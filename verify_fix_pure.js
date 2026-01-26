
// Mock Data and Logic for Verification

const GRADE_SYSTEM = {
    AA: { coefficient: 4.0, passed: true },
    AB: { coefficient: 3.7, passed: true },
    BA: { coefficient: 3.3, passed: true },
    BB: { coefficient: 3.0, passed: true },
    BC: { coefficient: 2.7, passed: true },
    CB: { coefficient: 2.3, passed: true },
    CC: { coefficient: 2.0, passed: true },
    CD: { coefficient: 1.7, passed: true },
    DC: { coefficient: 1.3, passed: true },
    DD: { coefficient: 1.0, passed: true },
    FD: { coefficient: 0.5, passed: false },
    FF: { coefficient: 0.0, passed: false },
    YT: { coefficient: 0.0, passed: true },
    YZ: { coefficient: 0.0, passed: false },
    DZ: { coefficient: 0.0, passed: false }
};

function parseTranscriptText(text) {
    const records = [];
    const lines = text.split('\n');
    let currentSemester = '';

    for (const line of lines) {
        const trimmedLine = line.trim();
        // Period check
        if (/\d{4}-\d{4}\s+(GÜZ|BAHAR|YAZ)/i.test(trimmedLine)) {
            currentSemester = trimmedLine;
            continue;
        }

        // Regex for the new format
        const match = trimmedLine.match(/^([A-ZİĞÜŞÇÖ0-9]{2,})\s+(.+?)\s+(\d+(?:\.\d+)?)\s+([A-Z]{2})\s+(\d+(?:\.\d+)?)(?:\s+([A-Z]+))?(?:\s+(.*))?$/);

        if (match && currentSemester) {
            const [, code, name, ectsStr, gradeLetter, pointsStr, status, rest] = match;

            const ects = parseFloat(ectsStr);
            const credits = ects; // ESTU uses AKTS
            const gradeInfo = GRADE_SYSTEM[gradeLetter] || { coefficient: 0, passed: false };

            let countInGPA = true;
            // Exclusion logic:
            // 1. Check for replacement course in 'rest' (Course Code pattern)
            const hasReplacement = rest && /[A-ZİĞÜŞÇÖ]{2,}\d{3,}/.test(rest);

            // 2. Check explicitly for Status 'S' IF NEEDED (Removed for now based on reasoning, relying on replacement)
            // But wait, user said "Statü S". Let's check if 'status' is S and no replacement?
            // User explicitly mentioned "Yerine ders seçilmiş".
            // If I just check hasReplacement, it covers both user cases.

            if (hasReplacement) {
                countInGPA = false;
            }

            records.push({
                id: `${code}-${currentSemester}`,
                courseCode: code,
                courseName: name.trim(),
                semester: currentSemester,
                credits: credits,
                ects: ects,
                grade: {
                    letter: gradeLetter,
                    coefficient: gradeInfo.coefficient,
                    passed: gradeInfo.passed
                },
                countInGPA: countInGPA,
                status: status, // for debug
                rest: rest // for debug
            });
        }
    }
    return records;
}

function compareSemesters(sem1, sem2) {
    if (sem1 === 'Simülasyon') return 1;
    if (sem2 === 'Simülasyon') return -1;

    const match1 = sem1.match(/(\d{4})-(\d{4})\s+(Güz|Bahar|Yaz)/i);
    const match2 = sem2.match(/(\d{4})-(\d{4})\s+(Güz|Bahar|Yaz)/i);

    if (!match1 || !match2) return 0;

    const year1 = parseInt(match1[1]);
    const year2 = parseInt(match2[1]);

    if (year1 !== year2) return year1 - year2;

    const termOrder = { 'güz': 1, 'bahar': 2, 'yaz': 3 };
    const term1 = termOrder[match1[3].toLowerCase()] || 0;
    const term2 = termOrder[match2[3].toLowerCase()] || 0;

    return term1 - term2;
}

function calculateGPA(records) {
    const latestRecords = new Map();
    for (const record of records) {
        const existing = latestRecords.get(record.courseCode);
        if (!existing || compareSemesters(record.semester, existing.semester) > 0) {
            latestRecords.set(record.courseCode, record);
        }
    }

    let totalWeightedGrade = 0;
    let totalCredits = 0;

    for (const record of latestRecords.values()) {
        if (record.grade.letter !== 'YT' && record.countInGPA !== false) {
            const rawPoints = record.grade.coefficient * record.credits;
            const weighted = Math.round(rawPoints * 100) / 100;
            totalWeightedGrade += weighted;
            totalCredits += record.credits;
        }
    }

    const gno = totalCredits > 0 ? totalWeightedGrade / totalCredits : 0;
    return { gno, totalCredits };
}

// --- TEST EXECUTION ---

const mockTranscript = `
2022-2023 Yaz Okulu
EEM102 Introduction to Electrical Engineering 7.5 AB 27.75 Z
BEÖ155 Beden Eğitimi(Tür) 2.0 CB 4.60 S

2024-2025 Güz Dönemi
MFALM102 Mühendislik Almancası II(Alm) 4.0 FF 0.00 S FİZ237(Tür)
FİZ237 Bilim ve Yemek(Tür) 3.0 AA 12.00 S
TTTT02 Project(İng) D 20.0 FF 0.00 MS EEM403(İng)
EEM403 Fundamentals of Optoelectronics and Nanophotonics (Opto. ve(İng) 5.0 AA 20.00 MS
`;

console.log('Parsing...');
const records = parseTranscriptText(mockTranscript);

const mfalm = records.find(r => r.courseCode === 'MFALM102');
console.log(`MFALM102: Count=${mfalm?.countInGPA} (Expected: false), Credits=${mfalm?.credits}`);

const tttt02 = records.find(r => r.courseCode === 'TTTT02');
console.log(`TTTT02: Count=${tttt02?.countInGPA} (Expected: false), Credits=${tttt02?.credits}`);

const beo155 = records.find(r => r.courseCode === 'BEÖ155');
console.log(`BEÖ155: Count=${beo155?.countInGPA} (Expected: true), Status=${beo155?.status}`);

const fiz237 = records.find(r => r.courseCode === 'FİZ237');
console.log(`FİZ237: Count=${fiz237?.countInGPA} (Expected: true), Status=${fiz237?.status}`);

const res = calculateGPA(records);
console.log('GPA:', res.gno);
console.log('Total Credits:', res.totalCredits);

// Check assumptions
if (mfalm && !mfalm.countInGPA && tttt02 && !tttt02.countInGPA && beo155 && beo155.countInGPA) {
    console.log('VERIFICATION SUCCESSFUL');
} else {
    console.log('VERIFICATION FAILED');
    process.exit(1);
}
