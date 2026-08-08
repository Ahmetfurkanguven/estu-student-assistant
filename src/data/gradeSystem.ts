/**
 * ESKİŞEHİR TEKNİK ÜNİVERSİTESİ
 * Ön Lisans ve Lisans Eğitim-Öğretim ve Sınav Yönetmeliği
 * Resmî Gazete: 9/9/2025, Sayı 33012
 * https://www.resmigazete.gov.tr/eskiler/2025/09/20250909-2.htm
 *
 * Bu dosya MADDE 18 (Başarı değerlendirmesi) ve MADDE 19 (Not ortalamaları)
 * hükümlerinin tek doğruluk kaynağıdır. Buradaki tablo yönetmelik metnine
 * birebir uymalıdır; katsayı uydurulmaz.
 */

export type GradeKind =
    | 'coefficient'  // Madde 18/4 — katsayılı, GNO'ya girer
    | 'passfail'     // Madde 18/5-f — YT/YZ, katsayısız, GNO'ya GİRMEZ
    | 'absent'       // Madde 18/5-c — DZ, FF veya YZ ile eş değer
    | 'administrative'; // ÇK, DV, EK, KL, SD

export interface GradeDefinition {
    letter: string;
    /** Madde 18/4 katsayısı. Katsayısı olmayan notlarda null. */
    coefficient: number | null;
    kind: GradeKind;
    /** Dersten başarılı sayılır mı (Madde 18/6: YT, DD veya üstü). */
    passed: boolean;
    /** Not ortalamasına (GNO/DNO) katılır mı (Madde 19/1). */
    countsInGpa: boolean;
    /** Mezuniyete engel mi (Madde 25/1: ÇK, DZ, EK, FF, YZ olmamalı). */
    blocksGraduation: boolean;
    /** Madde 19/5/19/6 kapsamında zorunlu tekrar gerektirir mi. */
    mustRetake: boolean;
    description: string;
    /** Yönetmelikte yer almayan, eski transkriptlerde görülebilen not. */
    legacy?: boolean;
}

/** Madde 18/4 — Başarı düzeyine ilişkin harf notları ve katsayıları. */
const COEFFICIENT_GRADES: Array<[string, number]> = [
    ['AA', 4.0],
    ['AB', 3.7],
    ['BA', 3.3],
    ['BB', 3.0],
    ['BC', 2.7],
    ['CB', 2.3],
    ['CC', 2.0],
    ['CD', 1.7],
    ['DC', 1.3],
    ['DD', 1.0],
    ['FF', 0.0]
];

/** Madde 18/6 — başarılı sayılmak için en az DD gerekir. */
const MIN_PASSING_COEFFICIENT = 1.0;

/** Madde 19/6 — "harf notu CC'nin altında olan dersler". */
export const CC_COEFFICIENT = 2.0;

function buildCoefficientGrade(letter: string, coefficient: number): GradeDefinition {
    const passed = coefficient >= MIN_PASSING_COEFFICIENT;
    return {
        letter,
        coefficient,
        kind: 'coefficient',
        passed,
        countsInGpa: true,
        blocksGraduation: !passed,
        mustRetake: !passed,
        description: `Katsayı ${coefficient.toFixed(2)}`
    };
}

export const GRADES: Record<string, GradeDefinition> = {
    ...Object.fromEntries(
        COEFFICIENT_GRADES.map(([letter, c]) => [letter, buildCoefficientGrade(letter, c)])
    ),

    // Madde 18/5-a
    'ÇK': {
        letter: 'ÇK', coefficient: null, kind: 'administrative',
        passed: false, countsInGpa: false, blocksGraduation: true, mustRetake: false,
        description: 'Çekildi — ekle/sil sonrası üç hafta içinde danışman onayıyla çekilen ders (Madde 10/4)'
    },
    // Madde 18/5-b
    'DV': {
        letter: 'DV', coefficient: null, kind: 'administrative',
        passed: false, countsInGpa: false, blocksGraduation: false, mustRetake: false,
        description: 'Devam ediyor — bir dönemden uzun süren dersin ilk dönemi'
    },
    // Madde 18/5-c — "DZ notu; FF veya YZ harf notuyla eş değerdir."
    'DZ': {
        letter: 'DZ', coefficient: 0.0, kind: 'absent',
        passed: false, countsInGpa: true, blocksGraduation: true, mustRetake: true,
        description: 'Devamsız — FF (katsayılı ders) veya YZ (YT/YZ dersi) ile eş değer'
    },
    // Madde 18/5-ç
    'EK': {
        letter: 'EK', coefficient: null, kind: 'administrative',
        passed: false, countsInGpa: false, blocksGraduation: true, mustRetake: false,
        description: 'Eksik — bir sonraki dönem başlamadan tamamlanmalı, aksi hâlde FF/YZ olur'
    },
    // Madde 18/5-d
    'KL': {
        letter: 'KL', coefficient: null, kind: 'administrative',
        passed: false, countsInGpa: false, blocksGraduation: false, mustRetake: false,
        description: 'Kaldırıldı — programdan kaldırılan ders'
    },
    // Madde 18/5-e
    'SD': {
        letter: 'SD', coefficient: null, kind: 'administrative',
        passed: false, countsInGpa: false, blocksGraduation: false, mustRetake: false,
        description: 'Sorumlu değil — isteğe bağlı hazırlık sınıfı'
    },
    // Madde 18/5-f
    'YT': {
        letter: 'YT', coefficient: null, kind: 'passfail',
        passed: true, countsInGpa: false, blocksGraduation: false, mustRetake: false,
        description: 'Yeterli — katsayısız, not ortalamasına katılmaz'
    },
    'YZ': {
        letter: 'YZ', coefficient: null, kind: 'passfail',
        passed: false, countsInGpa: false, blocksGraduation: true, mustRetake: true,
        description: 'Yetersiz — katsayısız, not ortalamasına katılmaz'
    },

    /**
     * FD, 9/9/2025 tarihli yönetmeliğin Madde 18/4 tablosunda YOKTUR.
     * Eski transkriptlerde görülebildiği için satır düşürmemek adına tanınır,
     * ancak tanındığında uyarı üretilir (bkz. transcriptParser diagnostics).
     */
    'FD': {
        letter: 'FD', coefficient: 0.5, kind: 'coefficient',
        passed: false, countsInGpa: true, blocksGraduation: true, mustRetake: true,
        description: 'Yürürlükteki yönetmelikte tanımlı değil (eski not)',
        legacy: true
    }
};

export const GRADE_LETTERS = Object.keys(GRADES);

/** Uzunluk azalan sırada — tokenizasyonda en uzun eşleşme önce denenir. */
export const GRADE_LETTERS_BY_LENGTH = [...GRADE_LETTERS].sort((a, b) => b.length - a.length);

export function isGradeLetter(token: string): boolean {
    return normalizeGradeLetter(token) !== null;
}

/**
 * "aa", "Aa", "CK", "CG" gibi varyasyonları yönetmelikteki harfe eşler.
 * Türkçe karakter içeren notlar (ÇK) ASCII'ye düşmüş hâlde de gelebilir.
 */
export function normalizeGradeLetter(token: string): string | null {
    const raw = token.trim().toUpperCase();
    if (!raw) return null;
    if (GRADES[raw]) return raw;

    const asciiFolded = raw
        .replace(/Ç|Ç/g, 'Ç')
        .replace(/^CK$/, 'ÇK');
    if (GRADES[asciiFolded]) return asciiFolded;

    return null;
}

export function getGrade(letter: string): GradeDefinition | null {
    const normalized = normalizeGradeLetter(letter);
    return normalized ? GRADES[normalized] : null;
}

/**
 * Madde 18/5-c: DZ, dersin türüne göre FF ya da YZ'ye eş değerdir.
 * YT/YZ ile değerlendirilen bir derste DZ alındıysa not ortalamasına katılmaz.
 */
export function resolveGradeForCourse(
    letter: string,
    opts: { isPassFailCourse?: boolean } = {}
): GradeDefinition | null {
    const grade = getGrade(letter);
    if (!grade) return null;
    if (grade.letter === 'DZ' && opts.isPassFailCourse) {
        return { ...GRADES['YZ'], letter: 'DZ', description: GRADES['DZ'].description };
    }
    return grade;
}

/** Madde 19/6 — "harf notu CC'nin altında olan dersler". */
export function isBelowCC(letter: string): boolean {
    const grade = getGrade(letter);
    if (!grade || grade.coefficient === null) return false;
    return grade.coefficient < CC_COEFFICIENT;
}

/**
 * Madde 8/5: "Bir dersten AA veya YT harf notu alan öğrenci, bu dersi tekrar
 * ya da bu dersin yerine başka bir dersi alamaz."
 */
export function isLockedFromRetake(letter: string): boolean {
    const normalized = normalizeGradeLetter(letter);
    return normalized === 'AA' || normalized === 'YT';
}

/**
 * Geriye dönük uyumluluk: eski kod `GRADE_SYSTEM[letter].coefficient/passed`
 * bekliyor. Yeni kodda GRADES kullanılmalıdır.
 * @deprecated GRADES / getGrade kullanın.
 */
export const GRADE_SYSTEM: Record<string, { coefficient: number; passed: boolean }> =
    Object.fromEntries(
        Object.values(GRADES).map(g => [g.letter, { coefficient: g.coefficient ?? 0, passed: g.passed }])
    );
