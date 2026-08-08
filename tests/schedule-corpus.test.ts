/**
 * Ders programı parser'ını GERÇEK PDF arşivine karşı koşturur.
 *
 *   npm run test:schedule -- "C:/.../Ders Programları"
 *
 * Klasör verilmezse atlanır (CI'da PDF'ler bulunmayabilir).
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
    parseSchedulePdf, parseCellText, buildCells, resolveGroupRanges, detectScheduleMeta, type PdfTextItem
} from '../src/utils/schedulePdfParser';
import { detectScheduleConflicts } from '../src/utils/scheduleUtils';

// npm `--` argümanlarını her ortamda iletmediği için env değişkeni de kabul edilir:
//   SCHEDULE_DIR="C:/.../Ders Programları" npm run test:schedule
const dir = process.argv[2] ?? process.env.SCHEDULE_DIR;

let pass = 0, fail = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = '') {
    if (ok) { pass++; console.log(`  ✓ ${name}`); }
    else { fail++; failures.push(`${name}${detail ? ' — ' + detail : ''}`); console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}
function eq(name: string, a: unknown, b: unknown) {
    check(name, JSON.stringify(a) === JSON.stringify(b), `beklenen ${JSON.stringify(b)}, gelen ${JSON.stringify(a)}`);
}

// ===========================================================================
console.log('\n── Hücre birleştirme (bölünmüş Türkçe karakterler) ─────────');

const split = buildCells([
    { str: 'K', x: 100, y: 500, width: 5, page: 1 },
    { str: 'İ', x: 105, y: 500, width: 3, page: 1 },
    { str: 'M 1005 General Chemistry', x: 108, y: 500, width: 90, page: 1 },
    { str: 'E 1', x: 300, y: 500, width: 12, page: 1 }
]);
eq('bölünmüş "KİM" birleşti', split[0].text, 'KİM 1005 General Chemistry');
eq('uzaktaki derslik ayrı hücre kaldı', split[1].text, 'E 1');

// ===========================================================================
console.log('\n── Hücre metni çözümleme (gerçek biçimler) ─────────────────');

const cases: Array<[string, Partial<ReturnType<typeof parseCellText>>]> = [
    ['KİM 1005 General Chemistry',
        { code: 'KİM1005', name: 'General Chemistry', groups: [], allGroups: false, instructor: null }],

    // Türkçe harfle BAŞLAYAN kod: \b bunu "KT151" diye okuyordu.
    ['İKT151 (İNG) (Şükrü M.T.)', { code: 'İKT151', instructor: 'Şükrü M.T.' }],
    ['İST2044 Engineering Probability', { code: 'İST2044', name: 'Engineering Probability' }],
    ['ÇEV201 Environmental Eng.', { code: 'ÇEV201' }],

    ['BİM 122 Disc. Comp. Struc. (Abdulkadir Z.)',
        { code: 'BİM122', groups: [], instructor: 'Abdulkadir Z.' }],

    ['EEM 206 Elect. Circ. Lab. (A) (Özge E.)',
        { code: 'EEM206', groups: ['A'], allGroups: false, instructor: 'Özge E.', isLabText: true }],

    ['EEM206 Electrical Circuits Lab. (Class - All Groups) (Özge E.)',
        { code: 'EEM206', allGroups: true, instructor: 'Özge E.' }],

    // Varsayılan okuma ARALIK: "A-E" → A, B, C, D, E
    ['BİL 200 Comp. Prog. (Class-A-E Groups) (Can U.)',
        {
            code: 'BİL200', groups: ['A', 'B', 'C', 'D', 'E'], groupsLiteral: ['A', 'E'],
            isRange: true, allGroups: false, instructor: 'Can U.'
        }],

    ['BİL200 Comp. Prog. (Class-B-C-D Groups) (Tansu F.)',
        { code: 'BİL200', groups: ['B', 'C', 'D'], allGroups: false }],

    ['FİZ 107 Physics Laboratory I / A&B',
        { code: 'FİZ107', groups: ['A', 'B'], isLabText: true }],

    ['FİZ 107 Physics Laboratory I / C',
        { code: 'FİZ107', groups: ['C'] }],

    // "A-B" aralık olarak da liste olarak da aynı sonucu verir
    ['FİZ105 A-B (İNG)',
        { code: 'FİZ105', groups: ['A', 'B'] }],

    ['MAT219 A-B (İNG) (M. Tankut Ö. -………..)',
        { code: 'MAT219', groups: ['A', 'B'] }],

    // Üç ve daha fazla harf zaten açık listedir, aralık açılmaz
    ['EEM311 Princ. of En. Conv. (A-B-C-D-E-F-G-H) (Murat B.)',
        { code: 'EEM311', groups: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], isRange: false }],

    ['EEM311 Princ. of En. Conv. (Class - All Groups) (Oğuzkağan A.)',
        { code: 'EEM311', allGroups: true }],

    ['EEM328 Electronics Lab (Class - All Groups) (Özen Y., Seval K.)',
        { code: 'EEM328', allGroups: true, isLabText: true }]
];

for (const [input, expected] of cases) {
    const got = parseCellText(input);
    const mismatches = Object.entries(expected).filter(([k, v]) =>
        JSON.stringify((got as any)[k]) !== JSON.stringify(v));
    check(
        `"${input.slice(0, 52)}${input.length > 52 ? '…' : ''}"`,
        mismatches.length === 0,
        mismatches.map(([k, v]) => `${k}: beklenen ${JSON.stringify(v)}, gelen ${JSON.stringify((got as any)[k])}`).join(' · ')
    );
}

// Öğretim elemanı grup sanılmamalı
check('hoca adı grup sanılmadı', parseCellText('EEM 206 Lab. (Özge E.)').groups.length === 0);

// --- Aralık mı liste mi: veriden karar ---
console.log('\n── "A-E" aralık/liste çözümü ───────────────────────────────');

const mk = (code: string, day: string, start: string, end: string, text: string,
            type: 'lecture' | 'lab' = 'lecture') => {
    const p = parseCellText(text);
    return {
        courseCode: code, courseName: p.name, day, startTime: start, endTime: end,
        section: p.groups.join('-'), groups: p.groups, groupsLiteral: p.groupsLiteral,
        isRange: p.isRange, type, async: false,
        instructor: p.instructor, classYear: null, rawText: text
    };
};

// Çakışma yoksa aralık okuması korunur
const noClash = [mk('BİL200', 'Salı', '16:00', '18:00', 'BİL200 Comp. Prog. (Class-A-E Groups)')];
resolveGroupRanges(noClash);
eq('çakışma yoksa aralık açık kalır', noClash[0].groups.join(''), 'ABCDE');

// Aynı saatte B-C-D şubesi varsa aralık okuması imkânsız → harfi harfine
const clashing = [
    mk('BİL200', 'Salı', '16:00', '18:00', 'BİL200 Comp. Prog. (Class-A-E Groups)'),
    mk('BİL200', 'Salı', '16:00', '18:00', 'BİL200 Comp. Prog. (Class-B-C-D Groups)')
];
const { downgraded } = resolveGroupRanges(clashing);
eq('çakışma varsa listeye düşer', clashing[0].groups.join(''), 'AE');
eq('diğer şube dokunulmadan kaldı', clashing[1].groups.join(''), 'BCD');
eq('düşürme raporlandı', downgraded.length, 1);
check('şubeler artık kesişmiyor',
    !clashing[0].groups.some(g => clashing[1].groups.includes(g)));

// İki hoca dersi bölüşmüşse, saatleri FARKLI olsa bile aralık okuması geçersizdir:
// bir öğrenci aynı dersin iki teorik şubesine birden gidemez.
const twoInstructors = [
    mk('BİL200', 'Salı', '16:00', '18:00', 'BİL200 Comp. Prog. (Class-A-E Groups) (Can U.)'),
    mk('BİL200', 'Çarşamba', '16:00', '18:00', 'BİL200 Comp. Prog. (Class-B-C-D Groups) (Tansu F.)')
];
resolveGroupRanges(twoInstructors);
eq('farklı günde de olsa bölüşme listeye düşürür', twoInstructors[0].groups.join(''), 'AE');
eq('iki hoca ayrı ayrı okundu',
    [twoInstructors[0].instructor, twoInstructors[1].instructor].join(' / '), 'Can U. / Tansu F.');

// Teorik "A-E" + gruplara ayrılmış LAB: bu bölüşme değildir, aralık KORUNUR.
const lectureWithLabs = [
    mk('EEM206', 'Salı', '12:00', '13:00', 'EEM206 Circuits Lab (Class-A-E Groups) (Özge E.)'),
    ...['A', 'B', 'C', 'D', 'E'].map((g, i) =>
        mk('EEM206', 'Pazartesi', `${9 + i * 2}:00`, `${11 + i * 2}:00`,
            `EEM 206 Elect. Circ. Lab. (${g}) (Özge E.)`, 'lab'))
];
resolveGroupRanges(lectureWithLabs);
eq('teorik + lab grupları aralığı bozmaz', lectureWithLabs[0].groups.join(''), 'ABCDE');

// Aynı şubenin saat saat tekrarı çakışma sayılmaz
const repeated = [
    mk('BİL200', 'Salı', '16:00', '17:00', 'BİL200 Comp. Prog. (Class-A-E Groups) (Can U.)'),
    mk('BİL200', 'Salı', '17:00', '18:00', 'BİL200 Comp. Prog. (Class-A-E Groups) (Can U.)')
];
resolveGroupRanges(repeated);
eq('aynı şubenin tekrarı aralığı bozmaz', repeated[0].groups.join(''), 'ABCDE');
// Dil etiketi ders adına karışmamalı
check('dil etiketi temizlendi', !parseCellText('FİZ105 Physics I (İNG)').name.includes('İNG'));

// ===========================================================================
if (!dir || !existsSync(dir)) {
    console.log('\n(PDF arşivi verilmedi, korpus testi atlandı)');
} else {
    console.log(`\n── Gerçek PDF arşivi: ${dir} ──────────────────`);

    const pdfjs = await import(
        pathToFileURL(join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.mjs')).href
    ) as any;

    const files = readdirSync(dir).filter(f => f.toLowerCase().endsWith('.pdf')).sort();
    const rows: Array<{ file: string; dersler: number; oturum: number; gunler: number; gruplar: string; sorun: string }> = [];

    for (const file of files) {
        const data = new Uint8Array(readFileSync(join(dir, file)));
        const pdf = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;

        const items: PdfTextItem[] = [];
        for (let p = 1; p <= pdf.numPages; p++) {
            const page = await pdf.getPage(p);
            const content = await page.getTextContent();
            for (const it of content.items as any[]) {
                if (!it.str?.trim()) continue;
                items.push({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width, page: p });
            }
        }

        const { offerings, diagnostics, availableGroups, meta } = parseSchedulePdf(items);

        // Dönem tespiti: dosya adı "GUZ/Güz/Fall" ya da "BAHAR/Spring" içeriyorsa
        // parser da aynı dönemi bulmalı. Öğrenci dönemlik program hazırlar.
        const fromName = /guz|güz|fall/i.test(file) ? 'guz'
            : /bahar|spring/i.test(file) ? 'bahar' : null;
        if (fromName) {
            check(`${file.slice(0, 40)}: dönem başlıktan okundu (${meta.term})`,
                meta.term === fromName, `dosya adı ${fromName}, başlık ${meta.term}`);
        }
        check(`${file.slice(0, 40)}: akademik yıl okundu`,
            meta.academicYear !== null && /^\d{4}-\d{4}$/.test(meta.academicYear),
            `${meta.academicYear}`);
        const days = new Set(offerings.map(o => o.day));
        const courses = new Set(offerings.map(o => o.courseCode));
        const problems = diagnostics.filter(d => d.level !== 'info');

        rows.push({
            file: file.length > 46 ? file.slice(0, 44) + '…' : file,
            dersler: courses.size,
            oturum: offerings.length,
            gunler: days.size,
            gruplar: availableGroups.join('') || '—',
            sorun: problems.length ? problems[0].code : ''
        });

        check(`${file.slice(0, 44)}: ders okundu`, courses.size > 0,
            problems.map(p => p.message).join(' | ').slice(0, 120));
        check(`${file.slice(0, 44)}: en az 4 gün`, days.size >= 4, `${days.size} gün: ${[...days].join(',')}`);
    }

    console.log('\n  dosya                                          ders  oturum  gün  grup');
    console.log('  ' + '─'.repeat(76));
    for (const r of rows) {
        console.log(
            `  ${r.file.padEnd(46)}${String(r.dersler).padStart(4)}` +
            `${String(r.oturum).padStart(8)}${String(r.gunler).padStart(5)}  ${r.gruplar}` +
            (r.sorun ? `  [${r.sorun}]` : '')
        );
    }
}

// ===========================================================================
console.log('\n── Dönem tespiti (öğrenci dönemlik program hazırlar) ───────');

const meta = (texts: string[]) => detectScheduleMeta(texts.map(text => ({ text })));

eq('güz dönemi okundu',
    meta(['2025-2026 ÖĞRETİM YILI GÜZ DÖNEMİ HAFTALIK DERS PROGRAMI']).term, 'guz');
eq('bahar dönemi okundu',
    meta(['2024-2025 ÖĞRETİM YILI BAHAR DÖNEMİ HAFTALIK DERS PROGRAMI']).term, 'bahar');
eq('yaz okulu okundu', meta(['2023-2024 YAZ OKULU DERS PROGRAMI']).term, 'yaz');
eq('İngilizce başlık okundu', meta(['2021-2022 Fall Semester Schedule']).term, 'guz');
eq('akademik yıl ayrıştırıldı',
    meta(['2025-2026 ÖĞRETİM YILI GÜZ DÖNEMİ']).academicYear, '2025-2026');
eq('dönem yoksa null döner', meta(['ELEKTRİK ELEKTRONİK MÜHENDİSLİĞİ BÖLÜMÜ']).term, null);

// Türkçe karakterler PDF'te bölünmüş gelebilir — sadeleştirilmiş arama tutmalı
eq('bölünmüş Türkçe karakterli başlık', meta(['2025-2026', 'GÜZ', 'DÖNEM', 'İ']).term, 'guz');

// ===========================================================================
console.log('\n── Çakışma: All Groups / lab grubu ayrımı ──────────────────');

const sample = [
    { courseCode: 'EEM206', section: 'All', day: 'Salı', startTime: '12:00', endTime: '13:00', type: 'lecture' as const },
    { courseCode: 'EEM206', section: 'A', day: 'Pazartesi', startTime: '14:00', endTime: '16:00', type: 'lab' as const },
    { courseCode: 'BİL200', section: 'A', day: 'Pazartesi', startTime: '16:00', endTime: '18:00', type: 'lab' as const },
    { courseCode: 'BİL200', section: 'A-E', day: 'Perşembe', startTime: '16:00', endTime: '18:00', type: 'lecture' as const }
];
eq('uyumlu seçimde çakışma yok', detectScheduleConflicts(sample).length, 0);

const withOverlap = [
    ...sample,
    { courseCode: 'EEM209', section: 'All', day: 'Pazartesi', startTime: '15:00', endTime: '17:00', type: 'lecture' as const }
];
const found = detectScheduleConflicts(withOverlap);
check('gerçek çakışma bulundu', found.length === 2, JSON.stringify(found.map(c => c.courses)));

// ===========================================================================
console.log(`\n${'═'.repeat(72)}`);
console.log(`Toplam: ${pass + fail} · Başarılı: ${pass} · Başarısız: ${fail}`);
if (fail) {
    console.log('\nBaşarısız:');
    failures.forEach(f => console.log(`  · ${f}`));
    process.exit(1);
}
