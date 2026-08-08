/**
 * src/data/*.ts içindeki mevcut EEM verisini bölüm profiline (JSON) dönüştürür.
 *
 * Amaç: elle kopyalarken veri kaybetmemek. Veri artık tek yerde —
 * public/data/departments/<KOD>.json — yaşar; TS dosyaları kaldırılabilir.
 *
 * Kullanım:  node scripts/build-department-profile.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** `export const NAME: Type = [ ... ];` içindeki dizi literalini çıkarır. */
function extractArrayLiteral(source, name) {
    const declaration = new RegExp(`export\\s+const\\s+${name}\\s*(?::[^=]+)?=\\s*`);
    const match = declaration.exec(source);
    if (!match) throw new Error(`${name} bulunamadı`);

    const start = source.indexOf('[', match.index + match[0].length - 1);
    if (start === -1) throw new Error(`${name} için dizi literali bulunamadı`);

    let depth = 0;
    let inString = null;
    for (let i = start; i < source.length; i++) {
        const ch = source[i];
        const prev = source[i - 1];
        if (inString) {
            if (ch === inString && prev !== '\\') inString = null;
            continue;
        }
        if (ch === "'" || ch === '"' || ch === '`') { inString = ch; continue; }
        if (ch === '[') depth++;
        else if (ch === ']') {
            depth--;
            if (depth === 0) {
                const literal = source.slice(start, i + 1);
                // Dizi literali geçerli bir JS ifadesidir; kendi kaynağımız.
                return new Function(`return (${literal});`)();
            }
        }
    }
    throw new Error(`${name} için kapanış parantezi bulunamadı`);
}

const coursesSrc = readFileSync(resolve(root, 'src/data/courses.ts'), 'utf8');
const rulesSrc = readFileSync(resolve(root, 'src/data/rules.ts'), 'utf8');
const groupsSrc = readFileSync(resolve(root, 'src/data/specializationGroups.ts'), 'utf8');

const ALL_COURSES = extractArrayLiteral(coursesSrc, 'ALL_COURSES');
const SPECIALIZATION_AREAS = extractArrayLiteral(rulesSrc, 'SPECIALIZATION_AREAS');
const INTIBAK_MAPPINGS = extractArrayLiteral(rulesSrc, 'INTIBAK_MAPPINGS');
const SPECIALIZATION_GROUPS = extractArrayLiteral(groupsSrc, 'SPECIALIZATION_GROUPS');

// Alan eşikleri (rules.ts) ile alan ders havuzunu (specializationGroups.ts) birleştir.
const specializations = SPECIALIZATION_AREAS.map(area => {
    const group = SPECIALIZATION_GROUPS.find(g => g.id === area.id);
    return {
        ...area,
        courses: (group?.courses ?? []).map(c => ({
            code: c.code,
            name: c.name,
            isMandatory: Boolean(c.isMandatory),
            prerequisite: c.prerequisite ?? null,
            term: c.term ?? null
        }))
    };
});

const orphanGroups = SPECIALIZATION_GROUPS
    .filter(g => !SPECIALIZATION_AREAS.some(a => a.id === g.id))
    .map(g => g.id);
if (orphanGroups.length) {
    console.warn(`UYARI: eşleşmeyen uzmanlaşma grubu: ${orphanGroups.join(', ')}`);
}

// Profilde geçen ama ders planında olmayan kodları görünür kıl.
const known = new Set(ALL_COURSES.map(c => c.code));
const missing = new Set();
for (const s of specializations) {
    for (const c of s.courses) if (!known.has(c.code)) missing.add(c.code);
    for (const c of s.requiredCourses) if (!known.has(c)) missing.add(c);
}
if (missing.size) {
    console.warn(`UYARI: ders planında bulunmayan ${missing.size} kod: ${[...missing].join(', ')}`);
}

const profile = {
    code: 'EEM',
    name: 'Elektrik-Elektronik Mühendisliği',
    nameEn: 'Electrical and Electronics Engineering',
    faculty: 'Mühendislik Fakültesi',
    degree: 'lisans',
    // Madde 25/1 — dört yıllık lisans programı için en az 240 AKTS.
    totalEcts: 240,
    coursePrefixes: ['EEM'],
    // Madde 8/4 — bitirme projesi niteliğindeki dersler.
    graduationProject: {
        codes: ['EEM413', 'EEM414'],
        minEctsAlternative: 180
    },
    courses: ALL_COURSES,
    intibak: INTIBAK_MAPPINGS,
    specializations,
    meta: {
        source: 'src/data/*.ts (scripts/build-department-profile.mjs ile üretildi)',
        updatedAt: new Date().toISOString().slice(0, 10)
    }
};

const outDir = resolve(root, 'public/data/departments');
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, 'EEM.json'), JSON.stringify(profile, null, 2) + '\n', 'utf8');

const index = {
    departments: [
        {
            code: profile.code,
            name: profile.name,
            nameEn: profile.nameEn,
            faculty: profile.faculty,
            degree: profile.degree,
            file: 'EEM.json'
        }
    ]
};
writeFileSync(resolve(outDir, 'index.json'), JSON.stringify(index, null, 2) + '\n', 'utf8');

console.log(`EEM.json yazıldı: ${ALL_COURSES.length} ders, ${INTIBAK_MAPPINGS.length} intibak, ${specializations.length} uzmanlaşma alanı`);
