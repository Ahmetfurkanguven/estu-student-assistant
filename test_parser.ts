
import { parseTranscriptText } from './src/utils/transcriptParser';

const problematicText = `
2024-2025 Güz Dönemi (Fontys University of Applied Science)
Kodu Ders Adı AKTS Not Kredi* Statü Yerine-1 Yerine-2
TTT01 Knowledge(Ing) D 5.0 FF 0.00 S
TTT02 Project(Ing) D 20.0 FF 0.00 MS EEM403(Ing)
TTT03 Proffessional Attitude(Ing) D 5.0 FF 0.00 S
`;

console.log("Testing Parser...");
const records = parseTranscriptText(problematicText);
console.log("Parsed Records:", JSON.stringify(records, null, 2));

records.forEach(r => {
    if (r.courseCode === 'TTT02') {
        console.log(`CHECK TTT02 Equivalent: '${r.equivalentCourse}' (Expected 'EEM403')`);
    }
});
