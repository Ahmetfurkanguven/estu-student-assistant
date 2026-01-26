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
        // Ders satırı kontrolü: Daha esnek split mantığı
        // Eski regex: /^([A-ZİĞÜŞÇÖ]{2,}[A-ZİĞÜŞÇÖ0-9]{3,})\s+(.+?)\s+(\d+)\s+([\d.]+)\s+([A-Z]{2})$/
        // Yeni mantık: Satırı parçala ve kolonları kontrol et.
        const parts = line.split(/\s{2,}|\t+/).filter(p => p.trim());
        const codeMatch = line.match(/^([A-ZİĞÜŞÇÖ]{2,}[A-ZİĞÜŞÇÖ0-9]{3,})\s+/);
        if (codeMatch && parts.length >= 5) {
            const code = codeMatch[1];
            // ÖZEL KOD: MFALM102 ve TTTT02 derslerini yoksay
            if (code === 'MFALM102' || code === 'TTTT02') {
                continue;
            }
            // YERİNE DERS KONTROLÜ
            // App.tsx'teki mantığın aynısı
            const yerine1 = parts.length > 6 ? parts[6] : null;
            const yerine2 = parts.length > 7 ? parts[7] : null;
            const isYerinePopulated = (val) => {
                return val && val.length > 2 && val !== 'Z' && val !== 'S'; // Basit kontrol
            };
            if (isYerinePopulated(yerine1) || isYerinePopulated(yerine2)) {
                console.log(`[IGNORED] Yerine ders tespit edildi (Parser), satır atlanıyor: ${code}`);
                continue;
            }
            // Normal Parse işlemine devam et (Regex yerine parts kullanarak)
            // parts[0]: Kod (muhtemelen codeMatch[1] ile aynı veya benzer)
            // parts[1]: Ad
            // parts[2]: Kredi/AKTS? (Format değişebilir, dikkatli olalım)
            // Transkript formatları değişken olduğu için orijinal regexi fallback olarak kullanabiliriz
            // Ancak "Yerine" sütunu varsa zaten yukarıda eledik.
            // Eğer buraya geldiysek "Yerine" sütunu yok veya boş.
            // Orijinal regex'i tekrar deneyelim, çünkü format doğrulaması sağlıyordu.
            // Ancak satırın sonunda ekstra şeyler olabilir (Yerine sütunu boş olsa bile bazen tab karakterleri vs).
            const match = line.match(/^([A-ZİĞÜŞÇÖ]{2,}[A-ZİĞÜŞÇÖ0-9]{3,})\s+(.+?)\s+(\d+)\s+([\d.]+)\s+([A-Z]{2})/);
            if (match) {
                const [, matchedCode, name, credits, ects, gradeLetter] = match;
                const gradeInfo = GRADE_SYSTEM[gradeLetter] || { coefficient: 0, passed: false };
                records.push({
                    id: `${matchedCode}-${currentSemester}`,
                    courseCode: matchedCode,
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
