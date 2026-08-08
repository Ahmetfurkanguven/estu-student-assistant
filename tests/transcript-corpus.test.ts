/**
 * Transkript motorunu GERÇEK PDF transkriptlere karşı koşturur.
 *
 *   TRANSCRIPT_DIR="C:/.../Transkriptler" npm run test:transcript
 *
 * Klasör verilmezse atlanır. Kişisel veri konsola dökülmez; dosya adları
 * kısaltılır ve yalnızca toplulaştırılmış doğruluk göstergeleri yazdırılır.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { buildLinesFromPdfItems, type PdfTextItemLike } from '../src/utils/transcriptParser';
import { analyzeTranscript } from '../src/engine/analyze';
import { validateProfile } from '../src/utils/departmentRegistry';
import { getGrade } from '../src/data/gradeSystem';
import { calculateGpa, buildSemesterHistory, applyIntibak } from '../src/utils/gpaCalculator';
import { parseTranscript } from '../src/utils/transcriptParser';

const dir = process.argv[2] ?? process.env.TRANSCRIPT_DIR;

let pass = 0, fail = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = '') {
    if (ok) { pass++; console.log(`  ✓ ${name}`); }
    else { fail++; failures.push(`${name}${detail ? ' — ' + detail : ''}`); console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}
function eq(name: string, a: unknown, b: unknown) {
    check(name, Object.is(a, b), `beklenen ${JSON.stringify(b)}, gelen ${JSON.stringify(a)}`);
}

const profile = validateProfile(
    JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/departments/EEM.json'), 'utf8'))
);

// ===========================================================================
console.log('\n── Dönem geçmişi geleceğe bakmamalı (Madde 19/6) ───────────');

// 1. dönemde FF, 3. dönemde tekrar edilip CC.
// 1. dönemin DNO'su FF'i İÇERMELİ; aksi halde uyarının hangi dönemde verildiği kayar.
const retroText = `2022-2023 Güz Dönemi
MAT1011  Calculus I  7.5  BA  24.75  Z
BİM122  Discrete Comp. Structures  5.0  FF  0.00  Z
2022-2023 Bahar Dönemi
MAT1012  Calculus II  7.5  DD  7.50  Z
EEM102  Introduction to EE  7.5  DD  7.50  Z
2023-2024 Güz Dönemi
BİM122  Discrete Comp. Structures  5.0  CC  10.00  Z`;

const retroHistory = buildSemesterHistory(applyIntibak(parseTranscript(retroText).records, []));
// (3.3*7.5 + 0*5) / 12.5 = 24.75/12.5 = 1.98  → FF sayılmalı
eq('1. dönem DNO’su FF’i içeriyor', retroHistory[0].dno, 1.98);
check('1. dönem GNO’su 2.00 altında', retroHistory[0].gno < 2.0, `${retroHistory[0].gno}`);

const retroAnalysis = analyzeTranscript(retroText, profile);
eq('uyarı ilk başarısız dönemde verildi',
    retroAnalysis.standing.warningSemester, '2022-2023 Güz Dönemi');
eq('iki ardışık başarısız dönem → tekrar aşaması', retroAnalysis.standing.stage, 'tekrar');
check('son GNO tekrar edilen dersin YENİ notunu kullanıyor',
    retroAnalysis.active.find(r => r.courseCode === 'BİM122')?.grade.letter === 'CC');

// ===========================================================================
if (!dir || !existsSync(dir)) {
    console.log('\n(Transkript arşivi verilmedi, korpus testi atlandı)');
} else {
    console.log(`\n── Gerçek transkript arşivi ────────────────────────────────`);

    const pdfjs = await import(
        pathToFileURL(join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.mjs')).href
    ) as any;

    const files = readdirSync(dir).filter(f => f.toLowerCase().endsWith('.pdf')).sort();
    const rows: string[] = [];

    for (const file of files) {
        // Kişisel veriyi ekrana basmamak için kısa etiket
        const label = file.replace(/\.pdf$/i, '').split(/[\s_]+/)[0].slice(0, 12);

        const data = new Uint8Array(readFileSync(join(dir, file)));
        const pdf = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;

        const items: PdfTextItemLike[] = [];
        for (let p = 1; p <= pdf.numPages; p++) {
            const page = await pdf.getPage(p);
            const content = await page.getTextContent();
            for (const it of content.items as any[]) {
                if (!it.str?.trim()) continue;
                items.push({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width, page: p });
            }
        }

        // Taranmış (görüntü) PDF'lerde metin katmanı yoktur; OCR olmadan
        // okunamaz. Bu bir parser hatası değildir — beklenen davranış,
        // kullanıcıya bunu AÇIKÇA söylemektir.
        if (items.length === 0) {
            const a = analyzeTranscript('', profile);
            check(`${label}: taranmış PDF açıkça bildiriliyor`,
                a.diagnostics.some(d => d.level === 'error' && /taranmış|görüntü/i.test(d.message)),
                a.diagnostics.map(d => d.code).join(','));
            rows.push(`  ${label.padEnd(13)}  — metin katmanı yok (taranmış PDF, OCR gerekir)`);
            continue;
        }

        const text = buildLinesFromPdfItems(items).join('\n');
        const a = analyzeTranscript(text, profile);

        // ---- ASIL SINAMA -------------------------------------------------
        // Transkriptin kendisi resmî GNO'yu yazar:
        //   "Anne Adı  SİBEL  Genel Not Ortalaması  3.00 / 76.66"
        // Motorun hesabı bununla birebir tutmalı. Yapısal değişmezler değil,
        // bu karşılaştırma doğruluğun gerçek ölçüsüdür.
        const officialMatch = /Genel Not Ortalaması[\s\t]*([0-3][.,]\d{1,2}|4[.,]00)/i.exec(text);
        const official = officialMatch ? parseFloat(officialMatch[1].replace(',', '.')) : null;

        const errors = a.diagnostics.filter(d => d.level === 'error');
        const warnings = a.diagnostics.filter(d => d.level === 'warning');

        // --- Değişmezler: her transkriptte tutmalı ---
        check(`${label}: ders okundu`, a.parsed.records.length > 0,
            errors.map(e => e.message).join(' | ').slice(0, 140));
        check(`${label}: hata seviyesinde tanı yok`, errors.length === 0,
            errors.map(e => e.code).join(','));
        check(`${label}: dönem başlıkları bulundu`, a.parsed.semesters.length > 0);
        check(`${label}: GNO 0–4 aralığında`, a.gpa.gno >= 0 && a.gpa.gno <= 4,
            `${a.gpa.gno}`);
        check(`${label}: her kaydın notu tanınıyor`,
            a.parsed.records.every(r => getGrade(r.grade.letter) !== null),
            a.parsed.records.filter(r => !getGrade(r.grade.letter)).map(r => r.grade.letter).join(','));
        check(`${label}: AKTS değerleri makul (0–30)`,
            a.parsed.records.every(r => r.ects > 0 && r.ects <= 30),
            a.parsed.records.filter(r => !(r.ects > 0 && r.ects <= 30))
                .map(r => `${r.courseCode}=${r.ects}`).slice(0, 5).join(','));
        check(`${label}: aynı ders aktif listede tekrarlanmıyor`,
            new Set(a.active.map(r => r.courseCode)).size === a.active.length);
        check(`${label}: ders adları boş değil`,
            a.parsed.records.filter(r => !r.courseName.trim()).length === 0,
            a.parsed.records.filter(r => !r.courseName.trim()).map(r => r.courseCode).slice(0, 5).join(','));

        if (official !== null) {
            check(`${label}: GNO resmî değerle aynı (${a.gpa.gno.toFixed(2)} vs ${official.toFixed(2)})`,
                Math.abs(a.gpa.gno - official) < 0.005,
                `fark ${(a.gpa.gno - official).toFixed(2)}`);
        } else {
            check(`${label}: transkriptte resmî GNO bulundu`, false, 'GNO satırı okunamadı');
        }

        // GNO, kayıtlardan bağımsız olarak yeniden hesaplanınca aynı çıkmalı
        eq(`${label}: GNO yeniden hesapla tutarlı`, calculateGpa(a.active).gno, a.gpa.gno);

        // Kümülatif GNO'nun son değeri toplam GNO ile aynı olmalı
        const lastCumulative = [...a.history].reverse().find(h => !h.key.special)?.gno;
        if (lastCumulative !== undefined) {
            eq(`${label}: son dönem kümülatif GNO = toplam GNO`, lastCumulative, a.gpa.gno);
        }

        // Madde 19/6 aşaması GNO ile tutarlı olmalı
        check(`${label}: aşama GNO ile tutarlı`,
            (a.gpa.gno >= 2.0) === (a.standing.stage === 'normal') ||
            a.history.filter(h => !h.key.special).length === 0,
            `GNO ${a.gpa.gno}, aşama ${a.standing.stage}`);

        // Tekrar listesi yalnızca gerçekten tekrar gerektiren notları içermeli
        check(`${label}: tekrar listesinde AA/YT yok`,
            !a.retakes.some(r => r.grade === 'AA' || r.grade === 'YT'),
            a.retakes.filter(r => r.grade === 'AA' || r.grade === 'YT').map(r => r.courseCode).join(','));

        rows.push(
            `  ${label.padEnd(13)}` +
            `${String(a.parsed.records.length).padStart(4)} ders  ` +
            `${String(a.parsed.semesters.length).padStart(2)} dönem  ` +
            `GNO ${a.gpa.gno.toFixed(2)}  ` +
            `${a.gpa.earnedEcts.toFixed(0).padStart(3)} AKTS  ` +
            `${a.standing.stage.padEnd(7)}  ` +
            `tekrar:${String(a.retakes.length).padStart(2)}  ` +
            `düşen:${String(a.superseded.length).padStart(2)}  ` +
            (warnings.length ? `uyarı:${warnings.length}` : '')
        );
    }

    console.log('\n  dosya          ders  dönem  GNO   kazanılan  durum    tekrar  düşen');
    console.log('  ' + '─'.repeat(84));
    rows.forEach(r => console.log(r));
}

// ===========================================================================
console.log(`\n${'═'.repeat(72)}`);
console.log(`Toplam: ${pass + fail} · Başarılı: ${pass} · Başarısız: ${fail}`);
if (fail) {
    console.log('\nBaşarısız:');
    failures.forEach(f => console.log(`  · ${f}`));
    process.exit(1);
}
