
import { parseTranscriptText } from './src/utils/transcriptParser';

const textWithExcludedCourses = `
2024-2025 Güz Dönemi
Kodu Ders Adı Kredi AKTS Not
MAT101 Matematik I 3 5.0 AA
MFALM102 Excluded Course 1 3 4.0 BB
TTTT02 Excluded Course 2 2 3.0 CC
FIZ101 Fizik I 3 5.0 BA
`;

console.log("Testing Course Filtering...");
const records = parseTranscriptText(textWithExcludedCourses);
console.log("Parsed Records Codes:", records.map(r => r.courseCode));

const hasMFALM102 = records.some(r => r.courseCode === 'MFALM102');
const hasTTTT02 = records.some(r => r.courseCode === 'TTTT02');

if (hasMFALM102 || hasTTTT02) {
    console.error("FAIL: Excluded courses found in the output.");
    if (hasMFALM102) console.error(" - Found MFALM102");
    if (hasTTTT02) console.error(" - Found TTTT02");
} else {
    console.log("PASS: Excluded courses were successfully filtered out.");
}
