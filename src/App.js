import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { Upload, Calendar, CheckCircle, AlertCircle, Trash2, Github, Download, BarChart3, CheckCircle2, Calculator, Info, Award, ShieldCheck } from 'lucide-react';
import { VisitorCounter } from './components/VisitorCounter';
import { detectScheduleConflicts } from './utils/scheduleUtils';
import { generateAcademicReport } from './utils/reportGenerator';
import { parseTranscriptText, readTranscriptFile } from './utils/transcriptParser';
import { calculateGPA } from './utils/gpaCalculator';
// ============================================================================
// COMPREHENSIVE DATA
// ============================================================================
// Harf notu katsayı sistemi. Başarı durumuna göre true/false belirtiyoruz.
const GRADE_SYSTEM = {
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
const ALL_COURSES = [
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
const INTIBAK_MAPPINGS = [
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
const SAMPLE_SCHEDULES = [
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
/**
 * İntibak (kod değişikliği) uygulanmış kayıtları döndürür. Eğer kayıt eski bir koda
 * sahipse, yeni kod ve açıklama eklenir.
 */
function applyIntibak(records) {
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
/**
 * Bir ders için önkoşullar sağlanmış mı kontrol eder. Önkoşullar listesi ALL_COURSES
 * içindeki course.prerequisites alanından alınır.
 */
function checkPrerequisites(courseCode, completedCourses) {
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
function checkEEM413Eligibility(records, gpa) {
    const reasons = [];
    if (gpa.gno < 2.0) {
        reasons.push(`GNO yetersiz: ${gpa.gno.toFixed(2)} < 2.00`);
    }
    // KURAL: İlk 4 yarıyılın tüm zorunlu dersleri tamamlanmış olmalı VEYA 180 AKTS tamamlanmış olmalı.
    const firstFourSemesterCourses = ALL_COURSES
        .filter(c => c.semester && c.semester <= 4 && c.type === 'zorunlu')
        .map(c => c.code);
    // 2. Geçilen dersleri bul (Code normalization: trim + uppercase + INTIBAK)
    const completedSet = new Set();
    const mappedDebug = []; // Debug için hangi derslerin çevrildiğini tutalım
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
    const [records, setRecords] = useState([]);
    const [simulationRecords, setSimulationRecords] = useState([]); // Senaryo modu kayıtları
    const [gpa, setGPA] = useState(null);
    const [activeTab, setActiveTab] = useState('upload');
    const [showAllRecords, setShowAllRecords] = useState(false); // For expandable course table
    const [departmentSchedule, setDepartmentSchedule] = useState([]); // Master Schedule
    // Manuel ders ekleme state'leri
    const [showManualEntryForm, setShowManualEntryForm] = useState(false);
    const [manualEntry, setManualEntry] = useState({
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
        const newOffering = {
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
    const handleDeleteScheduleItem = (index) => {
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
    const updateSimulationGrade = (id, newLetter) => {
        // GRADE_SYSTEM import edildiğini varsayıyoruz. Edilmemişse import eklenmeli.
        // Ancak App.tsx içinde başka yerlerde kullanıldığı için muhtemelen vardır.
        // Eğer yoksa basit bir lookup yapalım:
        const system = GRADE_SYSTEM;
        const newGradeInfo = system[newLetter];
        if (!newGradeInfo)
            return;
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
    const addSimulationCourse = (courseCode, letter) => {
        const course = ALL_COURSES.find(c => c.code === courseCode);
        if (!course)
            return;
        const gradeInfo = GRADE_SYSTEM[letter];
        const newRecord = {
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
    const removeSimulationRecord = (id) => {
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
        if (!customCourse.code || !customCourse.name)
            return;
        const gradeInfo = GRADE_SYSTEM[customCourse.grade];
        if (!gradeInfo)
            return;
        const newRecord = {
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
    const [selectedSchedule, setSelectedSchedule] = useState([]);
    const [showIntibak, setShowIntibak] = useState(false);
    const [proposedSchedule, setProposedSchedule] = useState([]);
    const [proposalLogs, setProposalLogs] = useState([]);
    const [activeScheduleTab, setActiveScheduleTab] = useState('manual');
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
        const coursesToAdd = [];
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
            }
            else {
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
    const isTimeInSlot = (slot, startTime, endTime) => {
        const [slotStart] = slot.split(' - ');
        const slotHour = parseInt(slotStart.split(':')[0]);
        const startHour = parseInt(startTime.split(':')[0]);
        const endHour = parseInt(endTime.split(':')[0]);
        return slotHour >= startHour && slotHour < endHour;
    };
    const handleSchedulePdfUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        // Clear old data first
        setDepartmentSchedule([]);
        setSelectedSchedule([]);
        localStorage.removeItem('estu-department-schedule');
        try {
            const pdfjs = await import('pdfjs-dist');
            pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
            // Collect ALL items with coordinates from ALL pages
            const allItems = [];
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const items = textContent.items;
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
                const dayStats = {};
                parsed.forEach(p => { dayStats[p.day] = (dayStats[p.day] || 0) + 1; });
                const dayInfo = Object.entries(dayStats).map(([d, c]) => `${d}: ${c}`).join(', ');
                alert(`✅ ${parsed.length} ders/şube başarıyla okundu!\n\nGün dağılımı:\n${dayInfo}`);
            }
            else {
                alert('⚠️ Ders formatı algılanamadı. Konsolu (F12) kontrol edin.');
            }
        }
        catch (error) {
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
            }
            catch (e) {
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
    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        // Reset previous state immediately
        setRecords([]);
        setGPA(null);
        setTranscriptText('');
        setStep(1); // Stay on step 1 until success
        // Input değerini sıfırla ki aynı dosyayı tekrar seçebilelim
        e.target.value = '';
        console.log('Dosya yüklendi:', file.name, 'Type:', file.type, 'Size:', file.size);
        try {
            console.log('Dosya okunuyor...');
            const text = await readTranscriptFile(file);
            setTranscriptText(text);
            console.log('Metin parse ediliyor...');
            // Use imported parser
            let parsed = parseTranscriptText(text);
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
        }
        catch (error) {
            console.error('Dosya yükleme hatası:', error);
            alert('Dosya okunamadı. Lütfen geçerli bir PDF veya TXT dosyası yükleyin.\n\nHata: ' + error.message);
        }
    };
    // Geçilen dersler kümesi
    const completedCourses = new Set(records.filter(r => r.grade.passed).map(r => r.courseCode));
    // EEM413/414 kontrolü
    const eem413Check = gpa ? checkEEM413Eligibility(records, gpa) : null;
    return (_jsxs("div", { className: "min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100", children: [_jsx("header", { className: "bg-white shadow-md", children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6", children: [_jsxs("h1", { className: "text-xl md:text-3xl font-bold text-indigo-900 leading-tight text-center md:text-left", children: [_jsx("span", { className: "md:hidden", children: "EST\u00DC EEM Akademik Planlama Sistemi" }), _jsx("span", { className: "hidden md:block", children: "EST\u00DC Elektrik Elektronik M\u00FChendisli\u011Fi Akademik Planlama Sistemi" })] }), _jsx("p", { className: "mt-2 text-gray-600 font-medium", children: "Ahmet Furkan G\u00FCven taraf\u0131ndan geli\u015Ftirilmi\u015Ftir." })] }) }), _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8", children: [_jsx("div", { className: "flex items-center justify-between mb-8 overflow-x-auto", children: [
                            { num: 1, label: 'Transkript', icon: Upload },
                            { num: 2, label: 'GPA & Senaryo', icon: Calculator },
                            { num: 3, label: 'Uzmanlaşma', icon: Award },
                            { num: 4, label: 'Ders Programı', icon: Calendar },
                            { num: 5, label: 'Rapor', icon: Download }
                        ].map(({ num, label, icon: Icon }) => (_jsxs("div", { className: "flex items-center", children: [_jsx("button", { onClick: () => records.length > 0 && setStep(num), className: `flex items-center justify-center w-12 h-12 rounded-full ${step >= num ? 'bg-indigo-600 text-white' : 'bg-gray-300 text-gray-600'} transition-colors`, children: step > num ? _jsx(CheckCircle, { size: 24 }) : _jsx(Icon, { size: 20 }) }), _jsx("span", { className: `ml-2 text-sm font-medium ${step >= num ? 'text-indigo-900' : 'text-gray-500'}`, children: label }), num < 5 && _jsx("div", { className: `w-12 h-1 mx-2 ${step > num ? 'bg-indigo-600' : 'bg-gray-300'}` })] }, num))) }), step === 1 && (_jsxs("div", { className: "bg-white rounded-xl shadow-lg p-8", children: [_jsx("h2", { className: "text-2xl font-bold text-gray-900 mb-6", children: "\uD83D\uDCC4 Transkript Y\u00FCkleme + \u0130ntibak" }), _jsxs("div", { className: "mb-4 flex items-center", children: [_jsx("input", { type: "checkbox", id: "intibak", checked: showIntibak, onChange: (e) => setShowIntibak(e.target.checked), className: "w-4 h-4 text-indigo-600 rounded" }), _jsx("label", { htmlFor: "intibak", className: "ml-2 text-sm text-gray-700", children: "Otomatik intibak uygula (EMAT111\u2192MAT1011, EK\u0130M105\u2192K\u0130M1005, vb.)" })] }), _jsxs("div", { className: "border-2 border-dashed border-gray-300 rounded-lg p-12 text-center", children: [_jsx(Upload, { className: "mx-auto h-12 w-12 text-gray-400 mb-4" }), _jsx("span", { className: "mt-2 block text-sm font-medium text-gray-900", children: "TXT veya PDF transkript y\u00FCkleyin" }), _jsx("input", { id: "transcriptFile", type: "file", accept: ".txt,.pdf", onChange: handleFileUpload, className: "hidden" }), _jsx("label", { htmlFor: "transcriptFile", className: "mt-4 inline-flex items-center justify-center px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer select-none", children: "Dosya Se\u00E7" })] }), _jsx("div", { className: "mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4", children: _jsxs("div", { className: "flex items-start", children: [_jsx(Info, { className: "h-5 w-5 text-blue-600 mt-0.5 mr-3" }), _jsxs("div", { className: "text-sm text-blue-800", children: [_jsx("p", { className: "font-medium mb-2", children: "\u2705 Yenilikler v2.0:" }), _jsxs("ul", { className: "list-disc list-inside space-y-1", children: [_jsx("li", { children: "PDF Parser (pdf.js entegrasyonu)" }), _jsx("li", { children: "\u0130ntibak motoru (eski\u2192yeni ders kodlar\u0131)" }), _jsx("li", { children: "6 uzmanla\u015Fma alan\u0131 + zorunlu ders kontrol\u00FC" }), _jsx("li", { children: "Ders program\u0131 parser + \u00E7ak\u0131\u015Fma analizi" }), _jsx("li", { children: "EEM413/414 g\u00FCncel kurallar (180 AKTS VEYA ilk 4 yar\u0131y\u0131l)" })] })] })] }) })] })), step === 2 && !gpa && records.length > 0 && (_jsx("div", { className: "flex items-center justify-center min-h-[400px]", children: _jsxs("div", { className: "text-center", children: [_jsx("div", { className: "animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4" }), _jsx("p", { className: "text-gray-600", children: "GNO hesaplan\u0131yor..." })] }) })), step === 2 && gpa && (_jsxs("div", { className: "space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500", children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "p-3 bg-gradient-to-br from-indigo-100 to-violet-100 rounded-xl shadow-sm", children: _jsx(BarChart3, { className: "w-8 h-8 text-indigo-600" }) }), _jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-bold text-gray-800", children: "GNO/DNO Analizi" }), _jsx("p", { className: "text-gray-500", children: "Akademik ba\u015Far\u0131 durumunuzun detayl\u0131 analizi" })] })] }), _jsxs("button", { onClick: () => {
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
                                        }, className: "flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm", children: [_jsx(Download, { size: 18 }), _jsx("span", { children: "Raporu \u0130ndir" })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-6", children: [_jsxs("div", { className: `p-6 rounded-2xl shadow-lg transform hover:scale-[1.02] transition-all duration-300 ${gpa.gno >= 3.0 ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white' : gpa.gno >= 2.0 ? 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white' : 'bg-gradient-to-br from-orange-500 to-red-500 text-white'}`, children: [_jsx("div", { className: "text-white/80 text-sm font-medium mb-1", children: "Genel Not Ortalamas\u0131" }), _jsx("div", { className: "text-5xl font-bold tracking-tight", children: gpa.gno.toFixed(2) }), _jsxs("div", { className: "mt-4 flex items-center gap-2 text-white/90 bg-white/10 p-2 rounded-lg backdrop-blur-sm", children: [gpa.gno >= 2.0 ? _jsx(CheckCircle2, { className: "w-5 h-5" }) : _jsx(AlertCircle, { className: "w-5 h-5" }), _jsx("span", { className: "font-medium", children: gpa.gno >= 2.0 ? 'Başarılı' : 'Akademik Yetersizlik' })] })] }), _jsxs("div", { className: "p-6 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow", children: [_jsx("div", { className: "text-gray-500 text-sm font-medium mb-1", children: "Toplam AKTS" }), _jsx("div", { className: "text-4xl font-bold text-gray-800 tracking-tight", children: gpa.totalECTS }), _jsx("div", { className: "mt-4 w-full bg-gray-100 rounded-full h-2 overflow-hidden", children: _jsx("div", { className: "bg-emerald-500 h-2 rounded-full transition-all duration-1000", style: { width: `${Math.min((gpa.totalECTS / 240) * 100, 100)}%` } }) }), _jsx("div", { className: "mt-2 text-xs text-gray-400 font-medium", children: "Mezuniyet: 240 AKTS" })] }), _jsxs("div", { className: "p-6 bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow", children: [_jsx("div", { className: "text-gray-500 text-sm font-medium mb-1", children: "Ge\u00E7ilen Kredi" }), _jsxs("div", { className: "text-4xl font-bold text-gray-800 tracking-tight flex items-baseline gap-2", children: [gpa.passedCredits, _jsxs("span", { className: "text-xl text-gray-400 font-normal", children: ["/", gpa.totalAttempted] })] }), _jsxs("div", { className: "mt-4 text-sm font-medium text-blue-600 bg-blue-50 py-1 px-3 rounded-full w-fit", children: ["%", gpa.totalAttempted > 0 ? Math.min(100, Math.round((gpa.passedCredits / gpa.totalAttempted) * 100)) : 0, " ba\u015Far\u0131"] })] })] }), eem413Check && (_jsxs("div", { className: "bg-white rounded-xl shadow-lg p-8", children: [_jsx("h2", { className: "text-2xl font-bold text-gray-900 mb-6", children: "\uD83C\uDF93 EEM413/414 Uygunluk Kontrol\u00FC" }), eem413Check.eligible ? (_jsxs("div", { className: "flex items-center p-4 bg-green-50 border border-green-200 rounded-lg", children: [_jsx(CheckCircle, { className: "h-6 w-6 text-green-600 mr-3" }), _jsxs("div", { children: [_jsx("p", { className: "font-medium text-green-900", children: "Design Project derslerini alabilirsiniz!" }), _jsx("p", { className: "text-sm text-green-700 mt-1", children: "\u2705 GNO \u2265 2.00 VE (\u0130lk 4 yar\u0131y\u0131l zorunlu dersleri VEYA 180+ AKTS)" })] })] })) : (_jsx("div", { className: "p-4 bg-red-50 border border-red-200 rounded-lg", children: _jsxs("div", { className: "flex items-start", children: [_jsx(AlertCircle, { className: "h-6 w-6 text-red-600 mr-3 mt-0.5" }), _jsxs("div", { children: [_jsx("p", { className: "font-medium text-red-900 mb-2", children: "Eksik ko\u015Fullar:" }), _jsx("ul", { className: "text-sm text-red-700 space-y-1", children: eem413Check.reasons.map((reason, i) => (_jsxs("li", { children: ["\u2022 ", reason] }, i))) })] })] }) }))] })), _jsxs("div", { className: "bg-white rounded-xl shadow-lg p-8", children: [_jsxs("h2", { className: "text-2xl font-bold text-gray-900 mb-6", children: ["\uD83D\uDCDA Ders Kay\u0131tlar\u0131 (", records.length, ")"] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full divide-y divide-gray-200", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Kod" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "Ders" }), _jsx("th", { className: "px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase", children: "D\u00F6nem" }), _jsx("th", { className: "px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase", children: "Not" }), _jsx("th", { className: "px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase", children: "AKTS" })] }) }), _jsx("tbody", { className: "bg-white divide-y divide-gray-200", children: (showAllRecords ? records : records.slice(0, 15)).map((record) => (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsx("td", { className: "px-4 py-3 text-sm font-medium text-gray-900", children: record.courseCode }), _jsx("td", { className: "px-4 py-3 text-sm text-gray-700", children: record.courseName }), _jsx("td", { className: "px-4 py-3 text-sm text-gray-600", children: record.semester }), _jsx("td", { className: "px-4 py-3 text-center", children: _jsx("span", { className: `inline-flex px-2 py-1 text-xs font-semibold rounded-full ${record.grade.passed
                                                                        ? 'bg-green-100 text-green-800'
                                                                        : 'bg-red-100 text-red-800'}`, children: record.grade.letter }) }), _jsx("td", { className: "px-4 py-3 text-sm text-center text-gray-700", children: record.ects })] }, record.id))) })] }) }), records.length > 15 && (_jsx("div", { className: "mt-4 text-center", children: _jsx("button", { onClick: () => setShowAllRecords(!showAllRecords), className: "px-6 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors", children: showAllRecords ? (_jsx(_Fragment, { children: "\uD83D\uDCE4 Daha Az G\u00F6ster (\u0130lk 15)" })) : (_jsxs(_Fragment, { children: ["\uD83D\uDCE5 T\u00FCm Dersleri G\u00F6ster (", records.length - 15, " ders daha)"] })) }) }))] }), _jsxs("div", { id: "simulation-section", className: "mt-12 pt-8 border-t border-gray-200", children: [_jsx("div", { className: "flex items-center justify-between mb-6", children: _jsxs("div", { children: [_jsx("h2", { className: "text-2xl font-bold text-gray-800", children: "\uD83E\uDDEA GNO Sim\u00FClasyonu & Senaryo" }), _jsx("p", { className: "text-gray-500", children: "Notlar\u0131n\u0131z\u0131 a\u015Fa\u011F\u0131dan de\u011Fi\u015Ftirerek veya yeni ders ekleyerek ortalaman\u0131z\u0131 tahmin edin." })] }) }), simGpaResult && (_jsx("div", { className: "space-y-6", children: _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-6", children: [_jsxs("div", { className: "p-6 bg-white rounded-2xl shadow-sm border border-gray-200", children: [_jsx("div", { className: "text-sm text-gray-500 mb-1", children: "Mevcut GNO" }), _jsx("div", { className: "text-3xl font-bold text-gray-400", children: (gpa?.gno || 0).toFixed(2) })] }), _jsxs("div", { className: `p-6 rounded-2xl shadow-lg transform transition-all ${simGpaResult.gno >= (gpa?.gno || 0) ? 'bg-gradient-to-br from-indigo-600 to-purple-600 text-white' : 'bg-gradient-to-br from-orange-500 to-red-500 text-white'}`, children: [_jsx("div", { className: "text-white/80 text-sm font-medium mb-1", children: "Sim\u00FClasyon GNO" }), _jsxs("div", { className: "flex items-end gap-3", children: [_jsx("div", { className: "text-5xl font-bold tracking-tight", children: simGpaResult.gno.toFixed(2) }), _jsxs("div", { className: `text-lg font-medium px-2 py-1 rounded-lg ${simGpaResult.gno >= (gpa?.gno || 0) ? 'bg-white/20 text-white' : 'bg-black/20 text-white'}`, children: [simGpaResult.gno >= (gpa?.gno || 0) ? '+' : '', (simGpaResult.gno - (gpa?.gno || 0)).toFixed(2)] })] })] }), (() => {
                                                    const simCheck = checkEEM413Eligibility(simulationRecords, simGpaResult);
                                                    return (_jsxs("div", { className: `p-6 rounded-2xl shadow-sm border ${simCheck.eligible ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`, children: [_jsx("div", { className: `text-sm font-medium mb-1 ${simCheck.eligible ? 'text-green-600' : 'text-red-600'}`, children: "Bitirme Projesi (Sim\u00FCle)" }), _jsx("div", { className: `text-xl font-bold ${simCheck.eligible ? 'text-green-800' : 'text-red-800'}`, children: simCheck.eligible ? '✅ Alabilirsin' : '❌ Alamazsın' })] }));
                                                })(), _jsxs("div", { className: "p-6 bg-white rounded-2xl shadow-sm border border-gray-200", children: [_jsx("div", { className: "text-sm text-gray-500 mb-1", children: "AKTS & Mezuniyet" }), _jsxs("div", { className: "flex flex-col", children: [_jsxs("div", { className: "text-2xl font-bold text-gray-800", children: [simGpaResult.totalECTS.toFixed(1), _jsx("span", { className: "text-sm text-gray-400 font-normal ml-1", children: "/ 240" })] }), _jsx("div", { className: `text-xs mt-1 font-medium ${simGpaResult.totalECTS >= 240 ? 'text-green-600' : 'text-orange-600'}`, children: simGpaResult.totalECTS >= 240
                                                                        ? '✅ Kredi Tamamlandı'
                                                                        : `⚠️ Mezuniyete ${(240 - simGpaResult.totalECTS).toFixed(1)} Kaldı` })] })] })] }) })), _jsxs("div", { className: "bg-white rounded-xl shadow-lg p-6 border border-gray-100 mt-6", children: [_jsx("h3", { className: "font-bold text-lg text-gray-800 mb-4", children: "\u2795 Senaryoya Ders Ekle" }), _jsxs("div", { className: "flex gap-6 border-b border-gray-200 mb-6", children: [_jsx("button", { className: `pb-2 px-1 font-medium text-sm transition-colors ${!isCustomMode ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`, onClick: () => setIsCustomMode(false), children: "\uD83D\uDD0D Listeden Se\u00E7" }), _jsx("button", { className: `pb-2 px-1 font-medium text-sm transition-colors ${isCustomMode ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`, onClick: () => setIsCustomMode(true), children: "\u270D\uFE0F \u00D6zel Ders Ekle" })] }), !isCustomMode ? (_jsxs("div", { className: "flex flex-col md:flex-row gap-4 items-end", children: [_jsxs("div", { className: "flex-1 w-full relative", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Ders Aray\u0131n (Kod veya \u0130sim)" }), isSearchOpen && (_jsx("div", { className: "fixed inset-0 z-10 cursor-default", onClick: () => setIsSearchOpen(false) })), _jsxs("div", { className: "relative z-20", children: [_jsx("input", { className: "w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500", value: simAddCourseCode, onChange: (e) => {
                                                                            setSimAddCourseCode(e.target.value);
                                                                            setIsSearchOpen(true);
                                                                        }, onFocus: () => setIsSearchOpen(true), placeholder: "\u00D6rn: EEM403 veya Yapay Zeka..." }), isSearchOpen && (_jsx("ul", { className: "absolute w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto divide-y divide-gray-100", children: (() => {
                                                                            // Alınmış veya senaryoda olan derslerin kodlarını (ve intibak karşılıklarını) bul
                                                                            const takenCodes = new Set();
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
                                                                                .filter(c => c.code.toLowerCase().includes(searchLower) ||
                                                                                c.name.toLowerCase().includes(searchLower))
                                                                                .sort((a, b) => a.code.localeCompare(b.code));
                                                                            if (filtered.length === 0) {
                                                                                return _jsx("li", { className: "px-4 py-3 text-gray-500 text-sm", children: "Sonu\u00E7 bulunamad\u0131." });
                                                                            }
                                                                            return filtered.map(c => (_jsxs("li", { onClick: () => {
                                                                                    setSimAddCourseCode(c.code);
                                                                                    setIsSearchOpen(false);
                                                                                }, className: "px-4 py-3 hover:bg-indigo-50 cursor-pointer transition-colors", children: [_jsx("div", { className: "font-bold text-gray-800", children: c.code }), _jsx("div", { className: "text-sm text-gray-600 truncate", children: c.name }), _jsxs("div", { className: "text-xs text-gray-400 mt-1", children: [c.credits, " Kredi | ", c.ects, " AKTS"] })] }, c.code)));
                                                                        })() }))] })] }), _jsxs("div", { className: "w-full md:w-32", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Hedef Not" }), _jsx("select", { className: "w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500", value: simAddGrade, onChange: (e) => setSimAddGrade(e.target.value), children: ['AA', 'AB', 'BA', 'BB', 'BC', 'CB', 'CC', 'CD', 'DC', 'DD', 'FF', 'YT'].map(g => (_jsx("option", { value: g, children: g }, g))) })] }), _jsx("button", { onClick: () => {
                                                            if (simAddCourseCode) {
                                                                addSimulationCourse(simAddCourseCode, simAddGrade);
                                                                setSimAddCourseCode(''); // Reset
                                                            }
                                                        }, disabled: !simAddCourseCode, className: "w-full md:w-auto px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium", children: "Ekle" })] })) : (_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-12 gap-4 items-end", children: [_jsxs("div", { className: "md:col-span-3", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Ders Kodu" }), _jsx("input", { className: "w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 uppercase", value: customCourse.code, onChange: e => setCustomCourse(prev => ({ ...prev, code: e.target.value })), placeholder: "\u00D6rn: YENI101" })] }), _jsxs("div", { className: "md:col-span-12 lg:col-span-5", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Ders Ad\u0131" }), _jsx("input", { className: "w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500", value: customCourse.name, onChange: e => setCustomCourse(prev => ({ ...prev, name: e.target.value })), placeholder: "\u00D6rn: \u0130leri Yapay Zeka" })] }), _jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Kredi" }), _jsx("input", { type: "number", className: "w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500", value: customCourse.credits, onChange: e => setCustomCourse(prev => ({ ...prev, credits: Number(e.target.value) })) })] }), _jsxs("div", { className: "md:col-span-2", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "AKTS" }), _jsx("input", { type: "number", className: "w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500", value: customCourse.ects, onChange: e => setCustomCourse(prev => ({ ...prev, ects: Number(e.target.value) })) })] }), _jsxs("div", { className: "md:col-span-4", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Ders Tipi" }), _jsxs("select", { className: "w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500", value: customCourse.type, onChange: e => setCustomCourse(prev => ({ ...prev, type: e.target.value })), children: [_jsx("option", { value: "secmeli", children: "Se\u00E7meli" }), _jsx("option", { value: "mesleki_secmeli", children: "Mesleki Se\u00E7meli" }), _jsx("option", { value: "zorunlu", children: "Zorunlu" })] })] }), _jsxs("div", { className: "md:col-span-3", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Not" }), _jsx("select", { className: "w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500", value: customCourse.grade, onChange: e => setCustomCourse(prev => ({ ...prev, grade: e.target.value })), children: ['AA', 'AB', 'BA', 'BB', 'BC', 'CB', 'CC', 'CD', 'DC', 'DD', 'FF', 'YT'].map(g => (_jsx("option", { value: g, children: g }, g))) })] }), _jsx("div", { className: "md:col-span-5 flex justify-end", children: _jsx("button", { onClick: addCustomSimulationCourse, disabled: !customCourse.code || !customCourse.name, className: "w-full md:w-auto px-8 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 font-medium", children: "+ \u00D6zel Dersi Ekle" }) })] }))] }), _jsxs("div", { className: "bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden mt-6", children: [_jsxs("div", { className: "p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center", children: [_jsx("h3", { className: "font-bold text-gray-800", children: "\uD83D\uDCCB Hesaplamaya Dahil Olan Dersler" }), _jsxs("span", { className: "text-sm text-gray-500", children: [simGpaResult?.usedCourses?.length || 0, " Ders"] })] }), _jsx("div", { className: "overflow-x-auto max-h-[600px]", children: _jsxs("table", { className: "w-full text-sm text-left", children: [_jsx("thead", { className: "text-xs text-gray-500 uppercase bg-gray-50 sticky top-0", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-3", children: "Kod" }), _jsx("th", { className: "px-6 py-3", children: "Ders Ad\u0131" }), _jsx("th", { className: "px-6 py-3 text-center", children: "Kredi" }), _jsx("th", { className: "px-6 py-3 text-center", children: "D\u00F6nem" }), _jsx("th", { className: "px-6 py-3 text-center", children: "Sim\u00FClasyon Notu" }), _jsx("th", { className: "px-6 py-3 text-center", children: "\u0130\u015Flem" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-100", children: simGpaResult?.usedCourses?.map((record) => (_jsxs("tr", { className: `hover:bg-gray-50 transition-colors ${record.semester === 'Simülasyon' ? 'bg-indigo-50/30' : ''}`, children: [_jsx("td", { className: "px-6 py-4 font-medium text-gray-900", children: record.courseCode }), _jsx("td", { className: "px-6 py-4 text-gray-600 max-w-xs truncate", title: record.courseName || '', children: record.courseName }), _jsx("td", { className: "px-6 py-4 text-center font-medium", children: record.credits }), _jsx("td", { className: "px-6 py-4 text-center text-xs text-gray-500", children: record.semester }), _jsx("td", { className: "px-6 py-4 text-center", children: _jsx("select", { className: `px-3 py-1 rounded-full text-xs font-bold border-0 cursor-pointer focus:ring-2 focus:ring-indigo-500 ${record.grade.passed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`, value: record.grade.letter, onChange: (e) => updateSimulationGrade(record.id, e.target.value), children: ['AA', 'AB', 'BA', 'BB', 'BC', 'CB', 'CC', 'CD', 'DC', 'DD', 'FF', 'YT'].map(g => (_jsx("option", { value: g, children: g }, g))) }) }), _jsx("td", { className: "px-6 py-4 text-center", children: record.semester === 'Simülasyon' && (_jsx("button", { onClick: () => removeSimulationRecord(record.id), className: "text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50", title: "Dersi Sil", children: _jsx(Trash2, { className: "w-4 h-4" }) })) })] }, record.id))) })] }) })] }), _jsxs("div", { className: "flex justify-between mt-8", children: [_jsx("button", { onClick: () => setStep(1), className: "px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50", children: "\u2190 Geri" }), _jsx("button", { onClick: () => setStep(3), className: "px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700", children: "Uzmanla\u015Fma Analizi \u2192" })] })] })] })), step === 3 && (_jsxs("div", { className: "space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500", children: [_jsxs("div", { className: "bg-white rounded-xl shadow-lg p-8 border border-indigo-100", children: [_jsxs("h2", { className: "text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2", children: [_jsx(Award, { className: "text-indigo-600" }), "Uzmanla\u015Fma Analizi ", _jsxs("span", { className: "text-sm font-normal text-gray-500 ml-2", children: ["(", analyzeSpecializations(records).activeSeason, " D\u00F6nemi \u0130\u00E7in Planlama)"] })] }), (() => {
                                        const analysis = analyzeSpecializations(records);
                                        const isTotalMet = analysis.totalTechnicalElectives >= 7;
                                        return (_jsxs("div", { children: [_jsxs("div", { className: "flex flex-col md:flex-row gap-6 mb-8", children: [_jsxs("div", { className: `flex-1 p-4 rounded-xl border-l-4 ${isTotalMet ? 'bg-green-50 border-green-500' : 'bg-amber-50 border-amber-500'} shadow-sm`, children: [_jsx("h3", { className: "font-bold text-gray-800 mb-1", children: "Toplam Mesleki Se\u00E7meli" }), _jsxs("div", { className: "flex items-end gap-2", children: [_jsx("span", { className: "text-3xl font-bold", children: analysis.totalTechnicalElectives }), _jsx("span", { className: "text-gray-500 mb-1", children: "/ 7 Ders (Min)" })] }), _jsx("p", { className: `text-sm mt-2 ${isTotalMet ? 'text-green-700' : 'text-amber-700'}`, children: isTotalMet ? '✅ Toplam ders sayısı şartı sağlandı.' : '⚠️ En az 7 mesleki seçmeli ders almalısınız.' })] }), _jsxs("div", { className: "flex-1 p-4 bg-blue-50 border-l-4 border-blue-500 rounded-xl shadow-sm", children: [_jsx("h3", { className: "font-bold text-gray-800 mb-1", children: "En Uygun Alan" }), _jsx("div", { className: "text-xl font-bold text-blue-900", children: analysis.bestGroup
                                                                        ? SPECIALIZATION_GROUPS.find(g => g.id === analysis.bestGroup)?.name
                                                                        : 'Henüz seçim yapılmadı' }), _jsx("p", { className: "text-sm text-blue-700 mt-2", children: "Mevcut derslerinize g\u00F6re en y\u00FCksek ilerleme." })] })] }), _jsx("h3", { className: "text-xl font-bold text-gray-800 mb-4", children: "Alan \u0130lerlemeleri" }), _jsx("div", { className: "grid grid-cols-1 xl:grid-cols-2 gap-6", children: analysis.groups.map((groupResult) => (_jsxs("div", { className: `relative overflow-hidden rounded-xl border-2 transition-all duration-300 ${groupResult.isQualified
                                                            ? 'border-green-500 bg-white shadow-md ring-4 ring-green-50/50'
                                                            : 'border-gray-200 bg-white hover:border-indigo-300 hover:shadow-md'}`, children: [groupResult.isQualified && (_jsx("div", { className: "absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg z-10", children: "TAMAMLANDI" })), _jsxs("div", { className: "p-5 border-b border-gray-100 bg-gray-50/50", children: [_jsx("h4", { className: "font-bold text-lg text-gray-900 pr-8", children: groupResult.group.name }), _jsxs("div", { className: "flex items-center gap-4 mt-2", children: [_jsxs("div", { className: "flex items-center text-sm font-medium", children: [_jsx("span", { className: `w-2 h-2 rounded-full mr-2 ${groupResult.takenCount >= 5 ? 'bg-green-500' : 'bg-gray-300'}` }), "\u0130lerleme: ", groupResult.takenCount, "/5"] }), _jsxs("div", { className: "flex items-center text-sm font-medium", children: [_jsx("span", { className: `w-2 h-2 rounded-full mr-2 ${groupResult.mandatoryMissing.length === 0 ? 'bg-green-500' : 'bg-red-500'}` }), "Zorunlu: ", groupResult.mandatoryMissing.length === 0 ? 'Tamam' : `${groupResult.mandatoryMissing.length} Eksik`] })] }), _jsx("div", { className: "mt-3 w-full bg-gray-200 rounded-full h-1.5 overflow-hidden", children: _jsx("div", { className: `h-full rounded-full ${groupResult.isQualified ? 'bg-green-500' : 'bg-indigo-500'}`, style: { width: `${Math.min((groupResult.takenCount / 5) * 100, 100)}%` } }) })] }), _jsx("div", { className: "p-0", children: _jsx("div", { className: "max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 p-2", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "text-xs text-gray-400 bg-gray-50 sticky top-0", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left py-2 px-3 font-medium", children: "Kod" }), _jsx("th", { className: "text-left py-2 px-3 font-medium", children: "Ders Ad\u0131" }), _jsx("th", { className: "text-center py-2 px-3 font-medium", children: "Durum" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-50", children: groupResult.coursesStatus.map((statusItem, idx) => (_jsxs("tr", { className: "group hover:bg-gray-50", children: [_jsxs("td", { className: "py-2 px-3 font-mono text-xs text-gray-600", children: [statusItem.course.code, statusItem.course.isMandatory && _jsx("span", { className: "ml-1 text-red-500 font-bold", title: "Zorunlu", children: "(Z)" })] }), _jsxs("td", { className: "py-2 px-3 text-gray-700 truncate max-w-[180px]", title: statusItem.course.name, children: [statusItem.course.name, _jsx("div", { className: "text-[10px] text-gray-400", children: statusItem.course.term })] }), _jsxs("td", { className: "py-2 px-3 text-center", children: [statusItem.status === 'taken' && (_jsxs("span", { className: "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800", children: [_jsx(CheckCircle, { size: 12, className: "mr-1" }), " Al\u0131nd\u0131"] })), statusItem.status === 'available' && (_jsx("span", { className: "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100", children: "Al\u0131nabilir" })), statusItem.status === 'locked' && (_jsxs("span", { className: "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500", title: `Önşart: ${statusItem.missingPrereq}`, children: ["\uD83D\uDD12 ", statusItem.missingPrereq] })), statusItem.status === 'wrong_term' && (_jsxs("span", { className: "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-50 text-gray-400 border border-gray-100 italic", children: ["\u23F3 ", statusItem.course.term, " D\u00F6nemi"] }))] })] }, idx))) })] }) }) })] }, groupResult.group.id))) }), _jsxs("div", { className: "mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800", children: [_jsxs("h4", { className: "font-bold flex items-center gap-2 mb-2", children: [_jsx(Info, { size: 16 }), " Kurallar Hat\u0131rlatmas\u0131:"] }), _jsxs("ul", { className: "list-disc list-inside space-y-1 ml-1", children: [_jsxs("li", { children: ["Mezuniyet i\u00E7in toplam ", _jsx("strong", { children: "en az 7" }), " mesleki se\u00E7meli ders (Minimum 35 AKTS) al\u0131nmal\u0131d\u0131r."] }), _jsxs("li", { children: ["Bu derslerin ", _jsx("strong", { children: "en az 5 tanesi" }), " (Min 25 AKTS) tek bir uzmanla\u015Fma grubundan se\u00E7ilmelidir."] }), _jsxs("li", { children: ["Se\u00E7ilen grubun alt\u0131ndaki ", _jsx("strong", { children: "(Z)" }), " i\u015Faretli zorunlu derslerin tamam\u0131 ba\u015Far\u0131lmal\u0131d\u0131r."] }), _jsx("li", { children: "\"Research in...\" derslerinden ayn\u0131 d\u00F6nem i\u00E7in en fazla 1, toplamda en fazla 2 adet al\u0131nabilir." })] })] })] }));
                                    })()] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("button", { onClick: () => setStep(2), className: "px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50", children: "\u2190 Geri" }), _jsx("button", { onClick: () => setStep(4), className: "px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700", children: "Ders Program\u0131 \u2192" })] })] })), step === 4 && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-white rounded-xl shadow-lg p-8", children: [_jsx("h2", { className: "text-2xl font-bold text-gray-900 mb-2", children: "\uD83D\uDCC5 Ders Program\u0131 Olu\u015Ftur" }), _jsx("p", { className: "text-gray-600 mb-6", children: "Haftal\u0131k ders program\u0131n\u0131z\u0131 olu\u015Fturun ve \u00E7ak\u0131\u015Fmalar\u0131 analiz edin" }), _jsxs("div", { className: "flex gap-4 border-b border-gray-200 mb-6", children: [_jsx("button", { onClick: () => setActiveScheduleTab('manual'), className: `pb-3 px-4 font-medium transition-colors ${activeScheduleTab === 'manual'
                                                    ? 'border-b-2 border-indigo-600 text-indigo-600'
                                                    : 'text-gray-500 hover:text-gray-700'}`, children: "\u270D\uFE0F Manuel Giri\u015F" }), _jsx("button", { onClick: () => setActiveScheduleTab('pdf'), className: `pb-3 px-4 font-medium transition-colors ${activeScheduleTab === 'pdf'
                                                    ? 'border-b-2 border-indigo-600 text-indigo-600'
                                                    : 'text-gray-500 hover:text-gray-700'}`, children: "\uD83D\uDCC4 PDF Y\u00FCkle" })] }), activeScheduleTab === 'manual' && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Ders Kodu" }), _jsx("input", { type: "text", placeholder: "EEM321", value: manualCourse.courseCode, onChange: (e) => setManualCourse({ ...manualCourse, courseCode: e.target.value.toUpperCase() }), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "G\u00FCn" }), _jsxs("select", { value: manualCourse.day, onChange: (e) => setManualCourse({ ...manualCourse, day: e.target.value }), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500", children: [_jsx("option", { value: "", children: "Se\u00E7" }), _jsx("option", { value: "Pazartesi", children: "Pazartesi" }), _jsx("option", { value: "Sal\u0131", children: "Sal\u0131" }), _jsx("option", { value: "\u00C7ar\u015Famba", children: "\u00C7ar\u015Famba" }), _jsx("option", { value: "Per\u015Fembe", children: "Per\u015Fembe" }), _jsx("option", { value: "Cuma", children: "Cuma" }), _jsx("option", { value: "Cumartesi", children: "Cumartesi" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Ba\u015Flang\u0131\u00E7" }), _jsx("input", { type: "time", value: manualCourse.startTime, onChange: (e) => setManualCourse({ ...manualCourse, startTime: e.target.value }), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Biti\u015F" }), _jsx("input", { type: "time", value: manualCourse.endTime, onChange: (e) => setManualCourse({ ...manualCourse, endTime: e.target.value }), className: "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500" })] })] }), _jsx("button", { onClick: () => {
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
                                                }, disabled: !manualCourse.courseCode || !manualCourse.day || !manualCourse.startTime || !manualCourse.endTime, className: "px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed", children: "+ Ders Ekle" })] })), activeScheduleTab === 'pdf' && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "border-2 border-dashed border-gray-300 rounded-lg p-8 text-center", children: [_jsx("input", { type: "file", accept: ".pdf", onChange: handleSchedulePdfUpload, className: "hidden", id: "schedule-pdf-input" }), _jsx("label", { htmlFor: "schedule-pdf-input", className: "cursor-pointer", children: _jsxs("div", { className: "text-gray-600", children: [_jsx("svg", { className: "mx-auto h-12 w-12 text-gray-400", stroke: "currentColor", fill: "none", viewBox: "0 0 48 48", children: _jsx("path", { d: "M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }) }), _jsx("p", { className: "mt-2 text-sm font-medium", children: "Ders Program\u0131 PDF'ini Y\u00FCkle" }), _jsx("p", { className: "mt-1 text-xs text-gray-500", children: "Okulun payla\u015Ft\u0131\u011F\u0131 PDF format\u0131ndaki program\u0131 y\u00FCkleyin" })] }) })] }), _jsx("p", { className: "text-xs text-gray-500", children: "\uD83D\uDCA1 PDF y\u00FCklendikten sonra otomatik olarak parse edilecek ve programa eklenecektir." })] })), departmentSchedule.length > 0 && (_jsxs("div", { className: "mt-8 p-6 bg-indigo-50 rounded-xl border border-indigo-100", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-lg font-bold text-indigo-900", children: "\uD83D\uDCDA B\u00F6l\u00FCm Program\u0131ndan Ders Se\u00E7" }), _jsxs("button", { onClick: autoAddFailedCourses, className: "px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 flex items-center gap-2", children: [_jsx(AlertCircle, { size: 16 }), "Kalan Dersleri Otomatik Ekle"] })] }), _jsx("p", { className: "text-sm text-indigo-700 mb-4", children: "A\u015Fa\u011F\u0131daki listeden derslerin \u015Fubelerini (Section) se\u00E7erek program\u0131n\u0131za ekleyin. \u00C7ak\u0131\u015Fmalar a\u015Fa\u011F\u0131da otomatik kontrol edilecektir." }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[500px] overflow-y-auto", children: Array.from(new Set(departmentSchedule.map(s => s.courseCode))).sort().map(code => {
                                                    const allSections = departmentSchedule.filter(s => s.courseCode === code);
                                                    const lectures = allSections.filter(s => s.type === 'lecture');
                                                    const labs = allSections.filter(s => s.type === 'lab');
                                                    return (_jsxs("div", { className: "bg-white p-4 rounded-lg shadow-sm border border-indigo-100", children: [_jsxs("div", { className: "flex justify-between items-center mb-3 pb-2 border-b border-gray-100", children: [_jsx("div", { className: "font-bold text-gray-800 text-lg", children: code }), _jsxs("div", { className: "flex gap-1", children: [lectures.length > 0 && (_jsxs("span", { className: "text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded", children: [lectures.length, " Teorik"] })), labs.length > 0 && (_jsxs("span", { className: "text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded", children: [labs.length, " Lab"] }))] })] }), lectures.length > 0 && (_jsxs("div", { className: "mb-3", children: [_jsxs("div", { className: "flex justify-between items-center mb-2", children: [_jsx("div", { className: "text-xs font-semibold text-blue-700 flex items-center gap-1", children: "\uD83D\uDCD6 Teorik Ders" }), _jsxs("button", { onClick: () => {
                                                                                    // Add ALL lecture sessions at once
                                                                                    const newSessions = lectures.filter(sec => !selectedSchedule.some(s => s.courseCode === sec.courseCode && s.day === sec.day && s.startTime === sec.startTime));
                                                                                    if (newSessions.length > 0) {
                                                                                        setSelectedSchedule([...selectedSchedule, ...newSessions]);
                                                                                    }
                                                                                }, className: "text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 transition-colors", children: ["T\u00FCm\u00FCn\u00FC Ekle (", lectures.length, ")"] })] }), _jsx("div", { className: "space-y-1 text-xs text-gray-600", children: lectures.map((sec, idx) => (_jsxs("div", { className: "flex items-center gap-2 p-1 bg-blue-50 rounded", children: [_jsx("span", { className: "font-medium", children: sec.day }), _jsxs("span", { className: "font-mono", children: [sec.startTime, "-", sec.endTime] })] }, `lec-${idx}`))) })] })), labs.length > 0 && (() => {
                                                                // Check if any lab group for this course is already selected
                                                                const selectedLabSection = selectedSchedule.find(s => s.courseCode === code && s.type === 'lab')?.section;
                                                                return (_jsxs("div", { children: [_jsxs("div", { className: "text-xs font-semibold text-orange-700 mb-2 flex items-center gap-1", children: ["\uD83D\uDD2C Laboratuvar Gruplar\u0131", selectedLabSection && (_jsxs("span", { className: "ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded", children: ["\u2713 Grup ", selectedLabSection, " se\u00E7ildi"] }))] }), _jsx("div", { className: "space-y-2", children: Array.from(new Set(labs.map(l => l.section))).sort().map(section => {
                                                                                const sectionLabs = labs.filter(l => l.section === section);
                                                                                const isThisGroupSelected = selectedLabSection === section;
                                                                                const isOtherGroupSelected = selectedLabSection && selectedLabSection !== section;
                                                                                return (_jsxs("div", { className: `p-2 rounded border ${isThisGroupSelected
                                                                                        ? 'bg-green-50 border-green-300'
                                                                                        : isOtherGroupSelected
                                                                                            ? 'bg-gray-100 border-gray-200 opacity-50'
                                                                                            : 'bg-orange-50 border-orange-100'}`, children: [_jsxs("div", { className: "flex justify-between items-center mb-1", children: [_jsxs("span", { className: `text-xs font-bold ${isThisGroupSelected ? 'text-green-800' : 'text-orange-800'}`, children: ["Grup ", section] }), isThisGroupSelected ? (_jsx("button", { onClick: () => {
                                                                                                        // Remove this group's sessions
                                                                                                        setSelectedSchedule(selectedSchedule.filter(s => !(s.courseCode === code && s.type === 'lab')));
                                                                                                    }, className: "text-xs bg-red-500 text-white px-2 py-0.5 rounded hover:bg-red-600", children: "Kald\u0131r" })) : (_jsx("button", { onClick: () => {
                                                                                                        if (isOtherGroupSelected)
                                                                                                            return; // Disabled
                                                                                                        // Add ALL sessions of this lab group
                                                                                                        const newSessions = sectionLabs.filter(sec => !selectedSchedule.some(s => s.courseCode === sec.courseCode && s.day === sec.day && s.startTime === sec.startTime));
                                                                                                        if (newSessions.length > 0) {
                                                                                                            setSelectedSchedule([...selectedSchedule, ...newSessions]);
                                                                                                        }
                                                                                                    }, disabled: !!isOtherGroupSelected, className: `text-xs px-2 py-0.5 rounded transition-colors ${isOtherGroupSelected
                                                                                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                                                                        : 'bg-orange-500 text-white hover:bg-orange-600'}`, children: isOtherGroupSelected ? 'Başka grup seçili' : 'Ekle' }))] }), _jsx("div", { className: "text-xs text-orange-700", children: sectionLabs.map((sec, idx) => (_jsxs("span", { children: [sec.day, " ", sec.startTime, "-", sec.endTime, idx < sectionLabs.length - 1 ? ', ' : ''] }, idx))) })] }, section));
                                                                            }) })] }));
                                                            })()] }, code));
                                                }) })] })), selectedSchedule.length > 0 && (_jsxs("div", { className: "mt-8", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h3", { className: "text-xl font-bold text-gray-900", children: "\uD83D\uDCCB Haftal\u0131k Program" }), _jsx("button", { onClick: () => setSelectedSchedule([]), className: "px-4 py-2 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100", children: "Program\u0131 Temizle" })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "min-w-full border-collapse", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { className: "sticky left-0 z-10 bg-red-900 text-white px-4 py-3 text-sm font-medium border border-gray-300", children: "Saat" }), ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'].map((day) => (_jsx("th", { className: "bg-blue-700 text-white px-4 py-3 text-sm font-medium border border-gray-300 min-w-[120px]", children: day }, day)))] }) }), _jsx("tbody", { children: generateTimeSlots().map((timeSlot) => (_jsxs("tr", { className: "hover:bg-gray-50", children: [_jsx("td", { className: "sticky left-0 z-10 bg-red-900 text-white px-4 py-3 text-xs font-medium border border-gray-300 whitespace-nowrap", children: timeSlot }), ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'].map((day) => {
                                                                        const course = selectedSchedule.find((s) => s.day === day && isTimeInSlot(timeSlot, s.startTime, s.endTime));
                                                                        return (_jsx("td", { className: `px-2 py-3 text-xs text-center border border-gray-300 ${course ? 'bg-gray-200 font-medium' : 'bg-white'}`, children: course ? (_jsxs("div", { className: "group relative", children: [_jsx("div", { className: "font-bold text-gray-900", children: course.courseCode }), _jsx("button", { onClick: () => {
                                                                                            setSelectedSchedule(selectedSchedule.filter(s => !(s.courseCode === course.courseCode && s.day === course.day && s.startTime === course.startTime)));
                                                                                        }, className: "absolute top-0 right-0 opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-800", title: "Dersi Sil", children: "\u00D7" })] })) : null }, day));
                                                                    })] }, timeSlot))) })] }) }), _jsxs("div", { className: "mt-6", children: [_jsx("h3", { className: "font-semibold text-gray-900 mb-3", children: "\u26A0\uFE0F \u00C7ak\u0131\u015Fma Analizi" }), (() => {
                                                        const conflicts = detectScheduleConflicts(selectedSchedule);
                                                        return conflicts.length > 0 ? (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: conflicts.map((c, i) => (_jsxs("div", { className: "p-3 bg-red-50 border border-red-200 rounded-lg flex items-start", children: [_jsx(AlertCircle, { className: "text-red-500 mt-0.5 mr-2 shrink-0", size: 18 }), _jsxs("div", { children: [_jsx("div", { className: "font-bold text-red-900 text-sm", children: "\u00C7ak\u0131\u015Fma Tespit Edildi" }), _jsx("div", { className: "text-red-700 text-sm mt-1", children: c.courses.join(' ve ') }), _jsx("div", { className: "text-red-600 text-xs mt-0.5", children: c.time })] })] }, i))) })) : (_jsx("div", { className: "p-4 bg-green-50 border border-green-200 rounded-lg", children: _jsxs("p", { className: "text-sm text-green-800 flex items-center", children: [_jsx(CheckCircle, { className: "mr-2", size: 16 }), "\u2705 \u00C7ak\u0131\u015Fma tespit edilmedi! Program\u0131n\u0131z uyumlu."] }) }));
                                                    })()] })] }))] }), _jsxs("div", { className: "flex justify-between items-center", children: [_jsx("button", { onClick: () => setStep(3), className: "px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50", children: "\u2190 Geri" }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { onClick: () => setStep(5), className: "px-6 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50", children: "Bu Ad\u0131m\u0131 Atla \u2192" }), _jsx("button", { onClick: () => setStep(5), className: "px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700", children: "Raporu \u0130ndir" })] })] })] })), step === 5 && gpa && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-white rounded-xl shadow-lg p-8", children: [_jsx("h2", { className: "text-2xl font-bold text-gray-900 mb-6", children: "\uD83D\uDCC4 Akademik Durum Raporu" }), _jsxs("div", { className: "space-y-4 mb-6", children: [_jsxs("div", { className: "p-4 bg-gray-50 rounded-lg", children: [_jsx("h3", { className: "font-semibold mb-2", children: "\uD83D\uDCCA Not Durumu" }), _jsxs("p", { children: ["GNO: ", _jsx("strong", { children: gpa.gno.toFixed(2) }), " | AKTS: ", _jsxs("strong", { children: [gpa.totalECTS, "/240"] })] })] }), selectedArea && (_jsxs("div", { className: "p-4 bg-gray-50 rounded-lg", children: [_jsx("h3", { className: "font-semibold mb-2", children: "\uD83C\uDFAF En \u0130yi Uzmanla\u015Fma" }), _jsx("p", { children: (() => {
                                                            const analysis = analyzeSpecializations(records);
                                                            const best = SPECIALIZATION_GROUPS.find(g => g.id === analysis.bestGroup);
                                                            if (best) {
                                                                const groupResult = analysis.groups.find(g => g.group.id === best.id);
                                                                return (_jsxs(_Fragment, { children: [_jsx("strong", { children: best.name }), _jsxs("p", { className: "text-sm text-gray-600 mt-1", children: ["\u0130lerleme: ", groupResult?.takenCount, "/5 ders"] })] }));
                                                            }
                                                            return _jsx("span", { children: "Hen\u00FCz yeterli veri yok" });
                                                        })() })] })), eem413Check && (_jsxs("div", { className: "p-4 bg-gray-50 rounded-lg", children: [_jsx("h3", { className: "font-semibold mb-2", children: "\uD83C\uDF93 EEM413/414 Durumu" }), _jsx("p", { className: eem413Check.eligible ? 'text-green-600' : 'text-red-600', children: eem413Check.eligible ? '✅ Alabilir' : '❌ Henüz alamaz' })] }))] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("button", { onClick: () => {
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
                                                }, className: "w-full flex items-center justify-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-lg transform hover:scale-[1.02]", children: [_jsx(Download, { size: 24, className: "mr-2" }), _jsx("span", { className: "font-bold text-lg", children: "PDF Raporu \u0130ndir" })] }), _jsx("p", { className: "text-center text-sm text-gray-500 mt-4", children: "Rapor, senaryo analizlerini ve uzmanla\u015Fma \u00F6nerilerini i\u00E7erir." })] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("button", { onClick: () => setStep(4), className: "px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50", children: "\u2190 Geri" }), _jsx("button", { onClick: () => setStep(1), className: "px-6 py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50", children: "Yeni Analiz Ba\u015Flat" })] })] })), _jsx("footer", { className: "bg-white border-t mt-12", children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6", children: [_jsxs("p", { className: "text-center text-gray-600 text-sm font-medium", children: [_jsx("span", { className: "md:hidden", children: "EST\u00DC EEM Akademik Planlama Sistemi" }), _jsx("span", { className: "hidden md:block", children: "EST\u00DC Elektrik Elektronik M\u00FChendisli\u011Fi Akademik Planlama Sistemi" })] }), _jsxs("div", { className: "flex flex-col items-center gap-3 mt-4", children: [_jsxs("div", { className: "flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-100 shadow-sm", children: [_jsx(ShieldCheck, { size: 16 }), _jsx("span", { className: "font-medium", children: "G\u00FCvenlik: T\u00FCm veriler taray\u0131c\u0131n\u0131zda i\u015Flenir, sunucuya g\u00F6nderilmez." })] }), _jsxs("div", { className: "flex items-center gap-3 text-xs text-gray-400", children: [_jsx("span", { children: "Ahmet Furkan G\u00FCven taraf\u0131ndan geli\u015Ftirilmi\u015Ftir." }), _jsx("span", { className: "text-gray-300", children: "|" }), _jsxs("a", { href: "https://github.com/", target: "_blank", rel: "noreferrer", className: "flex items-center gap-1 text-indigo-500 hover:text-indigo-700 transition-colors font-medium", children: [_jsx(Github, { size: 14 }), _jsx("span", { children: "A\u00E7\u0131k Kaynak Kodlar\u0131na Eri\u015F" })] })] })] })] }) }), _jsx(VisitorCounter, {})] })] }));
}
