
import { StudentRecord } from '../types';
import { SPECIALIZATION_GROUPS, SpecializationGroupDefinition, SpecializationCourse } from '../data/specializationGroups';
import { ALL_COURSES } from '../data/courses'; // Assuming ALL_COURSES is moved to data/courses in a real scenario, but accessing from App context might be better. 
// However, since App.tsx has ALL_COURSES locally (or if it imports), we'll define helper logic here.

/**
 * Checks if a specific course prerequisite is met.
 */
export function checkPrerequisiteStatus(
    prerequisiteCode: string | null,
    passedCourses: Set<string>
): { met: boolean; missing?: string } {
    if (!prerequisiteCode) return { met: true };
    const met = passedCourses.has(prerequisiteCode);
    return { met, missing: met ? undefined : prerequisiteCode };
}

/**
 * Determines the next active semester season based on the latest record.
 * Default to 'Güz' if no records found.
 */
function getNextTermSeason(records: StudentRecord[]): 'Güz' | 'Bahar' {
    if (records.length === 0) return 'Güz';

    // 1. Find the latest semester string using a simple sort
    // Format: "YYYY-YYYY GÜZ" or "YYYY-YYYY BAHAR"
    const uniqueSemesters = Array.from(new Set(records.map(r => r.semester)))
        .filter(s => s !== 'Simülasyon');

    if (uniqueSemesters.length === 0) return 'Güz';

    // Simple custom sort
    uniqueSemesters.sort((a, b) => {
        const matchA = a.match(/(\d{4})-(\d{4})\s+(Güz|Bahar|Yaz)/i);
        const matchB = b.match(/(\d{4})-(\d{4})\s+(Güz|Bahar|Yaz)/i);
        if (!matchA || !matchB) return a.localeCompare(b);

        const yearA = parseInt(matchA[1]);
        const yearB = parseInt(matchB[1]);
        if (yearA !== yearB) return yearA - yearB;

        const termOrder: Record<string, number> = { 'güz': 1, 'bahar': 2, 'yaz': 3 };
        const termA = termOrder[matchA[3].toLowerCase()] || 0;
        const termB = termOrder[matchB[3].toLowerCase()] || 0;
        return termA - termB;
    });

    const lastSemester = uniqueSemesters[uniqueSemesters.length - 1];

    // If last normalized semester contains 'Güz', next is 'Bahar'
    if (/Güz/i.test(lastSemester)) return 'Bahar';

    // If last is 'Bahar' or 'Yaz', next is 'Güz' (of the next year)
    return 'Güz';
}

/**
 * Result of analyzing a single specialization group for a student.
 */
export interface GroupAnalysisResult {
    group: SpecializationGroupDefinition;
    takenCount: number;
    mandatoryMissing: string[]; // Codes of missing mandatory courses
    coursesStatus: {
        course: SpecializationCourse;
        status: 'taken' | 'available' | 'locked' | 'wrong_term';
        missingPrereq?: string;
    }[];
    isQualified: boolean; // Has >= 5 taken AND mandatoryMissing is empty
}

/**
 * Analyzes all specialization groups for the student.
 */
export function analyzeSpecializations(records: StudentRecord[]): {
    totalTechnicalElectives: number;
    groups: GroupAnalysisResult[];
    bestGroup: string | null;
    activeSeason: 'Güz' | 'Bahar';
} {
    // 1. Identify passed courses
    const passedCourses = new Set(records.filter(r => r.grade.passed).map(r => r.courseCode));

    // 2. Count Total Technical Electives (Taking from records that match any course in ANY group)
    // Note: We need to be careful not to double count if a course appears in multiple groups? 
    // Usually courses are unique to groups or if shared, we should count unique codes.
    // The image implies mapped lists. Let's assume unique codes for simplicity or use a Set of unique elective codes found in records.

    // Collect all specialization course codes first to filter records
    const allSpecCodes = new Set<string>();
    SPECIALIZATION_GROUPS.forEach(g => g.courses.forEach(c => allSpecCodes.add(c.code)));

    const takenElectives = records.filter(r => r.grade.passed && allSpecCodes.has(r.courseCode));
    // Ensure uniqueness by code
    const uniqueTakenElectives = new Set(takenElectives.map(r => r.courseCode));
    const totalTechnicalElectives = uniqueTakenElectives.size;

    // 3. Determine active season
    const activeSeason = getNextTermSeason(records);

    // 4. Analyze each group
    const groups = SPECIALIZATION_GROUPS.map(group => {
        let takenCount = 0;
        const mandatoryMissing: string[] = [];
        const coursesStatus = group.courses.map(course => {
            const isTaken = passedCourses.has(course.code);
            if (isTaken) {
                takenCount++;
                return { course, status: 'taken' as const };
            } else {
                if (course.isMandatory) mandatoryMissing.push(course.code);

                // Prerequisite Check
                const prereqCheck = checkPrerequisiteStatus(course.prerequisite, passedCourses);

                if (!prereqCheck.met) {
                    return { course, status: 'locked' as const, missingPrereq: prereqCheck.missing };
                }

                // Season Check (Only if not taken and prerequisites met)
                // If the course term does NOT match the active season, user can't take it now along with current selection
                if (course.term !== activeSeason) {
                    return { course, status: 'wrong_term' as const };
                }

                return { course, status: 'available' as const };
            }
        });

        // Qualification rule: >= 5 courses passed within this group AND all mandatory courses passed
        const isQualified = takenCount >= 5 && mandatoryMissing.length === 0;

        return {
            group,
            takenCount,
            mandatoryMissing,
            coursesStatus,
            isQualified
        };
    });

    // 5. Determine 'Best' group (e.g. if qualified, or most progress)
    // Prioritize qualified groups, then by progress percentage
    const sortedGroups = [...groups].sort((a, b) => {
        if (a.isQualified && !b.isQualified) return -1;
        if (!a.isQualified && b.isQualified) return 1;
        return b.takenCount - a.takenCount;
    });

    const bestGroup = sortedGroups.length > 0 && sortedGroups[0].takenCount > 0 ? sortedGroups[0].group.id : null;

    return {
        totalTechnicalElectives,
        groups,
        bestGroup,
        activeSeason
    };
}
