import type { StudentRecord } from '../types';
import { getGrade, normalizeGradeLetter } from '../data/gradeSystem';

/**
 * Transkript parser'ı.
 *
 * Tasarım ilkesi: SABİT KOLON İNDEKSİ KULLANILMAZ.
 * Transkript biçimleri (TXT, PDF, farklı birim şablonları) kolon sayısı ve
 * sırası bakımından değişkendir. Bu yüzden her token *içeriğine* göre
 * sınıflandırılır ve satır, harf notunun konumundan iki yana ayrıştırılır:
 *
 *     KOD   Ders Adı   [kredi] AKTS   NOT   [kredi*not]  [statü]  [yerine]
 *     └─ kod ─┘└ ad ┘  └── notun solundaki sayı(lar) ──┘└─ notun sağı ─┘
 *
 * Ayrıca hiçbir satır sessizce düşürülmez; elenen her satır `diagnostics`
 * içinde gerekçesiyle döner.
 */

export interface TranscriptRecord extends StudentRecord {
    /** Satırın ham hâli — kullanıcıya "şu satır şöyle okundu" demek için. */
    rawLine: string;
    /** Transkriptteki statü kolonu (Z / S / Zorunlu / Seçmeli ...). */
    status: 'zorunlu' | 'secmeli' | 'mesleki_secmeli' | null;
    /**
     * "Yerine" kolonunda adı geçen ders kodu — BU DERSİN YERİNE ALINAN ders.
     *
     * ESTÜ transkriptinde sütun şu şekilde okunur:
     *   MFALM102 ... FF ... S  FİZ237(Tür)   → "MFALM102 yerine FİZ237 alındı"
     * Yani sütunu TAŞIYAN satır eskidir; adı geçen ders geçerlidir.
     * Madde 19/3: "en son alınan dersin notu ve kredisi esas alınır."
     */
    replacedByCode: string | null;
    /** Transfer/değişim eşlemesi yapıldıysa transkriptteki özgün kod. */
    sourceCode: string | null;
    /**
     * İntibak sonrası GÜNCEL müfredattaki karşılık (ör. EMAT221 → MAT2021).
     *
     * Yalnızca müfredat eşlemesi içindir: ön koşul, mezuniyet ve uzmanlaşma
     * kontrolleri buna bakar. GNO hesabında KULLANILMAZ — kod değiştirmek,
     * öğrencinin ayrıca aldığı yeni kodlu dersle çakışıp birini sildiriyordu.
     */
    curriculumCode: string;
    /** Yönetmelikte tanımlı olmayan bir not (ör. FD) kullanıldı mı. */
    legacyGrade: boolean;
}

export type DiagnosticLevel = 'info' | 'warning' | 'error';

export interface TranscriptDiagnostic {
    level: DiagnosticLevel;
    code: string;
    message: string;
    lineNumber?: number;
    line?: string;
}

export interface ParsedTranscript {
    records: TranscriptRecord[];
    diagnostics: TranscriptDiagnostic[];
    /** Tespit edilen dönem başlıkları, transkriptteki sırasıyla. */
    semesters: string[];
}

export interface ParseOptions {
    /**
     * Hiçbir koşulda okunmayacak ders kodları.
     *
     * Varsayılan BOŞTUR. Eski sürümde MFALM102/TTTT02 kodları koda gömülüydü;
     * bu dersler aslında "yerine ders" kuralının doğal sonucu olarak düşer,
     * özel listeye gerek yoktur.
     */
    ignoredCourseCodes?: string[];
}

const DEFAULT_IGNORED: string[] = [];

const UNKNOWN_SEMESTER = 'Bilinmeyen Dönem';

/** Türkçe büyük harfler dâhil ders kodu kalıbı: EEM336, MAT1011, İST2044, EEM4503A */
const COURSE_CODE = /^([A-ZÇĞİÖŞÜ]{2,5})[ ]?(\d{2,5})([A-Z])?$/;

const TERM_KEYWORDS = 'Güz|Bahar|Yaz|GÜZ|BAHAR|YAZ|Guz';
const SPECIAL_TERM_KEYWORDS = 'Transfer|Erasmus|Değişim|Degisim|DGS|Yatay|Dikey|Muafiyet|İntibak|Intibak';

/** "2023-2024 Güz", "2023 - 2024 Bahar Dönemi", "2024-2025 Yaz Okulu" */
const SEMESTER_HEADER = new RegExp(`\\d{4}\\s*[-–—/]\\s*\\d{4}[^\\n]*?(${TERM_KEYWORDS}|${SPECIAL_TERM_KEYWORDS})`, 'i');
const SPECIAL_SEMESTER = new RegExp(`(${SPECIAL_TERM_KEYWORDS})`, 'i');

const STATUS_MAP: Record<string, TranscriptRecord['status']> = {
    'Z': 'zorunlu',
    'ZORUNLU': 'zorunlu',
    'S': 'secmeli',
    'SEÇMELİ': 'secmeli',
    'SECMELI': 'secmeli',
    'MS': 'mesleki_secmeli',
    'MSD': 'mesleki_secmeli'
};

function isNumericToken(token: string): boolean {
    return /^\d{1,3}([.,]\d{1,2})?$/.test(token);
}

function toNumber(token: string): number {
    return parseFloat(token.replace(',', '.'));
}

function hasDecimal(token: string): boolean {
    return /[.,]\d/.test(token);
}

function asCourseCode(token: string): string | null {
    // "TÜR125(Tür)" -> "TÜR125"
    const cleaned = token.replace(/\(.*?\)/g, '').replace(/[^\wÇĞİÖŞÜçğıöşü]/g, '').toUpperCase();
    const match = COURSE_CODE.exec(cleaned);
    if (!match) return null;
    return `${match[1]}${match[2]}${match[3] ?? ''}`;
}

/**
 * PDF metin parçalarından satır kurar.
 *
 * Eski kod parçaları tek boşlukla birleştiriyordu; bu, kolon yapısını tamamen
 * yok ediyor ve `\s{2,}` ile kolon ayıran her mantığı bozuyordu. Burada yatay
 * boşluk korunur: geniş boşluklar sekmeye dönüşür.
 */
export interface PdfTextItemLike {
    str: string;
    x: number;
    y: number;
    width?: number;
    page?: number;
}

export function buildLinesFromPdfItems(items: PdfTextItemLike[], yTolerance = 3): string[] {
    const rows = new Map<string, PdfTextItemLike[]>();

    for (const item of items) {
        if (!item.str || !item.str.trim()) continue;
        const page = item.page ?? 1;
        const bucket = Math.round(item.y / yTolerance);
        const key = `${page}:${bucket}`;
        if (!rows.has(key)) rows.set(key, []);
        rows.get(key)!.push(item);
    }

    const ordered = [...rows.entries()].sort((a, b) => {
        const [pageA, bucketA] = a[0].split(':').map(Number);
        const [pageB, bucketB] = b[0].split(':').map(Number);
        if (pageA !== pageB) return pageA - pageB;
        return bucketB - bucketA; // PDF'te y yukarıdan aşağı azalır
    });

    return ordered.map(([, rowItems]) => {
        const sorted = [...rowItems].sort((a, b) => a.x - b.x);
        let line = '';
        let cursorEnd: number | null = null;

        for (const item of sorted) {
            const text = item.str.trim();
            if (!text) continue;
            if (cursorEnd !== null) {
                const gap = item.x - cursorEnd;
                // Geniş boşluk = kolon sınırı. Dar boşluk = kelime arası.
                line += gap > 6 ? '\t' : (gap > 0.5 ? ' ' : '');
            }
            line += text;
            cursorEnd = item.x + (item.width ?? text.length * 4);
        }
        return line;
    }).filter(line => line.trim());
}

export function parseTranscript(text: string, options: ParseOptions = {}): ParsedTranscript {
    const ignored = new Set((options.ignoredCourseCodes ?? DEFAULT_IGNORED).map(c => c.toUpperCase()));
    const records: TranscriptRecord[] = [];
    const diagnostics: TranscriptDiagnostic[] = [];
    const semesters: string[] = [];

    let currentSemester = '';
    let warnedMissingSemester = false;
    let candidateLines = 0;

    const lines = text.split(/\r?\n/);

    lines.forEach((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) return;
        const lineNumber = idx + 1;

        // --- Dönem başlığı -------------------------------------------------
        // "Dönem"/"Okulu" kelimesi ŞART DEĞİL; yıl aralığı + dönem adı yeterli.
        if (SEMESTER_HEADER.test(line) && !COURSE_CODE.test(line.split(/[\s\t]+/)[0] ?? '')) {
            currentSemester = line.replace(/\t+/g, ' ').trim();
            if (!semesters.includes(currentSemester)) semesters.push(currentSemester);
            return;
        }

        // --- Ders satırı ---------------------------------------------------
        const tokens = line.split(/[\t ]+/).filter(Boolean);
        if (tokens.length < 3) return;

        // Kod tek token olabilir ("EEM336") ya da PDF'te ikiye bölünmüş olabilir ("EEM" "336").
        let code = asCourseCode(tokens[0]);
        let codeTokenCount = 1;
        if (!code && tokens.length > 1) {
            const joined = asCourseCode(`${tokens[0]}${tokens[1]}`);
            if (joined && /^[A-ZÇĞİÖŞÜ]{2,5}$/.test(tokens[0])) {
                code = joined;
                codeTokenCount = 2;
            }
        }
        if (!code) return; // başlık, özet, GNO satırı vb.

        candidateLines++;

        if (ignored.has(code)) {
            diagnostics.push({
                level: 'info', code: 'IGNORED_COURSE', lineNumber, line,
                message: `${code} yok sayılan kayıt listesinde olduğu için atlandı.`
            });
            return;
        }

        // Harf notu: SONDAN ilk geçerli not. ("DC Machines" gibi ders adları
        // yüzünden baştan aramak yanlış sonuç verir.)
        let gradeIndex = -1;
        for (let i = tokens.length - 1; i >= codeTokenCount; i--) {
            if (normalizeGradeLetter(tokens[i])) { gradeIndex = i; break; }
        }
        if (gradeIndex === -1) {
            diagnostics.push({
                level: 'warning', code: 'NO_GRADE', lineNumber, line,
                message: `${code}: satırda tanınan bir harf notu yok, atlandı.`
            });
            return;
        }

        // Notun hemen solundaki ardışık sayı dizisi = kredi/AKTS kolonları.
        const creditTokens: string[] = [];
        for (let i = gradeIndex - 1; i >= codeTokenCount; i--) {
            if (isNumericToken(tokens[i])) creditTokens.unshift(tokens[i]);
            else break;
        }
        if (creditTokens.length === 0) {
            diagnostics.push({
                level: 'warning', code: 'NO_CREDIT', lineNumber, line,
                message: `${code}: notun solunda kredi/AKTS sayısı bulunamadı, atlandı.`
            });
            return;
        }

        // Madde 8/1 — "Derslerin kredileri ... AKTS kredileridir."
        // İki sayı varsa ondalıklı olan AKTS'tir (yerel kredi genelde tamsayı).
        let ects: number;
        let localCredits: number | undefined;
        if (creditTokens.length === 1) {
            ects = toNumber(creditTokens[0]);
        } else {
            const decimals = creditTokens.filter(hasDecimal);
            const ectsToken = decimals.length === 1 ? decimals[0] : creditTokens[creditTokens.length - 1];
            ects = toNumber(ectsToken);
            const other = creditTokens.filter(t => t !== ectsToken);
            if (other.length) localCredits = toNumber(other[other.length - 1]);
        }

        const gradeLetter = normalizeGradeLetter(tokens[gradeIndex])!;
        const gradeDef = getGrade(gradeLetter)!;

        if (gradeDef.legacy) {
            diagnostics.push({
                level: 'warning', code: 'LEGACY_GRADE', lineNumber, line,
                message: `${code}: "${gradeLetter}" notu 9/9/2025 tarihli yönetmelikte tanımlı değil; ` +
                    `katsayısı ${gradeDef.coefficient} varsayıldı.`
            });
        }

        const name = tokens
            .slice(codeTokenCount, gradeIndex - creditTokens.length)
            .join(' ')
            .replace(/\s*\(\s*\)\s*/g, ' ')
            .trim();

        // --- Notun sağı: kredi*not, statü, yerine ---------------------------
        const tail = tokens.slice(gradeIndex + 1);
        let status: TranscriptRecord['status'] = null;
        let tailCode: string | null = null;

        for (const token of tail) {
            const upper = token.toUpperCase();
            if (status === null && STATUS_MAP[upper] !== undefined) { status = STATUS_MAP[upper]; continue; }
            if (isNumericToken(token)) continue; // kredi*not çarpımı
            const maybeCode = asCourseCode(token);
            if (maybeCode && maybeCode !== code && tailCode === null) tailCode = maybeCode;
        }

        const isSpecialSemester = SPECIAL_SEMESTER.test(currentSemester);

        let finalCode = code;
        let sourceCode: string | null = null;
        let replacedByCode: string | null = null;

        if (tailCode) {
            if (isSpecialSemester) {
                // Transfer/değişim satırında karşılık kolonu YEREL dersi gösterir.
                finalCode = tailCode;
                sourceCode = code;
                diagnostics.push({
                    level: 'info', code: 'TRANSFER_MAPPED', lineNumber, line,
                    message: `${code} → ${tailCode} olarak eşlendi (${currentSemester}).`
                });
            } else {
                // Madde 19/3 — "seçmeli dersin yerine başka bir dersin alınması
                // durumunda en son alınan dersin notu ve kredisi esas alınır."
                // Sütunu taşıyan satır ESKİ derstir; adı geçen ders geçerlidir.
                replacedByCode = tailCode;
                diagnostics.push({
                    level: 'info', code: 'SUBSTITUTION', lineNumber, line,
                    message: `${code} yerine ${tailCode} alınmış (Madde 19/3). ` +
                        `${tailCode} transkriptte bulunursa ${code} ortalamadan düşürülecek.`
                });
            }
        }

        if (!currentSemester) {
            currentSemester = UNKNOWN_SEMESTER;
            if (!semesters.includes(UNKNOWN_SEMESTER)) semesters.push(UNKNOWN_SEMESTER);
            if (!warnedMissingSemester) {
                warnedMissingSemester = true;
                diagnostics.push({
                    level: 'warning', code: 'NO_SEMESTER_HEADER', lineNumber, line,
                    message: 'Dönem başlığı bulunamadan ders satırı görüldü. Dersler ' +
                        `"${UNKNOWN_SEMESTER}" altında toplandı; dönem bazlı analizler (DNO, ` +
                        'akademik yetersizlik) güvenilir olmayabilir.'
                });
            }
        }

        records.push({
            id: `${finalCode}-${currentSemester}-${records.length}`,
            courseCode: finalCode,
            courseName: name,
            semester: currentSemester,
            credits: ects,
            ects,
            grade: {
                letter: gradeDef.letter,
                coefficient: gradeDef.coefficient ?? 0,
                passed: gradeDef.passed
            },
            countInGPA: gradeDef.countsInGpa,
            rawLine: line,
            status,
            replacedByCode,
            sourceCode,
            // İntibak sonradan resolveRecords() içinde doldurulur.
            curriculumCode: finalCode,
            legacyGrade: Boolean(gradeDef.legacy)
        });

        if (localCredits !== undefined && Math.abs(localCredits - ects) > 0.01) {
            diagnostics.push({
                level: 'info', code: 'CREDIT_COLUMNS', lineNumber, line,
                message: `${finalCode}: iki kredi kolonu görüldü (${localCredits} / ${ects}). ` +
                    `AKTS ${ects} kabul edildi (Madde 8/1).`
            });
        }
    });

    if (records.length === 0) {
        diagnostics.push({
            level: 'error', code: 'NO_RECORDS',
            message: candidateLines > 0
                ? `Ders kodu içeren ${candidateLines} satır bulundu ama hiçbiri okunamadı. ` +
                  'Yukarıdaki uyarılar satır satır nedenini gösteriyor.'
                : 'Dosyada ders kodu ile başlayan hiçbir satır bulunamadı. ' +
                  'PDF taranmış (görüntü) olabilir veya beklenen düzende olmayabilir.'
        });
    }

    return { records, diagnostics, semesters };
}

/**
 * Eski API. `parseTranscript` tanı bilgisi de döndürür; yeni kod onu kullanmalı.
 * @deprecated
 */
export function parseTranscriptText(text: string): StudentRecord[] {
    return parseTranscript(text).records;
}

/** PDF/TXT dosyasını metne çevirir. PDF'te kolon yapısı korunur. */
export async function readTranscriptFile(file: File): Promise<string> {
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
        const pdfjs: any = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
            'pdfjs-dist/build/pdf.worker.min.mjs',
            import.meta.url
        ).href;

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

        const items: PdfTextItemLike[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            for (const item of content.items as any[]) {
                items.push({
                    str: item.str,
                    x: item.transform[4],
                    y: item.transform[5],
                    width: item.width,
                    page: i
                });
            }
        }
        return buildLinesFromPdfItems(items).join('\n');
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = event => resolve(event.target?.result as string);
        reader.onerror = () => reject(new Error('Dosya okunamadı'));
        reader.readAsText(file);
    });
}
