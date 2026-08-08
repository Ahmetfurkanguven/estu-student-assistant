# ESTÜ EEM Akademik Planlama Sistemi

Eskişehir Teknik Üniversitesi Elektrik‑Elektronik Mühendisliği öğrencileri için kapsamlı bir **akademik planlama aracı**. Bu proje,
transkriptinizi yükleyerek derslerinizi otomatik olarak algılar, not ortalamanızı hesaplar, önkoşulları denetler ve uzmanlaşma alanı seçiminizi
izlemeye yardımcı olur. Ayrıca PDF ders programı bilgilerini parse edip dersler arası çakışmaları bulur ve nihai bir rapor üretir.

## ✨ Özellikler

### 🎯 Beş Ana Modül

1. **PDF Parser** – Transkript dosyanızı (TXT/PDF) tarayıcı üzerinde okuyup ders kodu, ders adı, kredi, AKTS ve harf notlarını çıkartır.
2. **İntibak Motoru** – Eski ders kodlarını yeni kodlarla eşleştirir (ör. `EMAT111 → MAT1011`). Seçenek olarak açıp kapatılabilir.
3. **Uzmanlaşma Analizi** – Altı farklı alan (Elektronik, Güç, Haberleşme, Kontrol, Sayısal Sistemler, Sinyal İşleme) için gereken minimum ders/AKTS
   miktarını takip eder ve ilerlemenizi gösterir.
4. **Ders Programı Parser + Çakışma** – Güz/Bahar dönemi ders programı metninden gün, saat ve derslik bilgilerini çıkarır. Seçilen dersler
   arasında zaman çakışması olup olmadığını kontrol eder. Asenkron dersler çakışma analizine dâhil edilmez.
5. **Raporlama** – Hesaplanan GNO/DNO, tamamlanan AKTS, uzmanlaşma durumu, EEM413/414 uygunluğu ve çakışma sonuçlarını PDF/JSON olarak
   dışa aktarır.

### 📊 Hesaplamalar

* **Genel Not Ortalaması (GNO)** – 4.0 ölçeğinde kredi ağırlıklı not ortalamasını hesaplar. Yeterli (`YT`) dersler ortalamaya katılmaz.
* **EEM413/414 uygunluğu** – GNO ≥ 2.0 ve **(ilk dört yarıyılın tüm zorunlu dersleri tamamlanmış _veya_ 180 AKTS toplanmış)** şartını
  kontrol eder.
* **Önkoşullar** – Her ders için önkoşul listesini kontrol eder ve eksik dersleri listeler.
* **AKTS/Kredi Takibi** – Geçilen kredi/AKTS toplamını ve mezuniyete kalan dersleri gösterir.

### 🔒 Gizlilik

* **Tamamen client‑side**: Tüm hesaplamalar tarayıcıda çalışır, transkript veriniz sunucuya gönderilmez.
* **Yerel Saklama**: İşlem yaptığınız transkript ve hesaplamalar `localStorage` üzerinde saklanır; sayfayı yenilediğinizde kaybolmaz.

## 🚀 Kurulum

Bu proje [Vite](https://vitejs.dev/) ve [React](https://react.dev/) kullanılarak geliştirilmiştir.

```bash
# Depoyu klonlayın ve dizine gidin
git clone https://github.com/kullanici-adiniz/estu-eem-planner.git
cd estu-eem-planner

# Bağımlılıkları yükleyin
npm install

# Geliştirme sunucusunu başlatın (localhost:5173)
npm run dev

# Üretim derlemesi oluşturun
npm run build

# GitHub Pages'e deploy edin (gh-pages dalı oluşturulur)
npm run deploy
```

> **Not:** Deploy komutu için makinenizde `gh-pages` paketinin global olarak kurulu olması ve GitHub hesabınızda erişim izni olması gerekir.

## 📦 Deployment

### GitHub Pages

Projenin kendi GitHub reposu altında [GitHub Pages](https://pages.github.com/) kullanarak otomatik dağıtım yapabilirsiniz:

1. GitHub üzerinde bir depo oluşturun (örn. `estu-eem-planner`).
2. `Settings → Pages` menüsünde kaynak olarak **GitHub Actions**'ı seçin.
3. Bu projeyi `main` dalına push edin. `.github/workflows/deploy.yml` dosyası sayesinde build işlemi tetiklenir ve site `gh-pages` dalına
   deploy edilir.
4. Siteniz `https://kullanici-adiniz.github.io/estu-eem-planner/` adresinde canlı olacaktır.

### Manuel Deploy

Üretim derlemesini manuel olarak dağıtmak isterseniz:

```bash
npm run build
cp -r dist/ /path/to/hosting/root/
```

## 📚 Kullanım

1. **Transkript Yükle:** Uygulamaya TXT veya PDF formatında transkriptinizi yükleyin.
2. **İntibak Seç:** Dilerseniz eski ders kodlarını otomatik olarak yeni kodlara dönüştürün.
3. **GNO Analizi:** Not ortalamanız, toplanan AKTS ve EEM413/414 uygunluğunuz hesaplanır.
4. **Uzmanlaşma:** Altı alan arasından birini seçerek mesleki seçmeli ders ilerlemenizi takip edin.
5. **Ders Programı:** Haftalık ders programınızı metin olarak girip parse edin; çakışma analizini görün.
6. **Raporlama:** PDF veya JSON formatında rapor indirerek sonuçlarınızı kaydedin.

## 🎓 Bölüm Profilleri

Uygulamada **hiçbir bölümün verisi koda gömülü değildir.** Ders planı, önkoşullar,
intibak eşlemeleri ve uzmanlaşma alanları, seçilen bölümün profil dosyasından okunur.

```
public/data/departments/
├── index.json      ← seçim kutusunda listelenen bölümler
├── EEM.json
└── <KOD>.json      ← yeni bölüm buraya
```

### Yeni bölüm ekleme

**1. `public/data/departments/<KOD>.json` dosyasını oluşturun:**

```jsonc
{
  "code": "YZM",
  "name": "Yazılım Mühendisliği",
  "nameEn": "Software Engineering",
  "faculty": "Mühendislik Fakültesi",
  "degree": "lisans",              // "lisans" | "onlisans"
  "totalEcts": 240,                // Madde 25/1: lisans 240, ön lisans 120
  "coursePrefixes": ["YZM"],       // ders programı PDF'inde ders/derslik ayrımına yardımcı olur

  // Madde 8/4 — bitirme projesi niteliğindeki dersler
  "graduationProject": {
    "codes": ["YZM401", "YZM402"],
    "minEctsAlternative": 180
  },

  "courses": [
    {
      "code": "MAT1011",
      "name": "Calculus I",
      "credits": 7.5,
      "ects": 7.5,
      "type": "zorunlu",           // zorunlu | secmeli | mesleki_secmeli | universite_secmeli
      "semester": 1,               // zorunlu derslerde ŞART (tekrar sıralaması buna göre)
      "prerequisites": []
    }
  ],

  "intibak": [
    { "oldCode": "EMAT111", "newCode": "MAT1011", "note": "kod değişikliği" }
  ],

  "specializations": [
    {
      "id": "web",
      "name": "Web Teknolojileri",
      "nameEn": "Web Technologies",
      "requiredCourses": ["YZM301"],
      "minCourses": 5,
      "minECTS": 25,
      "courses": [
        { "code": "YZM301", "name": "Web Programming", "isMandatory": true,
          "prerequisite": "YZM201", "term": "Güz" }
      ]
    }
  ]
}
```

**2. `index.json` dosyasına kaydedin:**

```json
{
  "departments": [
    { "code": "YZM", "name": "Yazılım Mühendisliği",
      "faculty": "Mühendislik Fakültesi", "degree": "lisans", "file": "YZM.json" }
  ]
}
```

Profil doğrulanamazsa (eksik `code`, `name`, `degree`, `totalEcts` ya da `courses`)
uygulama sessizce yanlış sonuç üretmek yerine hata gösterir.

> `semester` alanı boş bırakılan zorunlu dersler, Madde 19/5'teki
> "yarıyılı en küçük olandan başlayarak" sıralamasında en sona düşer.

## ⚖️ Yönetmelik Dayanağı

Tüm hesaplama ve kurallar [ESTÜ Ön Lisans ve Lisans Eğitim-Öğretim ve Sınav
Yönetmeliği](https://www.resmigazete.gov.tr/eskiler/2025/09/20250909-2.htm)
(RG 9/9/2025, Sayı 33012) metnine dayanır:

| Madde | Konu | Kod |
|---|---|---|
| 8/1 | Kredilerin AKTS olması | `transcriptParser.ts` |
| 8/3 | Seçmeli kredisi dolduktan sonra yerine ders | `courseSelectionRules.ts` |
| 8/4 | Ön koşul (en az bir kez alınmış olmak), bitirme projesi | `courseSelectionRules.ts` |
| 8/5 | AA/YT alınan ders tekrar edilemez | `gradeSystem.ts` |
| 10/2 | Ders yükü: 45 / 60 (ÇAP) / 20 (yaz) / 25 AKTS | `repeatRules.ts` |
| 18/4-5 | Harf notları, katsayılar, ÇK/DV/DZ/EK/KL/SD/YT/YZ | `gradeSystem.ts` |
| 19/1 | GNO/DNO formülü (ara yuvarlama yok) | `gpaCalculator.ts` |
| 19/3 | Tekrar ve yerine derste "en son alınan" kuralı | `gpaCalculator.ts` |
| 19/5 | FF/YZ/DZ tekrarı, zorunlu–seçmeli ayrımı | `repeatRules.ts` |
| 19/6 | Akademik yetersizlik: uyarı → tekrar aşamaları | `repeatRules.ts` |
| 25/1 | Mezuniyet koşulları | `engine/analyze.ts` |

Kuralların korunduğunu doğrulamak için:

```bash
npm test
```

Ders programı parser'ını gerçek PDF arşivine karşı koşturmak için:

```bash
SCHEDULE_DIR="/path/to/Ders Programları" npm run test:schedule
```

## 🗓️ Ders Programı Oluşturucu

Okulun yayımladığı haftalık ders programı PDF'i yüklenir; sistem tabloyu
koordinatlarından çözer ve öğrencinin durumuna göre program kurar.

Parser'ın başa çıktığı gerçek biçimler (2016-2017 … 2026-2027 arşivi ile doğrulandı):

| Durum | Örnek |
|---|---|
| Dikey, harf harf yazılmış gün adları | `P` `A` `Z` `A` `R` `T` `E` `S` `İ` |
| Bölünmüş Türkçe karakterler | `K` + `İ` + `M 1005` → `KİM 1005` |
| Yıllara göre değişen kolon düzeni | `Ders I \| Derslik` · `Ders I \| Öğretim Elemanı \| Derslik` |
| Sayfada yan yana iki sınıf tablosu | `I. SINIF` \| `II. SINIF` |
| Tüm gruplara açık teorik | `(Class - All Groups)` |
| Şubeye özel teorik | `(Class-A-E Groups)`, `(Class-B-C-D Groups)` |
| Tek lab grubu | `(A)`, `/ A&B`, `/ C` |
| Koddan sonra çıplak grup | `FİZ105 A-B (İNG)` |
| Aynı kutuda birden çok ders | `EEM447 (H-I-İ-J) /EEM453 (C-D-E-P-T-U)` |
| Öğretim elemanı (grup sanılmamalı) | `(Özge E.)`, `(Özen Y., Seval K.)` |

**Grup mantığı:** teorik (`All Groups`) oturumlar koşulsuz eklenir; laboratuvar
ve şube oturumlarında yalnızca öğrencinin grubu eklenir. Bu ayrım yapılmazsa
her lablı derste sahte çakışma çıkar. Tercih edilen grup çakışıyorsa çakışmayan
başka bir gruba otomatik geçilir.

## 📝 Lisans

Bu proje MIT lisansı ile dağıtılmaktadır. Daha fazla bilgi için `LICENSE` dosyasına bakınız.

## 🤝 Katkıda Bulunma

Katkılarınızı memnuniyetle karşılıyoruz! Yeni özellikler önermek veya hataları bildirmek için GitHub Issues üzerinden bize ulaşabilirsiniz.