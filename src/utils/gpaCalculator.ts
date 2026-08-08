import type { IntibakMapping } from '../types';
import type { TranscriptRecord, TranscriptDiagnostic } from './transcriptParser';
import { getGrade } from '../data/gradeSystem';

/**
 * GNO/DNO hesabı — ESTÜ Ön Lisans ve Lisans Eğitim-Öğretim ve Sınav Yönetmeliği
 * (RG 9/9/2025, 33012) MADDE 19'a göre.
 *
 * Madde 19/1: "Not ortalaması; not ortalamasına katılan her bir dersin kredi
 * değeriyle o dersten alınan notun katsayısı çarpılarak bulunan değerlerin
 * toplamının, bu derslerin toplam kredi değerine bölünmesiyle bulunur."
 * → Ders başına ara yuvarlama YOKTUR; yalnızca sonuç iki basamağa yuvarlanır.
 *
 * Madde 19/3: "GNO hesaplanırken tekrar edilen ... dersin en son notu ve
 * kredisi; seçmeli dersin yerine başka bir dersin alınması durumunda ise en son
 * alınan dersin notu ve kredisi esas alınır."
 */

// ---------------------------------------------------------------------------
// Dönem sıralaması
// ---------------------------------------------------------------------------

const TERM_ORDER: Record<string, number> = { 'güz': 1, 'guz': 1, 'bahar': 2, 'yaz': 3 };

export interface SemesterKey {
    label: string;
    year: number;
    term: number;
    /** Transfer/intibak/muafiyet gibi takvime oturmayan kayıtlar. */
    special: boolean;
}

export function parseSemesterLabel(label: string): SemesterKey {
    const yearMatch = /(\d{4})\s*[-–—/]\s*(\d{4})/.exec(label);
    const termMatch = /(Güz|Guz|Bahar|Yaz)/i.exec(label);
    const special = /(Transfer|Erasmus|Değişim|Degisim|DGS|Yatay|Dikey|Muafiyet|İntibak|Intibak)/i.test(label);

    return {
        label,
        year: yearMatch ? parseInt(yearMatch[1], 10) : Number.NEGATIVE_INFINITY,
        term: termMatch ? (TERM_ORDER[termMatch[1].toLowerCase()] ?? 0) : 0,
        special
    };
}

export function compareSemesters(a: string, b: string): number {
    const ka = parseSemesterLabel(a);
    const kb = parseSemesterLabel(b);

    // Transfer/intibak kayıtları takvimin en başına konur: sonraki dönemlerde
    // aynı ders tekrar alınmışsa "en son not" doğru şekilde kazanır.
    if (ka.special !== kb.special) return ka.special ? -1 : 1;
    if (ka.year !== kb.year) return ka.year - kb.year;
    if (ka.term !== kb.term) return ka.term - kb.term;
    return a.localeCompare(b, 'tr');
}

export function sortSemesters(labels: string[]): string[] {
    return [...new Set(labels)].sort(compareSemesters);
}

// ---------------------------------------------------------------------------
// Kayıt çözümleme: intibak → yerine ders → tekrar
// ---------------------------------------------------------------------------

export type SupersedeReason = 'intibak' | 'yerine' | 'tekrar';

export interface SupersededRecord {
    record: TranscriptRecord;
    reason: SupersedeReason;
    /** Bu kaydın yerine geçen kayıt. */
    replacedBy: TranscriptRecord;
    explanation: string;
}

export interface ResolvedTranscript {
    /** GNO ve ilerleme hesaplarında kullanılacak nihai kayıtlar. */
    active: TranscriptRecord[];
    /** Düşen kayıtlar — kullanıcıya "neden sayılmadı" diye gösterilir. */
    superseded: SupersededRecord[];
    diagnostics: TranscriptDiagnostic[];
}

const U = (s: string) => s.trim().toUpperCase();

/**
 * Madde 5/1 — intibak eşlemesi.
 *
 * DERS KODUNU DEĞİŞTİRMEZ; yalnızca `curriculumCode` alanını doldurur.
 *
 * Kodu yeniden yazmak, öğrencinin hem eski hem yeni kodlu dersi aldığı
 * durumlarda ikisini tek koda indiriyor ve biri "tekrar" sanılarak
 * ortalamadan siliniyordu. 10 gerçek transkriptin resmî GNO'suyla
 * karşılaştırıldığında bunun yanlış olduğu ölçüldü: üniversite iki dersi de
 * ayrı ayrı sayıyor (tests/transcript-corpus.test.ts).
 */
export function applyIntibak(records: TranscriptRecord[], mappings: IntibakMapping[]): TranscriptRecord[] {
    if (!mappings.length) return records;
    const byOld = new Map(mappings.map(m => [U(m.oldCode), m.newCode]));

    return records.map(record => {
        const mapped = byOld.get(U(record.courseCode));
        return mapped ? { ...record, curriculumCode: mapped } : record;
    });
}

/** Bir kaydın müfredat eşleşmesinde kabul edilen kodları. */
export function recordCodes(record: TranscriptRecord): string[] {
    const codes = [U(record.courseCode)];
    if (record.curriculumCode && U(record.curriculumCode) !== codes[0]) {
        codes.push(U(record.curriculumCode));
    }
    return codes;
}

/**
 * Transkript kayıtlarını GNO'ya girecek nihai listeye indirger.
 *
 * Kurallar, 10 gerçek transkriptin üzerinde basılı resmî GNO ile karşılaştırılarak
 * belirlenmiştir (tests/transcript-corpus.test.ts — 10/10 birebir tutuyor):
 *
 *   1. "Yerine" sütunu dolu olan bir dersin hedefi transkriptte de varsa,
 *      o ders TÜM DENEMELERİYLE düşer; yerine alınan ders geçerlidir.
 *      Hedef transkriptte yoksa satır düşmez — o ders tek kayıttır.
 *   2. Kalanlarda aynı ders birden çok kez alınmışsa EN SON alınan geçerlidir
 *      (Madde 19/3).
 *   3. İntibak kod DEĞİŞTİRMEZ; yalnızca `curriculumCode` doldurur.
 */
export function resolveRecords(
    records: TranscriptRecord[],
    options: { intibak?: IntibakMapping[] } = {}
): ResolvedTranscript {
    const diagnostics: TranscriptDiagnostic[] = [];
    const superseded: SupersededRecord[] = [];

    const working = options.intibak?.length
        ? applyIntibak(records, options.intibak)
        : [...records];

    // 1) "Yerine" sütunu.
    //
    // Sütunu taşıyan A kaydı, B dersinin yerine sayıldığını bildirir. A'nın
    // ortalamadan düşüp düşmeyeceği ÜÇ duruma ayrılır. Bu ayrım 12 gerçek
    // transkriptin üzerinde basılı resmî GNO ile ölçülerek belirlenmiştir
    // (tests/transcript-corpus.test.ts — 12/12 birebir):
    //
    //   a) B transkriptte YOKSA  → A düşmez. A, o dersin tek kaydıdır.
    //      Erasmus satırları böyledir: TTTT01 (BA) → EEM210, EEM210 hiç
    //      alınmamıştır; TTTT01 öğrencinin gerçekten aldığı derstir.
    //
    //   b) A'dan BAŞARISIZ olunmuşsa → A tüm denemeleriyle düşer.
    //      MFALM102 (FF, sonra DZ) → FİZ237: ders bırakılıp yerine FİZ237
    //      alınmıştır; MFALM102'nin hiçbir denemesi ortalamaya girmez.
    //
    //   c) A başarılıysa, B'den ÖNCE alınmışsa düşer; SONRA alınmışsa kalır.
    //      Madde 19/3: "en son alınan dersin notu ve kredisi esas alınır."
    //      Erasmus'ta daha sonra alınan TTTT04 (BA) → EEM102 (DD, önceki
    //      dönem) örneğinde ikisi de sayılır; üniversite de böyle hesaplıyor.
    const present = new Set(working.map(r => U(r.courseCode)));

    const latestAttempt = new Map<string, TranscriptRecord>();
    for (const record of working) {
        const key = U(record.courseCode);
        const existing = latestAttempt.get(key);
        if (!existing || compareSemesters(record.semester, existing.semester) >= 0) {
            latestAttempt.set(key, record);
        }
    }

    const replacedBy = new Map<string, TranscriptRecord>();

    for (const record of working) {
        if (!record.replacedByCode) continue;
        const own = U(record.courseCode);
        const target = U(record.replacedByCode);
        if (target === own) continue;

        // (a) Hedef yok → düşürme, ama kullanıcıyı haberdar et.
        if (!present.has(target)) {
            diagnostics.push({
                level: 'warning', code: 'SUBSTITUTION_REPLACEMENT_MISSING',
                message: `${record.courseCode}, ${record.replacedByCode} dersinin yerine sayılmış ` +
                    `ama ${record.replacedByCode} transkriptte yok. ${record.courseCode} ` +
                    'ortalamada bırakıldı — kontrol edin.'
            });
            continue;
        }

        const own_ = latestAttempt.get(own)!;
        const replacement = latestAttempt.get(target)!;

        // (b) Başarısız olunan ders bırakılmıştır.
        if (!own_.grade.passed) { replacedBy.set(own, replacement); continue; }

        // (c) Başarılı ama daha eski → sonraki ders esas alınır.
        if (compareSemesters(own_.semester, replacement.semester) < 0) {
            replacedBy.set(own, replacement);
        }
    }

    const surviving: TranscriptRecord[] = [];
    for (const record of working) {
        const replacement = replacedBy.get(U(record.courseCode));
        if (!replacement) { surviving.push(record); continue; }
        superseded.push({
            record,
            reason: 'yerine',
            replacedBy: replacement,
            explanation:
                `${record.courseCode} (${record.grade.letter}) dersi yerine ` +
                `${replacement.courseCode} alınmış; ${record.courseCode} ortalamaya girmez.`
        });
    }

    if (replacedBy.size) {
        diagnostics.push({
            level: 'info', code: 'SUBSTITUTIONS',
            message: `${replacedBy.size} ders başka bir dersin yerine sayıldığı için ortalamadan çıkarıldı: ` +
                [...replacedBy.entries()].map(([k, v]) => `${k} → ${v.courseCode}`).join(', ')
        });
    }

    // 2) Tekrar: ders kodu başına en son dönem kazanır (Madde 19/3).
    const latest = new Map<string, TranscriptRecord>();
    for (const record of surviving) {
        const key = U(record.courseCode);
        const existing = latest.get(key);
        if (!existing) { latest.set(key, record); continue; }

        const cmp = compareSemesters(record.semester, existing.semester);
        const [winner, loser] = cmp >= 0 ? [record, existing] : [existing, record];
        latest.set(key, winner);
        superseded.push({
            record: loser,
            reason: 'tekrar',
            replacedBy: winner,
            explanation:
                `${loser.courseCode} dersi tekrar edilmiş. Madde 19/3 uyarınca en son ` +
                `alınan not geçerlidir: ${winner.semester} / ${winner.grade.letter} ` +
                `(düşen: ${loser.semester} / ${loser.grade.letter}).`
        });
    }

    return {
        active: [...latest.values()].sort((a, b) =>
            compareSemesters(a.semester, b.semester) || a.courseCode.localeCompare(b.courseCode, 'tr')),
        superseded,
        diagnostics
    };
}

// ---------------------------------------------------------------------------
// Ortalama hesabı
// ---------------------------------------------------------------------------

export interface GpaResult {
    /** Genel Not Ortalaması, iki basamağa yuvarlanmış (Madde 19/1). */
    gno: number;
    /** Ortalamaya giren derslerin toplam AKTS'i (payda). */
    gpaEcts: number;
    /** Başarıyla tamamlanan toplam AKTS (mezuniyet sayacı). */
    earnedEcts: number;
    /** Alınan tüm derslerin toplam AKTS'i. */
    attemptedEcts: number;
    /** Ortalamaya giren dersler. */
    countedCourses: TranscriptRecord[];
    /** YT/ÇK/EK gibi ortalamaya girmeyen dersler. */
    excludedCourses: TranscriptRecord[];
}

export function calculateGpa(records: TranscriptRecord[]): GpaResult {
    let weighted = 0;
    let gpaEcts = 0;
    let earnedEcts = 0;
    let attemptedEcts = 0;
    const countedCourses: TranscriptRecord[] = [];
    const excludedCourses: TranscriptRecord[] = [];

    for (const record of records) {
        const grade = getGrade(record.grade.letter);
        const ects = Number.isFinite(record.ects) ? record.ects : 0;
        attemptedEcts += ects;

        // Madde 18/5-f: YT/YZ katsayısızdır ve not ortalamasına KATILMAZ.
        // Madde 18/5-a/b/ç/d/e: ÇK, DV, EK, KL, SD de ortalamaya girmez.
        if (!grade || !grade.countsInGpa || grade.coefficient === null) {
            excludedCourses.push(record);
        } else {
            weighted += grade.coefficient * ects;
            gpaEcts += ects;
            countedCourses.push(record);
        }

        if (grade?.passed) earnedEcts += ects;
    }

    // Madde 19/1 — ara yuvarlama yok; sonuç iki basamak.
    const gno = gpaEcts > 0 ? Math.round((weighted / gpaEcts) * 100) / 100 : 0;

    return { gno, gpaEcts, earnedEcts, attemptedEcts, countedCourses, excludedCourses };
}

// ---------------------------------------------------------------------------
// Dönem geçmişi — Madde 19/6 (akademik yetersizlik) için zorunlu
// ---------------------------------------------------------------------------

export interface SemesterSnapshot {
    label: string;
    key: SemesterKey;
    /** O dönemde harf notu oluşan dersler üzerinden DNO (Madde 19/1). */
    dno: number;
    /** O dönemin sonu itibarıyla kümülatif GNO. */
    gno: number;
    ectsTaken: number;
    ectsEarned: number;
    records: TranscriptRecord[];
}

/**
 * Dönem dönem DNO ve o döneme kadarki kümülatif GNO'yu üretir.
 *
 * Kümülatif GNO her adımda yeniden çözümlenir: o tarihe kadar alınmış dersler
 * arasında "en son not" kuralı uygulanır. Böylece geçmiş dönemlerin GNO'su,
 * sonradan yapılan tekrarlardan etkilenmez.
 */
export function buildSemesterHistory(records: TranscriptRecord[]): SemesterSnapshot[] {
    const labels = sortSemesters(records.map(r => r.semester));
    const snapshots: SemesterSnapshot[] = [];

    labels.forEach((label, index) => {
        const semesterRecords = records.filter(r => r.semester === label);
        const upToHere = records.filter(r => {
            const idx = labels.indexOf(r.semester);
            return idx >= 0 && idx <= index;
        });

        const dnoResult = calculateGpa(semesterRecords);
        const cumulative = calculateGpa(resolveRecords(upToHere).active);

        snapshots.push({
            label,
            key: parseSemesterLabel(label),
            dno: dnoResult.gno,
            gno: cumulative.gno,
            ectsTaken: dnoResult.attemptedEcts,
            ectsEarned: dnoResult.earnedEcts,
            records: semesterRecords
        });
    });

    return snapshots;
}
