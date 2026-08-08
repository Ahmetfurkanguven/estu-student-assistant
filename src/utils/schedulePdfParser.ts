import type { ScheduleOffering } from '../types';

/**
 * ESTÜ haftalık ders programı PDF parser'ı.
 *
 * Gerçek PDF'lerin (2016-2017 … 2026-2027) ortak yapısı:
 *
 *   ┌──────┬──────┬────────┬─────────┬────────┬─────────┐
 *   │ GÜN  │ SAAT │ Ders I │ Derslik │ Ders II│ Derslik │   ← başlık satırı
 *   ├──────┼──────┼────────┼─────────┼────────┼─────────┤
 *   │  P   │08-09 │        │         │        │         │
 *   │  A   │09-10 │MAT 1011│  E 1    │        │         │
 *   │  Z   │10-11 │MAT 1011│  E 1    │        │         │
 *   └──────┴──────┴────────┴─────────┴────────┴─────────┘
 *
 * Uğraşılması gereken gerçek zorluklar:
 *
 *  1. Gün adları DİKEY ve HARF HARF yazılır ("P","A","Z","A","R","T","E","S","İ"),
 *     her biri ayrı bir metin öğesidir.
 *  2. Türkçe karakterler ayrı öğeye bölünür: "K"+"İ"+"M 1005" → "KİM 1005".
 *  3. Kolon düzeni yıllara göre değişir; 2026-2027'de "Öğretim Elemanı" kolonu
 *     eklenmiştir. Bu yüzden kolonlar BAŞLIK SATIRINDAN öğrenilir, sabitlenmez.
 *  4. Bir sayfada yan yana iki sınıf tablosu olabilir (2017-2018).
 *  5. Grup gösterimi en az beş farklı biçimdedir (bkz. parseGroups).
 *  6. Parantez içi hem öğretim elemanı hem grup hem dil olabilir.
 */

// ---------------------------------------------------------------------------
// Girdi tipleri
// ---------------------------------------------------------------------------

export interface PdfTextItem {
    str: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    page: number;
}

export interface ScheduleParseDiagnostic {
    level: 'info' | 'warning' | 'error';
    code: string;
    message: string;
    page?: number;
}

/** Tek bir ders oturumu (teorik saat ya da lab grubu). */
export interface ParsedOffering extends ScheduleOffering {
    /** Dersin adı (koddan sonraki metin, grup/dil/hoca temizlenmiş). */
    courseName: string;
    /** Bu oturumun geçerli olduğu gruplar. Boş dizi = tüm gruplar. */
    groups: string[];
    /** "A-E" gösteriminin harfi harfine okunuşu (['A','E']) — çakışma çözümü için. */
    groupsLiteral: string[];
    /** Gösterim aralık olarak açıldı mı. */
    isRange: boolean;
    instructor: string | null;
    /** Programdaki sınıf tablosu: 1..4 */
    classYear: number | null;
    /** Ham hücre metni — kullanıcıya "şöyle okundu" demek için. */
    rawText: string;
}

/**
 * Programın hangi döneme ait olduğu — başlıktan okunur.
 *
 * Öğrenci her zaman DÖNEMLİK program hazırlar; yıllık program diye bir şey
 * yoktur. Bu yüzden yüklenen dosyanın hangi dönem olduğu, ders önerisinden
 * AKTS sınırına kadar her şeyi etkiler.
 */
export interface ScheduleMeta {
    term: 'guz' | 'bahar' | 'yaz' | null;
    /** "2025-2026" */
    academicYear: string | null;
    /** Başlığın okunan hâli — kullanıcıya doğrulatmak için. */
    label: string | null;
}

export interface ParsedScheduleResult {
    offerings: ParsedOffering[];
    diagnostics: ScheduleParseDiagnostic[];
    /** Programda geçen tüm grup harfleri (şube seçimi için). */
    availableGroups: string[];
    meta: ScheduleMeta;
}

/** "2025-2026 ÖĞRETİM YILI GÜZ DÖNEMİ HAFTALIK DERS PROGRAMI" */
export function detectScheduleMeta(cells: Array<{ text: string }>): ScheduleMeta {
    const haystack = cells.map(c => c.text).join(' ');

    const yearMatch = /(\d{4})\s*[-–—/]\s*(\d{4})/.exec(haystack);
    const academicYear = yearMatch ? `${yearMatch[1]}-${yearMatch[2]}` : null;

    // Türkçe karakterler PDF'te bölünebildiği için sadeleştirilmiş arama.
    const folded = haystack.toUpperCase()
        .replace(/İ/g, 'I').replace(/Ü/g, 'U').replace(/Ö/g, 'O')
        .replace(/Ş/g, 'S').replace(/Ç/g, 'C').replace(/Ğ/g, 'G');

    let term: ScheduleMeta['term'] = null;
    if (/\bGUZ\b|\bFALL\b/.test(folded)) term = 'guz';
    else if (/\bBAHAR\b|\bSPRING\b/.test(folded)) term = 'bahar';
    else if (/\bYAZ\b|\bSUMMER\b/.test(folded)) term = 'yaz';

    const labelMatch = /(\d{4}\s*[-–—/]\s*\d{4}[^|]{0,60}?(?:DÖNEM|DONEM|SEMESTER|YARIYIL)\w*)/i.exec(haystack);

    return { term, academicYear, label: labelMatch ? labelMatch[1].replace(/\s+/g, ' ').trim() : null };
}

export interface ScheduleParseOptions {
    /** Bölüm profilindeki ders kodları — ders/derslik ayrımını kesinleştirir. */
    knownCourseCodes?: string[];
}

// ---------------------------------------------------------------------------
// Sabitler
// ---------------------------------------------------------------------------

export const DAYS_ORDER = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

/** Dikey yazılmış gün adlarını tanımak için harfleri sadeleştirilmiş biçimleri. */
const DAY_SIGNATURES: Array<{ day: string; keys: string[] }> = [
    { day: 'Pazartesi', keys: ['PAZARTESI', 'PZT', 'MONDAY'] },
    { day: 'Salı', keys: ['SALI', 'TUESDAY'] },
    { day: 'Çarşamba', keys: ['CARSAMBA', 'WEDNESDAY'] },
    { day: 'Perşembe', keys: ['PERSEMBE', 'THURSDAY'] },
    { day: 'Cuma', keys: ['CUMA', 'FRIDAY'] },
    { day: 'Cumartesi', keys: ['CUMARTESI', 'SATURDAY'] },
    { day: 'Pazar', keys: ['PAZAR', 'SUNDAY'] }
];

const TIME_RANGE = /^(\d{1,2})(?:[:.](\d{2}))?\s*[-–—]\s*(\d{1,2})(?:[:.](\d{2}))?$/;

/**
 * Ders kodu: "EEM 206", "BİL200", "MAT 1011", "EEM4503A", "İKT151"
 *
 * `\b` KULLANILMAZ: JavaScript'te \b yalnızca [A-Za-z0-9_] üzerinden tanımlıdır,
 * bu yüzden "İKT151" içinde İ ile K arasında sınır görür ve kodu "KT151" diye
 * okur. İ/Ş/Ç/Ğ/Ö/Ü ile başlayan tüm kodlar (İKT151, İST2044, ÇEV…) bozulurdu.
 * Sınır, Türkçe harfleri de kapsayan açık bir lookaround ile kuruluyor.
 */
const CODE_BOUNDARY_BEFORE = '(?<![A-ZÇĞİÖŞÜa-zçğıöşü0-9])';
const COURSE_CODE = new RegExp(
    `${CODE_BOUNDARY_BEFORE}([A-ZÇĞİÖŞÜ]{2,6})\\s?(\\d{2,4})([A-Z])?(?![0-9])`
);

/** Dil etiketleri — ders adının parçası değildir. */
const LANGUAGE_TAG = /\((?:İNG|ING|İNGİLİZCE|TÜR|TUR|TÜRKÇE|ALM|ENG)\)/gi;

const ROOM_ONLY = /^(lab\.?|laboratuvar|[A-ZÇĞİÖŞÜ]\s?\d{1,3}(?:\s*\/\s*[A-ZÇĞİÖŞÜ]?\s?\d{1,3})*|amfi\s*\d*|derslik\s*\d*)$/i;

const ASYNC_PATTERN = /(asenkron|asynchronous|uzaktan|çevrim ?içi|online)/i;

// ---------------------------------------------------------------------------
// 1. Adım: metin öğelerini hücrelere birleştir
// ---------------------------------------------------------------------------

interface Cell {
    text: string;
    x: number;
    xEnd: number;
    y: number;
    page: number;
}

function normalizeText(s: string): string {
    return s.replace(/\s+/g, ' ').trim();
}

/**
 * Aynı satırdaki (y) öğeleri x'e göre sıralayıp, aralarındaki boşluk küçükse
 * birleştirir. "K"+"İ"+"M 1005" → "KİM 1005" bu adımda düzelir.
 */
export function buildCells(items: PdfTextItem[], yTolerance = 2.2, gapThreshold = 2.5): Cell[] {
    const rows = new Map<string, PdfTextItem[]>();

    for (const item of items) {
        if (!item.str || !item.str.trim()) continue;
        const key = `${item.page}:${Math.round(item.y / yTolerance)}`;
        if (!rows.has(key)) rows.set(key, []);
        rows.get(key)!.push(item);
    }

    const cells: Cell[] = [];

    for (const rowItems of rows.values()) {
        const sorted = [...rowItems].sort((a, b) => a.x - b.x);
        let current: Cell | null = null;

        for (const item of sorted) {
            const width = item.width ?? item.str.length * 4;
            if (current && item.x - current.xEnd <= gapThreshold) {
                // Bitişik parça: aynı hücrenin devamı.
                const needsSpace = item.x - current.xEnd > 0.6 && !/\s$/.test(current.text);
                current.text += (needsSpace ? ' ' : '') + item.str;
                current.xEnd = item.x + width;
            } else {
                if (current) cells.push({ ...current, text: normalizeText(current.text) });
                current = { text: item.str, x: item.x, xEnd: item.x + width, y: item.y, page: item.page };
            }
        }
        if (current) cells.push({ ...current, text: normalizeText(current.text) });
    }

    return cells.filter(c => c.text);
}

// ---------------------------------------------------------------------------
// 2. Adım: hücre metnini çözümle (grup / hoca / dil / kod / ad)
// ---------------------------------------------------------------------------

export interface CellParse {
    code: string | null;
    name: string;
    /** Seçilen yorum (varsayılan: aralık). Boş = tüm gruplar. */
    groups: string[];
    /**
     * "A-E" gibi iki harfli gösterimin harfi harfine okunuşu: ['A','E'].
     * Aralık yorumu ("A'dan E'ye") çakışma üretirse buna dönülür.
     */
    groupsLiteral: string[];
    /** Gösterim aralık olarak da okunabiliyor mu ("A-E" evet, "B-C-D" hayır). */
    isRange: boolean;
    allGroups: boolean;
    instructor: string | null;
    isLabText: boolean;
}

/**
 * Şube harfi sıralaması — LATİN alfabesi.
 *
 * Şubeler A, B, C, D, E … diye ilerler; "A-E" gösterimi A, B, C, D, E demektir.
 * Türkçe alfabe kullanılırsa araya Ç girer ve A-E yanlışlıkla A,B,C,Ç,D,E olur.
 * (Ç/Ğ/Ş gibi harfler grup olarak görüldüyse bu, hoca baş harflerinin yanlış
 * ayrıştırılmasından gelir; gerçek şube adı değildir.)
 */
const SECTION_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function alphabetIndex(letter: string): number {
    return SECTION_ALPHABET.indexOf(letter);
}

/**
 * "A-E" gösterimini A'dan E'ye açar.
 *
 * Yalnızca TAM İKİ harf tire ile ayrılmışsa aralık kabul edilir; "B-C-D" gibi
 * üç ve daha fazla harfli gösterimler zaten grupların açık listesidir.
 *
 * `universe` verilirse aralık O DERSTE GERÇEKTEN GÖRÜLEN gruplar üzerinden
 * açılır. Sabit alfabe üzerinden açmak, o bölümde hiç kullanılmayan harfleri
 * (Ç, Ğ, Ş gibi) uyduruyordu.
 */
export function expandRange(letters: string[], universe?: string[]): string[] {
    if (letters.length !== 2) return letters;
    const [from, to] = letters;

    const scale = universe?.length
        ? [...new Set([...universe, from, to])].sort((a, b) => alphabetIndex(a) - alphabetIndex(b))
        : SECTION_ALPHABET.split('');

    const i = scale.indexOf(from);
    const j = scale.indexOf(to);
    if (i === -1 || j === -1 || j <= i) return letters;
    return scale.slice(i, j + 1);
}

/**
 * Parantez içeriğinin öğretim elemanı olup olmadığına karar verir.
 * Öğretim elemanı: "Özge E.", "M. Tankut Ö. -……", "Özen Y., Seval K."
 * Grup:            "A", "Class - All Groups", "Class-A-E Groups"
 */
function looksLikeInstructor(inner: string): boolean {
    const s = inner.trim();
    if (!s) return false;
    if (/grup|group|class|tüm/i.test(s)) return false;
    // Baş harf + nokta kalıbı (Özge E.) ya da nokta içeren isim
    if (/[A-ZÇĞİÖŞÜ][a-zçğıöşü]+\s+[A-ZÇĞİÖŞÜ]\./.test(s)) return true;
    if (/^[A-ZÇĞİÖŞÜ]\.\s/.test(s)) return true;
    if (/[.…]/.test(s) && s.length > 3) return true;
    // Birden fazla kelime ve tek harften uzun → isim olma ihtimali yüksek
    return s.split(/[\s,]+/).filter(Boolean).length >= 2 && s.length > 6;
}

/**
 * "A-E", "B-C-D", "A&B", "A, B" → ['A','B',...]
 *
 * Yalnızca LATİN harf ve rakamlar şube olabilir. Ç/Ğ/İ/Ö/Ş/Ü tek harfleri
 * neredeyse her zaman hoca adının baş harfinden ("Özge E." → "Ö") sızar;
 * bunları şube saymak sahte gruplar üretiyordu.
 */
function splitGroupLetters(raw: string): string[] {
    return raw
        .split(/[-–—&,+/\s]+/)
        .map(s => s.trim().toUpperCase())
        .filter(s => /^[A-Z0-9]$/.test(s));
}

/**
 * Bir hücre birden çok dersi barındırabilir; mesleki seçmeliler aynı saatte
 * paylaşılan bir kutuda listelenir:
 *
 *   "EEM447 (H-I-İ-J) /EEM453 (C-D-E-P-T-U) / EEM455 (B-L) /EEM457 (F-G-K)"
 *
 * Her ders kodunun başladığı yerden bölerek parçalara ayırır.
 */
export function splitMultiCourseCell(raw: string): string[] {
    const text = normalizeText(raw);
    const global = new RegExp(COURSE_CODE.source, 'g');
    const starts: number[] = [];
    let m: RegExpExecArray | null;
    while ((m = global.exec(text)) !== null) starts.push(m.index);

    if (starts.length <= 1) return [text];

    // Yalnızca ayırıcı (/ , ;) ile ayrılmış kodlarda böl — "MAT 1011 Calculus I"
    // gibi tek derste ikinci kod yakalanmışsa bölme.
    const parts: string[] = [];
    for (let i = 0; i < starts.length; i++) {
        const from = starts[i];
        const to = i + 1 < starts.length ? starts[i + 1] : text.length;
        const chunk = text.slice(from, to).trim();
        const separatorBefore = i === 0 || /[\/,;]\s*$/.test(text.slice(0, from).trim() + ' ')
            || /[\/,;]/.test(text.slice(starts[i - 1] ?? 0, from));
        if (i > 0 && !separatorBefore) {
            parts[parts.length - 1] += ' ' + chunk;
        } else {
            parts.push(chunk);
        }
    }
    return parts.filter(Boolean);
}

export function parseCellText(raw: string): CellParse {
    // Saat etiketi hücreye sızmışsa ("08-09 EEM402 …") baştan temizle.
    let text = ' ' + normalizeText(raw).replace(/^\d{1,2}\s*[-–—]\s*\d{1,2}\s+/, '') + ' ';

    // Dil etiketlerini at
    text = text.replace(LANGUAGE_TAG, ' ');

    const groups = new Set<string>();
    let allGroups = false;
    let instructor: string | null = null;
    /** Tire ile ayrılmış tam iki harf görüldüyse aralık okuması mümkündür. */
    let isRange = false;

    const addLetters = (letters: string[], separator: string) => {
        letters.forEach(g => groups.add(g));
        if (letters.length === 2 && /[-–—]/.test(separator)) isRange = true;
    };

    // --- Parantezli bloklar ---
    const parenBlocks: string[] = [];
    text = text.replace(/\(([^()]*)\)/g, (_m, inner: string) => {
        parenBlocks.push(inner);
        return ' '; // parantez bloğu çıkarıldı
    });

    for (const inner of parenBlocks) {
        const s = inner.trim();
        if (!s) continue;

        if (/all\s*groups?|tüm\s*grup/i.test(s)) { allGroups = true; continue; }

        // "Class-A-E Groups", "Class - A - E Groups", "Group(A-B)"
        const groupMatch = /(?:class|grup|group)s?\s*[-–—:]?\s*([A-ZÇĞİÖŞÜ0-9][-–—&,\sA-ZÇĞİÖŞÜ0-9]*)/i.exec(s);
        if (groupMatch && !looksLikeInstructor(s)) {
            const spec = groupMatch[1].replace(/groups?/i, '');
            const letters = splitGroupLetters(spec);
            if (letters.length) { addLetters(letters, spec); continue; }
        }

        // Yalın tek harf: (A), (B)
        if (/^[A-ZÇĞİÖŞÜ0-9]$/i.test(s)) { groups.add(s.toUpperCase()); continue; }

        // "A-B", "A&B"
        if (/^[A-ZÇĞİÖŞÜ0-9]([-–—&,\s][A-ZÇĞİÖŞÜ0-9])+$/i.test(s)) {
            addLetters(splitGroupLetters(s), s);
            continue;
        }

        if (looksLikeInstructor(s)) {
            instructor = instructor ? `${instructor}, ${s}` : s;
            continue;
        }

        // "Class" tek başına → tüm gruplar için teorik
        if (/^class$|^sınıf$/i.test(s)) { allGroups = true; continue; }
    }


    // --- Eğik çizgi ile grup: "Physics Laboratory I / A&B", "... / C" ---
    const slashGroup = /\/\s*([A-ZÇĞİÖŞÜ0-9](?:\s*[&,\-–—]\s*[A-ZÇĞİÖŞÜ0-9])*)\s*$/i.exec(text);
    if (slashGroup) {
        const letters = splitGroupLetters(slashGroup[1]);
        if (letters.length) {
            addLetters(letters, slashGroup[1]);
            text = text.slice(0, slashGroup.index) + ' ';
        }
    }

    // --- Ders kodu ---
    const codeMatch = COURSE_CODE.exec(text);
    const code = codeMatch ? `${codeMatch[1]}${codeMatch[2]}${codeMatch[3] ?? ''}`.toUpperCase() : null;
    if (codeMatch) {
        text = text.slice(0, codeMatch.index) + ' ' + text.slice(codeMatch.index + codeMatch[0].length);
    }

    // --- Koddan hemen sonra gelen çıplak grup harfleri: "FİZ105 A-B" ---
    const bareGroup = /^\s*([A-ZÇĞİÖŞÜ0-9](?:\s*[-–—&,]\s*[A-ZÇĞİÖŞÜ0-9])+)\s+/.exec(text);
    if (bareGroup) {
        const letters = splitGroupLetters(bareGroup[1]);
        if (letters.length >= 2) {
            addLetters(letters, bareGroup[1]);
            text = text.slice(bareGroup[0].length);
        }
    }

    const isLabText = /\blab\b|\blab\.|laboratuvar|laboratory/i.test(raw);
    const name = normalizeText(text.replace(/[-–—:;,]+\s*$/, ''));

    const groupsLiteral = [...groups];
    // VARSAYILAN OKUMA ARALIKTIR: "A-E" = A, B, C, D, E.
    // Bu okuma yanlışsa (dersi iki hoca bölüşmüşse) resolveGroupRanges() veriye
    // bakarak harfi harfine okumaya geri döner.
    return {
        code, name,
        groups: isRange ? expandRange(groupsLiteral) : groupsLiteral,
        groupsLiteral, isRange, allGroups, instructor, isLabText
    };
}

// ---------------------------------------------------------------------------
// 3. Adım: sayfa yapısını çöz
// ---------------------------------------------------------------------------

interface ColumnBand {
    kind: 'course' | 'room' | 'instructor';
    index: number;
    x: number;
    xEnd: number;
}

interface TableLayout {
    /** Tabloyu sınırlayan x aralığı (yan yana tablolar için). */
    xMin: number;
    xMax: number;
    columns: ColumnBand[];
    classYear: number | null;
    headerY: number;
}

const ROMAN: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5 };

function parseTimeCell(text: string): { start: number; end: number } | null {
    const m = TIME_RANGE.exec(text.trim());
    if (!m) return null;
    const start = parseInt(m[1], 10) * 60 + (m[2] ? parseInt(m[2], 10) : 0);
    const end = parseInt(m[3], 10) * 60 + (m[4] ? parseInt(m[4], 10) : 0);
    if (end <= start || start < 6 * 60 || end > 24 * 60) return null;
    return { start, end };
}

function fmt(total: number): string {
    return `${Math.floor(total / 60).toString().padStart(2, '0')}:${(total % 60).toString().padStart(2, '0')}`;
}

/** Başlık satırından ("Ders I | Derslik | …") kolon bantlarını çıkarır. */
function discoverTables(pageCells: Cell[]): TableLayout[] {
    const headerCells = pageCells.filter(c => /^ders\s+[IVX0-9]+$/i.test(c.text));
    if (headerCells.length === 0) return [];

    // Aynı y'deki başlıklar tek bir başlık satırıdır.
    const headerY = headerCells[0].y;
    const sameRow = pageCells.filter(c => Math.abs(c.y - headerY) < 4);

    const marks = sameRow
        .map(c => {
            if (/^ders\s+([IVX0-9]+)$/i.test(c.text)) {
                const label = /^ders\s+([IVX0-9]+)$/i.exec(c.text)![1].toUpperCase();
                return { kind: 'course' as const, index: ROMAN[label] ?? (parseInt(label, 10) || 1), cell: c };
            }
            if (/^derslik$/i.test(c.text)) return { kind: 'room' as const, index: 0, cell: c };
            if (/^öğretim\s*elemanı$|^ogretim\s*elemani$|^instructor$/i.test(c.text)) {
                return { kind: 'instructor' as const, index: 0, cell: c };
            }
            return null;
        })
        .filter((m): m is NonNullable<typeof m> => m !== null)
        .sort((a, b) => a.cell.x - b.cell.x);

    if (!marks.length) return [];

    // Yan yana tablolar: "Ders I" her tekrar ettiğinde yeni tablo başlar.
    const tables: TableLayout[] = [];
    let currentMarks: typeof marks = [];

    for (const mark of marks) {
        if (mark.kind === 'course' && mark.index === 1 && currentMarks.length) {
            tables.push(buildTable(currentMarks, pageCells, headerY));
            currentMarks = [];
        }
        currentMarks.push(mark);
    }
    if (currentMarks.length) tables.push(buildTable(currentMarks, pageCells, headerY));

    return tables;
}

function buildTable(
    marks: Array<{ kind: 'course' | 'room' | 'instructor'; index: number; cell: Cell }>,
    pageCells: Cell[],
    headerY: number
): TableLayout {
    // Başlık hücreleri kolonda ORTALANMIŞTIR ("Ders I" x=211 iken ders metni
    // x=146'da başlar). Bu yüzden kolon sınırları başlık MERKEZLERİNİN orta
    // noktalarından hesaplanır, başlangıç x'lerinden değil.
    const centers = marks.map(m => (m.cell.x + m.cell.xEnd) / 2);

    // İlk kolonun sol sınırı: SAAT kolonunun bittiği yer. Açık bırakılırsa
    // GÜN/SAAT kolonlarını yutar ve "08-09 EEM402 …" gibi birleşmiş hücreler
    // ders sanılır.
    const timeCellsLeft = pageCells.filter(
        c => c.xEnd <= marks[0].cell.x && parseTimeCell(c.text) !== null
    );
    const halfWidth = centers.length > 1 ? (centers[1] - centers[0]) / 2 : 60;
    const leftBound = timeCellsLeft.length
        ? Math.max(...timeCellsLeft.map(c => c.xEnd)) + 1
        : centers[0] - halfWidth;

    const columns: ColumnBand[] = [];
    let lastCourseIndex = 0;

    marks.forEach((mark, i) => {
        if (mark.kind === 'course') lastCourseIndex = mark.index;
        columns.push({
            kind: mark.kind,
            index: mark.kind === 'course' ? mark.index : lastCourseIndex,
            x: i === 0 ? leftBound : (centers[i - 1] + centers[i]) / 2,
            xEnd: i + 1 < centers.length ? (centers[i] + centers[i + 1]) / 2 : centers[i] + halfWidth * 2
        });
    });

    const xMin = leftBound;
    const xMax = columns[columns.length - 1].xEnd;

    // Bu tablonun sınıf yılı: başlığın hemen üstündeki "II. SINIF"
    const yearCell = pageCells
        .filter(c => c.y > headerY && c.y < headerY + 40 && /^([IVX]+)\s*\.\s*SINIF/i.test(c.text))
        .filter(c => c.x >= xMin - 40 && c.x <= xMax)
        .sort((a, b) => a.y - b.y)[0];

    const classYear = yearCell
        ? ROMAN[/^([IVX]+)/i.exec(yearCell.text)![1].toUpperCase()] ?? null
        : null;

    return { xMin, xMax, columns, classYear, headerY };
}

/**
 * Gün bantlarını belirler.
 *
 * Bantların SINIRI her zaman saat sütununun tekrarından çıkarılır: günün ilk
 * saat dilimi (ör. 08-09) her tekrarladığında yeni bir gün başlar. Bu, dikey
 * yazılmış gün harflerini okumaktan çok daha güvenilirdir.
 *
 * Dikey harfler yalnızca bantları ADLANDIRMAK için kullanılır; okunamazsa
 * Pazartesi'den başlayan varsayılan sıra kullanılır.
 */
function detectDayBlocks(
    pageCells: Cell[],
    table: TableLayout,
    timeRows: Array<{ y: number; x: number; start: number; end: number }>
): { blocks: Array<{ day: string; yMax: number; yMin: number }>; named: boolean } {
    const bands = fallbackDayBlocks(timeRows);
    if (!bands.length) return { blocks: [], named: false };

    // Gün kolonu: SAAT kolonunun solunda kalan dar hücreler.
    const timeX = Math.min(...timeRows.map(r => r.x));
    const dayCells = pageCells
        .filter(c => c.y < table.headerY)
        .filter(c => c.x >= timeX - 70 && c.x < timeX - 1)
        .filter(c => c.text.length <= 12 && /^[A-ZÇĞİÖŞÜ.\s]+$/i.test(c.text));

    // Dikey harfleri y'ye göre gruplayarak kelime kur.
    const sorted = [...dayCells].sort((a, b) => b.y - a.y);
    const words: Array<{ text: string; yTop: number; yBottom: number }> = [];
    let acc: { text: string; yTop: number; yBottom: number } | null = null;

    for (const cell of sorted) {
        const letters = cell.text.replace(/[^A-ZÇĞİÖŞÜ]/gi, '');
        if (!letters) continue;
        if (acc && acc.yBottom - cell.y <= 24) {
            acc.text += letters;
            acc.yBottom = cell.y;
        } else {
            if (acc) words.push(acc);
            acc = { text: letters, yTop: cell.y, yBottom: cell.y };
        }
    }
    if (acc) words.push(acc);

    const fold = (s: string) => s.toUpperCase()
        .replace(/İ/g, 'I').replace(/Ş/g, 'S').replace(/Ç/g, 'C')
        .replace(/Ğ/g, 'G').replace(/Ö/g, 'O').replace(/Ü/g, 'U');

    const found: Array<{ day: string; yTop: number; yBottom: number }> = [];
    for (const word of words) {
        const key = fold(word.text);
        const hit = DAY_SIGNATURES.find(d =>
            d.keys.some(k => key.startsWith(k) || (k.startsWith(key) && key.length >= 3)));
        if (hit && !found.some(f => f.day === hit.day)) {
            found.push({ day: hit.day, yTop: word.yTop, yBottom: word.yBottom });
        }
    }

    // Gün adları güvenilir biçimde okunduysa bantları DOĞRUDAN onlardan türet.
    // Saat tekrarı bazen fazladan bant üretiyor (boş Cumartesi satırı gibi);
    // gün adları varken onlara güvenmek daha doğru.
    if (found.length >= 3) {
        const sorted = [...found].sort((a, b) => b.yTop - a.yTop);
        const blocks = sorted.map((f, i) => ({
            day: f.day,
            yMax: i === 0 ? Infinity : (sorted[i - 1].yBottom + f.yTop) / 2,
            yMin: i === sorted.length - 1 ? -Infinity : (f.yBottom + sorted[i + 1].yTop) / 2
        }));
        return { blocks, named: true };
    }

    // Gün adı okunamadı: saat tekrarından gelen bantları sırayla adlandır.
    return {
        blocks: bands.map((b, i) => ({ ...b, day: DAYS_ORDER[i] ?? `Gün ${i + 1}` })),
        named: false
    };
}

/** Gün adı okunamazsa: günün ilk saat dilimi her tekrarladığında yeni gün başlar. */
function fallbackDayBlocks(
    timeRows: Array<{ y: number; start: number }>
): Array<{ day: string; yMax: number; yMin: number }> {
    if (!timeRows.length) return [];
    const firstStart = Math.min(...timeRows.map(r => r.start));
    const starts = timeRows.filter(r => r.start === firstStart).sort((a, b) => b.y - a.y);
    return starts.map((s, i) => ({
        day: DAYS_ORDER[i] ?? `Gün ${i + 1}`,
        yMax: i === 0 ? Infinity : (starts[i - 1].y + s.y) / 2,
        yMin: i === starts.length - 1 ? -Infinity : (s.y + starts[i + 1].y) / 2
    }));
}

// ---------------------------------------------------------------------------
// Ana giriş
// ---------------------------------------------------------------------------

export function parseSchedulePdf(
    items: PdfTextItem[],
    options: ScheduleParseOptions = {}
): ParsedScheduleResult {
    const diagnostics: ScheduleParseDiagnostic[] = [];
    const known = new Set((options.knownCourseCodes ?? []).map(c => c.replace(/\s+/g, '').toUpperCase()));
    const raw: ParsedOffering[] = [];

    const cells = buildCells(items);
    if (!cells.length) {
        diagnostics.push({
            level: 'error', code: 'NO_TEXT',
            message: 'PDF’ten metin çıkarılamadı. Dosya taranmış (görüntü) olabilir.'
        });
        return { offerings: [], diagnostics, availableGroups: [], meta: { term: null, academicYear: null, label: null } };
    }

    const byPage = new Map<number, Cell[]>();
    for (const c of cells) {
        if (!byPage.has(c.page)) byPage.set(c.page, []);
        byPage.get(c.page)!.push(c);
    }

    for (const [pageNum, pageCells] of [...byPage.entries()].sort((a, b) => a[0] - b[0])) {
        const tables = discoverTables(pageCells);

        if (!tables.length) {
            diagnostics.push({
                level: 'info', code: 'NO_TABLE', page: pageNum,
                message: `Sayfa ${pageNum}: "Ders I" başlığı bulunamadı, ders tablosu değil (kapak/not sayfası).`
            });
            continue;
        }

        for (const table of tables) {
            // Bu tablonun saat satırları
            const timeCells = pageCells
                .filter(c => c.x >= table.xMin - 90 && c.xEnd <= table.columns[0].x + 2)
                .map(c => ({ cell: c, time: parseTimeCell(c.text) }))
                .filter((t): t is { cell: Cell; time: { start: number; end: number } } => t.time !== null);

            if (!timeCells.length) {
                diagnostics.push({
                    level: 'warning', code: 'NO_TIME_ROWS', page: pageNum,
                    message: `Sayfa ${pageNum}: saat kolonu okunamadı, tablo atlandı.`
                });
                continue;
            }

            const timeRows = timeCells.map(t => ({
                y: t.cell.y, x: t.cell.x, start: t.time.start, end: t.time.end
            }));

            const { blocks: dayBlocks, named } = detectDayBlocks(pageCells, table, timeRows);
            if (!dayBlocks.length) {
                diagnostics.push({
                    level: 'warning', code: 'NO_DAYS', page: pageNum,
                    message: `Sayfa ${pageNum}: gün bantları çıkarılamadı, tablo atlandı.`
                });
                continue;
            }
            diagnostics.push({
                level: named ? 'info' : 'warning',
                code: named ? 'DAYS_READ' : 'DAY_FALLBACK',
                page: pageNum,
                message: named
                    ? `Sayfa ${pageNum}: ${dayBlocks.length} gün bandı — ${dayBlocks.map(b => b.day).join(', ')}`
                    : `Sayfa ${pageNum}: gün adları okunamadı; saat tekrarına göre ` +
                      `${dayBlocks.length} gün Pazartesi'den başlayarak sıralandı ` +
                      `(${dayBlocks.map(b => b.day).join(', ')}).`
            });

            const rowTolerance = estimateRowHeight(timeRows) * 0.6;

            // Ders hücreleri
            for (const column of table.columns) {
                if (column.kind !== 'course') continue;

                const courseCells = pageCells.filter(
                    c => c.y < table.headerY && c.x >= column.x && c.x < column.xEnd
                );

                for (const cell of courseCells) {
                    if (ROOM_ONLY.test(cell.text)) continue;

                    const day = dayBlocks.find(b => cell.y <= b.yMax && cell.y > b.yMin)?.day;
                    if (!day) continue;

                    const slot = timeRows
                        .map(r => ({ r, d: Math.abs(r.y - cell.y) }))
                        .filter(t => t.d <= rowTolerance)
                        .sort((a, b) => a.d - b.d)[0]?.r;
                    if (!slot) continue;

                    const isAsync = ASYNC_PATTERN.test(cell.text);
                    const room = findRoom(pageCells, table, column, cell, rowTolerance);
                    const roomIsLab = !!room && /^lab/i.test(room);

                    // Bir hücrede birden çok ders olabilir (paylaşılan seçmeli kutusu).
                    for (const fragment of splitMultiCourseCell(cell.text)) {
                        const parsed = parseCellText(fragment);
                        if (!parsed.code) continue;

                        const codeNorm = parsed.code.replace(/\s+/g, '').toUpperCase();
                        // Bilinen kod değilse ve ne ad ne grup varsa muhtemelen derslik
                        if (!known.has(codeNorm) && !parsed.name && !parsed.groups.length) continue;

                        // Lab oturumu mu, teorik mi?
                        //  - "(Class - All Groups)"        → herkese teorik
                        //  - belirli grup + "Lab" derslik  → o grubun lab oturumu
                        const type: 'lecture' | 'lab' =
                            parsed.allGroups ? 'lecture'
                                : (roomIsLab || (parsed.isLabText && parsed.groups.length > 0)) ? 'lab'
                                    : 'lecture';

                        raw.push({
                            courseCode: codeNorm,
                            courseName: parsed.name,
                            day: isAsync ? 'Asenkron' : day,
                            startTime: isAsync ? '00:00' : fmt(slot.start),
                            endTime: isAsync ? '00:00' : fmt(slot.end),
                            section: parsed.allGroups || !parsed.groups.length ? 'All' : parsed.groups.join('-'),
                            groups: parsed.allGroups ? [] : parsed.groups,
                            groupsLiteral: parsed.allGroups ? [] : parsed.groupsLiteral,
                            isRange: parsed.isRange,
                            type,
                            async: isAsync,
                            room: room ?? undefined,
                            instructor: parsed.instructor,
                            classYear: table.classYear,
                            rawText: fragment
                        });
                    }
                }
            }
        }
    }

    const { downgraded } = resolveGroupRanges(raw);
    if (downgraded.length) {
        const list = [...new Set(downgraded.map(o => `${o.courseCode} (${o.groupsLiteral.join('-')})`))];
        diagnostics.push({
            level: 'info', code: 'RANGE_AS_LIST',
            message: `${list.join(', ')}: "${downgraded[0].groupsLiteral.join('-')}" gösterimi aralık ` +
                'olarak açıldığında aynı dersin aynı saatteki başka şubesiyle çakışıyordu; ' +
                'harfi harfine (yalnızca yazılı gruplar) okundu.'
        });
    }

    const offerings = mergeConsecutive(dedupe(raw));
    const availableGroups = [...new Set(offerings.flatMap(o => o.groups))].sort();

    if (!offerings.length) {
        diagnostics.push({
            level: 'error', code: 'NO_OFFERINGS',
            message: 'Tablo bulundu ama hiçbir ders hücresi çözülemedi.'
        });
    } else {
        const byDay: Record<string, number> = {};
        for (const o of offerings) byDay[o.day] = (byDay[o.day] ?? 0) + 1;
        diagnostics.push({
            level: 'info', code: 'SUMMARY',
            message: `${offerings.length} oturum okundu (${new Set(offerings.map(o => o.courseCode)).size} ders` +
                `${availableGroups.length ? `, gruplar: ${availableGroups.join(', ')}` : ''}) — ` +
                Object.entries(byDay).map(([d, c]) => `${d}: ${c}`).join(', ')
        });
    }

    const meta = detectScheduleMeta(cells);
    if (meta.term) {
        diagnostics.push({
            level: 'info', code: 'TERM',
            message: `Program dönemi: ${meta.academicYear ?? ''} ` +
                `${meta.term === 'guz' ? 'Güz' : meta.term === 'bahar' ? 'Bahar' : 'Yaz okulu'}`.trim()
        });
    } else {
        diagnostics.push({
            level: 'warning', code: 'TERM_UNKNOWN',
            message: 'Programın hangi döneme ait olduğu başlıktan okunamadı — dönemi elle seçin.'
        });
    }

    return { offerings, diagnostics, availableGroups, meta };
}

/**
 * "A-E" gösteriminin aralık mı liste mi olduğunu VERİDEN karara bağlar.
 *
 * Varsayılan okuma aralıktır (A-E → A, B, C, D, E). Ancak aynı dersin aynı
 * gün ve saatte başka bir şubesi varsa ve aralık okuması o şubeyle ortak grup
 * üretiyorsa, öğrenci aynı anda iki derste olamayacağına göre gösterim
 * aslında bir listedir (A-E → A ve E). O oturum harfi harfine okumaya döner.
 *
 * Bu ayrım gerçek belgelerde her iki yönde de görülüyor, bu yüzden sabit bir
 * kural yerine tutarlılık kontrolü yapılıyor.
 */
export function resolveGroupRanges(
    offerings: ParsedOffering[]
): { offerings: ParsedOffering[]; downgraded: ParsedOffering[] } {
    const downgraded: ParsedOffering[] = [];
    const byCourse = new Map<string, ParsedOffering[]>();

    for (const o of offerings) {
        const key = o.courseCode.toUpperCase();
        if (!byCourse.has(key)) byCourse.set(key, []);
        byCourse.get(key)!.push(o);
    }

    for (const sessions of byCourse.values()) {
        // Bu derste açıkça listelenmiş (aralık olmayan) tüm grup harfleri.
        // Aralık bu küme üzerinden açılır; bölümde kullanılmayan harf uydurulmaz.
        const universe = [...new Set(
            sessions.filter(s => !s.isRange).flatMap(s => s.groups)
        )];

        // 1) Aralıkları aç
        for (const session of sessions) {
            if (!session.isRange) continue;
            session.groups = expandRange(session.groupsLiteral, universe);
            session.section = session.groups.join('-');
        }

        // 2) Açılım aynı dersin eşzamanlı başka şubesiyle çakışıyorsa geri al
        for (const candidate of sessions) {
            if (!candidate.isRange || candidate.groups.length <= 2) continue;

            const clashes = sessions.some(other => {
                if (other === candidate) return false;
                if (other.groups.length === 0) return false;          // "All Groups" herkesi kapsar

                // Aynı şubenin saat saat tekrarlayan hücreleri — çakışma değil.
                if (other.groupsLiteral.join('-') === candidate.groupsLiteral.join('-')) return false;

                if (!other.groups.some(g => candidate.groups.includes(g))) return false;

                // (a) Aynı dersin AYNI TÜRDEKİ iki oturumu aynı öğrenciyi içeremez:
                //     öğrenci tek bir teorik şubeye ve tek bir lab grubuna gider.
                //     Dersi iki hoca veriyorsa gruplar aralarında bölüşülmüştür;
                //     "A-E" burada A'dan E'ye değil, A ve E şubeleri demektir.
                if (other.type === candidate.type) return true;

                // (b) Tür farklı olsa bile aynı gün ve saatteyse öğrenci ikisinde olamaz.
                if (other.day !== candidate.day) return false;
                return candidate.startTime < other.endTime && other.startTime < candidate.endTime;
            });

            if (clashes) {
                candidate.groups = [...candidate.groupsLiteral];
                candidate.section = candidate.groups.join('-');
                candidate.isRange = false;
                downgraded.push(candidate);
            }
        }
    }

    return { offerings, downgraded };
}

function estimateRowHeight(rows: Array<{ y: number }>): number {
    const ys = [...new Set(rows.map(r => Math.round(r.y)))].sort((a, b) => a - b);
    if (ys.length < 2) return 10;
    const gaps: number[] = [];
    for (let i = 1; i < ys.length; i++) {
        const g = ys[i] - ys[i - 1];
        if (g > 0.5) gaps.push(g);
    }
    if (!gaps.length) return 10;
    gaps.sort((a, b) => a - b);
    return gaps[Math.floor(gaps.length / 2)];
}

/** Ders hücresinin sağındaki "Derslik" kolonunda, aynı satırdaki değeri bulur. */
function findRoom(
    pageCells: Cell[],
    table: TableLayout,
    courseColumn: ColumnBand,
    courseCell: Cell,
    tolerance: number
): string | null {
    const roomColumn = table.columns.find(
        c => c.kind === 'room' && c.index === courseColumn.index && c.x >= courseColumn.x
    );
    if (!roomColumn) return null;

    const hit = pageCells
        .filter(c => c.x >= roomColumn.x && c.x < roomColumn.xEnd)
        .filter(c => Math.abs(c.y - courseCell.y) <= tolerance)
        .sort((a, b) => Math.abs(a.y - courseCell.y) - Math.abs(b.y - courseCell.y))[0];

    return hit ? hit.text : null;
}

function key(o: ParsedOffering): string {
    return [o.courseCode, o.day, o.startTime, o.endTime, o.section, o.type].join('|');
}

function dedupe(list: ParsedOffering[]): ParsedOffering[] {
    const map = new Map<string, ParsedOffering>();
    for (const o of list) {
        const k = key(o);
        const existing = map.get(k);
        if (!existing) { map.set(k, o); continue; }
        if (!existing.room && o.room) existing.room = o.room;
        if (!existing.instructor && o.instructor) existing.instructor = o.instructor;
        if (!existing.courseName && o.courseName) existing.courseName = o.courseName;
    }
    return [...map.values()];
}

function mergeConsecutive(list: ParsedOffering[]): ParsedOffering[] {
    const sorted = [...list].sort((a, b) => {
        const d = DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day);
        if (d !== 0) return d;
        if (a.courseCode !== b.courseCode) return a.courseCode.localeCompare(b.courseCode, 'tr');
        if (a.section !== b.section) return a.section.localeCompare(b.section, 'tr');
        if (a.type !== b.type) return a.type.localeCompare(b.type);
        return a.startTime.localeCompare(b.startTime);
    });

    const merged: ParsedOffering[] = [];
    for (const curr of sorted) {
        const last = merged[merged.length - 1];
        if (
            last &&
            last.day === curr.day &&
            last.courseCode === curr.courseCode &&
            last.section === curr.section &&
            last.type === curr.type &&
            last.endTime === curr.startTime
        ) {
            last.endTime = curr.endTime;
            if (!last.room && curr.room) last.room = curr.room;
        } else {
            merged.push({ ...curr });
        }
    }
    return merged;
}

/** PDF dosyasından doğrudan okuma (tarayıcı tarafı). */
export async function readSchedulePdf(file: File): Promise<PdfTextItem[]> {
    const pdfjs: any = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
    ).href;

    const buffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buffer }).promise;

    const items: PdfTextItem[] = [];
    for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        for (const item of content.items as any[]) {
            items.push({
                str: item.str,
                x: item.transform[4],
                y: item.transform[5],
                width: item.width,
                height: item.height,
                page: p
            });
        }
    }
    return items;
}
