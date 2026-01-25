/**
 * GPA hesaplaması. Kredi ağırlıklı not ortalamasını hesaplar. Yeterli (YT) dersler
 * ortalamaya katılmaz. En son alınan dersin notu geçerli sayılır.
 */
/**
 * Dönemleri kronolojik olarak karşılaştırır
 * Örnek: "2024-2025 Güz Dönemi" > "2022-2023 Bahar Dönemi"
 */
function compareSemesters(sem1, sem2) {
    // Simülasyon her zaman en son dönemdir
    if (sem1 === 'Simülasyon')
        return 1;
    if (sem2 === 'Simülasyon')
        return -1;
    // Yıl ve dönem bilgisini çıkar
    const match1 = sem1.match(/(\d{4})-(\d{4})\s+(Güz|Bahar|Yaz)/i);
    const match2 = sem2.match(/(\d{4})-(\d{4})\s+(Güz|Bahar|Yaz)/i);
    if (!match1 || !match2)
        return 0;
    const year1 = parseInt(match1[1]);
    const year2 = parseInt(match2[1]);
    // Önce yıla göre karşılaştır
    if (year1 !== year2)
        return year1 - year2;
    // Yıl aynıysa döneme göre (Güz=1, Bahar=2, Yaz=3)
    const termOrder = { 'güz': 1, 'bahar': 2, 'yaz': 3 };
    const term1 = termOrder[match1[3].toLowerCase()] || 0;
    const term2 = termOrder[match2[3].toLowerCase()] || 0;
    return term1 - term2;
}
export function calculateGPA(records) {
    // Aynı dersi birden fazla aldıysa en son alınanı tutmak için Map kullanılır
    const latestRecords = new Map();
    for (const record of records) {
        const existing = latestRecords.get(record.courseCode);
        if (!existing || compareSemesters(record.semester, existing.semester) > 0) {
            if (existing) {
                console.log(`${record.courseCode}: ${existing.semester} (${existing.grade.letter}) -> ${record.semester} (${record.grade.letter})`);
            }
            latestRecords.set(record.courseCode, record);
        }
    }
    console.log('=== GNO HESAPLAMASI ===');
    let totalWeightedGrade = 0;
    let totalCredits = 0;
    let passedCredits = 0;
    let totalECTS = 0;
    const usedCourses = [];
    for (const record of latestRecords.values()) {
        // Sadece YT notlu dersler GNO'ya katılmaz
        if (record.grade.letter !== 'YT') {
            // Okul sistemi her dersin (Kredi * Not) puanını 2 basamağa yuvarlayıp topluyor
            const rawPoints = record.grade.coefficient * record.credits;
            const weighted = Math.round(rawPoints * 100) / 100;
            totalWeightedGrade += weighted;
            totalCredits += record.credits;
            usedCourses.push(record);
            console.log(`${record.courseCode}: ${record.grade.letter} x ${record.credits} = ${weighted.toFixed(2)}`);
        }
        totalECTS += record.ects;
        if (record.grade.passed) {
            passedCredits += record.credits;
        }
    }
    console.log(`Toplam Kredi: ${totalCredits}`);
    console.log(`Toplam Ağırlıklı Not: ${totalWeightedGrade.toFixed(2)}`);
    const gno = totalCredits > 0 ? totalWeightedGrade / totalCredits : 0;
    console.log(`GNO: ${totalWeightedGrade.toFixed(2)} / ${totalCredits} = ${gno.toFixed(2)}`);
    console.log('=== GNO HESAPLAMASI SONU ===');
    // Dersleri dönem ve koda göre sırala
    usedCourses.sort((a, b) => {
        const semComparison = compareSemesters(a.semester, b.semester);
        if (semComparison !== 0)
            return semComparison;
        return a.courseCode.localeCompare(b.courseCode);
    });
    return {
        gno: Math.round(gno * 100) / 100,
        dno: gno,
        totalCredits,
        passedCredits,
        totalECTS,
        usedCourses
    };
}
