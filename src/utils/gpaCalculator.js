import { normalizeCourseCode } from "./transcriptParser.js";
/**
 * GPA Calculator - Final Robust Version
 * Fixes:
 * - Placeholder substitution courses excluded (MFALM102, TTTT02 etc.)
 * - Parenthesis suffix codes like FİZ237(Tür), EEM403(İng) won't break matching
 * - Course codes are safely extracted even if parser produced noisy tokens
 * - "MS" status is NOT auto-excluded (EEM403 AA MS must count)
 * - Failed "S" courses excluded, passed "S" courses included
 * - Retake: best passed attempt wins
 */
// ===========================
// Grade Points (ESTÜ typical)
// ===========================
const gradePoints = {
    AA: 4.0,
    AB: 3.7,
    BA: 3.3,
    BB: 3.0,
    BC: 2.7,
    CB: 2.3,
    CC: 2.0,
    CD: 1.7,
    DC: 1.3,
    DD: 1.0,
    FD: 0.5, // Some systems include FD with 0.5
    FF: 0.0,
    DZ: 0.0,
    YZ: 0.0,
    // YT has no grade point (not numeric)
};
function hasGradePoint(letter) {
    const g = (letter || "").toUpperCase();
    return Object.prototype.hasOwnProperty.call(gradePoints, g);
}
function isFailedGrade(letter) {
    const g = (letter || "").toUpperCase();
    // We treat FF / DZ / YZ as failed
    return g === "FF" || g === "DZ" || g === "YZ";
}
/**
 * Extract a safe normalized course code from noisy text.
 * Examples:
 *  - "FİZ237(Tür)" -> "FİZ237"
 *  - "EEM403(İng)" -> "EEM403"
 *  - "TTTT02Project" -> "TTTT02"
 */
function safeCourseCode(raw) {
    const text = (raw || "").split("(")[0].toUpperCase();
    // find first "LETTERS+NUMBERS" pattern
    const m = text.match(/[A-ZÇĞİÖŞÜ]{2,8}\d{2,4}/);
    if (m?.[0])
        return m[0];
    // fallback to your existing normalizer
    return normalizeCourseCode(raw);
}
// FIX: Allow undefined input to prevent TS errors since StudentRecord.status is optional
function normalizeStatus(status) {
    return (status || "").trim().toUpperCase();
}
/**
 * Read substitution field from any possible naming used in codebase.
 * - equivalentCourse (expected)
 * - substitutedBy (new parser)
 * - replacementCourse (alt naming)
 */
function getSubstitutionTarget(c) {
    const eq = c.equivalentCourse ||
        c.substitutedBy ||
        c.replacementCourse ||
        "";
    return String(eq || "").trim();
}
/**
 * Determine whether course should be excluded from GPA.
 * Rules (robust):
 * - If substitution exists => placeholder excluded ALWAYS
 * - YT => excluded
 * - MUAF => excluded
 * - Status S + failed => excluded (but passed S included)
 * - TTTT placeholder failed => excluded
 * Notes:
 * - MS is NOT auto-excluded (EEM403 AA MS must count)
 */
function shouldExcludeFromGPA(c) {
    const code = safeCourseCode(c.courseCode);
    const grade = (c.grade?.letter || "").toUpperCase();
    const status = normalizeStatus(c.status);
    const sub = getSubstitutionTarget(c);
    // 1) Substitution placeholder always excluded
    if (sub.length > 0)
        return true;
    // 2) No-grade courses excluded
    if (grade === "YT")
        return true;
    // 3) Muaf excluded
    if (status === "MUAF")
        return true;
    // 4) Failed S excluded (passed S included)
    if (status === "S" && isFailedGrade(grade))
        return true;
    // 5) Extra safety: Erasmus placeholder TTTTxx failed excluded
    if (/^TTTT\d+$/i.test(code) && isFailedGrade(grade))
        return true;
    return false;
}
/**
 * Semester comparison to sort attempts chronologically if needed.
 * "2024-2025 Güz" > "2023-2024 Bahar"
 */
function compareSemesters(sem1, sem2) {
    if (sem1 === "Simülasyon")
        return 1;
    if (sem2 === "Simülasyon")
        return -1;
    const match1 = sem1.match(/(\d{4})-(\d{4})\s+(Güz|Bahar|Yaz)/i);
    const match2 = sem2.match(/(\d{4})-(\d{4})\s+(Güz|Bahar|Yaz)/i);
    if (!match1 || !match2)
        return 0;
    const year1 = parseInt(match1[1], 10);
    const year2 = parseInt(match2[1], 10);
    if (year1 !== year2)
        return year1 - year2;
    const termOrder = { güz: 1, bahar: 2, yaz: 3 };
    const t1 = termOrder[match1[3].toLowerCase()] || 0;
    const t2 = termOrder[match2[3].toLowerCase()] || 0;
    return t1 - t2;
}
/**
 * Choose best attempt for repeated course codes.
 * Spec wanted best passed attempt. If none passed, choose latest attempt.
 */
function chooseBestAttempt(attempts) {
    // passed attempts first (based on record flag)
    const passed = attempts.filter((a) => a.grade?.passed === true);
    if (passed.length > 0) {
        // Choose highest grade point among passed
        return passed.sort((a, b) => {
            const ga = (a.grade?.letter || "").toUpperCase();
            const gb = (b.grade?.letter || "").toUpperCase();
            return (gradePoints[gb] ?? 0) - (gradePoints[ga] ?? 0);
        })[0];
    }
    // if all failed -> choose latest semester attempt
    return attempts
        .slice()
        .sort((a, b) => compareSemesters(a.semester, b.semester))
        .pop();
}
export function calculateGPA(records) {
    // 1) Only take courses with numeric grade points (FF included, YT excluded)
    const eligible = records.filter((c) => hasGradePoint(c.grade?.letter || ""));
    // 2) Group by safe course code (robust)
    const byCode = new Map();
    for (const c of eligible) {
        const code = safeCourseCode(c.courseCode);
        if (!byCode.has(code))
            byCode.set(code, []);
        byCode.get(code).push(c);
    }
    // 3) Resolve retakes (best attempt)
    const resolvedAttempts = [];
    for (const [, attempts] of byCode.entries()) {
        resolvedAttempts.push(chooseBestAttempt(attempts));
    }
    // 4) Apply exclusion rules
    const included = [];
    const excluded = [];
    for (const c of resolvedAttempts) {
        if (shouldExcludeFromGPA(c))
            excluded.push(c);
        else
            included.push(c);
    }
    // 5) Calculate GPA
    let totalECTS = 0;
    let totalPoints = 0;
    let totalAttempted = 0;
    let passedCredits = 0;
    for (const c of included) {
        const grade = (c.grade?.letter || "").toUpperCase();
        const ects = Number(c.ects) || 0;
        const p = gradePoints[grade] ?? 0;
        totalECTS += ects;
        totalPoints += ects * p;
        totalAttempted += ects;
        if (c.grade?.passed)
            passedCredits += ects;
    }
    const rawGPA = totalECTS > 0 ? totalPoints / totalECTS : 0;
    // ✅ Debug prints (you can remove later)
    console.log("=== GPA DEBUG ===");
    console.log("TOTAL ECTS:", totalECTS, "TOTAL POINTS:", totalPoints, "GPA:", rawGPA);
    console.log("INCLUDED:", included.map((c) => [
        safeCourseCode(c.courseCode),
        (c.grade?.letter || "").toUpperCase(),
        c.ects,
        normalizeStatus(c.status),
        getSubstitutionTarget(c),
    ]));
    console.log("EXCLUDED:", excluded.map((c) => [
        safeCourseCode(c.courseCode),
        (c.grade?.letter || "").toUpperCase(),
        c.ects,
        normalizeStatus(c.status),
        getSubstitutionTarget(c),
    ]));
    return {
        gno: Math.round(rawGPA * 100) / 100,
        dno: rawGPA,
        totalCredits: totalECTS,
        passedCredits: passedCredits,
        totalECTS: totalECTS,
        totalAttempted: totalAttempted,
        usedCourses: included.sort((a, b) => compareSemesters(a.semester, b.semester)),
        replacedCourses: excluded,
    };
}
