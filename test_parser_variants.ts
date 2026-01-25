
import { parseTranscriptText } from './src/utils/transcriptParser';

const testText = `
2023-2024 Güz Dönemi
ERAS101 Erasmus Project 20.0 FF 0.00 Z

2024-2025 Bahar Dönemi
NEW101 New Course 5.0 MS 0.00 MS Yerine: ERAS101
NEW102 Other Course 3.0 AA 12.00 Z Yerine-1: OLD101
NEW103 Last Course 3.0 AA 12.00 Z Yerine 2: OLD102
`;

console.log('--- Parser Regex Robustness Test ---');
const records = parseTranscriptText(testText);

const new101 = records.find(r => r.courseCode === 'NEW101');
const new102 = records.find(r => r.courseCode === 'NEW102');
const new103 = records.find(r => r.courseCode === 'NEW103');

console.log('NEW101 Equivalent:', new101?.equivalentCourse);
console.log('NEW102 Equivalent:', new102?.equivalentCourse);
console.log('NEW103 Equivalent:', new103?.equivalentCourse);

if (new101?.equivalentCourse === 'ERAS101') console.log('PASS: "Yerine: KOD" detected');
else console.error('FAIL: "Yerine: KOD" missed');

if (new102?.equivalentCourse === 'OLD101') console.log('PASS: "Yerine-1: KOD" detected');
else console.error('FAIL: "Yerine-1: KOD" missed');

if (new103?.equivalentCourse === 'OLD102') console.log('PASS: "Yerine 2: KOD" detected');
else console.error('FAIL: "Yerine 2: KOD" missed');
