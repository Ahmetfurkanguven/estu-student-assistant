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

## 🎓 Veri Kaynakları

Bu projede kullanılan ders ve önkoşul bilgileri örnek olarak dahil edilmiştir. Gerçek veriler için aşağıdaki dosyaları güncelleyebilirsiniz:

* `public/data/courses.json` – Ders katalogu (kod, isim, kredi, AKTS, tür, önkoşullar, dönem).
* `public/data/prerequisites.json` – Ders → önkoşul listeleri.
* `public/data/intibak.json` – Eski → yeni ders kodu eşlemeleri.
* `public/data/specializations.json` – Uzmanlaşma alanları ve şartları.
* `public/data/schedules/*.json` – Yıllık ders programları.

## 📝 Lisans

Bu proje MIT lisansı ile dağıtılmaktadır. Daha fazla bilgi için `LICENSE` dosyasına bakınız.

## 🤝 Katkıda Bulunma

Katkılarınızı memnuniyetle karşılıyoruz! Yeni özellikler önermek veya hataları bildirmek için GitHub Issues üzerinden bize ulaşabilirsiniz.