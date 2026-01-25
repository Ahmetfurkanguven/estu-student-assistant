import { jsPDF } from 'jspdf';
import { analyzeSpecializations } from './specializationUtils';
import { translations } from '../data/locales';
export const generateAcademicReport = (data) => {
    console.log('Rapor oluşturuluyor...', data);
    const lang = data.lang || 'tr';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = (key) => translations[lang]?.[key] || key;
    try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        let yPos = 20;
        // --- Helper Functions ---
        const cleanText = (text) => {
            if (!text)
                return '';
            return text
                .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
                .replace(/ü/g, 'u').replace(/Ü/g, 'U')
                .replace(/ş/g, 's').replace(/Ş/g, 'S')
                .replace(/ı/g, 'i').replace(/İ/g, 'I')
                .replace(/ö/g, 'o').replace(/Ö/g, 'O')
                .replace(/ç/g, 'c').replace(/Ç/g, 'C');
        };
        const addTitle = (text) => {
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text(cleanText(text), pageWidth / 2, yPos, { align: 'center' });
            yPos += 10;
        };
        const addSubtitle = (text) => {
            yPos += 5;
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(79, 70, 229); // Indigo color
            doc.text(cleanText(text), 20, yPos);
            doc.setTextColor(0, 0, 0); // Reset to black
            yPos += 8;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
        };
        const addText = (text, indent = 20, fontSize = 10, isBold = false) => {
            doc.setFontSize(fontSize);
            doc.setFont('helvetica', isBold ? 'bold' : 'normal');
            doc.text(cleanText(text), indent, yPos);
            yPos += (fontSize / 2) + 2;
        };
        const addLine = () => {
            yPos += 2;
            doc.setDrawColor(200, 200, 200);
            doc.line(20, yPos, pageWidth - 20, yPos);
            yPos += 8;
        };
        const checkPageBreak = (neededSpace) => {
            if (yPos + neededSpace > doc.internal.pageSize.height - 20) {
                doc.addPage();
                yPos = 20;
            }
        };
        // --- HEADER ---
        addTitle(t('pdf_title'));
        doc.setFontSize(10);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(100);
        doc.text(cleanText(`${t('pdf_date')} ${new Date().toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US')}`), pageWidth / 2, yPos, { align: 'center' });
        yPos += 15;
        doc.setTextColor(0);
        // --- 1. STUDENT INFO ---
        addSubtitle(t('pdf_sec_student'));
        addText(t('pdf_dept'));
        addText(`${t('current_gno')}: ${data.gpa.gno.toFixed(2)}`, 20, 10, true);
        addText(`${t('total_ects')}: ${data.gpa.totalECTS.toFixed(1)}`);
        const successRate = data.gpa.totalAttempted > 0
            ? Math.round((data.gpa.passedCredits / data.gpa.totalAttempted) * 100)
            : 0;
        addText(`${t('pdf_success_rate')} %${successRate}`);
        addLine();
        // --- 2. SCENARIO / SIMULATION ANALYSIS (IF EXISTS) ---
        // Make sure we have simulation data to compare
        // Corrected property name: simulationGpa instead of SimulationGpa
        if (data.simulationGpa && data.simulationRecords) {
            checkPageBreak(80);
            addSubtitle(t('pdf_sec_sim'));
            // Identify changes
            const changes = [];
            data.simulationRecords.forEach(simRecord => {
                // Find original record by unique ID to prevent mismatching repeated courses
                const original = data.allRecords.find(r => r.id === simRecord.id);
                // Check if this is a simulation record (modified or new)
                // We can check if semester is 'Simülasyon' OR if grade is different from original
                if (simRecord.semester === 'Simülasyon') {
                    changes.push({
                        course: simRecord,
                        oldGrade: original ? original.grade.letter : '(New)',
                        newGrade: simRecord.grade.letter,
                        type: original ? 'update' : 'new'
                    });
                }
                else if (original && original.grade.letter !== simRecord.grade.letter) {
                    // Grade changed but semester label didn't change (shouldn't happen with current app logic but good to cover)
                    changes.push({
                        course: simRecord,
                        oldGrade: original.grade.letter,
                        newGrade: simRecord.grade.letter,
                        type: 'update'
                    });
                }
            });
            if (changes.length > 0) {
                addText(t('pdf_sim_changes'), 20, 11, true);
                yPos += 2;
                changes.forEach(change => {
                    checkPageBreak(12);
                    const isImprovement = calculateCoefficient(change.newGrade) > calculateCoefficient(change.oldGrade);
                    const changeSymbol = isImprovement ? t('pdf_imp_up') : t('pdf_imp_down');
                    const typeLabel = change.type === 'new' ? t('pdf_risk_new') : t('pdf_risk_repeat');
                    doc.setFontSize(10);
                    doc.setFont('helvetica', 'bold');
                    doc.text(cleanText(`${typeLabel} ${change.course.courseCode}`), 25, yPos);
                    doc.setFont('helvetica', 'normal');
                    const gradeText = `${change.oldGrade} ---> ${change.newGrade}`;
                    doc.text(cleanText(gradeText), 80, yPos);
                    doc.setFontSize(9);
                    doc.setTextColor(100);
                    doc.text(cleanText(`${change.course.credits} Kredi`), 130, yPos);
                    doc.setTextColor(0);
                    yPos += 6;
                });
                yPos += 5;
            }
            else {
                addText(t('pdf_sim_no_change'));
                yPos += 5;
            }
            // TOTAL IMPACT SUMMARY
            checkPageBreak(50); // Increased space check
            doc.setDrawColor(200);
            doc.setFillColor(249, 250, 251); // Gray-50
            doc.rect(20, yPos, pageWidth - 40, 45, 'FD'); // Increased height to 45
            const gpaDiff = data.simulationGpa.gno - data.gpa.gno;
            const sign = gpaDiff >= 0 ? '+' : '';
            const color = gpaDiff >= 0 ? [34, 197, 94] : [239, 68, 68]; // Green or Red
            yPos += 8;
            doc.setFontSize(11);
            doc.setFont('helvetica', 'bold');
            doc.text(cleanText(t('pdf_impact_analysis')), 30, yPos);
            // Row 1: GNO
            yPos += 10;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`${t('current_gno')}:`, 30, yPos);
            doc.setFont('helvetica', 'bold');
            doc.text(data.gpa.gno.toFixed(2), 60, yPos);
            doc.setFont('helvetica', 'normal');
            doc.text(t('pdf_target_gno'), 90, yPos);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(color[0], color[1], color[2]);
            doc.text(data.simulationGpa.gno.toFixed(2), 125, yPos);
            doc.setFontSize(12);
            doc.text(`(${sign}${gpaDiff.toFixed(2)})`, 150, yPos);
            doc.setTextColor(0); // Reset
            // Row 2: AKTS (NEW)
            yPos += 10;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`${t('total_ects')}:`, 30, yPos);
            doc.setFont('helvetica', 'bold');
            doc.text(data.gpa.totalECTS.toFixed(1), 60, yPos);
            doc.setFont('helvetica', 'normal');
            doc.text(t('pdf_target_ects'), 90, yPos);
            doc.setFont('helvetica', 'bold');
            doc.text(data.simulationGpa.totalECTS.toFixed(1), 125, yPos);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100);
            doc.text(`/ 240 (Mezuniyet)`, 140, yPos);
            doc.setTextColor(0);
            yPos += 15; // Adjusted spacing for next section
            addLine();
        }
        // --- 3. FAILED COURSES ---
        checkPageBreak(40);
        addSubtitle(t('pdf_sec_failed'));
        if (data.failedCourses.length > 0) {
            data.failedCourses.forEach((course) => {
                checkPageBreak(10);
                const status = course.grade.letter === 'DZ' ? '(Devamsiz)' : '';
                addText(`• ${course.courseCode} - ${course.courseName} [${course.grade.letter}] ${status}`);
            });
            yPos += 5;
            addText(t('pdf_failed_total').replace('{count}', data.failedCourses.length.toString()));
            addText(t('pdf_failed_advice'));
        }
        else {
            addText(t('pdf_failed_none'));
        }
        addLine();
        // --- 4. SPECIALIZATION ANALYSIS ---
        checkPageBreak(60);
        addSubtitle(t('pdf_sec_spec'));
        const specAnalysis = analyzeSpecializations(data.allRecords);
        const bestGroupId = specAnalysis.bestGroup;
        if (bestGroupId) {
            const groupResult = specAnalysis.groups.find(g => g.group.id === bestGroupId);
            if (groupResult) {
                addText(`${t('pdf_spec_best')} ${groupResult.group.name}`, 20, 10, true);
                const progress = Math.round((groupResult.takenCount / 5) * 100);
                addText(t('pdf_spec_progress').replace('{percent}', (progress > 100 ? 100 : progress).toString()).replace('{count}', groupResult.takenCount.toString()));
                yPos += 5;
                if (groupResult.mandatoryMissing.length > 0) {
                    addText(t('pdf_spec_missing_mandatory'));
                    groupResult.mandatoryMissing.forEach(code => {
                        checkPageBreak(6);
                        addText(`  - ${code} (Zorunlu)`, 25);
                    });
                    yPos += 3;
                }
                const availableCourses = groupResult.coursesStatus.filter(c => c.status === 'available').slice(0, 5);
                if (availableCourses.length > 0) {
                    addText(t('pdf_spec_suggested'));
                    availableCourses.forEach(item => {
                        checkPageBreak(6);
                        addText(`  - ${item.course.code} - ${item.course.name}`, 25);
                    });
                }
            }
        }
        else {
            addText(t('pdf_spec_none'));
        }
        addLine();
        // --- DISCLAIMER ---
        checkPageBreak(30);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        const disclaimer = t('pdf_disclaimer');
        const splitDisclaimer = doc.splitTextToSize(cleanText(disclaimer), pageWidth - 40);
        doc.text(splitDisclaimer, 20, yPos);
        doc.save('estu_akademik_senaryo_raporu.pdf');
        console.log('Rapor başarıyla oluşturuldu.');
    }
    catch (error) {
        console.error('PDF oluşturma hatası:', error);
        alert('PDF rapor oluşturulurken bir hata oluştu. Lütfen konsolu kontrol edin.');
    }
};
function calculateCoefficient(grade) {
    const map = {
        'AA': 4.0, 'AB': 3.7, 'BA': 3.3, 'BB': 3.0,
        'BC': 2.7, 'CB': 2.3, 'CC': 2.0, 'CD': 1.7,
        'DC': 1.3, 'DD': 1.0, 'FF': 0.0, 'FD': 0.5,
        '(Yeni Ders)': 0 // for new courses
    };
    return map[grade] || 0;
}
