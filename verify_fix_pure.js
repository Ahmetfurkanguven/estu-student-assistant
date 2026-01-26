
const GRADE_SYSTEM = {
    AA: { coefficient: 4.0, passed: true },
    FF: { coefficient: 0.0, passed: false },
    MS: { coefficient: 0.0, passed: true }
};

function parseLine(line) {
    // Regex from transcriptParser.ts
    const match = line.match(/^([A-ZİĞÜŞÇÖ]{2,}[A-ZİĞÜŞÇÖ0-9]{3,})\s+(.+?)\s+((?:\d+(?:\.\d+)?\s+)+)([A-Z]{2})(.*)$/);

    if (match) {
        let [, code, name, numbersPart, gradeLetter, rest] = match;

        console.log(`Matched: Code=${code}, Grade=${gradeLetter}, Rest="${rest}"`);

        let gradeInfo = GRADE_SYSTEM[gradeLetter] || { coefficient: 0, passed: false };

        // Test MS detection
        if (/\bMS\b/.test(rest)) {
            console.log('MS detected in rest. Overriding grade.');
            gradeLetter = 'MS';
            gradeInfo = GRADE_SYSTEM['MS'];
        }

        // Test Yerine detection
        const explicitMatch = rest.match(/Yerine(?:[-\s]*\d*)?\s*[:]?\s*([A-ZİĞÜŞÇÖ]{3,}\d{3})/i);
        let equivalent = explicitMatch ? explicitMatch[1] : null;

        return { code, gradeLetter, equivalent };
    }
    return null;
}

const lines = [
    // Case from user image
    "TTT02 Project(Ing) 20.0 FF 0.00 MS EEM403(Ing)",
    // Variant strictly matching regex
    "TTT02 Project(Ing) 20.0 FF 0.00 MS Yerine: EEM403",
    // No MS, just substitution
    "OLD101 OldCourse 5.0 FF 0.00 Z Yerine-1: NEW101"
];

console.log("--- JS Verification ---");
lines.forEach(l => {
    console.log(`\nTesting: "${l}"`);
    const res = parseLine(l);
    console.log("Result:", res);
});
