/** Parser'ın kaç dersi kaçırdığını ölçer: ham metindeki kodlar vs bulunanlar. */
import { readFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
import { parseSchedulePdf, buildCells, type PdfTextItem } from '../src/utils/schedulePdfParser';

let fail = 0;
import { validateProfile } from '../src/utils/departmentRegistry';

const profile = validateProfile(JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/departments/EEM.json'), 'utf8')));
const known = new Set(profile.courses.map(c => c.code.replace(/\s+/g, '').toUpperCase()));

const CODE = /\b([A-ZÇĞİÖŞÜ]{2,6})\s?(\d{2,4})([A-Z])?\b/g;

const pdfjs = await import(pathToFileURL(join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.mjs')).href) as any;
const dir = process.argv[2] ?? process.env.SCHEDULE_DIR;
if (!dir) { console.log('(PDF arşivi verilmedi, atlandı)'); process.exit(0); }
const only = process.argv[3];

console.log('dosya'.padEnd(44) + 'hamKod  bulunan  kaçan  oran');
console.log('─'.repeat(80));

for (const f of readdirSync(dir).filter(x => x.toLowerCase().endsWith('.pdf')).sort()) {
    if (only && !f.includes(only)) continue;
    const data = new Uint8Array(readFileSync(join(dir, f)));
    const pdf = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
    const items: PdfTextItem[] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
        const pg = await pdf.getPage(p); const c = await pg.getTextContent();
        for (const it of c.items as any[]) {
            if (!it.str?.trim()) continue;
            items.push({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width, page: p });
        }
    }

    // Ham metinde geçen, ders planında TANIMLI olan kodlar = altın standart
    const cells = buildCells(items);
    const raw = new Set<string>();
    for (const cell of cells) {
        // Dipnotlar programın parçası değil: "NOT 3: ... programda gösterilmemiştir"
        // Parser'la aynı eleme: dipnotlar programın parçası değil. "N" ayrı
        // hücreye düştüğü için "ote 3:" gibi parçalar da yakalanmalı.
        if (/^(NOT\s|Note\s|ote |Açıklama)/i.test(cell.text)) continue;
        if (/değiştiril|gösterilme|will not be/i.test(cell.text)) continue;
        if (cell.text.length > 90) continue;
        CODE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = CODE.exec(cell.text)) !== null) {
            const code = `${m[1]}${m[2]}${m[3] ?? ''}`.toUpperCase();
            if (known.has(code)) raw.add(code);
        }
    }

    const { offerings } = parseSchedulePdf(items, { knownCourseCodes: profile.courses.map(c => c.code) });
    const found = new Set(offerings.map(o => o.courseCode.toUpperCase()));
    const missed = [...raw].filter(c => !found.has(c)).sort();

    if (missed.length) fail++;
    const oran = raw.size ? Math.round((raw.size - missed.length) / raw.size * 100) : 100;
    console.log(
        `${f.slice(0, 42).padEnd(44)}${String(raw.size).padStart(6)}` +
        `${String(found.size).padStart(9)}${String(missed.length).padStart(7)}  %${oran}` +
        (missed.length ? `\n    kaçan: ${missed.join(', ')}` : '')
    );
}


if (fail) {
    console.log(`
Başarısız: ${fail} dosyada ders kaçtı`);
    process.exit(1);
}
console.log(`
Tüm dosyalarda %100 kapsama.`);
