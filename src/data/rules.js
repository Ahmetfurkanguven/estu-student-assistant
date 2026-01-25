// Harf notu katsayı sistemi. Başarı durumuna göre true/false belirtiyoruz.
export const GRADE_SYSTEM = {
    AA: { coefficient: 4.0, passed: true },
    AB: { coefficient: 3.7, passed: true },
    BA: { coefficient: 3.3, passed: true },
    BB: { coefficient: 3.0, passed: true },
    BC: { coefficient: 2.7, passed: true },
    CB: { coefficient: 2.3, passed: true },
    CC: { coefficient: 2.0, passed: true },
    CD: { coefficient: 1.7, passed: true },
    DC: { coefficient: 1.3, passed: true },
    DD: { coefficient: 1.0, passed: true },
    FD: { coefficient: 0.0, passed: false },
    FF: { coefficient: 0.0, passed: false },
    YT: { coefficient: 0.0, passed: true },
    YZ: { coefficient: 0.0, passed: false },
    DZ: { coefficient: 0.0, passed: false },
    MS: { coefficient: 0.0, passed: true }
};
// Uzmanlaşma alanları. Her alan için gereken dersler ve minimum MS ders/AKTS bilgisi.
export const SPECIALIZATION_AREAS = [
    {
        id: 'electronics',
        name: 'Elektronik',
        nameEn: 'Electronics',
        requiredCourses: ['EEM4501', 'EEM403'],
        minCourses: 5,
        minECTS: 25
    },
    {
        id: 'power',
        name: 'Güç Sistemleri',
        nameEn: 'Power Systems',
        requiredCourses: ['EEM471', 'EEM473'],
        minCourses: 5,
        minECTS: 25
    },
    {
        id: 'telecom',
        name: 'Haberleşme',
        nameEn: 'Telecommunications',
        requiredCourses: ['EEM409', 'EEM467'],
        minCourses: 5,
        minECTS: 25
    },
    {
        id: 'control',
        name: 'Kontrol',
        nameEn: 'Control',
        requiredCourses: ['EEM491'],
        minCourses: 5,
        minECTS: 25
    },
    {
        id: 'digital',
        name: 'Sayısal Sistemler',
        nameEn: 'Digital Systems',
        requiredCourses: ['EEM449', 'EEM480'],
        minCourses: 5,
        minECTS: 25
    },
    {
        id: 'signal',
        name: 'Sinyal İşleme',
        nameEn: 'Signal Processing',
        requiredCourses: ['EEM409', 'EEM477'],
        minCourses: 5,
        minECTS: 25
    }
];
// İntibak eşlemeleri. Eski ders kodları yenileriyle ilişkilendiriliyor.
export const INTIBAK_MAPPINGS = [
    { oldCode: 'EMAT111', newCode: 'MAT1011', note: '2025-2026 akademik yılından itibaren kod değişti' },
    { oldCode: 'EKİM105', newCode: 'KİM1005', note: '2025-2026 akademik yılından itibaren kod değişti' },
    { oldCode: 'EMAT112', newCode: 'MAT1012', note: '2025-2026 akademik yılından itibaren kod değişti' },
    { oldCode: 'EMAT221', newCode: 'MAT2021', note: '2025-2026 akademik yılından itibaren kod değişti' },
    { oldCode: 'EMAT211', newCode: 'MAT2011', note: '2025-2026 akademik yılından itibaren kod değişti' },
    { oldCode: 'MAT293', newCode: 'MAT2093', note: '2025-2026 akademik yılından itibaren kod ve adı değişti' },
    { oldCode: 'İST244', newCode: 'İST2044', note: '2025-2026 akademik yılından itibaren haftalık ders saati değişti' },
    { oldCode: 'EEM322', newCode: 'EEM4501', note: 'Electronics II → Analog Electronics' },
    { oldCode: 'EEM334', newCode: 'EEM4503', note: 'Digital Systems II → Digital Systems Design with VHDL and FPGA' }
];
// Örnek ders programı verisi. Gerçek uygulamada pdf parser üzerinden okunabilir.
export const SAMPLE_SCHEDULES = [
    { courseCode: 'EEM336', section: 'All', day: 'Pazartesi', startTime: '09:00', endTime: '12:00', room: 'E5', type: 'lecture' },
    { courseCode: 'EEM342', section: 'A', day: 'Pazartesi', startTime: '14:00', endTime: '16:00', room: 'Lab', type: 'lab' },
    { courseCode: 'EEM308', section: 'A', day: 'Pazartesi', startTime: '14:00', endTime: '16:00', room: 'Lab', type: 'lab' },
    { courseCode: 'İŞL101', section: 'All', day: 'Salı', startTime: '09:00', endTime: '12:00', room: 'E1', type: 'lecture' },
    { courseCode: 'EEM308', section: 'All', day: 'Salı', startTime: '14:00', endTime: '17:00', room: 'E5', type: 'lecture' },
    { courseCode: 'TAR165', section: 'All', day: 'Asenkron', startTime: '00:00', endTime: '00:00', type: 'lecture', async: true },
    { courseCode: 'İSG401', section: 'All', day: 'Asenkron', startTime: '00:00', endTime: '00:00', type: 'lecture', async: true }
];
export const SAMPLE_TRANSCRIPT_TEXT = `ESKIŞEHIR TEKNIK ÜNİVERSİTESİ
TRANSKRIPT

2023-2024 GÜZ
MAT1011 Calculus I                  6  7.5  AA
FİZ105 Physics I                    4  6.0  BA
FİZ107 Physics Laboratory I         2  1.5  AA
KİM1005 General Chemistry           4  6.0  BB
BİM122 Discrete Comp. Structures    3  5.0  BA
TÜR125 Türk Dili I                  2  2.0  YT

2023-2024 BAHAR
MAT1012 Calculus II                 6  7.5  BA
FİZ106 Physics II                   4  6.0  BB
FİZ108 Physics Laboratory II        2  1.5  BA
MAT2021 Linear Algebra              4  4.5  AA
EEM102 Intro to Elec. Eng.          6  7.5  BA
EEM104 Prof. Aspects of EEE         2  3.0  AA
TÜR126 Türk Dili II                 2  2.0  YT

2024-2025 GÜZ
MAT2011 Differential Equations      4  4.5  BA
MAT2093 Engineering Mathematics     4  6.0  BB
EEM209 Circuit Analysis I           5  7.5  BA
EEM206 Elec. Circuits Lab           3  3.0  AA
BİL200 Computer Programming         4  6.0  BA
TAR165 Atatürk İlkeleri I           2  2.0  YT

2024-2025 BAHAR
EEM208 Electromagnetic Fields       4  6.0  BB
EEM232 Digital Systems I            4  6.0  BA
EEM238 Digital Systems Lab          2  2.0  AA
İST2044 Engineering Probability     4  5.0  BA
EEM210 Fund. of Semiconductor       3  5.0  BA
TAR166 Atatürk İlkeleri II          2  2.0  YT`;
