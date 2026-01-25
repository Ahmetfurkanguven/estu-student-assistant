import { parseTranscriptText } from './src/utils/transcriptParser.js';
import { calculateGPA } from './src/utils/gpaCalculator.js';
const rawText = `
2023-2024 Bahar Dönemi
MFALM102 Mühendislik Almancası II(Alm) 4.0 DZ 0.00 S FİZ237(Tür)

2024-2025 Güz Dönemi (Fontys University of Applied Science)
TTTT01 Knowledge(İng) D 5.0 FF 0.00 S
TTTT02 Project(İng) D 20.0 FF 0.00 MS EEM403(İng)
TTTT03 Proffessional Attitude(İng) D 5.0 FF 0.00 S
`;
console.log("--- DEBUG START ---");
const records = parseTranscriptText(rawText);
console.log("\nPARSED RECORDS:");
records.forEach(r => {
    console.log(`Code: ${r.courseCode}, Equivalent: ${r.equivalentCourse}, Status: ${r.status}, Grade: ${r.grade.letter}`);
});
const result = calculateGPA(records);
console.log("\nGPA RESULT:");
console.log("Total Credits:", result.totalCredits);
console.log("Passed Credits:", result.passedCredits);
console.log("GPA:", result.gno);
console.log("Used Courses:", result.usedCourses.map(c => c.courseCode).join(", "));
console.log("Replaced Courses:", result.replacedCourses?.map(c => c.courseCode).join(", "));
