
import { calculateGPA } from './src/utils/gpaCalculator';
import { GRADE_SYSTEM } from './src/data/rules';

// Mock types locally to avoid complex imports if not needed, or just use `any` for simplicity in script
const mockRecords = [
    // 1. Semester: Took Erasmus Project (20 credits), Failed (FF)
    {
        id: '1',
        courseCode: 'ERASMUS20',
        courseName: 'Erasmus Project',
        semester: '2023-2024 Güz Dönemi',
        credits: 20,
        ects: 20,
        grade: { letter: 'FF', coefficient: 0, passed: false },
        equivalentCourse: undefined // Initially, maybe no link? Or maybe linked but different credits?
    },
    // 2. Semester: Took Equivalent Course (5 credits), Passed (MS/Exempt)
    // The user said: "20 kredilik erasmus projem yerine 5 kredi MS aldım"
    // "sistem 20 krediyi silip 5 kredi ekliyor ancak senin yazılımın sanırım 20 kredi FF'i de saymış"
    {
        id: '2',
        courseCode: 'MSCOURSE5',
        courseName: 'Equivalent Course',
        semester: '2023-2024 Bahar Dönemi',
        credits: 5,
        ects: 5,
        grade: { letter: 'MS', coefficient: 0, passed: true }, // MS is usually 0 coeff, passed=true
        equivalentCourse: 'ERASMUS20' // Explicitly saying it replaces ERASMUS20
    }
];

console.log('--- TEST CASE 1: Explicit Replacement Link ---');
const result1 = calculateGPA(mockRecords);
console.log('Result 1:', result1);

// EXPECTATION:
// The 20 credit FF should be REPLACED by the 5 credit MS.
// GPA Calculation:
// Total Credits should be 0 (because MS is exempt/not included in GPA).
// Weighted Grade should be 0.
// GPA should be NaN or 0 (if handled).
// IF BUGGY:
// Total Credits might be 20.
// Weighted Grade 0.
// GPA 0.00 (because FF affects it).

if (result1.totalCredits === 20) {
    console.error('FAIL: 20 credit course still counts towards GPA credits!');
} else {
    console.log('PASS: 20 credit course removed correctly.');
}

console.log('\n--- TEST CASE 2: Implicit/Missing Replacement Link (Simulating Parser Failure) ---');
const mockRecordsFailure = [
    {
        id: '1',
        courseCode: 'ERASMUS20',
        courseName: 'Erasmus Project',
        semester: '2023-2024 Güz Dönemi',
        credits: 20,
        ects: 20,
        grade: { letter: 'FF', coefficient: 0, passed: false },
        equivalentCourse: undefined
    },
    {
        id: '2',
        courseCode: 'MSCOURSE5',
        courseName: 'Equivalent Course',
        semester: '2023-2024 Bahar Dönemi',
        credits: 5,
        ects: 5,
        grade: { letter: 'MS', coefficient: 0, passed: true },
        equivalentCourse: undefined // Parser failed to find "Yerine: ERASMUS20"
    }
];

const result2 = calculateGPA(mockRecordsFailure);
console.log('Result 2:', result2);

if (result2.totalCredits === 20) {
    console.log('reproduced: Parser failure leads to 20 credit inclusion.');
}

