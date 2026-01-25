
const GRADE_SYSTEM = {
    'AA': { coefficient: 4.0, passed: true },
    'AB': { coefficient: 3.7, passed: true },
    'BA': { coefficient: 3.3, passed: true },
    'BB': { coefficient: 3.0, passed: true },
    'BC': { coefficient: 2.7, passed: true },
    'CB': { coefficient: 2.3, passed: true },
    'CC': { coefficient: 2.0, passed: true },
    'CD': { coefficient: 1.7, passed: true },
    'DC': { coefficient: 1.3, passed: true },
    'DD': { coefficient: 1.0, passed: true },
    'FF': { coefficient: 0.0, passed: false },
    'VF': { coefficient: 0.0, passed: false },
    'S': { coefficient: 0.0, passed: true },   // Satisfactory (Yeterli) - Kredisiz
    'U': { coefficient: 0.0, passed: false },  // Unsatisfactory (Yetersiz) - Kredisiz
    'YT': { coefficient: 0.0, passed: true },  // Yeterli (GNO'ya katılmaz)
    'YZ': { coefficient: 0.0, passed: false }, // Yetersiz
    'MU': { coefficient: 0.0, passed: true },  // Muaf
    'IZ': { coefficient: 0.0, passed: false }, // İzinsiz
    'DZ': { coefficient: 0.0, passed: false }, // Devamsız
};

function parseTranscriptText(text) {
    const records = [];
    const lines = text.split('\n');
    let currentSemester = '';

    for (const line of lines) {
        // Dönem başlığı kontrolü
        if (/\d{4}-\d{4}\s+(GÜZ|BAHAR|YAZ)/i.test(line)) {
            currentSemester = line.trim();
            continue;
        }

        const match = line.match(/^([A-ZİĞÜŞÇÖ]{2,}[A-ZİĞÜŞÇÖ0-9]{3,})\s+(.+?)\s+((?:\d+(?:\.\d+)?\s+)+)([A-Z]{2})(.*)$/);

        if (match && currentSemester) {
            const [, code, name, numbersPart, gradeLetter, rest] = match;

            const numbers = numbersPart.trim().split(/\s+/).map(n => parseFloat(n));
            let ects = numbers.length > 0 ? numbers[numbers.length - 1] : 0;
            let credits = numbers.length > 1 ? Math.round(numbers[0]) : Math.round(ects);

            const gradeInfo = GRADE_SYSTEM[gradeLetter] || { coefficient: 0, passed: false };

            let equivalentCourse;

            // 1. Explicit
            const explicitMatch = rest.match(/Yerine-\d+\s*[:]?\s*([A-ZİĞÜŞÇÖ]{3}\d{3})/i);
            if (explicitMatch) {
                equivalentCourse = explicitMatch[1].trim();
            } else {
                // 2. Implicit
                const courseCodeMatches = [...rest.matchAll(/\b([A-ZİĞÜŞÇÖ]{3}\d{3})\b/g)];
                if (courseCodeMatches.length > 0) {
                    equivalentCourse = courseCodeMatches[courseCodeMatches.length - 1][1];
                }
            }

            records.push({
                courseCode: code,
                grade: gradeLetter,
                equivalentCourse: equivalentCourse,
                rest: rest
            });
        }
    }
    return records;
}

const problematicText = `
2024-2025 Güz Dönemi (Fontys University of Applied Science)
Kodu Ders Adı AKTS Kredisi Not Kredi* Not Statü Yerine-1 Yerine-2
TTT01 Knowledge(Ing) D 5.0 FF 0.00 S
TTT02 Project(Ing) D 20.0 FF 0.00 MS EEM403(Ing)
TTT03 Proffessional Attitude(Ing) D 5.0 FF 0.00 S
`;

console.log("Testing JS Parser...");
const records = parseTranscriptText(problematicText);
console.log(JSON.stringify(records, null, 2));
