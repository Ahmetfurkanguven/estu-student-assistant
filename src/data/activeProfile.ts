import type { Course, IntibakMapping } from '../types';
import type { DepartmentProfile, DepartmentSpecialization } from '../types/department';

/**
 * Seçili bölümün profiline modül düzeyinden erişim.
 *
 * Uygulamada hiçbir bölümün ders planı, intibak eşlemesi ya da uzmanlaşma
 * tanımı koda gömülü değildir; hepsi `public/data/departments/<KOD>.json`
 * dosyasından yüklenir ve buraya yazılır.
 */

let activeProfile: DepartmentProfile | null = null;

export function setActiveProfile(profile: DepartmentProfile | null): void {
    activeProfile = profile;
}

export function getActiveProfile(): DepartmentProfile | null {
    return activeProfile;
}

export function getActiveCourses(): Course[] {
    return activeProfile?.courses ?? [];
}

export function getActiveIntibak(): IntibakMapping[] {
    return activeProfile?.intibak ?? [];
}

export function getActiveSpecializations(): DepartmentSpecialization[] {
    return activeProfile?.specializations ?? [];
}

export function getActiveDepartmentName(): string {
    return activeProfile?.name ?? 'Bölüm seçilmedi';
}
