import { ALL_COURSES } from '../data/courses';
/**
 * Checks if a course code exists in the offerings.
 */
function isOffered(code, offerings) {
    // Normalize codes (trim, upper) for comparison
    return offerings.some(o => o.courseCode.trim().toUpperCase() === code.trim().toUpperCase());
}
/**
 * Checks if prerequisites are met.
 */
function checkPrereqs(course, passedCourses) {
    if (!course.prerequisites || course.prerequisites.length === 0)
        return true;
    return course.prerequisites.every(p => passedCourses.has(p));
}
export function generateCourseProposal(records, offerings, gpa) {
    const logs = [];
    const proposal = [];
    const passedCourses = new Set(records.filter(r => r.grade.passed).map(r => r.courseCode));
    const failedCourses = records.filter(r => !r.grade.passed && r.grade.letter !== 'YT'); // FF, FD, YZ, DZ
    // Normalize GNO
    const currentGNO = gpa.gno;
    const isProbation = currentGNO < 2.00;
    if (isProbation) {
        logs.push(`⚠️ AKADEMİK YETERSİZLİK DURUMU TESPİT EDİLDİ (GNO: ${currentGNO.toFixed(2)} < 2.00)`);
        logs.push(`Yönetmelik Madde 19-6 uyarınca CC altı notlu dersleri tekrar etmeniz gerekebilir.`);
    }
    // 1. MUST RETAKE: Failed Courses (FF, YZ, DZ)
    // Madde 19-5: "Zorunlu derslerden FF, YZ veya DZ harf notu olan öğrenci, bu dersleri... tekrar almak zorundadır."
    // Priority: 1
    for (const record of failedCourses) {
        const courseDef = ALL_COURSES.find(c => c.code === record.courseCode);
        if (!courseDef)
            continue;
        if (isOffered(record.courseCode, offerings)) {
            // Check if already passed later (sometimes people fail then pass, data might have history)
            // The passedCourses set handles this if we populated it correctly from history
            if (!passedCourses.has(record.courseCode)) {
                proposal.push({
                    course: courseDef,
                    reason: `Zorunlu Tekrar (Not: ${record.grade.letter})`,
                    priority: 1,
                    isRepeat: true
                });
            }
        }
    }
    // 2. PROBATION RETAKE: Low Grades (< CC) if GNO < 2.00
    // Madde 19-6: "...CC'nin altında olan dersleri de tekrar etmek zorundadır."
    // Priority: 2 (High)
    if (isProbation) {
        const lowGradeCourses = records.filter(r => {
            // Grades below CC (2.0): DC (1.3), DD (1.0)
            // Note: FF is already handled above.
            return ['DC', 'DD'].includes(r.grade.letter);
        });
        for (const record of lowGradeCourses) {
            const courseDef = ALL_COURSES.find(c => c.code === record.courseCode);
            if (!courseDef)
                continue;
            if (isOffered(record.courseCode, offerings)) {
                // Prevent duplicates if logic overlaps
                if (!proposal.find(p => p.course.code === record.courseCode)) {
                    proposal.push({
                        course: courseDef,
                        reason: `Yetersizlik Nedeniyle Tekrar (Not: ${record.grade.letter})`,
                        priority: 2,
                        isRepeat: true
                    });
                }
            }
        }
    }
    // 3. REGULAR SEMESTER FLOW
    // Find the student's likely next semester.
    // Logic: Look at the highest semester where they have passed a mandatory course?
    // Or simpler: Look at active season of offerings + student's progress.
    // Let's assume user wants to take whatever is available for their level.
    // We will look for UNTAKEN courses that are OFFERED and PREREQUISITES MET.
    // Sort courses by semester to suggest lower terms first (Madde 19-5: "yarıyılı en küçük olandan başlayarak")
    const coursePool = [...ALL_COURSES].sort((a, b) => (a.semester || 0) - (b.semester || 0));
    for (const course of coursePool) {
        // Skip if already passed
        if (passedCourses.has(course.code))
            continue;
        // Skip if already proposed (as retake)
        if (proposal.find(p => p.course.code === course.code))
            continue;
        // SKIP IF NOT OFFERED
        // This is the critical filter requested. "İlk dönem zaten bitmiş... 2. dönemde alamaması gerekir"
        // If the uploaded schedule doesn't have Term 1 courses, they won't be offered here. perfect.
        if (!isOffered(course.code, offerings))
            continue;
        // CHECK PREREQUISITES
        // "ilk dönem alınan derslerin bazıları 2. dönem alınacak derslerin ön koşul dersi ise... alamaması gerekir"
        if (!checkPrereqs(course, passedCourses)) {
            logs.push(`🚫 ${course.code} n koşulu sağlanamadığı için eklenmedi.`);
            continue;
        }
        // Add as Standard Proposal
        // Mark priority based on Semester to encourage taking lower semesters first
        proposal.push({
            course: course,
            reason: `${course.semester}. Yarıyıl Dersi`,
            priority: 3,
            isRepeat: false
        });
    }
    // 4. LIMIT TO 45 ECTS (Madde 10-2)
    // Sort by Priority (1 > 2 > 3) then by Semester
    proposal.sort((a, b) => {
        if (a.priority !== b.priority)
            return a.priority - b.priority;
        return (a.course.semester || 0) - (b.course.semester || 0);
    });
    const finalProposal = [];
    let currentECTS = 0;
    const MAX_ECTS = 45;
    for (const p of proposal) {
        if (currentECTS + p.course.ects <= MAX_ECTS) {
            finalProposal.push(p);
            currentECTS += p.course.ects;
        }
        else {
            logs.push(`⚠️ ${p.course.code} AKTS limiti (${MAX_ECTS}) nedeniyle ekleneşemedi.`);
        }
    }
    return {
        proposal: finalProposal,
        totalECTS: currentECTS,
        logs
    };
}
