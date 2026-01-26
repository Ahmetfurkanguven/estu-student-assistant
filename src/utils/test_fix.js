import { parseTranscriptText } from './transcriptParser';
import { calculateGPA } from './gpaCalculator';
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
console.log('--- Parsing Transcript ---');
const records = parseTranscriptText(mockTranscript);
console.log(`Parsed ${records.length} records.`);
records.forEach(r => {
    console.log(`Code: ${r.courseCode}, Credits: ${r.credits}, Grade: ${r.grade.letter}, Status: ${r.countInGPA ? 'Included' : 'EXCLUDED'}`);
});
console.log('\n--- Checking Specific Cases ---');
const mfalm = records.find(r => r.courseCode === 'MFALM102');
if (mfalm) {
    console.log(`MFALM102 (Should be EXCLUDED): ${!mfalm.countInGPA ? 'PASS' : 'FAIL'} (Credits: ${mfalm.credits})`);
}
else {
    console.log('MFALM102 Not found');
}
const tttt02 = records.find(r => r.courseCode === 'TTTT02');
if (tttt02) {
    console.log(`TTTT02 (Should be EXCLUDED): ${!tttt02.countInGPA ? 'PASS' : 'FAIL'} (Credits: ${tttt02.credits})`);
}
else {
    console.log('TTTT02 Not found');
}
const beo155 = records.find(r => r.courseCode === 'BEÖ155');
if (beo155) {
    // BEÖ155 is a normal elective (S status), should be INCLUDED
    console.log(`BEÖ155 (Normal Elective S - Should be INCLUDED): ${beo155.countInGPA ? 'PASS' : 'FAIL'}`);
}
else {
    console.log('BEÖ155 Not found');
}
const gpaResult = calculateGPA(records);
console.log('\n--- GPA Result ---');
console.log(`GNO: ${gpaResult.gno}`);
console.log(`Total Credits: ${gpaResult.totalCredits}`); // Should exclude excluded courses
