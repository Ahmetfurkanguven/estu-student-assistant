export const translations = {
    tr: {
        // Header & Footer
        // Başlıklar bölümden bağımsızdır; seçilen bölüm adı alt satırda gösterilir.
        header_title_mobile: 'ESTÜ Akademik Planlama',
        header_title_desktop: 'ESTÜ Akademik Planlama Sistemi',
        header_no_department: 'Başlamak için bölümünüzü seçin',
        // Arayüzde kullanılan ama tanımsız kalmış anahtarlar
        placeholder_name: 'Ders adı',
        input_ects: 'AKTS',
        spec_subtitle: 'Uzmanlaşma alanı ilerlemeniz',
        total_tech_electives: 'Toplam Mesleki Seçmeli',
        total_courses_met_msg: '✅ Toplam ders sayısı şartı sağlandı.',
        min_7_courses_warning: '⚠️ En az 7 mesleki seçmeli ders almalısınız.',
        best_group_title: 'En Uygun Alan',
        no_selection_yet: 'Henüz seçim yok',
        best_group_desc: 'Mevcut derslerinize göre en yüksek ilerleme.',
        group_progress_title: 'Alan İlerlemeleri',
        status_ok: 'Tamam',
        status_missing: 'Eksik',
        col_status: 'Durum',
        status_term_suffix: 'dönemi',
        lecture: 'Teorik',
        lab: 'Laboratuvar',
        grade_status_title: '📊 Not Durumu',
        gno_caps: 'GNO',
        ects_caps: 'AKTS',
        best_spec_title: '🎯 En İyi Uzmanlaşma',
        courses_lower: 'ders',
        no_data_yet: 'Henüz veri yok',
        can_take_short: 'Alabilir',
        cannot_take_short: 'Alamaz',
        download_pdf_report: 'PDF Raporu İndir',
        report_footer_info: 'Bu rapor ESTÜ Ön Lisans ve Lisans Eğitim-Öğretim ve Sınav Yönetmeliği (RG 9/9/2025, 33012) hükümlerine göre üretilmiştir. Resmî belge değildir.',
        footer_security: 'Güvenlik: Tüm veriler tarayıcınızda işlenir, sunucuya gönderilmez.',
        footer_developer: 'Ahmet Furkan Güven tarafından geliştirilmiştir.',
        footer_opensource: 'Açık Kaynak Kodlarına Eriş',

        // Steps
        step_transcript: 'Transkript',
        step_gpa: 'GPA & Senaryo',
        step_specialization: 'Uzmanlaşma',
        step_schedule: 'Ders Programı',
        step_report: 'Rapor',

        // Step 1: Upload
        upload_title: '📄 Transkript Yükle + İntibak',
        upload_intibak_checkbox: 'Otomatik intibak uygula (EMAT111→MAT1011, EKİM105→KİM1005, vb.)',
        upload_box_text: 'TXT veya PDF transkript yükleyin',
        upload_button: 'Dosya Seç',
        upload_info_title: '✅ Yenilikler v2.0:',
        upload_info_1: 'PDF Parser (pdf.js entegrasyonu)',
        upload_info_2: 'İntibak motoru (eski→yeni ders kodları)',
        upload_info_3: '6 uzmanlaşma alanı + zorunlu ders kontrolü',
        upload_info_4: 'Ders programı parser + çakışma analizi',
        upload_info_5: 'Bitirme projesi koşulu (ilk 4 yarıyıl VEYA 180 AKTS — Madde 8/4)',

        // Step 2: GPA
        calculating: 'GNO hesaplanıyor...',
        gpa_title: 'GNO/DNO Analizi',
        gpa_subtitle: 'Akademik başarı durumunuzun detaylı analizi',
        download_report: 'Raporu İndir',
        gno_label: 'Genel Not Ortalaması',
        status_success: 'Başarılı',
        status_fail: 'Akademik Yetersizlik',
        total_ects: 'Toplam AKTS',
        graduation_goal: 'Mezuniyet: 240 AKTS',
        passed_credits: 'Geçilen Kredi',
        success_rate_suffix: 'başarı',

        // Bitirme projesi kontrolü (Madde 8/4) — ders kodları bölüm profilinden gelir
        eem413_title: '🎓 Bitirme Projesi Uygunluk Kontrolü',
        eem413_success_msg: 'Bitirme projesi derslerini alabilirsiniz!',
        eem413_success_detail: '✅ GNO ≥ 2.00 VE (İlk 4 yarıyıl zorunlu dersleri VEYA 180+ AKTS)',
        eem413_fail_msg: 'Eksik koşullar:',

        // Course List
        course_list_title: '📚 Ders Kayıtları',
        col_code: 'Kod',
        col_name: 'Ders',
        col_term: 'Dönem',
        col_grade: 'Not',
        col_ects: 'AKTS',
        show_less: 'Daha Az Göster (İlk 15)',
        show_more: 'Tüm Dersleri Göster',
        show_more_suffix: 'ders daha)',

        // Simulation
        sim_title: '🧪 GNO Simülasyonu & Senaryo',
        sim_desc: 'Notlarınızı aşağıdan değiştirerek veya yeni ders ekleyerek ortalamanızı tahmin edin.',
        current_gno: 'Mevcut GNO',
        sim_gno: 'Simülasyon GNO',
        graduation_cap_title: 'Bitirme Projesi (Simüle)',
        can_take: '✅ Alabilirsin',
        cannot_take: '❌ Alamazsın',
        ects_grad: 'AKTS & Mezuniyet',
        credits_completed: '✅ Kredi Tamamlandı',
        credits_remaining: '⚠️ Mezuniyete',
        credits_remaining_suffix: 'Kaldı',

        // Add Course
        add_course_title: '➕ Senaryoya Ders Ekle',
        input_credit: 'Kredi',
        input_type: 'Ders Tipi',
        type_elective: 'Seçmeli',
        type_technical: 'Mesleki Seçmeli',
        type_mandatory: 'Zorunlu',

        // Added Courses Table
        sim_table_title: '📋 Hesaplamaya Dahil Olan Dersler',

        // Navigation
        btn_back: '← Geri',
        btn_next_specialization: 'Uzmanlaşma Analizi →',
        btn_skip: 'Bu Adımı Atla →',
        btn_new_analysis: 'Yeni Analiz Başlat',

        // Step 3: Specialization
        spec_title: 'Uzmanlaşma Analizi',
        min_7_courses: '/ 7 Ders (Min)',
        progress_label: 'İlerleme:',
        mandatory_label: 'Zorunlu:',
        status_taken: 'Alındı',
        status_available: 'Alınabilir',

        // Step 4: Schedule

        // Step 5: Report
        report_title: '📄 Akademik Durum Raporu',

        // Dynamic / Alerts


        // PDF Report
    },
    en: {
        // Header & Footer
        header_title_mobile: 'ESTU Academic Planner',
        header_title_desktop: 'ESTU Academic Planning System',
        header_no_department: 'Select your department to begin',
        // Arayüzde kullanılan ama tanımsız kalmış anahtarlar
        placeholder_name: 'Course name',
        input_ects: 'ECTS',
        spec_subtitle: 'Your specialization progress',
        total_tech_electives: 'Total Technical Electives',
        total_courses_met_msg: '✅ Total course requirement met.',
        min_7_courses_warning: '⚠️ You need at least 7 technical electives.',
        best_group_title: 'Best Matching Area',
        no_selection_yet: 'No selection yet',
        best_group_desc: 'Highest progress based on your current courses.',
        group_progress_title: 'Area Progress',
        status_ok: 'OK',
        status_missing: 'Missing',
        col_status: 'Status',
        status_term_suffix: 'term',
        lecture: 'Lecture',
        lab: 'Lab',
        grade_status_title: '📊 Grade Status',
        gno_caps: 'GPA',
        ects_caps: 'ECTS',
        best_spec_title: '🎯 Best Specialization',
        courses_lower: 'courses',
        no_data_yet: 'No data yet',
        can_take_short: 'Eligible',
        cannot_take_short: 'Not eligible',
        download_pdf_report: 'Download PDF Report',
        report_footer_info: 'Generated per the ESTU Undergraduate Education and Examination Regulation (Official Gazette 9/9/2025, No. 33012). Not an official document.',
        footer_security: 'Security: All data is processed in your browser, never sent to a server.',
        footer_developer: 'Developed by Ahmet Furkan Güven.',
        footer_opensource: 'Access Open Source Codes',

        // Steps
        step_transcript: 'Transcript',
        step_gpa: 'GPA & Scenario',
        step_specialization: 'Specialization',
        step_schedule: 'Schedule',
        step_report: 'Report',

        // Step 1: Upload
        upload_title: '📄 Upload Transcript + Adaptation',
        upload_intibak_checkbox: 'Apply auto-adaptation (EMAT111→MAT1011, etc.)',
        upload_box_text: 'Upload TXT or PDF transcript',
        upload_button: 'Select File',
        upload_info_title: '✅ What\'s New v2.0:',
        upload_info_1: 'PDF Parser (pdf.js integration)',
        upload_info_2: 'Adaptation engine (old→new course codes)',
        upload_info_3: '6 specialization areas + mandatory course check',
        upload_info_4: 'Schedule parser + conflict analysis',
        upload_info_5: 'Graduation project rule (first 4 terms OR 180 ECTS — Art. 8/4)',

        // Step 2: GPA
        calculating: 'Calculating GPA...',
        gpa_title: 'GPA/CGPA Analysis',
        gpa_subtitle: 'Detailed analysis of your academic status',
        download_report: 'Download Report',
        gno_label: 'GPA',
        status_success: 'Successful',
        status_fail: 'Academic Insufficiency',
        total_ects: 'Total ECTS',
        graduation_goal: 'Graduation: 240 ECTS',
        passed_credits: 'Passed Credits',
        success_rate_suffix: 'success',

        // EEM413 Check
        eem413_title: '🎓 Graduation Project Eligibility',
        eem413_success_msg: 'You can take Design Project courses!',
        eem413_success_detail: '✅ GPA ≥ 2.00 AND (First 4 terms completed OR 180+ ECTS)',
        eem413_fail_msg: 'Missing requirements:',

        // Course List
        course_list_title: '📚 Course Records',
        col_code: 'Code',
        col_name: 'Course',
        col_term: 'Term',
        col_grade: 'Grade',
        col_ects: 'ECTS',
        show_less: 'Show Less',
        show_more: 'Show All Courses',
        show_more_suffix: 'more courses)',

        // Simulation
        sim_title: '🧪 GPA Simulation & Scenario',
        sim_desc: 'Predict your GPA by changing grades or adding new courses below.',
        current_gno: 'Current GPA',
        sim_gno: 'Simulation GPA',
        graduation_cap_title: 'Design Project (Simulated)',
        can_take: '✅ Eligible',
        cannot_take: '❌ Not Eligible',
        ects_grad: 'ECTS & Graduation',
        credits_completed: '✅ Credits Completed',
        credits_remaining: '⚠️ Remaining for Grad:',
        credits_remaining_suffix: '',

        // Add Course
        add_course_title: '➕ Add Course to Scenario',
        input_credit: 'Credit',
        input_type: 'Course Type',
        type_elective: 'Elective',
        type_technical: 'Technical Elective',
        type_mandatory: 'Mandatory',

        // Added Courses Table
        sim_table_title: '📋 Courses Included in Calculation',

        // Navigation
        btn_back: '← Back',
        btn_next_specialization: 'Specialization Analysis →',
        btn_skip: 'Skip This Step →',
        btn_new_analysis: 'Start New Analysis',

        // Step 3: Specialization
        spec_title: 'Specialization Analysis',
        min_7_courses: '/ 7 Courses (Min)',
        progress_label: 'Progress:',
        mandatory_label: 'Mandatory:',
        status_taken: 'Taken',
        status_available: 'Available',

        // Step 4: Schedule

        // Step 5: Report
        report_title: '📄 Academic Status Report',

        // Dynamic / Alerts

        // PDF Report
    }
};
