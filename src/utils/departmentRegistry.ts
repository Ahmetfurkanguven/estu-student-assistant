import type { DepartmentIndex, DepartmentIndexEntry, DepartmentProfile } from '../types/department';

/**
 * Bölüm profillerini `public/data/departments/` altından yükler.
 *
 * Tasarım kararı: uygulama hiçbir bölümü koda gömmez. Profili olmayan bölüm
 * desteklenmez ve kullanıcıya bunun nasıl ekleneceği açıkça söylenir.
 */

/**
 * Dağıtım kök yolu.
 *
 * DİKKAT: `import.meta.env` ifadesi Vite tarafından DERLEME ANINDA metin olarak
 * değiştirilir. `(import.meta as any).env` gibi bir yazım bu eşleşmeyi bozar;
 * üretim derlemesinde değer `undefined` kalır ve tüm istekler kök yola gider.
 * GitHub Pages'te site `/estu-student-assistant/` altında yayımlandığı için bu,
 * bölüm profillerinin 404 vermesine ve uygulamanın hiç açılmamasına yol açar.
 *
 * Bu yüzden ifade birebir `import.meta.env` olarak bırakılmalıdır. Vite dışında
 * (Node ile test koşumu) `import.meta.env` tanımsızdır; `?.` bunu karşılar.
 */
const BASE: string = import.meta.env?.BASE_URL ?? '/';
const DEPARTMENTS_ROOT = `${BASE.replace(/\/$/, '')}/data/departments`;

export class DepartmentProfileError extends Error {
    constructor(public readonly code: string, message: string) {
        super(message);
        this.name = 'DepartmentProfileError';
    }
}

let indexCache: DepartmentIndexEntry[] | null = null;
const profileCache = new Map<string, DepartmentProfile>();

export async function loadDepartmentIndex(): Promise<DepartmentIndexEntry[]> {
    if (indexCache) return indexCache;

    const res = await fetch(`${DEPARTMENTS_ROOT}/index.json`, { cache: 'no-cache' });
    if (!res.ok) {
        throw new DepartmentProfileError(
            'INDEX_MISSING',
            `Bölüm listesi okunamadı (${res.status}). ${DEPARTMENTS_ROOT}/index.json bulunamadı.`
        );
    }
    const data: DepartmentIndex = await res.json();
    if (!Array.isArray(data?.departments)) {
        throw new DepartmentProfileError('INDEX_INVALID', 'Bölüm listesi geçersiz: "departments" dizisi yok.');
    }

    indexCache = [...data.departments].sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    return indexCache;
}

export async function loadDepartmentProfile(code: string): Promise<DepartmentProfile> {
    const key = code.trim().toUpperCase();
    const cached = profileCache.get(key);
    if (cached) return cached;

    const index = await loadDepartmentIndex();
    const entry = index.find(d => d.code.toUpperCase() === key);
    if (!entry) {
        throw new DepartmentProfileError(
            'PROFILE_NOT_LISTED',
            `"${code}" bölümü için profil tanımlı değil. ` +
            `public/data/departments/${key}.json dosyasını ekleyip index.json'a kaydedin.`
        );
    }

    const res = await fetch(`${DEPARTMENTS_ROOT}/${entry.file}`, { cache: 'no-cache' });
    if (!res.ok) {
        throw new DepartmentProfileError(
            'PROFILE_MISSING',
            `"${entry.name}" profili okunamadı (${res.status}): ${entry.file}`
        );
    }

    const profile = validateProfile(await res.json());
    profileCache.set(key, profile);
    return profile;
}

/**
 * Profil dosyasını doğrular. Eksik/bozuk profil sessizce yanlış sonuç
 * üretmesin diye burada sert davranıyoruz.
 */
export function validateProfile(raw: any): DepartmentProfile {
    const problems: string[] = [];

    if (!raw || typeof raw !== 'object') {
        throw new DepartmentProfileError('PROFILE_INVALID', 'Profil dosyası bir JSON nesnesi değil.');
    }
    if (typeof raw.code !== 'string' || !raw.code.trim()) problems.push('"code" zorunlu');
    if (typeof raw.name !== 'string' || !raw.name.trim()) problems.push('"name" zorunlu');
    if (raw.degree !== 'lisans' && raw.degree !== 'onlisans') problems.push('"degree" "lisans" veya "onlisans" olmalı');
    if (typeof raw.totalEcts !== 'number' || raw.totalEcts <= 0) problems.push('"totalEcts" pozitif sayı olmalı');
    if (!Array.isArray(raw.courses)) problems.push('"courses" dizi olmalı');

    if (problems.length) {
        throw new DepartmentProfileError('PROFILE_INVALID', `Profil geçersiz: ${problems.join(', ')}`);
    }

    const seen = new Set<string>();
    const courses = (raw.courses as any[]).filter(c => {
        if (!c || typeof c.code !== 'string') return false;
        const code = c.code.trim();
        if (!code || seen.has(code)) return false;
        seen.add(code);
        return true;
    }).map(c => ({
        ...c,
        code: c.code.trim(),
        credits: Number(c.credits) || Number(c.ects) || 0,
        ects: Number(c.ects) || Number(c.credits) || 0
    }));

    return {
        code: raw.code.trim().toUpperCase(),
        name: raw.name.trim(),
        nameEn: raw.nameEn,
        faculty: raw.faculty,
        degree: raw.degree,
        totalEcts: raw.totalEcts,
        coursePrefixes: Array.isArray(raw.coursePrefixes) ? raw.coursePrefixes : [],
        courses,
        intibak: Array.isArray(raw.intibak) ? raw.intibak : [],
        specializations: Array.isArray(raw.specializations) ? raw.specializations : [],
        graduationProject: raw.graduationProject,
        meta: raw.meta
    };
}

/** Test/SSR yolları için — fetch olmadan profil enjekte etmeye izin verir. */
export function primeProfileCache(profile: DepartmentProfile): void {
    profileCache.set(profile.code.toUpperCase(), profile);
}

export function clearDepartmentCaches(): void {
    indexCache = null;
    profileCache.clear();
}
