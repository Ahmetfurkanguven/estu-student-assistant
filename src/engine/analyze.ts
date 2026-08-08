import type { ScheduleOffering } from '../types';
import type { DepartmentProfile } from '../types/department';
import { parseTranscript, type ParsedTranscript, type TranscriptRecord, type TranscriptDiagnostic } from '../utils/transcriptParser';
import {
    resolveRecords, calculateGpa, buildSemesterHistory, applyIntibak,
    type GpaResult, type SemesterSnapshot, type SupersededRecord
} from '../utils/gpaCalculator';
import { assessAcademicStanding, determineRetakes, type AcademicStanding, type RetakeItem, type TermType } from '../utils/repeatRules';
import { generateCourseProposal, checkGraduationProjectEligibility, type ProposalResult } from '../utils/courseSelectionRules';
import { getGrade } from '../data/gradeSystem';

/**
 * Transkript metninden tüm akademik analizi tek adımda üretir.
 * App katmanı yalnızca bunu çağırır; kural bilgisi burada ve utils/ altında kalır.
 */

export interface GraduationCheck {
    eligible: boolean;
    earnedEcts: number;
    requiredEcts: number;
    missingEcts: number;
    gnoOk: boolean;
    blockingGrades: Array<{ courseCode: string; letter: string }>;
    reasons: string[];
}

export interface AcademicAnalysis {
    parsed: ParsedTranscript;
    /** GNO ve ilerlemede kullanılan nihai kayıtlar. */
    active: TranscriptRecord[];
    /** Tekrar/yerine nedeniyle düşen kayıtlar — gerekçeleriyle. */
    superseded: SupersededRecord[];
    gpa: GpaResult;
    history: SemesterSnapshot[];
    standing: AcademicStanding;
    retakes: RetakeItem[];
    graduation: GraduationCheck;
    graduationProject: ReturnType<typeof checkGraduationProjectEligibility>;
    diagnostics: TranscriptDiagnostic[];
}

export function analyzeTranscript(
    text: string,
    profile: DepartmentProfile | null,
    options: { applyIntibak?: boolean } = {}
): AcademicAnalysis {
    const parsed = parseTranscript(text);
    const intibak = options.applyIntibak !== false ? profile?.intibak ?? [] : [];

    const resolved = resolveRecords(parsed.records, { intibak });

    const gpa = calculateGpa(resolved.active);

    // Dönem geçmişi ÇÖZÜMLENMEMİŞ kayıtlardan kurulur.
    //
    // resolved.active'te bir dersin yalnızca EN SON alınışı vardır; bunu geçmişe
    // beslersek 2022'deki FF, 2024'teki tekrarıyla geriye dönük silinir ve o
    // dönemin DNO/GNO'su olduğundan yüksek çıkar. Madde 19/6 uyarısının HANGİ
    // dönemde verildiği buna bağlı olduğundan, uyarı dönemi ve dolayısıyla
    // "CC altı" tekrar kapsamı yanlış hesaplanır.
    //
    // buildSemesterHistory kümülatif GNO'yu her dönem için o güne kadarki
    // kayıtlarla kendi içinde yeniden çözümler; burada yalnızca intibak
    // uygulanmış ham liste verilir.
    const history = buildSemesterHistory(applyIntibak(parsed.records, intibak));
    const standing = assessAcademicStanding(history);
    const retakes = determineRetakes(resolved.active, standing, profile);

    const graduationProject = profile
        ? checkGraduationProjectEligibility(profile, resolved.active, gpa.earnedEcts)
        : { eligible: true, reasons: [], missingCourses: [] };

    return {
        parsed,
        active: resolved.active,
        superseded: resolved.superseded,
        gpa,
        history,
        standing,
        retakes,
        graduation: checkGraduation(resolved.active, gpa, profile),
        graduationProject,
        diagnostics: [...parsed.diagnostics, ...resolved.diagnostics]
    };
}

/**
 * Madde 25/1 — "en az 240 AKTS kredilik dersi başarıyla tamamlayan;
 * ÇK, DZ, EK, FF ve YZ harf notu olmayan, GNO'su en az 2,00 olan ... öğrenciye
 * ... diploması ile not durum belgesi verilir."
 */
export function checkGraduation(
    records: TranscriptRecord[],
    gpa: GpaResult,
    profile: DepartmentProfile | null
): GraduationCheck {
    const requiredEcts = profile?.totalEcts ?? 240;
    const gnoOk = gpa.gno >= 2.0;

    const blockingGrades = records
        .filter(r => getGrade(r.grade.letter)?.blocksGraduation)
        .map(r => ({ courseCode: r.courseCode, letter: r.grade.letter }));

    const missingEcts = Math.max(0, requiredEcts - gpa.earnedEcts);
    const reasons: string[] = [];

    if (missingEcts > 0) reasons.push(`${missingEcts.toFixed(1)} AKTS eksik (gereken ${requiredEcts}).`);
    if (!gnoOk) reasons.push(`GNO ${gpa.gno.toFixed(2)} < 2,00.`);
    if (blockingGrades.length) {
        const summary = blockingGrades.slice(0, 8).map(b => `${b.courseCode} (${b.letter})`).join(', ');
        reasons.push(
            `Mezuniyete engel not bulunan ${blockingGrades.length} ders var: ${summary}` +
            (blockingGrades.length > 8 ? ' …' : '') + '. (ÇK, DZ, EK, FF, YZ)'
        );
    }

    return {
        eligible: reasons.length === 0,
        earnedEcts: gpa.earnedEcts,
        requiredEcts,
        missingEcts,
        gnoOk,
        blockingGrades,
        reasons
    };
}

export interface ProposalInput {
    analysis: AcademicAnalysis;
    profile: DepartmentProfile;
    offerings: ScheduleOffering[];
    term: TermType;
    doubleMajor?: boolean;
    graduatingAfterSummer?: boolean;
}

export function buildProposal(input: ProposalInput): ProposalResult {
    return generateCourseProposal({
        profile: input.profile,
        records: input.analysis.active,
        standing: input.analysis.standing,
        offerings: input.offerings,
        term: input.term,
        doubleMajor: input.doubleMajor,
        graduatingAfterSummer: input.graduatingAfterSummer
    });
}
