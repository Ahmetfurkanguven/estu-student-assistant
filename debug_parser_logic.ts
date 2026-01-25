
import { normalizeCourseCode } from './src/utils/transcriptParser.js';
import { GRADE_SYSTEM } from './src/data/rules.js';

// Copied from transcriptParser.ts to debug logic in isolation
function parseLineDebug(line: string) {
    console.log(`\nParsing: "${line}"`);
    const lineRegex = /^([A-ZİĞÜŞÇÖ\d]{2,})\s+(.*?)\s+([\d.\s]{3,})\s+([A-Z]{2}|--)\s+(.*)$/i;
    const match = line.match(lineRegex);

    if (!match) {
        console.log("NO MATCH");
        return;
    }

    let [_, rawCode, name, numbersPart, gradeLetter, rest] = match;
    console.log(`Code: ${rawCode}`);
    console.log(`Name: "${name}"`);
    console.log(`Numbers: "${numbersPart}"`);
    console.log(`Grade: "${gradeLetter}"`);
    console.log(`Rest: "${rest}"`);

    const restTokens = rest.trim().split(/\s+/);
    console.log("Rest Tokens:", restTokens);

    for (const token of restTokens) {
        let rawCode = token.split('(')[0];
        const cleanToken = rawCode.replace(/[^A-ZİĞÜŞÇÖ0-9]/g, '');
        console.log(`Token: "${token}" -> Raw: "${rawCode}" -> Clean: "${cleanToken}"`);
        if (/^[A-ZİĞÜŞÇÖ]{2,}\d{2,}$/.test(cleanToken)) {
            console.log(`  MATCHES REGEX: ${cleanToken}`);
        } else {
            console.log(`  NO MATCH REGEX`);
        }
    }
}

const lines = [
    "MFALM102 Mühendislik Almancası II(Alm) 4.0 DZ 0.00 S FİZ237(Tür)",
    "TTTT02 Project(İng) D 20.0 FF 0.00 MS EEM403(İng)"
];

lines.forEach(parseLineDebug);
