import React, { useState, useEffect, useRef } from 'react';
import { Upload, BookOpen, GraduationCap, Calendar, BarChart, ChevronRight, CheckCircle, AlertCircle, Trash2, Github, FileText, Download, BarChart3, CheckCircle2, Calculator, TrendingUp, Info, Award, ShieldCheck } from 'lucide-react';
import { VisitorCounter } from './components/VisitorCounter';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================
import { generateCourseProposal, ProposedCourse } from './utils/courseSelectionRules';
import { detectScheduleConflicts, parseScheduleFromItems } from './utils/scheduleUtils';
import { generateAcademicReport } from './utils/reportGenerator';

interface Course {
  code: string;
  name: string;
  credits: number;
  ects: number;
  type: 'zorunlu' | 'mesleki_secmeli' | 'secmeli' | 'universite_secmeli';
  prerequisites?: string[];
  semester?: number;
}

interface Grade {
  letter: string;
  coefficient: number;
  passed: boolean;
}

interface StudentRecord {
  id: string;
  courseCode: string;
  courseName: string;
  semester: string;
  credits: number;
  ects: number;
  grade: Grade;
  retake?: boolean;
}

interface ScheduleOffering {
  courseCode: string;
  section: string;
  day: string;
  startTime: string;
  endTime: string;
  room?: string;
  type: 'lecture' | 'lab';
  async?: boolean;
}

interface GPAResult {
  gno: number;
  dno: number;
  totalCredits: number;
  passedCredits: number;
  totalECTS: number;
  totalAttempted: number; // Toplam denenen kredi (tekrar edilenler dahil değil, sadece son kayıtlar)
  usedCourses?: StudentRecord[]; // make optional initially to avoid strict parsing issues
}

interface SpecializationArea {
  id: string;
  name: string;
  nameEn: string;
  requiredCourses: string[];
  minCourses: number;
  minECTS: number;
}

interface IntibakMapping {
  oldCode: string;
  newCode: string;
  note: string;
}

// ============================================================================
// COMPREHENSIVE DATA
// ============================================================================

// Harf notu katsayı sistemi. Başarı durumuna göre true/false belirtiyoruz.
const GRADE_SYSTEM: Record<string, { coefficient: number; passed: boolean }> = {
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
  FD: { coefficient: 0.5, passed: false },
  FF: { coefficient: 0.0, passed: false },
  YT: { coefficient: 0.0, passed: true },
  YZ: { coefficient: 0.0, passed: false },
  DZ: { coefficient: 0.0, passed: false }
};

// Ders listesi. Bu örnek kodda veriler hard‑coded olarak tanımlandı. Gerçek uygulamada
// bu dosyayı public/data/courses.json gibi bir kaynaktan da okuyabilirsiniz.
const ALL_COURSES: Course[] = [
  // 1. Yarıyıl
  { code: 'MAT1011', name: 'Calculus I', credits: 6, ects: 7.5, type: 'zorunlu', semester: 1 },
  { code: 'FİZ105', name: 'Physics I', credits: 4, ects: 6.0, type: 'zorunlu', semester: 1 },
  { code: 'FİZ107', name: 'Physics Laboratory I', credits: 2, ects: 1.5, type: 'zorunlu', semester: 1 },
  { code: 'KİM1005', name: 'General Chemistry', credits: 4, ects: 6.0, type: 'zorunlu', semester: 1 },
  { code: 'BİM122', name: 'Discrete Computational Structures', credits: 3, ects: 5.0, type: 'zorunlu', semester: 1 },
  { code: 'TÜR125', name: 'Türk Dili I', credits: 2, ects: 2.0, type: 'zorunlu', semester: 1 },

  // 2. Yarıyıl
  { code: 'MAT1012', name: 'Calculus II', credits: 6, ects: 7.5, type: 'zorunlu', semester: 2, prerequisites: ['MAT1011'] },
  { code: 'FİZ106', name: 'Physics II', credits: 4, ects: 6.0, type: 'zorunlu', semester: 2, prerequisites: ['FİZ105'] },
  { code: 'FİZ108', name: 'Physics Laboratory II', credits: 2, ects: 1.5, type: 'zorunlu', semester: 2, prerequisites: ['FİZ107'] },
  { code: 'MAT2021', name: 'Linear Algebra', credits: 4, ects: 4.5, type: 'zorunlu', semester: 2 },
  { code: 'EEM102', name: 'Introduction to Electrical Engineering', credits: 6, ects: 7.5, type: 'zorunlu', semester: 2 },
  { code: 'EEM104', name: 'Professional Aspects of EEE', credits: 2, ects: 3.0, type: 'zorunlu', semester: 2 },
  { code: 'TÜR126', name: 'Türk Dili II', credits: 2, ects: 2.0, type: 'zorunlu', semester: 2 },

  // 3. Yarıyıl
  { code: 'MAT2011', name: 'Differential Equations', credits: 4, ects: 4.5, type: 'zorunlu', semester: 3, prerequisites: ['MAT1012'] },
  { code: 'MAT2093', name: 'Engineering Mathematics', credits: 4, ects: 6.0, type: 'zorunlu', semester: 3 },
  { code: 'EEM209', name: 'Circuit Analysis I', credits: 5, ects: 7.5, type: 'zorunlu', semester: 3, prerequisites: ['EEM102'] },
  { code: 'EEM206', name: 'Electrical Circuits Laboratory', credits: 3, ects: 3.0, type: 'zorunlu', semester: 3, prerequisites: ['EEM102'] },
  { code: 'BİL200', name: 'Computer Programming', credits: 4, ects: 6.0, type: 'zorunlu', semester: 3 },
  { code: 'TAR165', name: 'Atatürk İlkeleri ve İnkılap Tarihi I', credits: 2, ects: 2.0, type: 'zorunlu', semester: 3 },

  // 4. Yarıyıl
  { code: 'EEM208', name: 'Electromagnetic Fields and Waves', credits: 4, ects: 6.0, type: 'zorunlu', semester: 4, prerequisites: ['MAT2093'] },
  { code: 'EEM232', name: 'Digital Systems I', credits: 4, ects: 6.0, type: 'zorunlu', semester: 4 },
  { code: 'EEM238', name: 'Digital Systems Laboratory', credits: 2, ects: 2.0, type: 'zorunlu', semester: 4 },
  { code: 'İST2044', name: 'Engineering Probability', credits: 4, ects: 5.0, type: 'zorunlu', semester: 4 },
  { code: 'EEM210', name: 'Fundamentals of Semiconductor Devices', credits: 3, ects: 5.0, type: 'zorunlu', semester: 4 },
  { code: 'TAR166', name: 'Atatürk İlkeleri ve İnkılap Tarihi II', credits: 2, ects: 2.0, type: 'zorunlu', semester: 4 },

  // 5. Yarıyıl
  { code: 'EEM301', name: 'Signals and Systems', credits: 4, ects: 6.0, type: 'zorunlu', semester: 5, prerequisites: ['MAT2011'] },
  { code: 'EEM311', name: 'Principles of Energy Conversion', credits: 5, ects: 6.0, type: 'zorunlu', semester: 5, prerequisites: ['EEM208'] },
  { code: 'EEM321', name: 'Electronics I', credits: 3, ects: 5.0, type: 'zorunlu', semester: 5, prerequisites: ['EEM210'] },
  { code: 'EEM328', name: 'Electronics Laboratory', credits: 3, ects: 3.0, type: 'zorunlu', semester: 5 },
  { code: 'İKT151', name: 'Economics', credits: 3, ects: 3.0, type: 'zorunlu', semester: 5 },

  // 6. Yarıyıl
  { code: 'EEM308', name: 'Introduction to Communications', credits: 5, ects: 7.0, type: 'zorunlu', semester: 6, prerequisites: ['EEM301'] },
  { code: 'EEM336', name: 'Microprocessors I', credits: 5, ects: 7.0, type: 'zorunlu', semester: 6 },
  { code: 'EEM342', name: 'Fundamentals of Control Systems', credits: 5, ects: 7.0, type: 'zorunlu', semester: 6, prerequisites: ['EEM301'] },

  // 7. Yarıyıl
  { code: 'EEM413', name: 'EEE Design Project I', credits: 6, ects: 4.5, type: 'zorunlu', semester: 7 },
  { code: 'EEM415', name: 'Engineering Design and Research', credits: 2, ects: 3.0, type: 'zorunlu', semester: 7 },

  // 8. Yarıyıl
  { code: 'EEM414', name: 'EEE Design Project II', credits: 6, ects: 4.5, type: 'zorunlu', semester: 8, prerequisites: ['EEM413'] },

  // Mesleki Seçmeli Örnekler
  { code: 'EEM409', name: 'Random Signals', credits: 3, ects: 5.0, type: 'mesleki_secmeli' },
  { code: 'EEM467', name: 'Digital Communications', credits: 3, ects: 5.0, type: 'mesleki_secmeli' },
  { code: 'EEM477', name: 'Digital Signal Processing', credits: 3, ects: 5.0, type: 'mesleki_secmeli' },
  { code: 'EEM471', name: 'Electrical Machinery I', credits: 4, ects: 5.0, type: 'mesleki_secmeli' },
  { code: 'EEM473', name: 'Power Systems Analysis I', credits: 3, ects: 5.0, type: 'mesleki_secmeli' },
  { code: 'EEM475', name: 'Power Electronics I', credits: 3, ects: 5.0, type: 'mesleki_secmeli' },
  { code: 'EEM491', name: 'Linear Control Systems', credits: 3, ects: 5.0, type: 'mesleki_secmeli' },
  { code: 'EEM480', name: 'Algorithms and Complexity', credits: 3, ects: 5.0, type: 'mesleki_secmeli' },
  { code: 'EEM449', name: 'Embedded System Design', credits: 4, ects: 5.0, type: 'mesleki_secmeli' },
  { code: 'EEM4503', name: 'Digital Systems Design with VHDL and FPGA', credits: 5, ects: 5.0, type: 'mesleki_secmeli' }
];

// Uzmanlaşma alanları. Her alan için gereken dersler ve minimum MS ders/AKTS bilgisi.
import { analyzeSpecializations } from './utils/specializationUtils';
import { SPECIALIZATION_GROUPS } from './data/specializationGroups';



// İntibak eşlemeleri. Eski ders kodları yenileriyle ilişkilendiriliyor.
const INTIBAK_MAPPINGS: IntibakMapping[] = [
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
const SAMPLE_SCHEDULES: ScheduleOffering[] = [
  { courseCode: 'EEM336', section: 'All', day: 'Pazartesi', startTime: '09:00', endTime: '12:00', room: 'E5', type: 'lecture' },
  { courseCode: 'EEM342', section: 'A', day: 'Pazartesi', startTime: '14:00', endTime: '16:00', room: 'Lab', type: 'lab' },
  { courseCode: 'EEM308', section: 'A', day: 'Pazartesi', startTime: '14:00', endTime: '16:00', room: 'Lab', type: 'lab' },
  { courseCode: 'İŞL101', section: 'All', day: 'Salı', startTime: '09:00', endTime: '12:00', room: 'E1', type: 'lecture' },
  { courseCode: 'EEM308', section: 'All', day: 'Salı', startTime: '14:00', endTime: '17:00', room: 'E5', type: 'lecture' },
  { courseCode: 'TAR165', section: 'All', day: 'Asenkron', startTime: '00:00', endTime: '00:00', type: 'lecture', async: true },
  { courseCode: 'İSG401', section: 'All', day: 'Asenkron', startTime: '00:00', endTime: '00:00', type: 'lecture', async: true }
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Gelişmiş transkript parsırı. Her satırı okuyarak ders kodu, isim, kredi, AKTS ve
 * harf notu bilgilerini ayıklar. Dönem başlıklarını (YYYY-YYYY GÜZ/BAHAR) de
 * tespit eder ve kayıtları buna göre etiketler.
 */
function parseTranscriptAdvanced(text: string): StudentRecord[] {
  const records: StudentRecord[] = [];
  const lines = text.split('\n');
  let currentSemester = '';

  for (const line of lines) {
    // Dönem başlığı kontrolü - çeşitli formatlar:
    // 1. "2022-2023 Güz Dönemi" veya "2022-2023 Yaz Okulu"
    // 2. "2023-2024 Transfer Dersler (Gazi Üniversitesi)" - DGS öğrencileri için
    // 3. "2022-2023 Bahar Dönemi"

    if (/\d{4}-\d{4}\s+(Güz|Bahar|Yaz|GÜZ|BAHAR|YAZ)/i.test(line) && /(Dönem|Okulu)/i.test(line)) {
      currentSemester = line.trim();
      console.log('Dönem bulundu:', currentSemester);
      continue;
    }

    // Transfer dersler formatı - DGS ile gelenler için
    if (/\d{4}-\d{4}\s+Transfer\s+Dersler/i.test(line)) {
      currentSemester = line.trim();
      console.log('Transfer dönemi bulundu:', currentSemester);
      continue;
    }

    // Ders satırı kontrolü için PDF formatı:
    // Kodu   Ders Adı   AKTS Kredisi   Not   Kredi*Not   Statü
    // BİM122   Discrete Computational Structures (...)   5.0   CD   8.50   Z

    // Önce ders kodunu ara (satır başında)
    const codeMatch = line.match(/^([A-ZİĞÜŞÇÖ]{2,}[A-ZİĞÜŞÇÖ0-9]{3,})\s+/);
    if (codeMatch && currentSemester) {
      const code = codeMatch[1];

      // Satırın geri kalanını parçalara ayır (birden fazla boşluk veya tab ile)
      const parts = line.split(/\s{2,}|\t+/).filter(p => p.trim());

      if (parts.length >= 4) {
        // parts[0] = Kod
        // parts[1] = Ders Adı
        // parts[2] = AKTS Kredisi (sayı)
        // parts[3] = Not (harf)
        // parts[4] = Kredi*Not (sayı - atlanabilir)
        // parts[5] = Statü (Z veya S)

        const courseName = parts[1];
        let aktsStr = parts[2];
        const gradeStr = parts[3];
        const status = parts.length >= 6 ? parts[5] : 'Z'; // Son kolon statü (sadece bilgi amaçlı)

        // AKTS ve not bilgisini parse et
        // Transfer derslerde format "D 2.0" olabilir, "D" harfini temizle
        aktsStr = aktsStr.replace(/^[A-Za-z]\s*/, '').trim();
        const akts = parseFloat(aktsStr);
        const gradeLetter = gradeStr.toUpperCase();

        // Not sisteminde varsa devam et
        const gradeInfo = GRADE_SYSTEM[gradeLetter];
        if (gradeInfo && !isNaN(akts)) {
          // Tüm dersler GNO'ya katılır (sadece YT hariç)
          records.push({
            id: `${code}-${currentSemester}`,
            courseCode: code,
            courseName: courseName.trim(),
            semester: currentSemester,
            credits: akts, // AKTS değerini olduğu gibi kullan (5.0, 7.5 vs)
            ects: akts,
            grade: {
              letter: gradeLetter,
              coefficient: gradeInfo.coefficient,
              passed: gradeInfo.passed
            }
          });
          console.log(`Ders eklendi: ${code} - ${gradeLetter} - ${akts} Kredi - Statü: ${status}`);
        }
      }
    }
  }
  return records;
}

/**
 * İntibak (kod değişikliği) uygulanmış kayıtları döndürür. Eğer kayıt eski bir koda
 * sahipse, yeni kod ve açıklama eklenir.
 */
function applyIntibak(records: StudentRecord[]): StudentRecord[] {
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
 * GPA hesaplaması. Kredi ağırlıklı not ortalamasını hesaplar. Yeterli (YT) dersler
 * ortalamaya katılmaz. En son alınan dersin notu geçerli sayılır.
 */
// Helper function for semester comparison
function compareSemesters(sem1: string, sem2: string): number {
  if (sem1 === 'Simülasyon') return 1;
  if (sem2 === 'Simülasyon') return -1;

  const match1 = sem1.match(/(\d{4})-(\d{4})\s+(Güz|Bahar|Yaz)/i);
  const match2 = sem2.match(/(\d{4})-(\d{4})\s+(Güz|Bahar|Yaz)/i);

  if (!match1 || !match2) return sem1.localeCompare(sem2);

  const year1 = parseInt(match1[1]);
  const year2 = parseInt(match2[1]);

  if (year1 !== year2) return year1 - year2;

  const termOrder: Record<string, number> = { 'güz': 1, 'bahar': 2, 'yaz': 3 };
  const term1 = termOrder[match1[3].toLowerCase()] || 0;
  const term2 = termOrder[match2[3].toLowerCase()] || 0;

  return term1 - term2;
}

/**
 * GPA hesaplaması. Kredi ağırlıklı not ortalamasını hesaplar.
 */
function calculateGPA(records: StudentRecord[]): GPAResult {
  // Aynı dersi birden fazla aldıysa en son alınanı tutmak için Map kullanılır
  const latestRecords = new Map<string, StudentRecord>();
  for (const record of records) {
    const code = record.courseCode.trim(); // Boşlukları temizle
    const existing = latestRecords.get(code);
    if (!existing || compareSemesters(record.semester, existing.semester) > 0) {
      latestRecords.set(code, record);
    }
  }

  let totalWeightedGrade = 0;
  let totalCredits = 0; // GNO paydası
  let passedCredits = 0;
  let totalECTS = 0;
  let totalAttempted = 0; // Tüm alınan dersler (GNO'ya girmese bile)
  const usedCourses: StudentRecord[] = [];

  for (const record of latestRecords.values()) {
    // Toplam denenen kredi (YT/YZ dahil tüm dersler)
    totalAttempted += record.credits;

    // Sadece YT notlu dersler GNO'ya katılmaz
    if (record.grade.letter !== 'YT') {
      // Okul sistemi her dersin (Kredi * Not) puanını 2 basamağa yuvarlayıp topluyor
      const rawPoints = record.grade.coefficient * record.credits;
      const weighted = Math.round(rawPoints * 100) / 100;

      totalWeightedGrade += weighted;
      totalCredits += record.credits;
      usedCourses.push(record);
    }
    totalECTS += record.ects;
    if (record.grade.passed) {
      passedCredits += record.credits;
    }
  }

  // Dersleri dönem sıralı gösterelim
  usedCourses.sort((a, b) => {
    const semCheck = compareSemesters(a.semester, b.semester);
    if (semCheck !== 0) return semCheck;
    return a.courseCode.localeCompare(b.courseCode);
  });

  const gno = totalCredits > 0 ? totalWeightedGrade / totalCredits : 0;
  return {
    gno: Math.round(gno * 100) / 100,
    dno: gno,
    totalCredits,
    passedCredits,
    totalECTS,
    totalAttempted,
    usedCourses
  };
}

/**
 * Bir ders için önkoşullar sağlanmış mı kontrol eder. Önkoşullar listesi ALL_COURSES
 * içindeki course.prerequisites alanından alınır.
 */
function checkPrerequisites(courseCode: string, completedCourses: Set<string>): { canTake: boolean; missing: string[] } {
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
function checkEEM413Eligibility(records: StudentRecord[], gpa: GPAResult): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (gpa.gno < 2.0) {
    reasons.push(`GNO yetersiz: ${gpa.gno.toFixed(2)} < 2.00`);
  }

  // KURAL: İlk 4 yarıyılın tüm zorunlu dersleri tamamlanmış olmalı VEYA 180 AKTS tamamlanmış olmalı.
  const firstFourSemesterCourses = ALL_COURSES
    .filter(c => c.semester && c.semester <= 4 && c.type === 'zorunlu')
    .map(c => c.code);

  // 2. Geçilen dersleri bul (Code normalization: trim + uppercase + INTIBAK)
  const completedSet = new Set<string>();
  const mappedDebug: string[] = []; // Debug için hangi derslerin çevrildiğini tutalım

  records.forEach(r => {
    if (r.grade.passed) {
      let code = r.courseCode.trim().toUpperCase();

      // Zorla İntibak Kontrolü (State'te yapılmamışsa burada yap)
      const mapping = INTIBAK_MAPPINGS.find(m => m.oldCode === code);
      if (mapping) {
        mappedDebug.push(`${code} -> ${mapping.newCode}`);
        code = mapping.newCode;
      }

      completedSet.add(code);
    }
  });

  // 3. Eksikleri bul
  const missingCourses = firstFourSemesterCourses.filter(code => !completedSet.has(code.trim().toUpperCase()));

  // DEBUG LOG
  console.log('Zorunlu Dersler:', firstFourSemesterCourses);
  console.log('Geçilenler (After Intibak):', Array.from(completedSet));
  console.log('Eksikler:', missingCourses);

  // KURAL KONTROLÜ
  // Eğer (Eksik Ders > 0) VE (AKTS < 180) -> ELIGIBLE DEĞİL
  if (missingCourses.length > 0 && gpa.totalECTS < 180) {
    reasons.push('Bu dersi almak için EN AZ BİR koşulu sağlamanız gerekir:');
    reasons.push('1. İlk 4 yarıyılın zorunlu derslerini tamamlamak (Eksikleriniz var)');
    reasons.push('2. En az 180 AKTS tamamlamak');
    reasons.push(`Eksik Dersler: ${missingCourses.join(', ')}`);

    // İntibak bilgisini de gösterelim ki kullanıcı dönüşümü görsün
    if (mappedDebug.length > 0) {
      reasons.push(`Uygulanan İntibaklar: ${mappedDebug.join(', ')}`);
    }
    // DETAYLI DEBUG BİLGİSİ (Sorunu çözmek için)
    reasons.push('--- TEKNİK DETAYLAR ---');
    reasons.push(`Beklenen Zorunlu Dersler (${firstFourSemesterCourses.length}): ${firstFourSemesterCourses.sort().join(', ')}`);
    reasons.push(`Tespit Edilen Geçilmiş Dersler (${completedSet.size}): ${Array.from(completedSet).sort().join(', ')}`);
  }

  return {
    eligible: reasons.length === 0,
    reasons
  };
}





// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

export default function App() {
  const [step, setStep] = useState(1);
  const [transcriptText, setTranscriptText] = useState('');
  const [records, setRecords] = useState<StudentRecord[]>([]);
  const [simulationRecords, setSimulationRecords] = useState<StudentRecord[]>([]); // Senaryo modu kayıtları
  const [gpa, setGPA] = useState<GPAResult | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'analysis'>('upload');
  const [showAllRecords, setShowAllRecords] = useState(false); // For expandable course table
  const [departmentSchedule, setDepartmentSchedule] = useState<ScheduleOffering[]>([]); // Master Schedule

  // Manuel ders ekleme state'leri
  const [showManualEntryForm, setShowManualEntryForm] = useState(false);
  const [manualEntry, setManualEntry] = useState<{
    courseCode: string;
    day: string;
    startTime: string;
    endTime: string;
    section: string;
    type: 'lecture' | 'lab';
  }>({
    courseCode: '',
    day: 'Pazartesi',
    startTime: '09:00',
    endTime: '10:00',
    section: 'All',
    type: 'lecture'
  });

  // Manuel ders ekleme fonksiyonu
  const handleAddManualCourse = () => {
    if (!manualEntry.courseCode.trim()) {
      alert('Ders kodu gereklidir!');
      return;
    }

    const newOffering: ScheduleOffering = {
      courseCode: manualEntry.courseCode.toUpperCase(),
      day: manualEntry.day,
      startTime: manualEntry.startTime,
      endTime: manualEntry.endTime,
      section: manualEntry.section,
      type: manualEntry.type,
      async: false
    };

    setDepartmentSchedule(prev => [...prev, newOffering]);
    setManualEntry({
      courseCode: '',
      day: 'Pazartesi',
      startTime: '09:00',
      endTime: '10:00',
      section: 'All',
      type: 'lecture'
    });
    setShowManualEntryForm(false);
  };

  // Ders silme fonksiyonu
  const handleDeleteScheduleItem = (index: number) => {
    setDepartmentSchedule(prev => prev.filter((_, i) => i !== index));
  };

  // Load saved department schedule -- Master Database for conflicts
  // Load saved department schedule -- REMOVED per user request to clear on refresh
  useEffect(() => {
    // Explicitly clear any stale schedule data on mount
    localStorage.removeItem('estu-department-schedule');
    setDepartmentSchedule([]);
  }, []);


  // Initialize simulation mode with current records
  const handleStartSimulation = () => {
    // Deep copy to avoid reference issues
    setSimulationRecords(JSON.parse(JSON.stringify(records)));
    // Scroll to simulation section (already in Step 2)
    window.scrollTo({ top: document.getElementById('simulation-section')?.offsetTop || 600, behavior: 'smooth' });
  };

  // Senaryo: Varolan dersin notunu güncelle
  const updateSimulationGrade = (id: string, newLetter: string) => {
    // GRADE_SYSTEM import edildiğini varsayıyoruz. Edilmemişse import eklenmeli.
    // Ancak App.tsx içinde başka yerlerde kullanıldığı için muhtemelen vardır.
    // Eğer yoksa basit bir lookup yapalım:
    const system = GRADE_SYSTEM;
    const newGradeInfo = system[newLetter];
    if (!newGradeInfo) return;

    setSimulationRecords(prev => prev.map(rec => {
      if (rec.id === id) {
        return {
          ...rec,
          semester: 'Simülasyon', // Mark as simulation to ensure it overrides original
          grade: {
            letter: newLetter,
            coefficient: newGradeInfo.coefficient,
            passed: newGradeInfo.passed
          }
        };
      }
      return rec;
    }));
  };

  // Senaryo: Yeni ders ekle
  const addSimulationCourse = (courseCode: string, letter: string) => {
    const course = ALL_COURSES.find(c => c.code === courseCode);
    if (!course) return;

    const gradeInfo = GRADE_SYSTEM[letter];

    const newRecord: StudentRecord = {
      id: `SIM-${Date.now()}-${Math.random()}`,
      courseCode: course.code,
      courseName: course.name,
      credits: course.credits,
      ects: course.ects,
      semester: 'Simülasyon',
      grade: {
        letter,
        coefficient: gradeInfo.coefficient,
        passed: gradeInfo.passed
      }
    };
    setSimulationRecords(prev => [...prev, newRecord]);
  };

  const removeSimulationRecord = (id: string) => {
    setSimulationRecords(prev => prev.filter(r => r.id !== id));
  };

  // Simülasyon UI State
  const [simAddCourseCode, setSimAddCourseCode] = useState('');
  const [simAddGrade, setSimAddGrade] = useState('AA');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Derived Simulation State
  // Calculate when we have simulation records (Step 2 onwards where simulation UI is shown)
  const simGpaResult = simulationRecords.length > 0 ? calculateGPA(simulationRecords) : null;

  const [selectedArea, setSelectedArea] = useState('');

  // Custom Course Mode State
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [customCourse, setCustomCourse] = useState({
    code: '',
    name: '',
    credits: 3,
    ects: 5,
    grade: 'AA',
    type: 'secmeli'
  });

  const addCustomSimulationCourse = () => {
    if (!customCourse.code || !customCourse.name) return;

    const gradeInfo = GRADE_SYSTEM[customCourse.grade];
    if (!gradeInfo) return;

    const newRecord: StudentRecord = {
      id: `SIM-CUSTOM-${Date.now()}-${Math.random()}`,
      courseCode: customCourse.code.toUpperCase().trim(),
      courseName: customCourse.name.trim(),
      credits: Number(customCourse.credits),
      ects: Number(customCourse.ects),
      semester: 'Simülasyon',
      grade: {
        letter: customCourse.grade,
        coefficient: gradeInfo.coefficient,
        passed: gradeInfo.passed
      }
    };
    setSimulationRecords(prev => [...prev, newRecord]);
    // Reset form defaults
    setCustomCourse(prev => ({ ...prev, code: '', name: '' }));
  };
  const [scheduleText, setScheduleText] = useState('');
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleOffering[]>([]);
  const [showIntibak, setShowIntibak] = useState(false);
  const [proposedSchedule, setProposedSchedule] = useState<ProposedCourse[]>([]);
  const [proposalLogs, setProposalLogs] = useState<string[]>([]);
  const [activeScheduleTab, setActiveScheduleTab] = useState<'manual' | 'pdf' | 'text'>('manual');
  const [manualCourse, setManualCourse] = useState({ courseCode: '', day: '', startTime: '', endTime: '' });

  // Auto-add failed courses to schedule
  const autoAddFailedCourses = () => {
    if (records.length === 0) {
      alert('⚠️ Önce transkript yükleyin.');
      return;
    }
    if (departmentSchedule.length === 0) {
      alert('⚠️ Önce bölüm ders programı PDF\'ini yükleyin.');
      return;
    }

    // Find failed courses (passed: false)
    const failedCourses = records.filter(r => !r.grade.passed);
    const failedCodes = [...new Set(failedCourses.map(r => r.courseCode))];

    console.log('Failed courses:', failedCodes);

    // Find these courses in department schedule
    const coursesToAdd: ScheduleOffering[] = [];
    let addedCount = 0;
    let notFoundCount = 0;

    for (const code of failedCodes) {
      // Find all sections of this course in department schedule
      const sections = departmentSchedule.filter(s => s.courseCode === code);

      if (sections.length > 0) {
        // Add the first available section (user can change later)
        // Check if already in selectedSchedule
        const alreadyAdded = selectedSchedule.some(s => s.courseCode === code);
        if (!alreadyAdded) {
          coursesToAdd.push(sections[0]); // Add first section
          addedCount++;
        }
      } else {
        console.log(`Course ${code} not found in department schedule`);
        notFoundCount++;
      }
    }

    if (coursesToAdd.length > 0) {
      setSelectedSchedule(prev => [...prev, ...coursesToAdd]);
    }

    let message = `✅ ${addedCount} kalan ders otomatik eklendi.`;
    if (notFoundCount > 0) {
      message += ` ⚠️ ${notFoundCount} ders bölüm programında bulunamadı (farklı dönemde olabilir).`;
    }
    if (addedCount === 0 && notFoundCount === 0) {
      message = '✅ Kalan ders yok! Tüm dersleri geçmişsiniz.';
    }
    alert(message);
  };

  //Helper functions for schedule grid
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour <= 20; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00 - ${(hour + 1).toString().padStart(2, '0')}:00`);
    }
    return slots;
  };

  const isTimeInSlot = (slot: string, startTime: string, endTime: string) => {
    const [slotStart] = slot.split(' - ');
    const slotHour = parseInt(slotStart.split(':')[0]);
    const startHour = parseInt(startTime.split(':')[0]);
    const endHour = parseInt(endTime.split(':')[0]);
    return slotHour >= startHour && slotHour < endHour;
  };

  const handleSchedulePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Clear old data first
    setDepartmentSchedule([]);
    setSelectedSchedule([]);
    localStorage.removeItem('estu-department-schedule');

    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).href;

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

      // Collect ALL items with coordinates from ALL pages
      const allItems: any[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const items = textContent.items as any[];

        items.forEach(item => {
          allItems.push({
            str: item.str,
            x: item.transform[4],
            y: item.transform[5],
            width: item.width,
            height: item.height,
            page: i
          });
        });
      }

      console.log(`[PDF] Extracted ${allItems.length} text items from ${pdf.numPages} pages`);

      // Use grid-based parser with coordinates
      const { parseScheduleFromItems } = await import('./utils/scheduleUtils');
      const parsed = parseScheduleFromItems(allItems);

      if (parsed.length > 0) {
        setDepartmentSchedule(parsed);
        // localStorage.setItem removed - data will not persist across refresh

        // Show detailed success message
        const dayStats: Record<string, number> = {};
        parsed.forEach(p => { dayStats[p.day] = (dayStats[p.day] || 0) + 1; });
        const dayInfo = Object.entries(dayStats).map(([d, c]) => `${d}: ${c}`).join(', ');

        alert(`✅ ${parsed.length} ders/şube başarıyla okundu!\n\nGün dağılımı:\n${dayInfo}`);
      } else {
        alert('⚠️ Ders formatı algılanamadı. Konsolu (F12) kontrol edin.');
      }
    } catch (error) {
      console.error('PDF okuma hatası:', error);
      alert('PDF okurken hata oluştu.');
    }

    e.target.value = '';
  };

  // Local storage'dan veri yükle
  useEffect(() => {
    const saved = localStorage.getItem('estu-eem-data');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setRecords(data.records || []);
        setTranscriptText(data.transcriptText || '');
      } catch (e) {
        console.error('Load error');
      }
    }
  }, []);

  // Kayıtlar değiştiğinde GNO hesapla ve localStorage'e kaydet
  useEffect(() => {
    if (records.length > 0) {
      localStorage.setItem('estu-eem-data', JSON.stringify({ records, transcriptText }));
      setGPA(calculateGPA(records));
    }
  }, [records, transcriptText]);

  // Auto-initialize simulation records when main records change
  useEffect(() => {
    if (records.length > 0) {
      // Initialize simulation with a deep copy of current records
      setSimulationRecords(JSON.parse(JSON.stringify(records)));
    }
  }, [records]);


  // Dosya yükleme işlemi. PDF ve TXT desteklenir.
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset previous state immediately
    setRecords([]);
    setGPA(null);
    setTranscriptText('');
    setStep(1); // Stay on step 1 until success

    // Input değerini sıfırla ki aynı dosyayı tekrar seçebilelim
    e.target.value = '';

    console.log('Dosya yüklendi:', file.name, 'Type:', file.type, 'Size:', file.size);

    try {
      // PDF veya TXT dosyasını oku
      let text: string;
      if (file.type === 'application/pdf') {
        console.log('PDF dosyası algılandı, pdfjs-dist yükleniyor...');
        // PDF.js ile PDF'ten metin çıkar
        const pdfjs = await import('pdfjs-dist');

        // Worker'ı npm paketinden kullan - Vite bunu otomatik handle eder
        // @ts-ignore - Vite özel import syntaxı
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url
        ).href;
        console.log('PDF okunuyor...');
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

        console.log('PDF sayfa sayısı:', pdf.numPages);
        text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();

          // PDF'den metni daha iyi yapılandırmak için satır sonlarını koru
          let lastY = -1;
          const pageLines: string[] = [];
          let currentLine = '';

          textContent.items.forEach((item: any) => {
            // Y pozisyonu değiştiyse yeni satır
            if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) {
              if (currentLine.trim()) {
                pageLines.push(currentLine.trim());
              }
              currentLine = '';
            }
            currentLine += item.str + ' ';
            lastY = item.transform[5];
          });

          // Son satırı ekle
          if (currentLine.trim()) {
            pageLines.push(currentLine.trim());
          }

          text += pageLines.join('\n') + '\n';
        }
        console.log('PDF metin çıkarıldı, uzunluk:', text.length);
        console.log('İlk 500 karakter:', text.substring(0, 500));
        console.log('=== TAM METİN ===');
        console.log(text);
        console.log('=== TAM METİN SONU ===');
      } else {
        console.log('TXT dosyası olarak okunuyor...');
        // TXT dosyası - FileReader kullan
        text = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.onerror = () => reject(new Error('Dosya okunamadı'));
          reader.readAsText(file);
        });
        console.log('TXT dosyası okundu, uzunluk:', text.length);
      }

      console.log('Metin parse ediliyor...');
      setTranscriptText(text);
      let parsed = parseTranscriptAdvanced(text);
      console.log('Parse edilen kayıt sayısı:', parsed.length);

      if (parsed.length === 0) {
        alert('Dosyadan ders kaydı okunamadı! Lütfen geçerli bir transkript yüklediğinizden emin olun.');
        return;
      }

      if (showIntibak) {
        console.log('İntibak uygulanıyor...');
        parsed = applyIntibak(parsed);
      }
      setRecords(parsed);
      setSimulationRecords([]); // Clear old simulation data when new file is loaded
      setStep(2);
      console.log('İşlem başarılı, adım 2\'ye geçiliyor');
    } catch (error) {
      console.error('Dosya yükleme hatası:', error);
      alert('Dosya okunamadı. Lütfen geçerli bir PDF veya TXT dosyası yükleyin.\n\nHata: ' + (error as Error).message);
    }
  };




  // Geçilen dersler kümesi
  const completedCourses = new Set(records.filter(r => r.grade.passed).map(r => r.courseCode));
  // EEM413/414 kontrolü
  const eem413Check = gpa ? checkEEM413Eligibility(records, gpa) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-xl md:text-3xl font-bold text-indigo-900 leading-tight text-center md:text-left">
            <span className="md:hidden">ESTÜ EEM Akademik Planlama Sistemi</span>
            <span className="hidden md:block">ESTÜ Elektrik Elektronik Mühendisliği Akademik Planlama Sistemi</span>
          </h1>
          <p className="mt-2 text-gray-600 font-medium">
            Ahmet Furkan Güven tarafından geliştirilmiştir.
          </p>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8 overflow-x-auto">
          {[
            { num: 1, label: 'Transkript', icon: Upload },
            { num: 2, label: 'GPA & Senaryo', icon: Calculator },
            { num: 3, label: 'Uzmanlaşma', icon: Award },
            { num: 4, label: 'Ders Programı', icon: Calendar },
            { num: 5, label: 'Rapor', icon: Download }
          ].map(({ num, label, icon: Icon }) => (
            <div key={num} className="flex items-center">
              <button
                onClick={() => records.length > 0 && setStep(num)}
                className={`flex items-center justify-center w-12 h-12 rounded-full ${step >= num ? 'bg-indigo-600 text-white' : 'bg-gray-300 text-gray-600'
                  } transition-colors`}
              >
                {step > num ? <CheckCircle size={24} /> : <Icon size={20} />}
              </button>
              <span className={`ml-2 text-sm font-medium ${step >= num ? 'text-indigo-900' : 'text-gray-500'}`}>
                {label}
              </span>
              {num < 5 && <div className={`w-12 h-1 mx-2 ${step > num ? 'bg-indigo-600' : 'bg-gray-300'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">📄 Transkript Yükleme + İntibak</h2>
            <div className="mb-4 flex items-center">
              <input
                type="checkbox"
                id="intibak"
                checked={showIntibak}
                onChange={(e) => setShowIntibak(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded"
              />
              <label htmlFor="intibak" className="ml-2 text-sm text-gray-700">
                Otomatik intibak uygula (EMAT111→MAT1011, EKİM105→KİM1005, vb.)
              </label>
            </div>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <span className="mt-2 block text-sm font-medium text-gray-900">
                TXT veya PDF transkript yükleyin
              </span>

              {/* Gerçek file input (gizli) */}
              <input
                id="transcriptFile"
                type="file"
                accept=".txt,.pdf"
                onChange={handleFileUpload}
                className="hidden"
              />

              {/* Buton görünümlü label: input'u garanti tetikler */}
              <label
                htmlFor="transcriptFile"
                className="mt-4 inline-flex items-center justify-center px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer select-none"
              >
                Dosya Seç
              </label>

            </div>

            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <Info className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-2">✅ Yenilikler v2.0:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>PDF Parser (pdf.js entegrasyonu)</li>
                    <li>İntibak motoru (eski→yeni ders kodları)</li>
                    <li>6 uzmanlaşma alanı + zorunlu ders kontrolü</li>
                    <li>Ders programı parser + çakışma analizi</li>
                    <li>EEM413/414 güncel kurallar (180 AKTS VEYA ilk 4 yarıyıl)</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Adım 2: GNO Analizi */}
        {step === 2 && !gpa && records.length > 0 && (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-600">GNO hesaplanıyor...</p>
            </div>
          </div>
        )}

        {step === 2 && gpa && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-xl shadow-sm">
                  <BarChart3 className="w-8 h-8 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">GNO/DNO Analizi</h2>
                  <p className="text-gray-500">Akademik başarı durumunuzun detaylı analizi</p>
                </div>
              </div>

              <button
                onClick={() => {
                  // Geçilen dersleri bul
                  const passedCodes = new Set(records.filter(r => r.grade.passed).map(r => r.courseCode));

                  // Analiz sayfası içinde simülasyon verileri varsa rapora ekle
                  // simulationRecords state'i doluysa hesaplama yap
                  const simResult = simulationRecords.length > 0 ? calculateGPA(simulationRecords) : null;

                  generateAcademicReport({
                    studentName: 'Öğrenci',
                    studentId: '123456789',
                    department: 'Elektrik-Elektronik Mühendisliği',
                    gpa: gpa,
                    // Sadece sonradan geçilmemiş olan başarısız dersleri listele
                    failedCourses: records.filter(r => !r.grade.passed && !passedCodes.has(r.courseCode)),
                    allRecords: records,
                    simulationGpa: simResult,
                    simulationRecords: simulationRecords.length > 0 ? simulationRecords : undefined
                  });
                }}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Download size={18} />
                <span>Raporu İndir</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className={`p-6 rounded-2xl shadow-lg transform hover:scale-[1.02] transition-all duration-300 ${gpa.gno >= 3.0 ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white' : gpa.gno >= 2.0 ? 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white' : 'bg-gradient-to-br from-orange-500 to-red-500 text-white'}`}>
                <div className="text-white/80 text-sm font-medium mb-1">Genel Not Ortalaması</div>
                <div className="text-5xl font-bold tracking-tight">{gpa.gno.toFixed(2)}</div>
                <div className="mt-4 flex items-center gap-2 text-white/90 bg-white/10 p-2 rounded-lg backdrop-blur-sm">
                  {gpa.gno >= 2.0 ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  <span className="font-medium">{gpa.gno >= 2.0 ? 'Başarılı' : 'Akademik Yetersizlik'}</span>
                </div>
              </div>

              <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="text-gray-500 text-sm font-medium mb-1">Toplam AKTS</div>
                <div className="text-4xl font-bold text-gray-800 tracking-tight">{gpa.totalECTS}</div>
                <div className="mt-4 w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min((gpa.totalECTS / 240) * 100, 100)}%` }}
                  ></div>
                </div>
                <div className="mt-2 text-xs text-gray-400 font-medium">Mezuniyet: 240 AKTS</div>
              </div>

              <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="text-gray-500 text-sm font-medium mb-1">Geçilen Kredi</div>
                <div className="text-4xl font-bold text-gray-800 tracking-tight flex items-baseline gap-2">
                  {gpa.passedCredits}
                  <span className="text-xl text-gray-400 font-normal">/{gpa.totalAttempted}</span>
                </div>
                <div className="mt-4 text-sm font-medium text-blue-600 bg-blue-50 py-1 px-3 rounded-full w-fit">
                  %{gpa.totalAttempted > 0 ? Math.min(100, Math.round((gpa.passedCredits / gpa.totalAttempted) * 100)) : 0} başarı
                </div>
              </div>
            </div>


            {/* Removed Hesaplama Detayları table - simplified UX */}

            {eem413Check && (
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">🎓 EEM413/414 Uygunluk Kontrolü</h2>
                {eem413Check.eligible ? (
                  <div className="flex items-center p-4 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="h-6 w-6 text-green-600 mr-3" />
                    <div>
                      <p className="font-medium text-green-900">Design Project derslerini alabilirsiniz!</p>
                      <p className="text-sm text-green-700 mt-1">
                        ✅ GNO ≥ 2.00 VE (İlk 4 yarıyıl zorunlu dersleri VEYA 180+ AKTS)
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start">
                      <AlertCircle className="h-6 w-6 text-red-600 mr-3 mt-0.5" />
                      <div>
                        <p className="font-medium text-red-900 mb-2">Eksik koşullar:</p>
                        <ul className="text-sm text-red-700 space-y-1">
                          {eem413Check.reasons.map((reason, i) => (
                            <li key={i}>• {reason}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">📚 Ders Kayıtları ({records.length})</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kod</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ders</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dönem</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Not</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">AKTS</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(showAllRecords ? records : records.slice(0, 15)).map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{record.courseCode}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{record.courseName}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{record.semester}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${record.grade.passed
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                            }`}>
                            {record.grade.letter}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-gray-700">{record.ects}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {records.length > 15 && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => setShowAllRecords(!showAllRecords)}
                    className="px-6 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                  >
                    {showAllRecords ? (
                      <>📤 Daha Az Göster (İlk 15)</>
                    ) : (
                      <>📥 Tüm Dersleri Göster ({records.length - 15} ders daha)</>
                    )}
                  </button>
                </div>
              )}
            </div>
            {/* Simulation Section Merged into Step 2 */}
            <div id="simulation-section" className="mt-12 pt-8 border-t border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">🧪 GNO Simülasyonu & Senaryo</h2>
                  <p className="text-gray-500">Notlarınızı aşağıdan değiştirerek veya yeni ders ekleyerek ortalamanızı tahmin edin.</p>
                </div>
              </div>

              {/* Simulation Dashboard (Copied from old Step 3) */}
              {simGpaResult && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-200">
                      <div className="text-sm text-gray-500 mb-1">Mevcut GNO</div>
                      <div className="text-3xl font-bold text-gray-400">{(gpa?.gno || 0).toFixed(2)}</div>
                    </div>
                    <div className={`p-6 rounded-2xl shadow-lg transform transition-all ${simGpaResult.gno >= (gpa?.gno || 0) ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white' : 'bg-gradient-to-br from-orange-500 to-red-500 text-white'}`}>
                      <div className="text-white/80 text-sm font-medium mb-1">Simülasyon GNO</div>
                      <div className="flex items-end gap-3">
                        <div className="text-5xl font-bold tracking-tight">{simGpaResult.gno.toFixed(2)}</div>
                        <div className={`text-lg font-medium px-2 py-1 rounded-lg ${simGpaResult.gno >= (gpa?.gno || 0) ? 'bg-white/20 text-white' : 'bg-black/20 text-white'}`}>
                          {simGpaResult.gno >= (gpa?.gno || 0) ? '+' : ''}{(simGpaResult.gno - (gpa?.gno || 0)).toFixed(2)}
                        </div>
                      </div>
                    </div>
                    {(() => {
                      const simCheck = checkEEM413Eligibility(simulationRecords, simGpaResult);
                      return (
                        <div className={`p-6 rounded-2xl shadow-sm border ${simCheck.eligible ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                          <div className={`text-sm font-medium mb-1 ${simCheck.eligible ? 'text-green-600' : 'text-red-600'}`}>Bitirme Projesi (Simüle)</div>
                          <div className={`text-xl font-bold ${simCheck.eligible ? 'text-green-800' : 'text-red-800'}`}>
                            {simCheck.eligible ? '✅ Alabilirsin' : '❌ Alamazsın'}
                          </div>
                        </div>
                      );
                    })()}
                    {/* AKTS Status Card */}
                    <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-200">
                      <div className="text-sm text-gray-500 mb-1">AKTS & Mezuniyet</div>
                      <div className="flex flex-col">
                        <div className="text-2xl font-bold text-gray-800">
                          {simGpaResult.totalECTS.toFixed(1)}
                          <span className="text-sm text-gray-400 font-normal ml-1">/ 240</span>
                        </div>
                        <div className={`text-xs mt-1 font-medium ${simGpaResult.totalECTS >= 240 ? 'text-green-600' : 'text-orange-600'}`}>
                          {simGpaResult.totalECTS >= 240
                            ? '✅ Kredi Tamamlandı'
                            : `⚠️ Mezuniyete ${(240 - simGpaResult.totalECTS).toFixed(1)} Kaldı`}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Yeni Ders Ekleme (Merged) */}
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 mt-6">
                <h3 className="font-bold text-lg text-gray-800 mb-4">➕ Senaryoya Ders Ekle</h3>

                {/* Tabs */}
                <div className="flex gap-6 border-b border-gray-200 mb-6">
                  <button
                    className={`pb-2 px-1 font-medium text-sm transition-colors ${!isCustomMode ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setIsCustomMode(false)}
                  >
                    🔍 Listeden Seç
                  </button>
                  <button
                    className={`pb-2 px-1 font-medium text-sm transition-colors ${isCustomMode ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    onClick={() => setIsCustomMode(true)}
                  >
                    ✍️ Özel Ders Ekle
                  </button>
                </div>

                {!isCustomMode ? (
                  <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full relative">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ders Arayın (Kod veya İsim)</label>

                      {/* Backdrop to close dropdown when clicking outside */}
                      {isSearchOpen && (
                        <div className="fixed inset-0 z-10 cursor-default" onClick={() => setIsSearchOpen(false)}></div>
                      )}

                      <div className="relative z-20">
                        <input
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500"
                          value={simAddCourseCode}
                          onChange={(e) => {
                            setSimAddCourseCode(e.target.value);
                            setIsSearchOpen(true);
                          }}
                          onFocus={() => setIsSearchOpen(true)}
                          placeholder="Örn: EEM403 veya Yapay Zeka..."
                        />

                        {isSearchOpen && (
                          <ul className="absolute w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto divide-y divide-gray-100">
                            {(() => {
                              // Alınmış veya senaryoda olan derslerin kodlarını (ve intibak karşılıklarını) bul
                              const takenCodes = new Set<string>();
                              simulationRecords.forEach(r => {
                                takenCodes.add(r.courseCode); // Orijinal kod
                                // İntibak kontrolü
                                const mapping = INTIBAK_MAPPINGS.find(m => m.oldCode === r.courseCode);
                                if (mapping) {
                                  takenCodes.add(mapping.newCode); // Yeni kod
                                }
                              });

                              const searchLower = simAddCourseCode.toLowerCase();
                              const filtered = ALL_COURSES
                                .filter(c => !takenCodes.has(c.code))
                                .filter(c =>
                                  c.code.toLowerCase().includes(searchLower) ||
                                  c.name.toLowerCase().includes(searchLower)
                                )
                                .sort((a, b) => a.code.localeCompare(b.code));

                              if (filtered.length === 0) {
                                return <li className="px-4 py-3 text-gray-500 text-sm">Sonuç bulunamadı.</li>
                              }

                              return filtered.map(c => (
                                <li
                                  key={c.code}
                                  onClick={() => {
                                    setSimAddCourseCode(c.code);
                                    setIsSearchOpen(false);
                                  }}
                                  className="px-4 py-3 hover:bg-indigo-50 cursor-pointer transition-colors"
                                >
                                  <div className="font-bold text-gray-800">{c.code}</div>
                                  <div className="text-sm text-gray-600 truncate">{c.name}</div>
                                  <div className="text-xs text-gray-400 mt-1">{c.credits} Kredi | {c.ects} AKTS</div>
                                </li>
                              ));
                            })()}
                          </ul>
                        )}
                      </div>
                    </div>
                    <div className="w-full md:w-32">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Hedef Not</label>
                      <select
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500"
                        value={simAddGrade}
                        onChange={(e) => setSimAddGrade(e.target.value)}
                      >
                        {['AA', 'AB', 'BA', 'BB', 'BC', 'CB', 'CC', 'CD', 'DC', 'DD', 'FF', 'YT'].map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => {
                        if (simAddCourseCode) {
                          addSimulationCourse(simAddCourseCode, simAddGrade);
                          setSimAddCourseCode(''); // Reset
                        }
                      }}
                      disabled={!simAddCourseCode}
                      className="w-full md:w-auto px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
                    >
                      Ekle
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ders Kodu</label>
                      <input
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 uppercase"
                        value={customCourse.code}
                        onChange={e => setCustomCourse(prev => ({ ...prev, code: e.target.value }))}
                        placeholder="Örn: YENI101"
                      />
                    </div>
                    <div className="md:col-span-12 lg:col-span-5">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ders Adı</label>
                      <input
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500"
                        value={customCourse.name}
                        onChange={e => setCustomCourse(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Örn: İleri Yapay Zeka"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Kredi</label>
                      <input
                        type="number"
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500"
                        value={customCourse.credits}
                        onChange={e => setCustomCourse(prev => ({ ...prev, credits: Number(e.target.value) }))}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">AKTS</label>
                      <input
                        type="number"
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500"
                        value={customCourse.ects}
                        onChange={e => setCustomCourse(prev => ({ ...prev, ects: Number(e.target.value) }))}
                      />
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ders Tipi</label>
                      <select
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500"
                        value={customCourse.type}
                        onChange={e => setCustomCourse(prev => ({ ...prev, type: e.target.value }))}
                      >
                        <option value="secmeli">Seçmeli</option>
                        <option value="mesleki_secmeli">Mesleki Seçmeli</option>
                        <option value="zorunlu">Zorunlu</option>
                      </select>
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Not</label>
                      <select
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500"
                        value={customCourse.grade}
                        onChange={e => setCustomCourse(prev => ({ ...prev, grade: e.target.value }))}
                      >
                        {/* GRADE_SYSTEM keys minus YZ/DZ */}
                        {['AA', 'AB', 'BA', 'BB', 'BC', 'CB', 'CC', 'CD', 'DC', 'DD', 'FF', 'YT'].map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-5 flex justify-end">
                      <button
                        onClick={addCustomSimulationCourse}
                        disabled={!customCourse.code || !customCourse.name}
                        className="w-full md:w-auto px-8 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium"
                      >
                        + Özel Dersi Ekle
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Ders Listesi */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden mt-6">
                <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                  <h3 className="font-bold text-gray-800">📋 Hesaplamaya Dahil Olan Dersler</h3>
                  <span className="text-sm text-gray-500">{simGpaResult?.usedCourses?.length || 0} Ders</span>
                </div>
                <div className="overflow-x-auto max-h-[600px]">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-6 py-3">Kod</th>
                        <th className="px-6 py-3">Ders Adı</th>
                        <th className="px-6 py-3 text-center">Kredi</th>
                        <th className="px-6 py-3 text-center">Dönem</th>
                        <th className="px-6 py-3 text-center">Simülasyon Notu</th>
                        <th className="px-6 py-3 text-center">İşlem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {simGpaResult?.usedCourses?.map((record) => (
                        <tr key={record.id} className={`hover:bg-gray-50 transition-colors ${record.semester === 'Simülasyon' ? 'bg-indigo-50/30' : ''}`}>
                          <td className="px-6 py-4 font-medium text-gray-900">{record.courseCode}</td>
                          <td className="px-6 py-4 text-gray-600 max-w-xs truncate" title={record.courseName || ''}>{record.courseName}</td>
                          <td className="px-6 py-4 text-center font-medium">{record.credits}</td>
                          <td className="px-6 py-4 text-center text-xs text-gray-500">{record.semester}</td>
                          <td className="px-6 py-4 text-center">
                            <select
                              className={`px-3 py-1 rounded-full text-xs font-bold border-0 cursor-pointer focus:ring-2 focus:ring-indigo-500 ${record.grade.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}
                              value={record.grade.letter}
                              onChange={(e) => updateSimulationGrade(record.id, e.target.value)}
                            >
                              {['AA', 'AB', 'BA', 'BB', 'BC', 'CB', 'CC', 'CD', 'DC', 'DD', 'FF', 'YT'].map(g => (
                                <option key={g} value={g}>{g}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {record.semester === 'Simülasyon' && (
                              <button
                                onClick={() => removeSimulationRecord(record.id)}
                                className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50"
                                title="Dersi Sil"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Navigation for Step 2 -> 3 */}
              <div className="flex justify-between mt-8">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  ← Geri
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Uzmanlaşma Analizi →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Specialization Analysis */}
        {step === 3 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header / Summary */}
            <div className="bg-white rounded-xl shadow-lg p-8 border border-indigo-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Award className="text-indigo-600" />
                Uzmanlaşma Analizi <span className="text-sm font-normal text-gray-500 ml-2">({analyzeSpecializations(records).activeSeason} Dönemi İçin Planlama)</span>
              </h2>

              {(() => {
                const analysis = analyzeSpecializations(records);
                const isTotalMet = analysis.totalTechnicalElectives >= 7;

                return (
                  <div>
                    <div className="flex flex-col md:flex-row gap-6 mb-8">
                      <div className={`flex-1 p-4 rounded-xl border-l-4 ${isTotalMet ? 'bg-green-50 border-green-500' : 'bg-amber-50 border-amber-500'} shadow-sm`}>
                        <h3 className="font-bold text-gray-800 mb-1">Toplam Mesleki Seçmeli</h3>
                        <div className="flex items-end gap-2">
                          <span className="text-3xl font-bold">{analysis.totalTechnicalElectives}</span>
                          <span className="text-gray-500 mb-1">/ 7 Ders (Min)</span>
                        </div>
                        <p className={`text-sm mt-2 ${isTotalMet ? 'text-green-700' : 'text-amber-700'}`}>
                          {isTotalMet ? '✅ Toplam ders sayısı şartı sağlandı.' : '⚠️ En az 7 mesleki seçmeli ders almalısınız.'}
                        </p>
                      </div>

                      <div className="flex-1 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-xl shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-1">En Uygun Alan</h3>
                        <div className="text-xl font-bold text-blue-900">
                          {analysis.bestGroup
                            ? SPECIALIZATION_GROUPS.find(g => g.id === analysis.bestGroup)?.name
                            : 'Henüz seçim yapılmadı'}
                        </div>
                        <p className="text-sm text-blue-700 mt-2">
                          Mevcut derslerinize göre en yüksek ilerleme.
                        </p>
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-gray-800 mb-4">Alan İlerlemeleri</h3>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      {analysis.groups.map((groupResult) => (
                        <div
                          key={groupResult.group.id}
                          className={`relative overflow-hidden rounded-xl border-2 transition-all duration-300 ${groupResult.isQualified
                            ? 'border-green-500 bg-white shadow-md ring-4 ring-green-50/50'
                            : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md'
                            }`}
                        >
                          {groupResult.isQualified && (
                            <div className="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg z-10">
                              TAMAMLANDI
                            </div>
                          )}

                          <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                            <h4 className="font-bold text-lg text-gray-900 pr-8">{groupResult.group.name}</h4>
                            <div className="flex items-center gap-4 mt-2">
                              <div className="flex items-center text-sm font-medium">
                                <span className={`w-2 h-2 rounded-full mr-2 ${groupResult.takenCount >= 5 ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                                İlerleme: {groupResult.takenCount}/5
                              </div>
                              <div className="flex items-center text-sm font-medium">
                                <span className={`w-2 h-2 rounded-full mr-2 ${groupResult.mandatoryMissing.length === 0 ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                Zorunlu: {groupResult.mandatoryMissing.length === 0 ? 'Tamam' : `${groupResult.mandatoryMissing.length} Eksik`}
                              </div>
                            </div>
                            {/* Progress bar */}
                            <div className="mt-3 w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${groupResult.isQualified ? 'bg-green-500' : 'bg-indigo-500'}`}
                                style={{ width: `${Math.min((groupResult.takenCount / 5) * 100, 100)}%` }}
                              />
                            </div>
                          </div>

                          <div className="p-0">
                            <div className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 p-2">
                              <table className="w-full text-sm">
                                <thead className="text-xs text-gray-400 bg-gray-50 sticky top-0">
                                  <tr>
                                    <th className="text-left py-2 px-3 font-medium">Kod</th>
                                    <th className="text-left py-2 px-3 font-medium">Ders Adı</th>
                                    <th className="text-center py-2 px-3 font-medium">Durum</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {groupResult.coursesStatus.map((statusItem, idx) => (
                                    <tr key={idx} className="group hover:bg-gray-50">
                                      <td className="py-2 px-3 font-mono text-xs text-gray-600">
                                        {statusItem.course.code}
                                        {statusItem.course.isMandatory && <span className="ml-1 text-red-500 font-bold" title="Zorunlu">(Z)</span>}
                                      </td>
                                      <td className="py-2 px-3 text-gray-700 truncate max-w-[180px]" title={statusItem.course.name}>
                                        {statusItem.course.name}
                                        <div className="text-[10px] text-gray-400">{statusItem.course.term}</div>
                                      </td>
                                      <td className="py-2 px-3 text-center">
                                        {statusItem.status === 'taken' && (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                            <CheckCircle size={12} className="mr-1" /> Alındı
                                          </span>
                                        )}
                                        {statusItem.status === 'available' && (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                            Alınabilir
                                          </span>
                                        )}
                                        {statusItem.status === 'locked' && (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500" title={`Önşart: ${statusItem.missingPrereq}`}>
                                            🔒 {statusItem.missingPrereq}
                                          </span>
                                        )}
                                        {statusItem.status === 'wrong_term' && (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-400 border border-gray-100 italic">
                                            ⏳ {statusItem.course.term} Dönemi
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
                      <h4 className="font-bold flex items-center gap-2 mb-2"><Info size={16} /> Kurallar Hatırlatması:</h4>
                      <ul className="list-disc list-inside space-y-1 ml-1">
                        <li>Mezuniyet için toplam <strong>en az 7</strong> mesleki seçmeli ders (Minimum 35 AKTS) alınmalıdır.</li>
                        <li>Bu derslerin <strong>en az 5 tanesi</strong> (Min 25 AKTS) tek bir uzmanlaşma grubundan seçilmelidir.</li>
                        <li>Seçilen grubun altındaki <strong>(Z)</strong> işaretli zorunlu derslerin tamamı başarılmalıdır.</li>
                        <li>"Research in..." derslerinden aynı dönem için en fazla 1, toplamda en fazla 2 adet alınabilir.</li>
                      </ul>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setStep(2)} // Corrected: Back to Analysis/Simulation (Step 2)
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                ← Geri
              </button>
              <button
                onClick={() => setStep(4)} // Forward to Schedule Planning (Step 4)
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                Ders Programı →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Schedule Planning */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">📅 Ders Programı Oluştur</h2>
              <p className="text-gray-600 mb-6">Haftalık ders programınızı oluşturun ve çakışmaları analiz edin</p>

              {/* Tab Selection */}
              <div className="flex gap-4 border-b border-gray-200 mb-6">
                <button
                  onClick={() => setActiveScheduleTab('manual')}
                  className={`pb-3 px-4 font-medium transition-colors ${activeScheduleTab === 'manual'
                    ? 'border-b-2 border-indigo-600 text-indigo-600'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  ✍️ Manuel Giriş
                </button>
                <button
                  onClick={() => setActiveScheduleTab('pdf')}
                  className={`pb-3 px-4 font-medium transition-colors ${activeScheduleTab === 'pdf'
                    ? 'border-b-2 border-indigo-600 text-indigo-600'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  📄 PDF Yükle
                </button>
              </div>

              {/* Manual Entry Form */}
              {activeScheduleTab === 'manual' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ders Kodu</label>
                      <input
                        type="text"
                        placeholder="EEM321"
                        value={manualCourse.courseCode}
                        onChange={(e) => setManualCourse({ ...manualCourse, courseCode: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Gün</label>
                      <select
                        value={manualCourse.day}
                        onChange={(e) => setManualCourse({ ...manualCourse, day: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">Seç</option>
                        <option value="Pazartesi">Pazartesi</option>
                        <option value="Salı">Salı</option>
                        <option value="Çarşamba">Çarşamba</option>
                        <option value="Perşembe">Perşembe</option>
                        <option value="Cuma">Cuma</option>
                        <option value="Cumartesi">Cumartesi</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Başlangıç</label>
                      <input
                        type="time"
                        value={manualCourse.startTime}
                        onChange={(e) => setManualCourse({ ...manualCourse, startTime: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bitiş</label>
                      <input
                        type="time"
                        value={manualCourse.endTime}
                        onChange={(e) => setManualCourse({ ...manualCourse, endTime: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (manualCourse.courseCode && manualCourse.day && manualCourse.startTime && manualCourse.endTime) {
                        setSelectedSchedule([...selectedSchedule, {
                          courseCode: manualCourse.courseCode,
                          section: '1',
                          day: manualCourse.day,
                          startTime: manualCourse.startTime,
                          endTime: manualCourse.endTime,
                          type: 'lecture',
                          async: false
                        }]);
                        setManualCourse({ courseCode: '', day: '', startTime: '', endTime: '' });
                      }
                    }}
                    disabled={!manualCourse.courseCode || !manualCourse.day || !manualCourse.startTime || !manualCourse.endTime}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    + Ders Ekle
                  </button>
                </div>
              )}

              {/* PDF Upload */}
              {activeScheduleTab === 'pdf' && (
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleSchedulePdfUpload}
                      className="hidden"
                      id="schedule-pdf-input"
                    />
                    <label htmlFor="schedule-pdf-input" className="cursor-pointer">
                      <div className="text-gray-600">
                        <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                          <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <p className="mt-2 text-sm font-medium">Ders Programı PDF'ini Yükle</p>
                        <p className="mt-1 text-xs text-gray-500">Okulun paylaştığı PDF formatındaki programı yükleyin</p>
                      </div>
                    </label>
                  </div>
                  <p className="text-xs text-gray-500">
                    💡 PDF yüklendikten sonra otomatik olarak parse edilecek ve programa eklenecektir.
                  </p>
                </div>
              )}

              {/* Department Schedule Browser */}
              {departmentSchedule.length > 0 && (
                <div className="mt-8 p-6 bg-indigo-50 rounded-xl border border-indigo-100">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-indigo-900">📚 Bölüm Programından Ders Seç</h3>
                    <button
                      onClick={autoAddFailedCourses}
                      className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 flex items-center gap-2"
                    >
                      <AlertCircle size={16} />
                      Kalan Dersleri Otomatik Ekle
                    </button>
                  </div>
                  <p className="text-sm text-indigo-700 mb-4">
                    Aşağıdaki listeden derslerin şubelerini (Section) seçerek programınıza ekleyin. Çakışmalar aşağıda otomatik kontrol edilecektir.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto">
                    {Array.from(new Set(departmentSchedule.map(s => s.courseCode))).sort().map(code => {
                      const allSections = departmentSchedule.filter(s => s.courseCode === code);
                      const lectures = allSections.filter(s => s.type === 'lecture');
                      const labs = allSections.filter(s => s.type === 'lab');

                      return (
                        <div key={code} className="bg-white p-4 rounded-lg shadow-sm border border-indigo-100">
                          {/* Course Header */}
                          <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
                            <div className="font-bold text-gray-800 text-lg">{code}</div>
                            <div className="flex gap-1">
                              {lectures.length > 0 && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                  {lectures.length} Teorik
                                </span>
                              )}
                              {labs.length > 0 && (
                                <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                                  {labs.length} Lab
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Lecture Sessions */}
                          {lectures.length > 0 && (
                            <div className="mb-3">
                              <div className="flex justify-between items-center mb-2">
                                <div className="text-xs font-semibold text-blue-700 flex items-center gap-1">
                                  📖 Teorik Ders
                                </div>
                                <button
                                  onClick={() => {
                                    // Add ALL lecture sessions at once
                                    const newSessions = lectures.filter(sec =>
                                      !selectedSchedule.some(s =>
                                        s.courseCode === sec.courseCode && s.day === sec.day && s.startTime === sec.startTime
                                      )
                                    );
                                    if (newSessions.length > 0) {
                                      setSelectedSchedule([...selectedSchedule, ...newSessions]);
                                    }
                                  }}
                                  className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition-colors"
                                >
                                  Tümünü Ekle ({lectures.length})
                                </button>
                              </div>
                              <div className="space-y-1 text-xs text-gray-600">
                                {lectures.map((sec, idx) => (
                                  <div key={`lec-${idx}`} className="flex items-center gap-2 p-1 bg-blue-50 rounded">
                                    <span className="font-medium">{sec.day}</span>
                                    <span className="font-mono">{sec.startTime}-{sec.endTime}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Lab Sessions - Grouped by Section (Mutual Exclusion) */}
                          {labs.length > 0 && (() => {
                            // Check if any lab group for this course is already selected
                            const selectedLabSection = selectedSchedule.find(s =>
                              s.courseCode === code && s.type === 'lab'
                            )?.section;

                            return (
                              <div>
                                <div className="text-xs font-semibold text-orange-700 mb-2 flex items-center gap-1">
                                  🔬 Laboratuvar Grupları
                                  {selectedLabSection && (
                                    <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded">
                                      ✓ Grup {selectedLabSection} seçildi
                                    </span>
                                  )}
                                </div>
                                <div className="space-y-2">
                                  {/* Group labs by section */}
                                  {Array.from(new Set(labs.map(l => l.section))).sort().map(section => {
                                    const sectionLabs = labs.filter(l => l.section === section);
                                    const isThisGroupSelected = selectedLabSection === section;
                                    const isOtherGroupSelected = selectedLabSection && selectedLabSection !== section;

                                    return (
                                      <div
                                        key={section}
                                        className={`p-2 rounded border ${isThisGroupSelected
                                          ? 'bg-green-50 border-green-300'
                                          : isOtherGroupSelected
                                            ? 'bg-gray-100 border-gray-200 opacity-50'
                                            : 'bg-orange-50 border-orange-100'
                                          }`}
                                      >
                                        <div className="flex justify-between items-center mb-1">
                                          <span className={`text-xs font-bold ${isThisGroupSelected ? 'text-green-800' : 'text-orange-800'}`}>
                                            Grup {section}
                                          </span>
                                          {isThisGroupSelected ? (
                                            <button
                                              onClick={() => {
                                                // Remove this group's sessions
                                                setSelectedSchedule(selectedSchedule.filter(s =>
                                                  !(s.courseCode === code && s.type === 'lab')
                                                ));
                                              }}
                                              className="text-xs bg-red-500 text-white px-2 py-0.5 rounded hover:bg-red-600"
                                            >
                                              Kaldır
                                            </button>
                                          ) : (
                                            <button
                                              onClick={() => {
                                                if (isOtherGroupSelected) return; // Disabled
                                                // Add ALL sessions of this lab group
                                                const newSessions = sectionLabs.filter(sec =>
                                                  !selectedSchedule.some(s =>
                                                    s.courseCode === sec.courseCode && s.day === sec.day && s.startTime === sec.startTime
                                                  )
                                                );
                                                if (newSessions.length > 0) {
                                                  setSelectedSchedule([...selectedSchedule, ...newSessions]);
                                                }
                                              }}
                                              disabled={!!isOtherGroupSelected}
                                              className={`text-xs px-2 py-0.5 rounded transition-colors ${isOtherGroupSelected
                                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                : 'bg-orange-500 text-white hover:bg-orange-600'
                                                }`}
                                            >
                                              {isOtherGroupSelected ? 'Başka grup seçili' : 'Ekle'}
                                            </button>
                                          )}
                                        </div>
                                        <div className="text-xs text-orange-700">
                                          {sectionLabs.map((sec, idx) => (
                                            <span key={idx}>
                                              {sec.day} {sec.startTime}-{sec.endTime}
                                              {idx < sectionLabs.length - 1 ? ', ' : ''}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Weekly Schedule Grid */}
              {selectedSchedule.length > 0 && (
                <div className="mt-8">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-gray-900">📋 Haftalık Program</h3>
                    <button
                      onClick={() => setSelectedSchedule([])}
                      className="px-4 py-2 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
                    >
                      Programı Temizle
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse">
                      <thead>
                        <tr>
                          <th className="sticky left-0 z-10 bg-red-900 text-white px-4 py-3 text-sm font-medium border border-gray-300">
                            Saat
                          </th>
                          {['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'].map((day) => (
                            <th key={day} className="bg-blue-700 text-white px-4 py-3 text-sm font-medium border border-gray-300 min-w-[120px]">
                              {day}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {generateTimeSlots().map((timeSlot) => (
                          <tr key={timeSlot} className="hover:bg-gray-50">
                            <td className="sticky left-0 z-10 bg-red-900 text-white px-4 py-3 text-xs font-medium border border-gray-300 whitespace-nowrap">
                              {timeSlot}
                            </td>
                            {['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'].map((day) => {
                              const course = selectedSchedule.find((s) =>
                                s.day === day && isTimeInSlot(timeSlot, s.startTime, s.endTime)
                              );
                              return (
                                <td
                                  key={day}
                                  className={`px-2 py-3 text-xs text-center border border-gray-300 ${course ? 'bg-gray-200 font-medium' : 'bg-white'
                                    }`}
                                >
                                  {course ? (
                                    <div className="group relative">
                                      <div className="font-bold text-gray-900">{course.courseCode}</div>
                                      <button
                                        onClick={() => {
                                          setSelectedSchedule(selectedSchedule.filter(s =>
                                            !(s.courseCode === course.courseCode && s.day === course.day && s.startTime === course.startTime)
                                          ));
                                        }}
                                        className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-800"
                                        title="Dersi Sil"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ) : null}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Conflict Analysis */}
                  <div className="mt-6">
                    <h3 className="font-semibold text-gray-900 mb-3">⚠️ Çakışma Analizi</h3>
                    {(() => {
                      const conflicts = detectScheduleConflicts(selectedSchedule);
                      return conflicts.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {conflicts.map((c, i) => (
                            <div key={i} className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
                              <AlertCircle className="text-red-500 mt-0.5 mr-2 shrink-0" size={18} />
                              <div>
                                <div className="font-bold text-red-900 text-sm">Çakışma Tespit Edildi</div>
                                <div className="text-red-700 text-sm mt-1">{c.courses.join(' ve ')}</div>
                                <div className="text-red-600 text-xs mt-0.5">{c.time}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-sm text-green-800 flex items-center">
                            <CheckCircle className="mr-2" size={16} />
                            ✅ Çakışma tespit edilmedi! Programınız uyumlu.
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}

            </div>
            <div className="flex justify-between items-center">
              <button
                onClick={() => setStep(3)} // Back to Specialization Step 3
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                ← Geri
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(5)} // Skip schedule simulation
                  className="px-6 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
                >
                  Bu Adımı Atla →
                </button>
                <button
                  onClick={() => setStep(5)} // Forward to Report
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  Raporu İndir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Report */}
        {
          step === 5 && gpa && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">📄 Akademik Durum Raporu</h2>
                <div className="space-y-4 mb-6">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-semibold mb-2">📊 Not Durumu</h3>
                    <p>GNO: <strong>{gpa.gno.toFixed(2)}</strong> | AKTS: <strong>{gpa.totalECTS}/240</strong></p>
                  </div>
                  {selectedArea && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h3 className="font-semibold mb-2">🎯 En İyi Uzmanlaşma</h3>
                      <p>
                        {(() => {
                          const analysis = analyzeSpecializations(records);
                          const best = SPECIALIZATION_GROUPS.find(g => g.id === analysis.bestGroup);
                          if (best) {
                            const groupResult = analysis.groups.find(g => g.group.id === best.id);
                            return (
                              <>
                                <strong>{best.name}</strong>
                                <p className="text-sm text-gray-600 mt-1">
                                  İlerleme: {groupResult?.takenCount}/5 ders
                                </p>
                              </>
                            )
                          }
                          return <span>Henüz yeterli veri yok</span>
                        })()}
                      </p>
                    </div>
                  )}
                  {eem413Check && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h3 className="font-semibold mb-2">🎓 EEM413/414 Durumu</h3>
                      <p className={eem413Check.eligible ? 'text-green-600' : 'text-red-600'}>
                        {eem413Check.eligible ? '✅ Alabilir' : '❌ Henüz alamaz'}
                      </p>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <button
                    onClick={() => {
                      const passedCodes = new Set(records.filter(r => r.grade.passed).map(r => r.courseCode));
                      const simResult = simulationRecords.length > 0 ? calculateGPA(simulationRecords) : null;

                      generateAcademicReport({
                        studentName: 'Öğrenci',
                        studentId: '123456789',
                        department: 'Elektrik-Elektronik Mühendisliği',
                        gpa: gpa,
                        failedCourses: records.filter(r => !r.grade.passed && !passedCodes.has(r.courseCode)),
                        allRecords: records,
                        simulationGpa: simResult,
                        simulationRecords: simulationRecords.length > 0 ? simulationRecords : undefined
                      });
                    }}
                    className="w-full flex items-center justify-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-lg transform hover:scale-[1.02]"
                  >
                    <Download size={24} className="mr-2" />
                    <span className="font-bold text-lg">PDF Raporu İndir</span>
                  </button>
                  <p className="text-center text-sm text-gray-500 mt-4">
                    Rapor, senaryo analizlerini ve uzmanlaşma önerilerini içerir.
                  </p>
                </div>
              </div>
              <div className="flex justify-between">
                <button
                  onClick={() => setStep(4)} // Back to Schedule Planning
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  ← Geri
                </button>
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50"
                >
                  Yeni Analiz Başlat
                </button>
              </div>
            </div>
          )
        }

        <footer className="bg-white border-t mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <p className="text-center text-gray-600 text-sm font-medium">
              <span className="md:hidden">ESTÜ EEM Akademik Planlama Sistemi</span>
              <span className="hidden md:block">ESTÜ Elektrik Elektronik Mühendisliği Akademik Planlama Sistemi</span>
            </p>

            <div className="flex flex-col items-center gap-3 mt-4">
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100 shadow-sm">
                <ShieldCheck size={16} />
                <span className="font-medium">Güvenlik: Tüm veriler tarayıcınızda işlenir, sunucuya gönderilmez.</span>
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>Ahmet Furkan Güven tarafından geliştirilmiştir.</span>
                <span className="text-gray-300">|</span>
                <a href="https://github.com/" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-indigo-500 hover:text-indigo-700 transition-colors font-medium">
                  <Github size={14} />
                  <span>Açık Kaynak Kodlarına Eriş</span>
                </a>
              </div>
            </div>
          </div>
        </footer>
        <VisitorCounter />
      </div >
    </div >
  );
}