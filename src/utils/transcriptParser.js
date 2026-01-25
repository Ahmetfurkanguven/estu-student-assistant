import { GRADE_SYSTEM } from '../data/rules';
/**
 * Gelişmiş transkript parsırı. Her satırı okuyarak ders kodu, isim, kredi, AKTS ve
 * harf notu bilgilerini ayıklar. Dönem başlıklarını (YYYY-YYYY GÜZ/BAHAR) de
 * tespit eder ve kayıtları buna göre etiketler.
 */
export function parseTranscriptText(text) {
    const records = [];
    const lines = text.split('\n');
    let currentSemester = '';
    for (const line of lines) {
        // Dönem başlığı kontrolü
        if (/\d{4}-\d{4}\s+(GÜZ|BAHAR)/i.test(line)) {
            currentSemester = line.trim();
            continue;
        }
        // Ders satırı kontrolü: Kod + İsim + Kredi + AKTS + Not
        const match = line.match(/^([A-ZİĞÜŞÇÖ]{2,}[A-ZİĞÜŞÇÖ0-9]{3,})\s+(.+?)\s+(\d+)\s+([\d.]+)\s+([A-Z]{2})$/);
        if (match && currentSemester) {
            const [, code, name, credits, ects, gradeLetter] = match;
            const gradeInfo = GRADE_SYSTEM[gradeLetter] || { coefficient: 0, passed: false };
            records.push({
                id: `${code}-${currentSemester}`,
                courseCode: code,
                courseName: name.trim(),
                semester: currentSemester,
                credits: parseInt(credits),
                ects: parseFloat(ects),
                grade: {
                    letter: gradeLetter,
                    coefficient: gradeInfo.coefficient,
                    passed: gradeInfo.passed
                }
            });
        }
    }
    return records;
}
/**
 * PDF dosyasını okuyup text'e dönüştürme fonksiyonu.
 * pdfjs-dist kullanarak PDF'ten metin çıkarır.
 */
export async function extractTextFromPDF(file) {
    try {
        const pdfjs = await import('pdfjs-dist');
        // PDF.js worker ayarlaması
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
                .map((item) => item.str)
                .join(' ');
            fullText += pageText + '\n';
        }
        return fullText;
    }
    catch (error) {
        console.error('PDF okuma hatası:', error);
        throw new Error('PDF dosyası okunamadı. Lütfen text formatında transkript yükleyin.');
    }
}
/**
 * Dosya okuma işlemi. PDF veya TXT dosyalarını destekler.
 */
export async function readTranscriptFile(file) {
    if (file.type === 'application/pdf') {
        return await extractTextFromPDF(file);
    }
    else {
        // TXT dosyası
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target?.result;
                resolve(text);
            };
            reader.onerror = () => reject(new Error('Dosya okunamadı'));
            reader.readAsText(file);
        });
    }
}
