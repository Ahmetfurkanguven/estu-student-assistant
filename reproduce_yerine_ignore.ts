
import { parseTranscriptAdvanced } from './src/utils/transcriptParserTestCopy'; // Will need to copy the function to a temp file or mock it

// Mocking the function here to simulate the fix logic before applying
function parseTranscriptAdvancedMock(text: string) {
    const records = [];
    const lines = text.split('\n');
    let currentSemester = '';

    for (const line of lines) {
        if (/^\d{4}-\d{4}/.test(line)) {
            currentSemester = line.trim();
            continue;
        }

        const codeMatch = line.match(/^([A-ZİĞÜŞÇÖ]{2,}[A-ZİĞÜŞÇÖ0-9]{3,})\s+/);
        if (codeMatch && currentSemester) {
            const code = codeMatch[1];
            const parts = line.split(/\s{2,}|\t+/).filter(p => p.trim());

            // --- PROPOSED FIX LOGIC ---
            // Code Name AKTS Grade Credits Status Yerine1 Yerine2
            // 0    1    2    3     4       5      6       7
            // If parts length > 6 and part[6] is valid content (course code or text), ignore row.

            // Check for Yerine-1 (index 6 typically if Points column exists, or check relative to end)
            // Let's print parts to match strict indices
            // console.log("Parts:", parts);

            // Standard layout with all columns populated:
            // 0: Code, 1: Name, 2: AKTS, 3: Grade, 4: Points, 5: Status, 6: Yerine-1, 7: Yerine-2

            // Sometimes Points (Kredi*Not) might be missing or merged? 
            // Better heuristic: if the last element or second to last element looks like a course code (and isn't the status Z/S), it's a replacement.

            const lastPart = parts[parts.length - 1];
            const secondLastPart = parts[parts.length - 2];

            const isCourseCode = (s) => /^[A-Z]{3,}\d{3,}/.test(s) || /^[A-Z]{3,}\d{3,}\(/.test(s);

            // If the line has 'Yerine' data, we assume it's at the end.
            // If parts.length > 6 (Code, Name, AKTS, Grade, Points, Status -> 6 items minimum for a full row without replacement)
            // Actually, Points is optional in some logic, but usually present.

            // Let's use the explicit indices if possible, or search for replacement pattern
            // "Yerine-1" is usually column 6 or 7.

            // If parts has more than 6 elements, and the items after index 5 aren't just empty/whitespace (already trimmed)
            // AND they definitely look like replacement info (e.g. course codes)

            const potentialYerine1 = parts[6]; // Index 6
            const potentialYerine2 = parts[7]; // Index 7 (if exists)

            if (potentialYerine1 && potentialYerine1.length > 2 && potentialYerine1 !== 'Z' && potentialYerine1 !== 'S') {
                console.log(`[IGNORED] Row with Yerine-1: ${code} - Found: ${potentialYerine1}`);
                continue;
            }
            if (potentialYerine2 && potentialYerine2.length > 2) {
                console.log(`[IGNORED] Row with Yerine-2: ${code} - Found: ${potentialYerine2}`);
                continue;
            }

            // --- END FIX LOGIC ---

            records.push({ code }); // Simplified for test
        }
    }
    return records;
}

const testText = `
2024-2025 Güz
TTTT02 Project(Ing) 20.0 FF 0.00 MS EEM403(Ing)
MAT101 Matematik 5.0 AA 20.00 Z
`;

console.log("Testing Yerine Logic...");
const results = parseTranscriptAdvancedMock(testText);
console.log("Results (Codes):", results.map(r => r.code));

const foundTTTT02 = results.some(r => r.code === 'TTTT02');
if (foundTTTT02) {
    console.error("FAIL: TTTT02 was NOT ignored.");
} else {
    console.log("PASS: TTTT02 was ignored.");
}
