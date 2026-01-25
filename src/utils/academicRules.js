import { ALL_COURSES } from '../data/courses';
import { SPECIALIZATION_AREAS } from '../data/rules';
import { INTIBAK_MAPPINGS } from '../data/rules';
/**
 * İntibak (kod değişikliği) uygulanmış kayıtları döndürür. Eğer kayıt eski bir koda
 * sahipse, yeni kod ve açıklama eklenir.
 */
export function applyIntibak(records) {
    return records.map(record => {
        const mapping = INTIBAK_MAPPINGS.find(m => m.oldCode === record.courseCode);
        if (mapping) {
            return {
                ...record,
                courseCode: mapping.newCode,
                courseName: record.courseName + ' (İntibak)'
            };
        }
        return record;
    });
}
/**
 * Bir ders için önkoşullar sağlanmış mı kontrol eder. Önkoşullar listesi ALL_COURSES
 * içindeki course.prerequisites alanından alınır.
 */
export function checkPrerequisites(courseCode, completedCourses) {
    const course = ALL_COURSES.find(c => c.code === courseCode);
    if (!course || !course.prerequisites) {
        return { canTake: true, missing: [] };
    }
    const missing = course.prerequisites.filter(prereq => !completedCourses.has(prereq));
    return {
        canTake: missing.length === 0,
        missing
    };
}
/**
 * EEM413/414 alma uygunluğunu kontrol eder. GNO ≥ 2.00 ve (ilk 4 yarıyıl zorunlu
 * dersler tamamlanmış VEYA en az 180 AKTS) kriterlerini kullanır.
 */
export function checkEEM413Eligibility(records, gpa) {
    const reasons = [];
    if (gpa.gno < 2.0) {
        reasons.push(`GNO yetersiz: ${gpa.gno.toFixed(2)} < 2.00`);
    }
    // KURAL: GNO >= 2.00 VE İlk 4 yarıyılın tüm zorunlu dersleri tamamlanmış olmalı VE 180 AKTS tamamlanmış olmalı.
    // KURAL: İlk 4 yarıyılın tüm zorunlu dersleri tamamlanmış olmalı VEYA 180 AKTS tamamlanmış olmalı.
    // (Biri sağlanırsa yeterli)
    // 1. İlk 4 yarıyıl zorunlu ders kontrolü
    const firstFourSemesterCourses = ALL_COURSES.filter(c => c.semester && c.semester <= 4 && c.type === 'zorunlu').map(c => c.code);
    // Geçilen dersleri (passed=true) al. Yaz okulu vs. fark etmeksizin kod eşleşiyorsa sayılır.
    // Course code trim ve uppercase yaparak eşleşmeyi garantiye alalım.
    const completedCourses = new Set(records.filter(r => r.grade.passed).map(r => r.courseCode.trim()));
    const missingCourses = firstFourSemesterCourses.filter(c => !completedCourses.has(c));
    // Eğer hem ders eksiği var HEM DE 180 AKTS tamamlanmamışsa -> UYGUN DEĞİL
    if (missingCourses.length > 0 && gpa.totalECTS < 180) {
        reasons.push('Bu dersi almak için aşağıdaki iki koşuldan EN AZ BİRİNİ sağlamanız gerekir:');
        reasons.push('1. İlk 4 yarıyılın zorunlu derslerini tamamlamak (Eksikleriniz var)');
        reasons.push('2. En az 180 AKTS tamamlamak');
        reasons.push(`Durumunuz: ${gpa.totalECTS} AKTS ve şu dersler eksik: ${missingCourses.join(', ')}`);
    }
    return {
        eligible: reasons.length === 0,
        reasons
    };
}
/**
 * Uzmanlaşma alanı ilerlemesini hesaplar. Seçilen alana ait MS ders sayısı ve
 * zorunlu alan derslerinin alınma durumunu kontrol eder.
 */
export function checkSpecialization(records, areaId) {
    const area = SPECIALIZATION_AREAS.find(a => a.id === areaId);
    if (!area)
        return { meets: false, progress: '0/5 ders' };
    const takenMS = records.filter(r => r.grade.passed &&
        ALL_COURSES.find(c => c.code === r.courseCode && c.type === 'mesleki_secmeli'));
    const areaCourseCodes = ALL_COURSES.filter(c => c.type === 'mesleki_secmeli').map(c => c.code);
    const areaCoursesTaken = takenMS.filter(r => areaCourseCodes.includes(r.courseCode));
    const requiredTaken = area.requiredCourses.filter(req => records.find(r => r.courseCode === req && r.grade.passed));
    const meets = areaCoursesTaken.length >= area.minCourses && requiredTaken.length === area.requiredCourses.length;
    return {
        meets,
        progress: `${areaCoursesTaken.length}/${area.minCourses} ders, Zorunlu: ${requiredTaken.length}/${area.requiredCourses.length}`
    };
}
