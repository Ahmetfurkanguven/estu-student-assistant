import type { Course } from '../types';
import type { DepartmentProfile } from '../types/department';
import type { TranscriptRecord } from './transcriptParser';
import type { SemesterSnapshot } from './gpaCalculator';
import { getGrade, isBelowCC, isLockedFromRetake } from '../data/gradeSystem';
import { compareSemesters } from './gpaCalculator';

/**
 * Ders tekrarı ve akademik yetersizlik — MADDE 19/5 ve MADDE 19/6.
 * (ESTÜ Ön Lisans ve Lisans Eğitim-Öğretim ve Sınav Yönetmeliği, RG 9/9/2025, 33012)
 *
 * Madde 19/6 TEK BİR DURUM DEĞİL, ÜÇ AŞAMALI bir süreç tanımlar:
 *
 *   normal → uyarı        : güz/bahar sonunda GNO < 2,00
 *   uyarı  → normal       : yaz okulunda VEYA takip eden dönemde GNO ≥ 2,00
 *   uyarı  → tekrar       : takip eden dönemde de GNO 2,00'ye çıkmazsa
 *   tekrar → normal       : tekrar ettiği dönem sonunda GNO ≥ 2,00
 *
 * Yükümlülük aşamaya göre değişir:
 *   uyarı  : yalnızca FF/YZ/DZ dersleri tekrar edilir.
 *   tekrar : FF/YZ/DZ derslerine EK OLARAK, uyarının alındığı dönemden itibaren
 *            harf notu CC'nin ALTINDA olan dersler de tekrar edilir.
 */

export const MIN_GNO = 2.0;

export type AcademicStage = 'normal' | 'uyari' | 'tekrar';

export interface AcademicStanding {
    stage: AcademicStage;
    /** En son dönem sonu itibarıyla GNO. */
    gno: number;
    /** Akademik yetersizlik uyarısının ilk alındığı dönem (CC altı kapsamının başlangıcı). */
    warningSemester: string | null;
    /** Değerlendirmeye esas son dönem. */
    lastSemester: string | null;
    /** Kullanıcıya gösterilecek, madde referanslı açıklama satırları. */
    explanation: string[];
    /** Aşamanın nasıl oluştuğunu dönem dönem gösteren iz. */
    timeline: Array<{ semester: string; gno: number; stage: AcademicStage; note: string }>;
}

/** Yaz okulu uyarı tetiklemez ama uyarıyı kaldırabilir (Madde 19/6). */
function isSummer(snapshot: SemesterSnapshot): boolean {
    return snapshot.key.term === 3;
}

function isGradedTerm(snapshot: SemesterSnapshot): boolean {
    return snapshot.key.term === 1 || snapshot.key.term === 2;
}

export function assessAcademicStanding(history: SemesterSnapshot[]): AcademicStanding {
    let stage: AcademicStage = 'normal';
    let warningSemester: string | null = null;
    const timeline: AcademicStanding['timeline'] = [];

    for (const snapshot of history) {
        if (snapshot.key.special) continue; // transfer/intibak dönemleri değerlendirilmez

        const meets = snapshot.gno >= MIN_GNO;

        if (isSummer(snapshot)) {
            if (meets && stage !== 'normal') {
                stage = 'normal';
                warningSemester = null;
                timeline.push({
                    semester: snapshot.label, gno: snapshot.gno, stage,
                    note: 'Yaz okulu sonunda GNO 2,00’ye ulaştı; akademik yetersizlik uyarısı kalktı.'
                });
            } else {
                timeline.push({
                    semester: snapshot.label, gno: snapshot.gno, stage,
                    note: 'Yaz okulu — uyarı tetiklemez.'
                });
            }
            continue;
        }

        if (!isGradedTerm(snapshot)) continue;

        if (meets) {
            const wasFlagged = stage !== 'normal';
            stage = 'normal';
            warningSemester = null;
            timeline.push({
                semester: snapshot.label, gno: snapshot.gno, stage,
                note: wasFlagged
                    ? 'GNO 2,00’ye ulaştı; ders tekrarı/uyarı sona erdi.'
                    : 'GNO 2,00 ve üzeri.'
            });
            continue;
        }

        if (stage === 'normal') {
            stage = 'uyari';
            warningSemester = snapshot.label;
            timeline.push({
                semester: snapshot.label, gno: snapshot.gno, stage,
                note: 'GNO 2,00’nin altında — akademik yetersizlik uyarısı verildi.'
            });
        } else if (stage === 'uyari') {
            stage = 'tekrar';
            timeline.push({
                semester: snapshot.label, gno: snapshot.gno, stage,
                note: 'Uyarı sonrası dönemde de GNO 2,00’ye çıkmadı — genişletilmiş ders tekrarı başladı.'
            });
        } else {
            timeline.push({
                semester: snapshot.label, gno: snapshot.gno, stage,
                note: 'Ders tekrarı devam ediyor.'
            });
        }
    }

    const last = [...history].reverse().find(s => !s.key.special) ?? null;
    const gno = last?.gno ?? 0;

    const explanation: string[] = [];
    if (stage === 'normal') {
        explanation.push(`GNO ${gno.toFixed(2)} — akademik yetersizlik durumu yok.`);
        explanation.push('Madde 19/5: zorunlu derslerden FF/YZ/DZ notunuz varsa bunları ders planındaki döneminde, yarıyılı en küçük olandan başlayarak tekrar almak zorundasınız.');
    } else if (stage === 'uyari') {
        explanation.push(`GNO ${gno.toFixed(2)} < 2,00 — akademik yetersizlik uyarısı (Madde 19/6).`);
        explanation.push('Bu aşamada yalnızca FF, YZ ve DZ notlu derslerinizi ders planında gösterilen güz/bahar döneminde tekrar almak zorundasınız.');
        explanation.push('CC altı dersleriniz bu aşamada tekrar kapsamında DEĞİLDİR.');
        explanation.push('Yaz okulunda veya takip eden dönemde GNO’nuzu 2,00’ye çıkarırsanız uyarı kalkar.');
    } else {
        explanation.push(`GNO ${gno.toFixed(2)} < 2,00 ve uyarı sonrası dönemde de düzelmedi — genişletilmiş ders tekrarı (Madde 19/6).`);
        explanation.push('FF, YZ ve DZ notlu derslerinize EK OLARAK, akademik yetersizlik uyarısını aldığınız dönemden itibaren harf notu CC’nin altında olan (CD, DC, DD) dersleri de tekrar etmek zorundasınız.');
        explanation.push('Tekrar, yarıyılı en küçük olan dersten başlayarak yapılır.');
        explanation.push('Tekrar ettiğiniz dönem sonunda GNO 2,00’ye ulaşırsa ders tekrarı sona erer.');
        if (warningSemester) {
            explanation.push(`CC altı tekrar kapsamının başlangıcı: ${warningSemester}.`);
        }
    }

    return { stage, gno, warningSemester, lastSemester: last?.label ?? null, explanation, timeline };
}

// ---------------------------------------------------------------------------
// Tekrar edilmesi gereken dersler
// ---------------------------------------------------------------------------

export type RetakeKind = 'basarisiz' | 'cc_alti';

export interface RetakeItem {
    courseCode: string;
    courseName: string;
    grade: string;
    semester: string;
    /** Dersin AKTS kredisi — ders yükü hesabı için (Madde 10/2). */
    ects: number;
    kind: RetakeKind;
    /** Ders planındaki yarıyıl — "yarıyılı en küçük olandan başlayarak" sıralaması için. */
    planSemester: number | null;
    /** Zorunlu ders mi (Madde 19/5 farklı davranır). */
    isMandatoryCourse: boolean;
    /** Seçmeli derslerde aynı statüde başka ders alma seçeneği var mı. */
    canSubstitute: boolean;
    reason: string;
    regulation: string;
}

function findCourse(profile: DepartmentProfile | null, code: string): Course | undefined {
    return profile?.courses.find(c => c.code.toUpperCase() === code.toUpperCase());
}

function isMandatory(record: TranscriptRecord, course: Course | undefined): boolean {
    if (course) return course.type === 'zorunlu';
    if (record.status) return record.status === 'zorunlu';
    return true; // bilinmiyorsa güvenli taraf: zorunlu varsay
}

export function determineRetakes(
    activeRecords: TranscriptRecord[],
    standing: AcademicStanding,
    profile: DepartmentProfile | null
): RetakeItem[] {
    const items: RetakeItem[] = [];

    for (const record of activeRecords) {
        const grade = getGrade(record.grade.letter);
        if (!grade) continue;

        // Madde 8/5 — AA veya YT alınan ders tekrar edilemez.
        if (isLockedFromRetake(record.grade.letter)) continue;

        const course = findCourse(profile, record.curriculumCode) ?? findCourse(profile, record.courseCode);
        const mandatory = isMandatory(record, course);
        const planSemester = course?.semester ?? null;

        // 1) FF / YZ / DZ — her aşamada tekrar zorunlu (Madde 19/5, 19/6).
        if (grade.mustRetake) {
            items.push({
                courseCode: record.courseCode,
                courseName: record.courseName || course?.name || record.courseCode,
                grade: record.grade.letter,
                semester: record.semester,
                ects: record.ects,
                kind: 'basarisiz',
                planSemester,
                isMandatoryCourse: mandatory,
                canSubstitute: !mandatory,
                reason: mandatory
                    ? `Zorunlu dersten ${record.grade.letter} — ders planındaki döneminde tekrar almak zorunludur.`
                    : `Seçmeli dersten ${record.grade.letter} — bu dersi tekrarlayabilir veya danışman onayıyla aynı statüde başka bir ders alabilirsiniz.`,
                regulation: 'Madde 19/5'
            });
            continue;
        }

        // 2) CC altı — YALNIZCA "tekrar" aşamasında ve uyarı döneminden itibaren.
        if (standing.stage !== 'tekrar') continue;
        if (!isBelowCC(record.grade.letter)) continue;
        if (standing.warningSemester &&
            compareSemesters(record.semester, standing.warningSemester) < 0) continue;

        items.push({
            courseCode: record.courseCode,
            courseName: record.courseName || course?.name || record.courseCode,
            grade: record.grade.letter,
            semester: record.semester,
            ects: record.ects,
            kind: 'cc_alti',
            planSemester,
            isMandatoryCourse: mandatory,
            canSubstitute: !mandatory,
            reason: `Harf notu CC’nin altında (${record.grade.letter}) ve akademik yetersizlik uyarısı ` +
                `aldığınız ${standing.warningSemester} döneminden sonra alınmış.`,
            regulation: 'Madde 19/6'
        });
    }

    // "yarıyılı en küçük olandan başlayarak" (Madde 19/5)
    return items.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'basarisiz' ? -1 : 1;
        const sa = a.planSemester ?? Number.MAX_SAFE_INTEGER;
        const sb = b.planSemester ?? Number.MAX_SAFE_INTEGER;
        if (sa !== sb) return sa - sb;
        return a.courseCode.localeCompare(b.courseCode, 'tr');
    });
}

// ---------------------------------------------------------------------------
// Ders yükü — Madde 10/2
// ---------------------------------------------------------------------------

export type TermType = 'guz' | 'bahar' | 'yaz';

export interface EctsLimitContext {
    term: TermType;
    /** Çift anadal programına kayıtlı mı. */
    doubleMajor?: boolean;
    /** Yaz okulu sonu itibarıyla mezuniyet aşamasında mı. */
    graduatingAfterSummer?: boolean;
}

/**
 * Madde 10/2 — dönem başına en çok alınabilecek AKTS.
 * "Bu kredilere, diğer yükseköğretim kurumlarından alınan dersin/derslerin
 * kredileri de dâhil edilir."
 */
export function getEctsLimit(ctx: EctsLimitContext): { limit: number; note: string } {
    if (ctx.term === 'yaz') {
        return ctx.graduatingAfterSummer
            ? { limit: 25, note: 'Yaz okulu sonu itibarıyla mezuniyet aşamasındaki öğrenci (Madde 10/2).' }
            : { limit: 20, note: 'Yaz okulu üst sınırı (Madde 10/2).' };
    }
    return ctx.doubleMajor
        ? { limit: 60, note: 'Çift anadal programına kayıtlı öğrenci (Madde 10/2).' }
        : { limit: 45, note: 'Güz/bahar yarıyılı üst sınırı (Madde 10/2).' };
}
