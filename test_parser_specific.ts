
import { parseTranscriptText } from './src/utils/transcriptParser';

const testText = `
2024-2025 Güz Dönemi
TTT01 Knowledge(Ing) D 5.0 FF 0.00 S
TTT02 Project(Ing) D 20.0 FF 0.00 MS EEM403(Ing)
`;

console.log('--- Parsing Test ---');
const records = parseTranscriptText(testText);
console.log(JSON.stringify(records, null, 2));

const ttt02 = records.find(r => r.courseCode === 'TTT02');
if (ttt02) {
    console.log('\nTTT02 Analysis:');
    console.log('Detected Equivalent:', ttt02.equivalentCourse);
    if (ttt02.equivalentCourse === 'EEM403') {
        console.log('PASS: Parser correctly identified EEM403 substitution.');
    } else {
        console.error('FAIL: Parser missed the substitution!');
    }
} else {
    console.error('FAIL: Could not parse TTT02 line.');
}
