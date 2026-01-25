
import { parseTranscriptText } from './src/utils/transcriptParser';
import { calculateGPA } from './src/utils/gpaCalculator';

const transcriptLines = [
    // Previous fail
    "MFALM102   Mühendislik Almancası II(Alm)   4.0   FF   0.00   S",
    // Retake with substitution
    "MFALM102   Mühendislik Almancası II(Alm)   4.0   DZ   0.00   S   FİZ237(Tür)",
    // The replacement course (taken later)
    "FİZ237   Bilim ve Yemek(Tür)   3.0   AA   12.00   S",

    // Erasmus case
    "TTTT02   Project(İng)   D 20.0   FF   0.00   MS   EEM403(İng)",
    "EEM403   Fundamentals of Optoelectronics and Nanophotonics (Opto. ve(İng)   5.0   AA   20.00   MS"
].join('\n');

console.log("--- PARSING ---");
const records = parseTranscriptText(transcriptLines);
records.forEach(r => {
    console.log(`Code: '${r.courseCode}', Grade: '${r.grade.letter}', Eq: '${r.equivalentCourse}'`);
});

console.log("\n--- CALCULATING GPA ---");
const result = calculateGPA(records);
console.log("Used Courses:", result.usedCourses.map(r => r.courseCode).join(", "));
console.log("Replaced Courses:", result.replacedCourses?.map(r => r.courseCode).join(", "));
