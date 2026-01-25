
const GRADE_SYSTEM = {
    'FF': { coefficient: 0.0, passed: false },
    'AA': { coefficient: 4.0, passed: true },
    'DZ': { coefficient: 0.0, passed: false },
    'S': { coefficient: 0.0, passed: true },
    'MS': { coefficient: 0.0, passed: true },
};

function parseTranscriptText(text) {
    const records = [];
    // Clean up text to match what we likely get from PDF (handling potential multi-spaces)
    const lines = text.split('\n');
    let currentSemester = '2024-2025 Güz';

    for (const line of lines) {
        if (!line.trim()) continue;
        console.log(`Processing: "${line}"`);

        // The regex we updated in Step 374
        const match = line.match(/^([A-ZİĞÜŞÇÖ]{2,}[A-ZİĞÜŞÇÖ0-9]{3,})\s+(.+?)\s+((?:\d+(?:\.\d+)?\s+)+)([A-Z]{2})(.*)$/);

        if (match) {
            const [, code, name, numbersPart, gradeLetter, rest] = match;
            console.log(`  -> Match! Code: ${code}, Rest: "${rest}"`);

            let equivalentCourse;

            // 1. Explicit
            const explicitMatch = rest.match(/Yerine-\d+\s*[:]?\s*([A-ZİĞÜŞÇÖ]{3,}\d{3})/i);
            if (explicitMatch) {
                equivalentCourse = explicitMatch[1].trim();
                console.log(`  -> Explicit Equivalent: ${equivalentCourse}`);
            } else {
                // 2. Implicit (The logic we added)
                // Regex from Step 374: /\b([A-ZİĞÜŞÇÖ]{3,}\d{3})\b/g
                const courseCodeMatches = [...rest.matchAll(/\b([A-ZİĞÜŞÇÖ]{3,}\d{3})\b/g)];
                if (courseCodeMatches.length > 0) {
                    equivalentCourse = courseCodeMatches[courseCodeMatches.length - 1][1];
                    console.log(`  -> Implicit Equivalent: ${equivalentCourse}`);
                } else {
                    console.log(`  -> No Implicit Match found withregex /\\b([A-ZİĞÜŞÇÖ]{3,}\\d{3})\\b/g`);
                }
            }
        } else {
            console.log("  -> No match.");
        }
    }
}

// Test cases based on user logs
const linesToTest = `
TTTT02   Project(İng)   D 20.0   FF   0.00   MS   EEM403(İng)
TTTT02 Project(İng) D 20.0 FF 0.00 MS EEM403(İng)
MFALM102   Mühendislik Almancası II(Alm)   4.0   DZ   0.00   S   FİZ237(Tür)
`;

parseTranscriptText(linesToTest);
