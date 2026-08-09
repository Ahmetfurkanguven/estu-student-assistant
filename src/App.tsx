import React, { useState, useEffect, useRef } from 'react';
import { Upload, BookOpen, GraduationCap, Calendar, BarChart, ChevronRight, CheckCircle, AlertCircle, Trash2, Github, FileText, Download, BarChart3, CheckCircle2, Calculator, TrendingUp, Info, Award, ShieldCheck, Globe } from 'lucide-react';
import { translations } from './data/locales';
import { VisitorCounter } from './components/VisitorCounter';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================
import { ProposedCourse, ProposalResult } from './utils/courseSelectionRules';
import { detectScheduleConflicts } from './utils/scheduleUtils';
import { generateAcademicReport } from './utils/reportGenerator';

// --- Yönetmelik motoru (ESTÜ ÖL/L Eğitim-Öğretim ve Sınav Yönetmeliği, RG 9/9/2025) ---
import type { DepartmentProfile } from './types/department';
import { analyzeTranscript, buildProposal, type AcademicAnalysis } from './engine/analyze';
import { readTranscriptFile } from './utils/transcriptParser';
import type { TermType } from './utils/repeatRules';
import { setActiveProfile } from './data/activeProfile';
import { DepartmentSelector } from './components/DepartmentSelector';
import { TranscriptDiagnostics } from './components/TranscriptDiagnostics';
import { AcademicStandingPanel } from './components/AcademicStandingPanel';
import { CourseProposalPanel } from './components/CourseProposalPanel';
import { GpaTargetPlanner } from './components/GpaTargetPlanner';
import { ScheduleBuilder } from './components/ScheduleBuilder';

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

// Ders planı, intibak eşlemeleri, uzmanlaşma tanımları ve örnek program verisi
// koda GÖMÜLÜ DEĞİLDİR. Seçilen bölümün public/data/departments/<KOD>.json
// profilinden yüklenir. Bkz. utils/departmentRegistry.ts, data/activeProfile.ts
import { getActiveCourses, getActiveIntibak } from './data/activeProfile';

// Uzmanlaşma alanları. Her alan için gereken dersler ve minimum MS ders/AKTS bilgisi.
import { analyzeSpecializations } from './utils/specializationUtils';
import { SPECIALIZATION_GROUPS } from './data/specializationGroups';





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

    // Transfer/Erasmus dersler formatı
    if (/\d{4}-\d{4}\s+(Transfer|Erasmus|Değişim|DGS|Yatay)/i.test(line)) {
      currentSemester = line.trim();
      console.log('Özel transfer/değişim dönemi bulundu:', currentSemester);
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

        // YERİNE DERS KONTROLÜ
        const yerine1 = parts.length > 6 ? parts[6] : null;
        const yerine2 = parts.length > 7 ? parts[7] : null;

        const isYerinePopulated = (val: string | null) => {
          return val && val.length > 2 && val !== 'Z' && val !== 'S';
        };

        const isSpecialTransfer = /Transfer|Erasmus|Değişim|DGS|Yatay/i.test(currentSemester);
        let finalCode = code;

        if (isSpecialTransfer) {
          // Transfer derslerde Karşılık-1 veya Karşılık-2 kolonunda yerel kod olabilir
          const candidates = [yerine1, yerine2].filter(isYerinePopulated);
          if (candidates.length > 0) {
            // "TÜR125(Tür)" -> "TÜR125" temizliği
            const clean = candidates[0]!.replace(/\(.*\)/, '').trim();
            if (clean.length >= 3) {
              finalCode = clean;
              console.log(`Transfer eşleşmesi: ${code} -> ${finalCode}`);
            }
          }
        } else if (isYerinePopulated(yerine1) || isYerinePopulated(yerine2)) {
          console.log(`[IGNORED] Yerine ders tespit edildi, satır atlanıyor: ${code}`);
          continue;
        }

        // AKTS ve not bilgisini parse et
        // Transfer derslerde format "D 2.0" olabilir, "D" harfini temizle
        aktsStr = aktsStr.replace(/^[A-Za-z]\s*/, '').trim();
        const akts = parseFloat(aktsStr);
        const gradeLetter = gradeStr.toUpperCase();

        // Not sisteminde varsa devam et
        const gradeInfo = GRADE_SYSTEM[gradeLetter];
        if (gradeInfo && !isNaN(akts)) {
          records.push({
            id: `${finalCode}-${currentSemester}-${Math.random().toString(36).substr(2, 5)}`,
            courseCode: finalCode,
            courseName: courseName.trim(),
            semester: currentSemester,
            credits: akts,
            ects: akts,
            grade: {
              letter: gradeLetter,
              coefficient: gradeInfo.coefficient,
              passed: gradeInfo.passed
            }
          });
          console.log(`Ders eklendi: ${finalCode} (Ori: ${code}) - ${gradeLetter} - ${akts} Kredi`);
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
    const mapping = getActiveIntibak().find(m => m.oldCode === record.courseCode);
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
 * Bir ders için önkoşullar sağlanmış mı kontrol eder. Önkoşullar listesi getActiveCourses()
 * içindeki course.prerequisites alanından alınır.
 */
function checkPrerequisites(courseCode: string, completedCourses: Set<string>): { canTake: boolean; missing: string[] } {
  const course = getActiveCourses().find(c => c.code === courseCode);
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
 * Bitirme projesi derslerini alma uygunluğunu kontrol eder (Madde 8/4). GNO ≥ 2.00 ve (ilk 4 yarıyıl zorunlu
 * dersler tamamlanmış VEYA en az 180 AKTS) kriterlerini kullanır.
 */
function checkGraduationProjectEligibility(records: StudentRecord[], gpa: GPAResult): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (gpa.gno < 2.0) {
    reasons.push(`GNO yetersiz: ${gpa.gno.toFixed(2)} < 2.00`);
  }

  // KURAL: İlk 4 yarıyılın tüm zorunlu dersleri tamamlanmış olmalı VEYA 180 AKTS tamamlanmış olmalı.
  const firstFourSemesterCourses = getActiveCourses()
    .filter(c => c.semester && c.semester <= 4 && c.type === 'zorunlu')
    .map(c => c.code);

  // 2. Geçilen dersleri bul (Code normalization: trim + uppercase + INTIBAK)
  const completedSet = new Set<string>();
  const mappedDebug: string[] = []; // Debug için hangi derslerin çevrildiğini tutalım

  records.forEach(r => {
    if (r.grade.passed) {
      let code = r.courseCode.trim().toUpperCase();

      // Zorla İntibak Kontrolü (State'te yapılmamışsa burada yap)
      const mapping = getActiveIntibak().find(m => m.oldCode === code);
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
  const [language, setLanguage] = useState<'tr' | 'en'>('tr');
  const t = (key: string) => {
    // @ts-ignore
    return translations[language][key] || key;
  };

  const [step, setStep] = useState(1);
  const [transcriptText, setTranscriptText] = useState('');
  const [records, setRecords] = useState<StudentRecord[]>([]);
  const [simulationRecords, setSimulationRecords] = useState<StudentRecord[]>([]); // Senaryo modu kayıtları
  const [gpa, setGPA] = useState<GPAResult | null>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'analysis'>('upload');
  const [showAllRecords, setShowAllRecords] = useState(false); // For expandable course table
  const [departmentSchedule, setDepartmentSchedule] = useState<ScheduleOffering[]>([]); // Master Schedule

  // --- Bölüm profili ve yönetmelik analizi ---
  // Bölüme özgü hiçbir veri koda gömülü değil; hepsi seçilen profilden gelir.
  const [departmentCode, setDepartmentCode] = useState<string | null>(null);
  const [profile, setProfile] = useState<DepartmentProfile | null>(null);
  const [academicAnalysis, setAcademicAnalysis] = useState<AcademicAnalysis | null>(null);
  const [proposal, setProposal] = useState<ProposalResult | null>(null);
  const [proposalTerm, setProposalTerm] = useState<TermType>('guz');
  const [doubleMajor, setDoubleMajor] = useState(false);

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

  const removeSimulationRecord = (id: string) => {
    setSimulationRecords(prev => prev.filter(r => r.id !== id));
  };

  // Simülasyon UI State
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Derived Simulation State
  // Calculate when we have simulation records (Step 2 onwards where simulation UI is shown)
  const simGpaResult = simulationRecords.length > 0 ? calculateGPA(simulationRecords) : null;

  const [selectedArea, setSelectedArea] = useState('');

  // Custom Course Mode State
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
  const [showIntibak, setShowIntibak] = useState(false);


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

  // Modül düzeyindeki yardımcılar da seçili profilden okusun.
  useEffect(() => { setActiveProfile(profile); }, [profile]);

  // Bölüm veya intibak tercihi değişince analizi yeniden üret: intibak
  // eşlemeleri ve ders planı profile bağlı olduğu için sonuç değişir.
  useEffect(() => {
    if (!transcriptText) return;
    const result = analyzeTranscript(transcriptText, profile, { applyIntibak: showIntibak });
    setAcademicAnalysis(result);
    setRecords(result.active);
  }, [profile, showIntibak, transcriptText]);

  // Ders önerisi — Madde 19/5, 19/6 ve 10/2.
  useEffect(() => {
    if (!academicAnalysis || !profile) { setProposal(null); return; }
    setProposal(buildProposal({
      analysis: academicAnalysis,
      profile,
      offerings: departmentSchedule,
      term: proposalTerm,
      doubleMajor
    }));
  }, [academicAnalysis, profile, departmentSchedule, proposalTerm, doubleMajor]);


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
      // PDF'te kolon yapısı korunarak okunur (bkz. buildLinesFromPdfItems).
      const text = await readTranscriptFile(file);
      setTranscriptText(text);

      // Tüm kural bilgisi engine/analyze içinde; burada yalnızca sonuç tüketilir.
      const result = analyzeTranscript(text, profile, { applyIntibak: showIntibak });
      setAcademicAnalysis(result);

      if (result.active.length === 0) {
        // Artık sessiz başarısızlık yok: neden aşağıdaki uyarı panelinde
        // satır satır görünür.
        const errors = result.diagnostics.filter(d => d.level === 'error');
        alert(
          'Transkriptten ders okunamadı.\n\n' +
          (errors.map(e => '• ' + e.message).join('\n') ||
            'Ayrıntı için sayfadaki uyarı bölümüne bakın.')
        );
        return;
      }

      setRecords(result.active);
      setSimulationRecords([]); // Clear old simulation data when new file is loaded
      setStep(2);
    } catch (error) {
      console.error('Dosya yükleme hatası:', error);
      alert('Dosya okunamadı. Lütfen geçerli bir PDF veya TXT dosyası yükleyin.\n\nHata: ' + (error as Error).message);
    }
  };




  // Geçilen dersler kümesi
  const completedCourses = new Set(records.filter(r => r.grade.passed).map(r => r.courseCode));
  // Bitirme projesi uygunluğu (Madde 8/4) — ders kodları bölüm profilinden
  const eem413Check = gpa ? checkGraduationProjectEligibility(records, gpa) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-xl md:text-3xl font-bold text-indigo-900 leading-tight text-center md:text-left">
              <span className="md:hidden">{t('header_title_mobile')}</span>
              <span className="hidden md:block">{t('header_title_desktop')}</span>
            </h1>
            <p className="mt-2 text-gray-600 font-medium">
              {profile ? profile.name : t('header_no_department')}
            </p>
          </div>

          <button
            onClick={() => setLanguage(l => l === 'tr' ? 'en' : 'tr')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition-colors"
          >
            <Globe className="w-4 h-4" />
            <span>{language === 'tr' ? 'EN' : 'TR'}</span>
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8 overflow-x-auto">
          {[
            { num: 1, label: t('step_transcript'), icon: Upload },
            { num: 2, label: t('step_gpa'), icon: Calculator },
            { num: 3, label: t('step_specialization'), icon: Award },
            { num: 4, label: t('step_schedule'), icon: Calendar },
            { num: 5, label: t('step_report'), icon: Download }
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
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('upload_title')}</h2>

            {/* Bölüm profili — ders planı, intibak ve uzmanlaşma verisi buradan gelir. */}
            <DepartmentSelector
              value={departmentCode}
              onChange={(code, loaded) => { setDepartmentCode(code); setProfile(loaded); }}
            />

            {academicAnalysis && (
              <TranscriptDiagnostics
                diagnostics={academicAnalysis.diagnostics}
                superseded={academicAnalysis.superseded}
              />
            )}

            <div className="mb-4 flex items-center">
              <input
                type="checkbox"
                id="intibak"
                checked={showIntibak}
                onChange={(e) => setShowIntibak(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded"
              />
              <label htmlFor="intibak" className="ml-2 text-sm text-gray-700">
                {t('upload_intibak_checkbox')}
              </label>
            </div>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <span className="mt-2 block text-sm font-medium text-gray-900">
                {t('upload_box_text')}
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
                {t('upload_button')}
              </label>

            </div>

            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start">
                <Info className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-2">{t('upload_info_title')}</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>{t('upload_info_1')}</li>
                    <li>{t('upload_info_2')}</li>
                    <li>{t('upload_info_3')}</li>
                    <li>{t('upload_info_4')}</li>
                    <li>{t('upload_info_5')}</li>
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
              <p className="text-gray-600">{t('calculating')}</p>
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
                  <h2 className="text-2xl font-bold text-gray-800">{t('gpa_title')}</h2>
                  <p className="text-gray-500">{t('gpa_subtitle')}</p>
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
                <span>{t('download_report')}</span>
              </button>
            </div>

            {/* Madde 19/6 — akademik yetersizlik aşaması ve tekrar yükümlülüğü */}
            {academicAnalysis && (
              <div className="mb-6 space-y-6">
                <AcademicStandingPanel
                  standing={academicAnalysis.standing}
                  retakes={academicAnalysis.retakes}
                  history={academicAnalysis.history}
                />
                <CourseProposalPanel
                  result={proposal}
                  term={proposalTerm}
                  onTermChange={setProposalTerm}
                  doubleMajor={doubleMajor}
                  onDoubleMajorChange={setDoubleMajor}
                  disabledReason={!profile ? 'Ders önerisi için önce bölüm seçin.' : undefined}
                />

                {/* Hedef GNO → hangi dersi tekrar, hangi notla (Madde 19/3) */}
                <GpaTargetPlanner
                  records={academicAnalysis.active}
                  newCourseOptions={
                    profile
                      ? profile.courses.filter(c =>
                          !academicAnalysis.active.some(r => r.courseCode.toUpperCase() === c.code.toUpperCase()))
                      : []
                  }
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className={`p-6 rounded-2xl shadow-lg transform hover:scale-[1.02] transition-all duration-300 ${gpa.gno >= 3.0 ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white' : gpa.gno >= 2.0 ? 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white' : 'bg-gradient-to-br from-orange-500 to-red-500 text-white'}`}>
                <div className="text-white/80 text-sm font-medium mb-1">{t('gno_label')}</div>
                <div className="text-5xl font-bold tracking-tight">{gpa.gno.toFixed(2)}</div>
                <div className="mt-4 flex items-center gap-2 text-white/90 bg-white/10 p-2 rounded-lg backdrop-blur-sm">
                  {gpa.gno >= 2.0 ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  <span className="font-medium">{gpa.gno >= 2.0 ? t('status_success') : t('status_fail')}</span>
                </div>
              </div>

              <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="text-gray-500 text-sm font-medium mb-1">{t('total_ects')}</div>
                <div className="text-4xl font-bold text-gray-800 tracking-tight">{gpa.totalECTS}</div>
                <div className="mt-4 w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-2 rounded-full transition-all duration-1000"
                    style={{ width: `${Math.min((gpa.totalECTS / 240) * 100, 100)}%` }}
                  ></div>
                </div>
                <div className="mt-2 text-xs text-gray-400 font-medium">{t('graduation_goal')}</div>
              </div>

              <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="text-gray-500 text-sm font-medium mb-1">{t('passed_credits')}</div>
                <div className="text-4xl font-bold text-gray-800 tracking-tight flex items-baseline gap-2">
                  {gpa.passedCredits}
                  <span className="text-xl text-gray-400 font-normal">/{gpa.totalAttempted}</span>
                </div>
                <div className="mt-4 text-sm font-medium text-blue-600 bg-blue-50 py-1 px-3 rounded-full w-fit">
                  %{gpa.totalAttempted > 0 ? Math.min(100, Math.round((gpa.passedCredits / gpa.totalAttempted) * 100)) : 0} {t('success_rate_suffix')}
                </div>
              </div>
            </div>


            {/* Removed Hesaplama Detayları table - simplified UX */}

            {eem413Check && (
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('eem413_title')}</h2>
                {eem413Check.eligible ? (
                  <div className="flex items-center p-4 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle className="h-6 w-6 text-green-600 mr-3" />
                    <div>
                      <p className="font-medium text-green-900">{t('eem413_success_msg')}</p>
                      <p className="text-sm text-green-700 mt-1">
                        {t('eem413_success_detail')}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-start">
                      <AlertCircle className="h-6 w-6 text-red-600 mr-3 mt-0.5" />
                      <div>
                        <p className="font-medium text-red-900 mb-2">{t('eem413_fail_msg')}</p>
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
              <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('course_list_title')} ({records.length})</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('col_code')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('col_name')}</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t('col_term')}</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('col_grade')}</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t('col_ects')}</th>
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
                      <>📤 {t('show_less')}</>
                    ) : (
                      <>📥 {t('show_more')} ({records.length - 15} {t('show_more_suffix')}</>
                    )}
                  </button>
                </div>
              )}
            </div>
            {/* Simulation Section Merged into Step 2 */}
            <div id="simulation-section" className="mt-12 pt-8 border-t border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">{t('sim_title')}</h2>
                    <p className="text-gray-500">{t('sim_desc')}</p>
                  </div>
                </div>
              </div>

              {/* Simulation Dashboard (Copied from old Step 3) */}
              {simGpaResult && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-200">
                      <div className="text-sm text-gray-500 mb-1">{t('current_gno')}</div>
                      <div className="text-3xl font-bold text-gray-400">{(gpa?.gno || 0).toFixed(2)}</div>
                    </div>
                    <div className={`p-6 rounded-2xl shadow-lg transform transition-all ${simGpaResult.gno >= (gpa?.gno || 0) ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white' : 'bg-gradient-to-br from-orange-500 to-red-500 text-white'}`}>
                      <div className="text-white/80 text-sm font-medium mb-1">{t('sim_gno')}</div>
                      <div className="flex items-end gap-3">
                        <div className="text-5xl font-bold tracking-tight">{simGpaResult.gno.toFixed(2)}</div>
                        <div className={`text-lg font-medium px-2 py-1 rounded-lg ${simGpaResult.gno >= (gpa?.gno || 0) ? 'bg-white/20 text-white' : 'bg-black/20 text-white'}`}>
                          {simGpaResult.gno >= (gpa?.gno || 0) ? '+' : ''}{(simGpaResult.gno - (gpa?.gno || 0)).toFixed(2)}
                        </div>
                      </div>
                    </div>
                    {(() => {
                      const simCheck = checkGraduationProjectEligibility(simulationRecords, simGpaResult);
                      return (
                        <div className={`p-6 rounded-2xl shadow-sm border ${simCheck.eligible ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                          <div className={`text-sm font-medium mb-1 ${simCheck.eligible ? 'text-green-600' : 'text-red-600'}`}>{t('graduation_cap_title')}</div>
                          <div className={`text-xl font-bold ${simCheck.eligible ? 'text-green-800' : 'text-red-800'}`}>
                            {simCheck.eligible ? t('can_take') : t('cannot_take')}
                          </div>
                        </div>
                      );
                    })()}
                    {/* AKTS Status Card */}
                    <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-200">
                      <div className="text-sm text-gray-500 mb-1">{t('ects_grad')}</div>
                      <div className="flex flex-col">
                        <div className="text-2xl font-bold text-gray-800">
                          {simGpaResult.totalECTS.toFixed(1)}
                          <span className="text-sm text-gray-400 font-normal ml-1">/ 240</span>
                        </div>
                        <div className={`text-xs mt-1 font-medium ${simGpaResult.totalECTS >= 240 ? 'text-green-600' : 'text-orange-600'}`}>
                          {simGpaResult.totalECTS >= 240
                            ? t('credits_completed')
                            : `${t('credits_remaining')} ${(240 - simGpaResult.totalECTS).toFixed(1)} ${t('credits_remaining_suffix')}`}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Senaryoya ders ekleme.
                  Eskiden iki sekme vardı: "listeden seç" ve "manuel gir".
                  Ayrı olmaları gereksizdi — kod alanı zaten katalogda arama
                  yapıyor; katalogdan seçilen ders diğer alanları dolduruyor,
                  katalogda olmayan ders için aynı alanlar elle dolduruluyor. */}
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 mt-6">
                <h3 className="font-bold text-lg text-gray-800 mb-1">{t('add_course_title')}</h3>
                <p className="text-sm text-gray-500 mb-5">
                  Ders kodunu yazmaya başlayın; ders planındakiler listelenir ve seçtiğinizde
                  bilgiler otomatik dolar. Ders planında olmayan bir ders için alanları
                  kendiniz doldurabilirsiniz.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  {/* Kod alanı aynı zamanda katalog aramasıdır */}
                  <div className="md:col-span-4 relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('col_code')}</label>

                    {isSearchOpen && (
                      <div className="fixed inset-0 z-10 cursor-default" onClick={() => setIsSearchOpen(false)} />
                    )}

                    <div className="relative z-20">
                      <input
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 uppercase"
                        value={customCourse.code}
                        onChange={e => {
                          setCustomCourse(prev => ({ ...prev, code: e.target.value }));
                          setIsSearchOpen(true);
                        }}
                        onFocus={() => setIsSearchOpen(true)}
                        placeholder="EEM403 veya ders adı…"
                      />

                      {isSearchOpen && (
                        <ul className="absolute w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto divide-y divide-gray-100">
                          {(() => {
                            // Senaryoda zaten olan dersler (intibak karşılıkları dâhil) listelenmez.
                            const taken = new Set<string>();
                            simulationRecords.forEach(r => {
                              taken.add(r.courseCode);
                              const m = getActiveIntibak().find(x => x.oldCode === r.courseCode);
                              if (m) taken.add(m.newCode);
                            });

                            const q = customCourse.code.toLowerCase().trim();
                            const matches = getActiveCourses()
                              .filter(c => !taken.has(c.code))
                              .filter(c =>
                                !q ||
                                c.code.toLowerCase().includes(q) ||
                                c.name.toLowerCase().includes(q))
                              .sort((a, b) => a.code.localeCompare(b.code, 'tr'))
                              .slice(0, 60);

                            if (matches.length === 0) {
                              return (
                                <li className="px-4 py-3 text-sm text-gray-500">
                                  Ders planında eşleşme yok — alanları elle doldurup ekleyebilirsiniz.
                                </li>
                              );
                            }

                            return matches.map(c => (
                              <li
                                key={c.code}
                                onClick={() => {
                                  setCustomCourse(prev => ({
                                    ...prev,
                                    code: c.code,
                                    name: c.name,
                                    credits: c.credits,
                                    ects: c.ects,
                                    type: c.type
                                  }));
                                  setIsSearchOpen(false);
                                }}
                                className="px-4 py-2.5 hover:bg-indigo-50 cursor-pointer transition-colors"
                              >
                                <div className="font-semibold text-gray-800">{c.code}</div>
                                <div className="text-sm text-gray-600 truncate">{c.name}</div>
                                <div className="text-xs text-gray-400 mt-0.5">
                                  {c.ects} AKTS{c.semester ? ` · ${c.semester}. yarıyıl` : ''}
                                </div>
                              </li>
                            ));
                          })()}
                        </ul>
                      )}
                    </div>
                  </div>

                  <div className="md:col-span-8">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('col_name')}</label>
                    <input
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500"
                      value={customCourse.name}
                      onChange={e => setCustomCourse(prev => ({ ...prev, name: e.target.value }))}
                      placeholder={t('placeholder_name')}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('input_credit')}</label>
                    <input
                      type="number"
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500"
                      value={customCourse.credits}
                      onChange={e => setCustomCourse(prev => ({ ...prev, credits: Number(e.target.value) }))}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('input_ects')}</label>
                    <input
                      type="number"
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500"
                      value={customCourse.ects}
                      onChange={e => setCustomCourse(prev => ({ ...prev, ects: Number(e.target.value) }))}
                    />
                  </div>

                  <div className="md:col-span-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('input_type')}</label>
                    <select
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500"
                      value={customCourse.type}
                      onChange={e => setCustomCourse(prev => ({ ...prev, type: e.target.value }))}
                    >
                      <option value="secmeli">{t('type_elective')}</option>
                      <option value="mesleki_secmeli">{t('type_technical')}</option>
                      <option value="zorunlu">{t('type_mandatory')}</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('col_grade')}</label>
                    <select
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500"
                      value={customCourse.grade}
                      onChange={e => setCustomCourse(prev => ({ ...prev, grade: e.target.value }))}
                    >
                      {['AA', 'AB', 'BA', 'BB', 'BC', 'CB', 'CC', 'CD', 'DC', 'DD', 'FF', 'YT'].map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2 flex justify-end">
                    <button
                      onClick={addCustomSimulationCourse}
                      disabled={!customCourse.code.trim() || !customCourse.name.trim()}
                      className="w-full px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium"
                    >
                      Ekle
                    </button>
                  </div>
                </div>
              </div>


              {/* Ders Listesi */}
              <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden mt-6">
                <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                  <h3 className="font-bold text-gray-800">{t('sim_table_title')}</h3>
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
                  {t('btn_back')}
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  {t('btn_next_specialization')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Specialization Analysis */}
        {(step as any) === 3 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header / Summary */}
            <div className="bg-white rounded-xl shadow-lg p-8 border border-indigo-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Award className="text-indigo-600" />
                {t('spec_title')} <span className="text-sm font-normal text-gray-500 ml-2">{t('spec_subtitle').replace('{season}', analyzeSpecializations(records).activeSeason)}</span>
              </h2>

              {(() => {
                const analysis = analyzeSpecializations(records);
                const isTotalMet = analysis.totalTechnicalElectives >= 7;

                return (
                  <div>
                    <div className="flex flex-col md:flex-row gap-6 mb-8">
                      <div className={`flex-1 p-4 rounded-xl border-l-4 ${isTotalMet ? 'bg-green-50 border-green-500' : 'bg-amber-50 border-amber-500'} shadow-sm`}>
                        <h3 className="font-bold text-gray-800 mb-1">{t('total_tech_electives')}</h3>
                        <div className="flex items-end gap-2">
                          <span className="text-3xl font-bold">{analysis.totalTechnicalElectives}</span>
                          <span className="text-gray-500 mb-1">{t('min_7_courses')}</span>
                        </div>
                        <p className={`text-sm mt-2 ${isTotalMet ? 'text-green-700' : 'text-amber-700'}`}>
                          {isTotalMet ? t('total_courses_met_msg') : t('min_7_courses_warning')}
                        </p>
                      </div>

                      <div className="flex-1 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-xl shadow-sm">
                        <h3 className="font-bold text-gray-800 mb-1">{t('best_group_title')}</h3>
                        <div className="text-xl font-bold text-blue-900">
                          {analysis.bestGroup
                            ? SPECIALIZATION_GROUPS.find(g => g.id === analysis.bestGroup)?.name
                            : t('no_selection_yet')}
                        </div>
                        <p className="text-sm text-blue-700 mt-2">
                          {t('best_group_desc')}
                        </p>
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-gray-800 mb-4">{t('group_progress_title')}</h3>
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
                              {t('completed')}
                            </div>
                          )}

                          <div className="p-5 border-b border-gray-100 bg-gray-50/50">
                            <h4 className="font-bold text-lg text-gray-900 pr-8">{groupResult.group.name}</h4>
                            <div className="flex items-center gap-4 mt-2">
                              <div className="flex items-center text-sm font-medium">
                                <span className={`w-2 h-2 rounded-full mr-2 ${groupResult.takenCount >= 5 ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                                {t('progress_label')} {groupResult.takenCount}/5
                              </div>
                              <div className="flex items-center text-sm font-medium">
                                <span className={`w-2 h-2 rounded-full mr-2 ${groupResult.mandatoryMissing.length === 0 ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                {t('mandatory_label')} {groupResult.mandatoryMissing.length === 0 ? t('status_ok') : `${groupResult.mandatoryMissing.length} ${t('status_missing')}`}
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
                                    <th className="text-left py-2 px-3 font-medium">{t('col_code')}</th>
                                    <th className="text-left py-2 px-3 font-medium">{t('col_name')}</th>
                                    <th className="text-center py-2 px-3 font-medium">{t('col_status')}</th>
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
                                            <CheckCircle size={12} className="mr-1" /> {t('status_taken')}
                                          </span>
                                        )}
                                        {statusItem.status === 'available' && (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                            {t('status_available')}
                                          </span>
                                        )}
                                        {statusItem.status === 'locked' && (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500" title={`Önşart: ${statusItem.missingPrereq}`}>
                                            🔒 {statusItem.missingPrereq}
                                          </span>
                                        )}
                                        {statusItem.status === 'wrong_term' && (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-400 border border-gray-100 italic">
                                            ⏳ {statusItem.course.term} {t('status_term_suffix')}
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
        {(step as any) === 4 && (
          <div className="space-y-6">
            {/* Ders programının tek sahibi burasıdır.
                Daha önce bunun altında ikinci bir "manuel giriş / PDF yükle"
                paneli daha vardı; iki ayrı program arayüzü olması hem kafa
                karıştırıyor hem de ders önerisinin hangi programı gördüğünü
                belirsizleştiriyordu. Kaldırıldı. */}
            <ScheduleBuilder
              knownCourseCodes={profile?.courses.map(c => c.code) ?? []}
              proposal={proposal?.proposal ?? []}
              retakes={academicAnalysis?.retakes ?? []}
              ectsLimit={proposal?.ectsLimit}
              term={proposalTerm}
              onTermChange={setProposalTerm}
              onOfferingsChange={setDepartmentSchedule}
            />

            <div className="flex justify-between items-center">
              <button
                onClick={() => setStep(3)} // Back to Specialization Step 3
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                {t('btn_back')}
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(5)} // Skip schedule simulation
                  className="px-6 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
                >
                  {t('btn_skip')}
                </button>
                <button
                  onClick={() => setStep(5)} // Forward to Report
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  {t('download_report')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Report */}
        {
          (step as any) === 5 && gpa && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('report_title')}</h2>
                <div className="space-y-4 mb-6">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-semibold mb-2">{t('grade_status_title')}</h3>
                    <p>{t('gno_caps') || 'GNO'}: <strong>{gpa.gno.toFixed(2)}</strong> | {t('ects_caps') || 'AKTS'}: <strong>{gpa.totalECTS}/240</strong></p>
                  </div>
                  {selectedArea && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h3 className="font-semibold mb-2">{t('best_spec_title')}</h3>
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
                                  {t('progress_label')} {groupResult?.takenCount}/5 {t('courses_lower') || 'ders'}
                                </p>
                              </>
                            )
                          }
                          return <span>{t('no_data_yet')}</span>
                        })()}
                      </p>
                    </div>
                  )}
                  {eem413Check && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h3 className="font-semibold mb-2">{t('eem413_title')}</h3>
                      <p className={eem413Check.eligible ? 'text-green-600' : 'text-red-600'}>
                        {eem413Check.eligible ? t('can_take_short') : t('cannot_take_short')}
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
                    <span className="font-bold text-lg">{t('download_pdf_report')}</span>
                  </button>
                  <p className="text-center text-sm text-gray-500 mt-4">
                    {t('report_footer_info')}
                  </p>
                </div>
              </div>
              <div className="flex justify-between">
                <button
                  onClick={() => setStep(4)} // Back to Schedule Planning
                  className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  {t('btn_back')}
                </button>
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50"
                >
                  {t('btn_new_analysis')}
                </button>
              </div>
            </div>
          )
        }
      </div>

      <footer className="bg-white border-t mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-gray-600 text-sm font-medium">
            <span className="md:hidden">{t('header_title_mobile')}</span>
            <span className="hidden md:block">{t('header_title_desktop')}</span>
          </p>

          <div className="flex flex-col items-center gap-3 mt-4">
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100 shadow-sm">
              <ShieldCheck size={16} />
              <span className="font-medium">{t('footer_security')}</span>
            </div>

            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>{t('footer_developer')}</span>
              <span className="text-gray-300">|</span>
              <a href="https://github.com/" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-indigo-500 hover:text-indigo-700 transition-colors font-medium">
                <Github size={14} />
                <span>{t('footer_opensource')}</span>
              </a>
            </div>
          </div>
        </div>
      </footer>
      <VisitorCounter />
    </div>
  );
}