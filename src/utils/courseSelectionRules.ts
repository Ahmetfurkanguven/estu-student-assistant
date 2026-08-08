import type { Course, ScheduleOffering } from '../types';
import type { DepartmentProfile } from '../types/department';
import type { TranscriptRecord } from './transcriptParser';
import type { AcademicStanding, RetakeItem, TermType } from './repeatRules';
import { determineRetakes, getEctsLimit } from './repeatRules';
import { isLockedFromRetake } from '../data/gradeSystem';
import { recordCodes } from './gpaCalculator';

/**
 * Ders önerisi üretimi — ESTÜ Ön Lisans ve Lisans Eğitim-Öğretim ve Sınav
 * Yönetmeliği (RG 9/9/2025, 33012).
 *
 * Uygulanan hükümler:
 *   Madde  8/4 — ön koşul: bağlantılı dersin EN AZ BİR KEZ ALINMIŞ olması yeterli
 *                (geçmiş olma şartı yoktur), bitirme projesi koşulu
 *   Madde  8/5 — AA/YT alınan ders tekrar edilemez, yerine ders alınamaz
 *   Madde 10/2 — dönem başına AKTS üst sınırı
 *   Madde 19/5 — FF/YZ/DZ tekrarı, yarıyılı en küçük olandan başlayarak
 *   Madde 19/6 — akademik yetersizlik aşamalarına göre genişleyen tekrar
 */

export type ProposalPriority = 1 | 2 | 3;

export interface ProposedCourse {
    course: Course;
    reason: string;
    regulation: string;
    /** 1: zorunlu tekrar · 2: yetersizlik tekrarı · 3: normal akış */
    priority: ProposalPriority;
    isRepeat: boolean;
    /** Seçmelide danışman onayıyla aynı statüde başka ders alınabilir mi. */
    canSubstitute: boolean;
}

export interface ProposalContext {
    profile: DepartmentProfile;
    records: TranscriptRecord[];
    standing: AcademicStanding;
    offerings: ScheduleOffering[];
    term: TermType;
    doubleMajor?: boolean;
    graduatingAfterSummer?: boolean;
    /** Ders programı yüklenmediyse "açılmayan dersi önerme" filtresi uygulanmaz. */
    requireOffering?: boolean;
}

export interface ProposalResult {
    proposal: ProposedCourse[];
    /** AKTS sınırına takıldığı için listeye giremeyen dersler. */
    deferred: ProposedCourse[];
    totalEcts: number;
    ectsLimit: number;
    ectsLimitNote: string;
    retakes: RetakeItem[];
    logs: string[];
}

function normalize(code: string): string {
    return code.trim().toUpperCase();
}

function isOffered(code: string, offerings: ScheduleOffering[]): boolean {
    return offerings.some(o => normalize(o.courseCode) === normalize(code));
}

/**
 * Madde 8/4 — "bir dersin ön koşulunun yerine getirilebilmesi için o dersle
 * bağlantılı dersin/derslerin EN AZ BİR KEZ ALINMASI ve derse/derslere devam
 * koşulunun yerine getirilmiş olması gerekir."
 *
 * Yani ön koşul dersinden GEÇMİŞ olmak şart değildir; alınmış ve devamsız
 * (DZ) kalınmamış olması yeterlidir.
 */
export function checkPrerequisites(
    course: Course,
    records: TranscriptRecord[]
): { satisfied: boolean; missing: string[]; attendanceFailed: string[] } {
    if (!course.prerequisites?.length) {
        return { satisfied: true, missing: [], attendanceFailed: [] };
    }

    const missing: string[] = [];
    const attendanceFailed: string[] = [];

    for (const prereq of course.prerequisites) {
        const attempts = records.filter(r => recordCodes(r).includes(normalize(prereq)));
        if (attempts.length === 0) {
            missing.push(prereq);
            continue;
        }
        // Devam koşulu: DZ dışında en az bir kayıt olmalı.
        if (!attempts.some(a => a.grade.letter !== 'DZ')) {
            attendanceFailed.push(prereq);
        }
    }

    return {
        satisfied: missing.length === 0 && attendanceFailed.length === 0,
        missing,
        attendanceFailed
    };
}

/**
 * Madde 8/4 — bitirme ödevi/projesi ve benzeri dersler için:
 * ilk dört yarıyıldaki TÜM zorunlu dersleri başarmış VEYA en az 180 AKTS
 * (profilde `minEctsAlternative`) başarmış olmak.
 */
export function checkGraduationProjectEligibility(
    profile: DepartmentProfile,
    records: TranscriptRecord[],
    earnedEcts: number
): { eligible: boolean; reasons: string[]; missingCourses: string[] } {
    const config = profile.graduationProject;
    if (!config) return { eligible: true, reasons: [], missingCourses: [] };

    const passed = new Set(records.filter(r => r.grade.passed).flatMap(recordCodes));

    const firstFour = profile.courses
        .filter(c => c.type === 'zorunlu' && c.semester != null && c.semester <= 4)
        .map(c => c.code);
    const missingCourses = firstFour.filter(code => !passed.has(normalize(code)));

    const byCourses = missingCourses.length === 0;
    const byEcts = earnedEcts >= config.minEctsAlternative;

    if (byCourses || byEcts) {
        return { eligible: true, reasons: [], missingCourses };
    }

    return {
        eligible: false,
        missingCourses,
        reasons: [
            `${config.codes.join('/')} dersleri için Madde 8/4’teki iki koşuldan en az biri sağlanmalıdır:`,
            `1) İlk dört yarıyılın tüm zorunlu derslerini başarmak — eksik: ${missingCourses.length} ders`,
            `2) En az ${config.minEctsAlternative} AKTS başarmak — mevcut: ${earnedEcts.toFixed(1)} AKTS`
        ]
    };
}

export function generateCourseProposal(ctx: ProposalContext): ProposalResult {
    const { profile, records, standing, offerings, term } = ctx;
    const requireOffering = ctx.requireOffering ?? offerings.length > 0;
    const logs: string[] = [];

    const { limit: ectsLimit, note: ectsLimitNote } = getEctsLimit({
        term,
        doubleMajor: ctx.doubleMajor,
        graduatingAfterSummer: ctx.graduatingAfterSummer
    });

    const retakes = determineRetakes(records, standing, profile);
    const passed = new Set(records.filter(r => r.grade.passed).flatMap(recordCodes));
    const earnedEcts = records.filter(r => r.grade.passed).reduce((sum, r) => sum + r.ects, 0);

    logs.push(...standing.explanation.map(line => `📘 ${line}`));

    const candidates: ProposedCourse[] = [];
    const seen = new Set<string>();

    const courseByCode = new Map(profile.courses.map(c => [normalize(c.code), c]));

    const push = (course: Course, entry: Omit<ProposedCourse, 'course'>) => {
        const key = normalize(course.code);
        if (seen.has(key)) return;
        seen.add(key);
        candidates.push({ course, ...entry });
    };

    // --- 1 & 2) Tekrar edilmesi gereken dersler --------------------------------
    for (const item of retakes) {
        const course = courseByCode.get(normalize(item.courseCode));
        if (!course) {
            logs.push(`⚠️ ${item.courseCode} tekrar edilmeli ama bölüm profilinde tanımlı değil; ders planına ekleyin.`);
            continue;
        }
        if (requireOffering && !isOffered(course.code, offerings)) {
            logs.push(`ℹ️ ${course.code} tekrar kapsamında ama bu dönem programda açılmamış görünüyor. ` +
                'Madde 19/5 uyarınca kendi dönemi dışında açılırsa talep ederek alabilirsiniz.');
            continue;
        }
        push(course, {
            reason: item.reason,
            regulation: item.regulation,
            priority: item.kind === 'basarisiz' ? 1 : 2,
            isRepeat: true,
            canSubstitute: item.canSubstitute
        });
    }

    // --- 3) Normal akış -------------------------------------------------------
    const projectCodes = new Set((profile.graduationProject?.codes ?? []).map(normalize));
    const projectCheck = checkGraduationProjectEligibility(profile, records, earnedEcts);

    const pool = [...profile.courses].sort(
        (a, b) => (a.semester ?? Number.MAX_SAFE_INTEGER) - (b.semester ?? Number.MAX_SAFE_INTEGER)
    );

    for (const course of pool) {
        const key = normalize(course.code);
        if (seen.has(key)) continue;
        if (passed.has(key)) continue;

        // Madde 8/5 — AA/YT alınmış ders yeniden alınamaz.
        const existing = records.find(r => recordCodes(r).includes(key));
        if (existing && isLockedFromRetake(existing.grade.letter)) continue;

        if (requireOffering && !isOffered(course.code, offerings)) continue;

        if (projectCodes.has(key) && !projectCheck.eligible) {
            logs.push(`🚫 ${course.code}: ${projectCheck.reasons[0]}`);
            continue;
        }

        const prereq = checkPrerequisites(course, records);
        if (!prereq.satisfied) {
            if (prereq.missing.length) {
                logs.push(`🚫 ${course.code}: ön koşul dersi hiç alınmamış — ${prereq.missing.join(', ')} (Madde 8/4)`);
            }
            if (prereq.attendanceFailed.length) {
                logs.push(`🚫 ${course.code}: ön koşul dersinde devam koşulu sağlanmamış (DZ) — ${prereq.attendanceFailed.join(', ')} (Madde 8/4)`);
            }
            continue;
        }

        push(course, {
            reason: course.semester ? `${course.semester}. yarıyıl dersi` : 'Ders planı dersi',
            regulation: 'Ders planı',
            priority: 3,
            isRepeat: false,
            canSubstitute: course.type !== 'zorunlu'
        });
    }

    // --- AKTS sınırı (Madde 10/2) --------------------------------------------
    candidates.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        const sa = a.course.semester ?? Number.MAX_SAFE_INTEGER;
        const sb = b.course.semester ?? Number.MAX_SAFE_INTEGER;
        if (sa !== sb) return sa - sb;
        return a.course.code.localeCompare(b.course.code, 'tr');
    });

    const proposal: ProposedCourse[] = [];
    const deferred: ProposedCourse[] = [];
    let totalEcts = 0;

    for (const candidate of candidates) {
        if (totalEcts + candidate.course.ects <= ectsLimit) {
            proposal.push(candidate);
            totalEcts += candidate.course.ects;
        } else {
            deferred.push(candidate);
        }
    }

    if (deferred.length) {
        logs.push(`⚠️ ${deferred.length} ders ${ectsLimit} AKTS sınırına sığmadı. ${ectsLimitNote}`);
    }
    if (requireOffering) {
        logs.push('ℹ️ Öneriler yüklenen ders programında açılan derslerle sınırlandı.');
    } else {
        logs.push('ℹ️ Ders programı yüklenmediği için "bu dönem açılmayan ders" filtresi uygulanmadı.');
    }

    return { proposal, deferred, totalEcts, ectsLimit, ectsLimitNote, retakes, logs };
}
