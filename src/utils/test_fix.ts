/**
 * Bu dosyadaki senaryo tests/engine.test.ts içine taşındı ve oradaki
 * "yerine ders" testlerinin temelini oluşturuyor.
 *
 * Çalıştırma:  npm test
 *
 * @deprecated tests/engine.test.ts kullanın.
 */
import { parseTranscript } from './transcriptParser';
import { resolveRecords, calculateGpa } from './gpaCalculator';

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

const parsed = parseTranscript(mockTranscript);
const resolved = resolveRecords(parsed.records);
const gpa = calculateGpa(resolved.active);

console.log(`Okunan: ${parsed.records.length} · Ortalamaya giren: ${resolved.active.length}`);
for (const s of resolved.superseded) console.log(`  düştü: ${s.record.courseCode} — ${s.explanation}`);
console.log(`GNO: ${gpa.gno} · Payda (AKTS): ${gpa.gpaEcts}`);
