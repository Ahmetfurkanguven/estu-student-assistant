import type { StudentRecord } from '../types';
import { GRADE_SYSTEM } from '../data/rules';
// @ts-ignore
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/**
 * Gelişmiş transkript parsırı. Her satırı okuyarak ders kodu, isim, kredi, AKTS ve
 * harf notu bilgilerini ayıklar. Dönem başlıklarını (YYYY-YYYY GÜZ/BAHAR) de
 * tespit eder ve kayıtları buna göre etiketler.
 */
export function parseTranscriptText(text: string): StudentRecord[] {
    const records: StudentRecord[] = [];
    const lines = text.split('\n');
    let currentSemester = '';

    for (const line of lines) {
        // console.log('PARSER V2.1: Line:', line.substring(0, 20) + '...'); // Debug log removed to reduce noise
        const trimmedLine = line.trim();
        // Dönem başlığı kontrolü
        if (/\d{4}-\d{4}\s+(GÜZ|BAHAR|YAZ)/i.test(trimmedLine)) {
            currentSemester = trimmedLine;
            continue;
        }

        // Regex for the new format observed in images:
        // CourseCode | CourseName | AKTS | Grade | Credits | Status | ReplacedBy...
        // Example: MFALM102 Mühendislik Almancası II(Alm) 4.0 FF 0.00 S FİZ237(Tür)
        const match = trimmedLine.match(/^([A-ZİĞÜŞÇÖ0-9]{2,})\s+(.+?)\s+(\d+(?:\.\d+)?)\s+([A-Z]{2})\s+(\d+(?:\.\d+)?)(?:\s+([A-Z]+))?(?:\s+(.*))?$/);

        if (match && currentSemester) {
            const [, code, name, ectsStr, gradeLetter, pointsStr, status, rest] = match;

            const ects = parseFloat(ectsStr);
            // ESTU uses AKTS for GPA calculation based on the transcript columns (AKTS * Grade = Points)
            const credits = ects;
            const gradeInfo = GRADE_SYSTEM[gradeLetter] || { coefficient: 0, passed: false };

            // Determine if the course should be counted in GPA
            // 1. If Status is 'S' (often means 'Saydırıldı' or 'Silindi' in this context of replacement)
            // 2. If 'rest' contains a valid course code (indicating it was replaced by another course)
            let countInGPA = true;
            const hasReplacement = rest && /[A-ZİĞÜŞÇÖ]{2,}\d{3,}/.test(rest);

            if (hasReplacement) {
                countInGPA = false;
            }

            // Also exclude 'T' (Transfer) or other non-calculated statuses if necessary, 
            // but for now focusing on the user's "Yerine" request.

            records.push({
                id: `${code}-${currentSemester}`,
                courseCode: code,
                courseName: name.trim(),
                semester: currentSemester,
                credits: credits,
                ects: ects,
                grade: {
                    letter: gradeLetter,
                    coefficient: gradeInfo.coefficient,
                    passed: gradeInfo.passed
                },
                countInGPA: countInGPA
            });
        } else {
            // Fallback for older format
            // Example: BİM122   Discrete Computational Structures (...)   5.0   CD   8.50   Z
            // Looks like: Code Name ECTS Grade Points Status
            // Old Regex expected: Code Name Credits ECTS Grade ?? The comments in old code were inconsistent with regex.
            // Let's rely on the one that was in the file before my edits if it exists, otherwise use a generic one.

            // Based on previous view:
            // const oldMatch = line.match(/^([A-ZİĞÜŞÇÖ]{2,}[A-ZİĞÜŞÇÖ0-9]{3,})\s+(.+?)\s+(\d+)\s+([\d.]+)\s+([A-Z]{2})$/);

            // Adapting a robust fallback:
            const fallbackMatch = trimmedLine.match(/^([A-ZİĞÜŞÇÖ0-9]{2,})\s+(.+?)\s+(\d+(?:\.\d+)?)\s+([A-Z]{2})/);
            if (fallbackMatch && currentSemester) {
                const [, code, name, creditsStr, gradeLetter] = fallbackMatch;
                const creds = parseFloat(creditsStr);
                const gradeInfo = GRADE_SYSTEM[gradeLetter] || { coefficient: 0, passed: false };

                records.push({
                    id: `${code}-${currentSemester}`,
                    courseCode: code,
                    courseName: name.trim(),
                    semester: currentSemester,
                    credits: creds,
                    ects: creds, // Assuming AKTS if only one number
                    grade: {
                        letter: gradeLetter,
                        coefficient: gradeInfo.coefficient,
                        passed: gradeInfo.passed
                    },
                    countInGPA: true
                });
            }
        }
    }
    return records;
}

/**
 * PDF dosyasını okuyup text'e dönüştürme fonksiyonu.
 * pdfjs-dist kullanarak PDF'ten metin çıkarır.
 */
export async function extractTextFromPDF(file: File): Promise<string> {
    try {
        const pdfjs = await import('pdfjs-dist');
        // PDF.js worker ayarlaması
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                .map((item: any) => item.str)
                .join(' ');
            fullText += pageText + '\n';
        }

        return fullText;
    } catch (error) {
        console.error('PDF okuma hatası:', error);
        throw new Error('PDF dosyası okunamadı. Lütfen text formatında transkript yükleyin.');
    }
}

/**
 * Dosya okuma işlemi. PDF veya TXT dosyalarını destekler.
 */
export async function readTranscriptFile(file: File): Promise<string> {
    if (file.type === 'application/pdf') {
        return await extractTextFromPDF(file);
    } else {
        // TXT dosyası
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target?.result as string;
                resolve(text);
            };
            reader.onerror = () => reject(new Error('Dosya okunamadı'));
            reader.readAsText(file);
        });
    }
}
