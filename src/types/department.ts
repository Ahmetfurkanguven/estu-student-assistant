import type { Course, IntibakMapping, SpecializationArea } from './index';

/** Uzmanlaşma alanına ait tek bir ders. */
export interface DepartmentSpecializationCourse {
    code: string;
    name: string;
    /** Alanın zorunlu dersi mi (kataloglarda "(Z)" ile işaretli). */
    isMandatory: boolean;
    prerequisite: string | null;
    term: 'Güz' | 'Bahar' | null;
}

/** Uzmanlaşma alanı: eşik değerler + alanın ders havuzu. */
export interface DepartmentSpecialization extends SpecializationArea {
    courses: DepartmentSpecializationCourse[];
}

/**
 * Bir bölümün tüm bölüme özgü verisi. Uygulamada EEM'e ya da başka bir bölüme
 * ait hiçbir sabit bulunmaz; her şey bu profilden okunur.
 *
 * Profiller `public/data/departments/<code>.json` altında tutulur ve
 * `public/data/departments/index.json` ile listelenir.
 */
export interface DepartmentProfile {
    /** Ders kodu ön eki ile aynı olmak zorunda değil. Dosya adı bu koddur. */
    code: string;
    name: string;
    nameEn?: string;
    faculty?: string;
    degree: 'lisans' | 'onlisans';

    /** Madde 25/1 — mezuniyet için gereken toplam AKTS (lisans 240, ön lisans 120). */
    totalEcts: number;

    /**
     * Bölümün kendi derslerinin kod ön ekleri (ör. ["EEM"]).
     * Ders programı PDF'inde derslik/ders ayrımına yardımcı olur; filtre değildir.
     */
    coursePrefixes: string[];

    /** Ders planı. Zorunlu dersler `semester` alanını doldurmalıdır. */
    courses: Course[];

    /** Eski → yeni ders kodu eşlemeleri (Madde 5/1 intibak). */
    intibak: IntibakMapping[];

    /** Uzmanlaşma alanları. Bölümde yoksa boş dizi. */
    specializations: DepartmentSpecialization[];

    /**
     * Madde 8/4 — bitirme ödevi/projesi ve benzeri mezuniyet projesi dersleri.
     * Bu dersleri alabilmek için ilk dört yarıyılın tüm zorunlu dersleri
     * başarılmış VEYA en az `minEctsAlternative` AKTS tamamlanmış olmalıdır.
     */
    graduationProject?: {
        codes: string[];
        minEctsAlternative: number;
    };

    /** Profil sürümü / kaynak bilgisi — veri güncelliğini izlemek için. */
    meta?: {
        catalogYear?: string;
        source?: string;
        updatedAt?: string;
    };
}

export interface DepartmentIndexEntry {
    code: string;
    name: string;
    nameEn?: string;
    faculty?: string;
    degree: 'lisans' | 'onlisans';
    file: string;
}

export interface DepartmentIndex {
    departments: DepartmentIndexEntry[];
}
