/**
 * Motor testleri — yönetmelik hükümlerinin koda doğru yansıdığını doğrular.
 * Çalıştırma:  npm test
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parseTranscript, buildLinesFromPdfItems } from '../src/utils/transcriptParser';
import type { TranscriptRecord } from '../src/utils/transcriptParser';
import { resolveRecords, calculateGpa, buildSemesterHistory, compareSemesters } from '../src/utils/gpaCalculator';
import { assessAcademicStanding, determineRetakes, getEctsLimit } from '../src/utils/repeatRules';
import { generateCourseProposal, checkPrerequisites } from '../src/utils/courseSelectionRules';
import { validateProfile } from '../src/utils/departmentRegistry';
import { GRADES } from '../src/data/gradeSystem';
import { computeBase, buildCandidates, projectCandidate, buildTargetPlan, buildTargetPlans } from '../src/utils/gpaTarget';
import { groupOfferings, buildSchedulePlan, buildWeeklyGrid } from '../src/utils/schedulePlanner';
import type { ParsedOffering } from '../src/utils/schedulePdfParser';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail = '') {
    if (condition) { passed++; console.log(`  ✓ ${name}`); }
    else { failed++; failures.push(`${name}${detail ? ' — ' + detail : ''}`); console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

function eq(name: string, actual: unknown, expected: unknown) {
    check(name, Object.is(actual, expected), `beklenen ${JSON.stringify(expected)}, gelen ${JSON.stringify(actual)}`);
}

function section(title: string) { console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 60 - title.length))}`); }

// ===========================================================================
section('Harf notu tablosu (Madde 18/4-5)');

eq('AA katsayısı 4.00', GRADES['AA'].coefficient, 4.0);
eq('CD katsayısı 1.70', GRADES['CD'].coefficient, 1.7);
eq('FF katsayısı 0.00', GRADES['FF'].coefficient, 0.0);
check('FD yönetmelik dışı olarak işaretli', GRADES['FD'].legacy === true);
check('YT ortalamaya girmez', GRADES['YT'].countsInGpa === false);
check('YZ ortalamaya girmez (eski kodda giriyordu)', GRADES['YZ'].countsInGpa === false);
check('ÇK ortalamaya girmez ama mezuniyeti engeller',
    GRADES['ÇK'].countsInGpa === false && GRADES['ÇK'].blocksGraduation === true);
check('DZ tekrar gerektirir', GRADES['DZ'].mustRetake === true);

// ===========================================================================
section('Transkript parser — eskiden 0 ders okunan biçimler');

const CASES: Record<string, string> = {
    'A) başlıkta "Dönemi" yok':
        `2023-2024 GÜZ
MAT1011 Calculus I                  6  7.5  AA
FİZ105 Physics I                    4  6.0  BA
TÜR125 Türk Dili I                  2  2.0  YT`,

    'B) başlıkta "Dönemi" var':
        `2023-2024 Güz Dönemi
MAT1011 Calculus I                  6  7.5  AA
FİZ105 Physics I                    4  6.0  BA
TÜR125 Türk Dili I                  2  2.0  YT`,

    'C) PDF: tek boşlukla birleşmiş satır':
        `2023-2024 Güz Dönemi
MAT1011 Calculus I 7.5 AA 30.00 Z
FİZ105 Physics I 6.0 BA 19.80 Z`,

    'D) statü kolonu "Zorunlu" yazılı':
        `2023-2024 Güz Dönemi
MAT1011  Calculus I  6  7.5  AA  24.00  Zorunlu
FİZ105  Physics I  4  6.0  BA  13.20  Zorunlu`,

    'E) gerçek yerine sayılan ders':
        `2023-2024 Güz Dönemi
EEM322  Electronics II  3  5.0  BA  9.90  Z  EEM4501`
};

for (const [label, text] of Object.entries(CASES)) {
    const result = parseTranscript(text);
    const expected = { 'A': 3, 'B': 3, 'C': 2, 'D': 2, 'E': 1 }[label[0]]!;
    check(`${label}: ${expected} ders okundu`, result.records.length === expected,
        `gelen ${result.records.length}`);
}

const caseB = parseTranscript(CASES['B) başlıkta "Dönemi" var']);
eq('ders adı doğru okundu (eskiden "6" oluyordu)', caseB.records[0].courseName, 'Calculus I');
eq('AKTS doğru', caseB.records[0].ects, 7.5);
eq('not doğru', caseB.records[0].grade.letter, 'AA');

const caseD = parseTranscript(CASES['D) statü kolonu "Zorunlu" yazılı']);
check('"Zorunlu" yerine ders sanılmadı', caseD.records.every(r => r.replacedByCode === null));
eq('statü zorunlu olarak okundu', caseD.records[0].status, 'zorunlu');

const caseE = parseTranscript(CASES['E) gerçek yerine sayılan ders']);
eq('yerine sayılan ders kaydı korundu', caseE.records[0].courseCode, 'EEM322');
eq('yerine alınan ders tespit edildi', caseE.records[0].replacedByCode, 'EEM4501');

// "DC Machines" gibi ders adı harf notu sanılmamalı
const trickyName = parseTranscript(`2023-2024 Güz Dönemi
EEM471  DC Machines and Drives  5.0  BB  15.00  Z`);
eq('ders adındaki "DC" not sanılmadı', trickyName.records[0].grade.letter, 'BB');
eq('ders adı korundu', trickyName.records[0].courseName, 'DC Machines and Drives');

// Hiç okunamayan dosya sessiz kalmamalı
const garbage = parseTranscript('bu bir transkript değil\nsadece düz metin');
check('okunamayan dosyada error tanısı üretildi',
    garbage.diagnostics.some(d => d.level === 'error' && d.code === 'NO_RECORDS'));

// Dönem başlığı olmadan da ders okunur, ama uyarı verilir
const noHeader = parseTranscript('MAT1011 Calculus I  6  7.5  AA');
check('başlıksız dosyada ders okundu', noHeader.records.length === 1);
check('başlıksız dosyada uyarı verildi',
    noHeader.diagnostics.some(d => d.code === 'NO_SEMESTER_HEADER'));

// PDF satır kurma: geniş boşluk sekmeye dönüşmeli
const pdfLine = buildLinesFromPdfItems([
    { str: 'MAT1011', x: 10, y: 700, width: 40, page: 1 },
    { str: 'Calculus I', x: 60, y: 700, width: 50, page: 1 },
    { str: '7.5', x: 300, y: 700, width: 15, page: 1 },
    { str: 'AA', x: 350, y: 700, width: 12, page: 1 }
]);
check('PDF satırında kolon boşluğu korundu', pdfLine[0].includes('\t'), pdfLine[0]);
check('PDF satırı parse edilebiliyor', parseTranscript(pdfLine.join('\n')).records.length === 1);

// ===========================================================================
section('GNO / DNO (Madde 19/1, 19/3)');

const gpaText = `2023-2024 Güz Dönemi
MAT1011  Calculus I  7.5  AA
FİZ105   Physics I   6.0  FF
TÜR125   Türk Dili I 2.0  YT
İSG401   İş Sağlığı  2.0  YZ`;

const gpaParsed = parseTranscript(gpaText);
const gpaResolved = resolveRecords(gpaParsed.records);
const gpa = calculateGpa(gpaResolved.active);

// (4.00*7.5 + 0.00*6.0) / (7.5 + 6.0) = 30 / 13.5 = 2.2222 -> 2.22
eq('GNO doğru hesaplandı', gpa.gno, 2.22);
eq('GNO paydasında YT/YZ yok', gpa.gpaEcts, 13.5);
check('YT ortalamaya girmedi', !gpa.countedCourses.some(c => c.grade.letter === 'YT'));
check('YZ ortalamaya girmedi', !gpa.countedCourses.some(c => c.grade.letter === 'YZ'));
eq('kazanılan AKTS yalnızca geçilen dersler', gpa.earnedEcts, 9.5); // AA 7.5 + YT 2.0

// Tekrar: en son not geçerli (Madde 19/3)
const retakeParsed = parseTranscript(`2023-2024 Güz Dönemi
EEM209  Circuit Analysis I  7.5  FF
2024-2025 Güz Dönemi
EEM209  Circuit Analysis I  7.5  BB`);
const retakeResolved = resolveRecords(retakeParsed.records);
eq('tekrar edilen ders tek kez sayıldı', retakeResolved.active.length, 1);
eq('en son not geçerli', retakeResolved.active[0].grade.letter, 'BB');
check('düşen kayıt gerekçesiyle raporlandı',
    retakeResolved.superseded.some(s => s.reason === 'tekrar'));

// Yerine ders (Madde 19/3): sütunu TAŞIYAN satır düşer, adı geçen ders kalır.
// Gerçek ESTÜ transkript satırı — src/utils/test_fix.ts içindeki örnekten.
const realSample = `2022-2023 Yaz Okulu
EEM102 Introduction to Electrical Engineering 7.5 AB 27.75 Z
BEÖ155 Beden Eğitimi(Tür) 2.0 CB 4.60 S

2024-2025 Güz Dönemi
MFALM102 Mühendislik Almancası II(Alm) 4.0 FF 0.00 S FİZ237(Tür)
FİZ237 Bilim ve Yemek(Tür) 3.0 AA 12.00 S
TTTT02 Project(İng) D 20.0 FF 0.00 MS EEM403(İng)
EEM403 Fundamentals of Optoelectronics and Nanophotonics (Opto. ve(İng) 5.0 AA 20.00 MS`;

const realParsed = parseTranscript(realSample);
eq('gerçek transkriptten 6 ders okundu', realParsed.records.length, 6);

const mfalm = realParsed.records.find(r => r.courseCode === 'MFALM102')!;
eq('MFALM102 yerine FİZ237 alındığı okundu', mfalm.replacedByCode, 'FİZ237');
eq('MFALM102 AKTS doğru', mfalm.ects, 4.0);
const tttt = realParsed.records.find(r => r.courseCode === 'TTTT02')!;
eq('TTTT02 yerine EEM403 alındığı okundu', tttt.replacedByCode, 'EEM403');
eq('TTTT02 AKTS doğru ("D 20.0" biçimi)', tttt.ects, 20.0);
eq('BEÖ155 statüsü seçmeli', realParsed.records.find(r => r.courseCode === 'BEÖ155')!.status, 'secmeli');
eq('EEM403 statüsü mesleki seçmeli', realParsed.records.find(r => r.courseCode === 'EEM403')!.status, 'mesleki_secmeli');

const realResolved = resolveRecords(realParsed.records);
const realCodes = realResolved.active.map(r => r.courseCode).sort();
check('yerine bırakılan FF dersleri düştü',
    !realCodes.includes('MFALM102') && !realCodes.includes('TTTT02'), realCodes.join(','));
check('yerine ALINAN dersler kaldı',
    realCodes.includes('FİZ237') && realCodes.includes('EEM403'), realCodes.join(','));
eq('kalan ders sayısı', realResolved.active.length, 4);
check('düşen dersler gerekçesiyle raporlandı',
    realResolved.superseded.filter(s => s.reason === 'yerine').length === 2);
// Eski kodda bu iki ders "NUCLEAR OPTION" ile ada göre siliniyordu; artık kural sonucu.
check('FF notları GNO paydasına girmedi',
    calculateGpa(realResolved.active).countedCourses.every(c => c.grade.letter !== 'FF'));

// "Yerine" sütununun üç durumu — 12 gerçek transkriptin resmî GNO'suyla ölçüldü.
//
// (b) Başarısız olunan ders bırakılmıştır: tüm denemeleri düşer.
const substFailed = resolveRecords(parseTranscript(`2023-2024 Güz Dönemi
MFALM102  Mühendislik Almancası  4.0  FF  0.00  S
2023-2024 Bahar Dönemi
MFALM102  Mühendislik Almancası  4.0  DZ  0.00  S  FİZ237
2025-2026 Güz Dönemi
FİZ237  Fizik  3.0  AA  12.00  S`).records);
eq('başarısız yerine dersi düştü', substFailed.active.length, 1);
eq('kalan ders yerine ALINAN', substFailed.active[0].courseCode, 'FİZ237');
check('her iki deneme de düştü',
    substFailed.superseded.filter(s => s.record.courseCode === 'MFALM102').length === 2);

// (c1) Başarılı ama hedeften ÖNCE alınmış → düşer (Madde 19/3 "en son alınan").
const substEarlier = resolveRecords(parseTranscript(`2022-2023 Güz Dönemi
EMAT221  Linear Algebra  4.5  CD  7.65  Z  MAT2021
2024-2025 Bahar Dönemi
MAT2021  Linear Algebra  4.5  DD  4.50  Z`).records);
eq('eski tarihli başarılı yerine dersi düştü', substEarlier.active.length, 1);
eq('geçerli olan sonraki ders', substEarlier.active[0].courseCode, 'MAT2021');

// (c2) Başarılı ve hedeften SONRA alınmış → KALIR; ikisi de sayılır.
// Erasmus dersi, daha önce alınmış yerel dersin yerine sayılır ama ortalamadan
// çıkarmaz — üniversitenin hesabı da böyle.
const substLater = resolveRecords(parseTranscript(`2023-2024 Bahar Dönemi
EEM102  Introduction to EE  7.5  DD  7.50  Z
2024-2025 Bahar Dönemi (Lietuvos Inzinerijos Kolegia)
TTTT04  Erasmus Course  6.0  BA  19.80  Z  EEM102`).records);
eq('sonraki tarihli başarılı yerine dersi kaldı', substLater.active.length, 2);
check('ikisi de ortalamaya girdi',
    calculateGpa(substLater.active).gpaEcts === 13.5,
    `${calculateGpa(substLater.active).gpaEcts}`);

// Yerine alınan ders transkriptte yoksa kayıt DÜŞÜRÜLMEZ (veri kaybı olmasın).
const danglingSubst = resolveRecords(parseTranscript(`2023-2024 Güz Dönemi
EEM322  Electronics II  5.0  FF  0.00  S  EEM4501`).records);
eq('yerine alınan ders yoksa kayıt korunur', danglingSubst.active.length, 1);
check('bu durumda uyarı verilir',
    danglingSubst.diagnostics.some(d => d.code === 'SUBSTITUTION_REPLACEMENT_MISSING'));

eq('dönem sıralaması: güz < bahar', Math.sign(compareSemesters('2023-2024 Güz', '2023-2024 Bahar')), -1);
eq('dönem sıralaması: bahar < yaz', Math.sign(compareSemesters('2023-2024 Bahar', '2023-2024 Yaz Okulu')), -1);
eq('dönem sıralaması: yıl önceliği', Math.sign(compareSemesters('2024-2025 Güz', '2023-2024 Bahar')), 1);

// ===========================================================================
section('Akademik yetersizlik aşamaları (Madde 19/6)');

function standingFor(text: string) {
    const parsed = parseTranscript(text);
    const history = buildSemesterHistory(parsed.records);
    return { standing: assessAcademicStanding(history), records: resolveRecords(parsed.records).active, history };
}

// Tek dönem GNO < 2.00 → sadece UYARI (eski kod doğrudan tam tekrara geçiyordu)
const s1 = standingFor(`2023-2024 Güz Dönemi
MAT1011  Calculus I  7.5  DD
FİZ105   Physics I   6.0  DC`);
eq('tek başarısız dönem → uyarı', s1.standing.stage, 'uyari');
eq('uyarı dönemi kaydedildi', s1.standing.warningSemester, '2023-2024 Güz Dönemi');

// İki ardışık dönem < 2.00 → TAM TEKRAR
const s2 = standingFor(`2023-2024 Güz Dönemi
MAT1011  Calculus I  7.5  DD
FİZ105   Physics I   6.0  DC
2023-2024 Bahar Dönemi
MAT1012  Calculus II  7.5  DD
FİZ106   Physics II   6.0  DC`);
eq('iki ardışık başarısız dönem → tekrar', s2.standing.stage, 'tekrar');

// Uyarı sonrası düzelme → normal
const s3 = standingFor(`2023-2024 Güz Dönemi
MAT1011  Calculus I  7.5  DD
2023-2024 Bahar Dönemi
MAT1012  Calculus II  7.5  AA
FİZ106   Physics II   6.0  AA`);
eq('GNO 2.00 üstüne çıkınca uyarı kalktı', s3.standing.stage, 'normal');

// Yaz okulu uyarı tetiklemez ama kaldırabilir
const s4 = standingFor(`2023-2024 Güz Dönemi
MAT1011  Calculus I  7.5  DD
2023-2024 Yaz Okulu
MAT1011  Calculus I  7.5  AA`);
eq('yaz okulunda düzelme uyarıyı kaldırdı', s4.standing.stage, 'normal');

// ===========================================================================
section('Tekrar listesi (Madde 19/5, 19/6)');

const profile = validateProfile(
    JSON.parse(readFileSync(resolve(process.cwd(), 'public/data/departments/EEM.json'), 'utf8'))
);
eq('EEM profili yüklendi', profile.code, 'EEM');
check('profil ders içeriyor', profile.courses.length > 100);

// Uyarı aşamasında CC altı tekrar KAPSAM DIŞI
const r1 = standingFor(`2023-2024 Güz Dönemi
MAT1011  Calculus I  7.5  DD
FİZ105   Physics I   6.0  FF`);
const retakes1 = determineRetakes(r1.records, r1.standing, profile);
check('uyarı aşamasında yalnızca FF tekrarda',
    retakes1.length === 1 && retakes1[0].courseCode === 'FİZ105',
    JSON.stringify(retakes1.map(r => r.courseCode)));

// Tekrar aşamasında CC altı de dâhil — CD dahil olmalı (eski kod CD'yi kaçırıyordu)
const r2 = standingFor(`2023-2024 Güz Dönemi
MAT1011  Calculus I  7.5  CD
FİZ105   Physics I   6.0  DD
2023-2024 Bahar Dönemi
MAT1012  Calculus II  7.5  DC
FİZ106   Physics II   6.0  DD`);
const retakes2 = determineRetakes(r2.records, r2.standing, profile);
const codes2 = retakes2.map(r => r.courseCode);
eq('tekrar aşaması tespit edildi', r2.standing.stage, 'tekrar');
check('CD tekrar listesinde (eskiden atlanıyordu)', codes2.includes('MAT1011'), codes2.join(','));
check('DC ve DD de listede', codes2.includes('MAT1012') && codes2.includes('FİZ105'), codes2.join(','));
check('tekrar sıralaması yarıyılı küçükten büyüğe',
    retakes2.every((r, i, arr) => i === 0 || (arr[i - 1].planSemester ?? 99) <= (r.planSemester ?? 99)));

// Uyarı döneminden ÖNCEKİ CC altı dersler kapsam dışı
const r3 = standingFor(`2021-2022 Güz Dönemi
BİM122   Discrete Structures  5.0  DD
MAT1011  Calculus I  7.5  AA
FİZ105   Physics I   6.0  AA
KİM1005  Chemistry   6.0  AA
2023-2024 Güz Dönemi
EEM209   Circuit Analysis I  7.5  FF
EEM206   Circuits Lab  3.0  FF
MAT2011  Differential Equations  4.5  FF
MAT2093  Engineering Math  6.0  FF
2023-2024 Bahar Dönemi
EEM208   Electromagnetics  6.0  DD`);
const retakes3 = determineRetakes(r3.records, r3.standing, profile);
check('uyarı öncesi DD kapsam dışı bırakıldı',
    !retakes3.some(r => r.courseCode === 'BİM122'),
    retakes3.map(r => `${r.courseCode}:${r.kind}`).join(','));

// Madde 8/5 — AA alınan ders tekrar listesine girmez
check('AA alınan ders tekrara girmedi', !retakes3.some(r => r.courseCode === 'MAT1011'));

// ===========================================================================
section('Ön koşul (Madde 8/4) ve ders yükü (Madde 10/2)');

const calc2 = profile.courses.find(c => c.code === 'MAT1012')!;
const attemptedOnly: TranscriptRecord[] = [{
    id: 'x', courseCode: 'MAT1011', courseName: 'Calculus I', semester: '2023-2024 Güz',
    credits: 7.5, ects: 7.5, grade: { letter: 'FF', coefficient: 0, passed: false },
    rawLine: '', status: null, replacedByCode: null, sourceCode: null, legacyGrade: false
}];
check('ön koşul: dersi ALMIŞ olmak yeterli, geçmek şart değil',
    checkPrerequisites(calc2, attemptedOnly).satisfied === true);

const absentOnly: TranscriptRecord[] = [{ ...attemptedOnly[0], grade: { letter: 'DZ', coefficient: 0, passed: false } }];
check('ön koşul: DZ (devamsız) yeterli değil',
    checkPrerequisites(calc2, absentOnly).satisfied === false);

check('ön koşul: hiç alınmamışsa sağlanmaz',
    checkPrerequisites(calc2, []).satisfied === false);

eq('güz/bahar AKTS sınırı', getEctsLimit({ term: 'guz' }).limit, 45);
eq('yaz okulu AKTS sınırı', getEctsLimit({ term: 'yaz' }).limit, 20);
eq('çift anadal AKTS sınırı', getEctsLimit({ term: 'bahar', doubleMajor: true }).limit, 60);
eq('yaz sonu mezuniyet aşaması', getEctsLimit({ term: 'yaz', graduatingAfterSummer: true }).limit, 25);

// ===========================================================================
section('Ders önerisi');

const proposalCtx = standingFor(`2023-2024 Güz Dönemi
MAT1011  Calculus I  7.5  FF
FİZ105   Physics I   6.0  AA`);
const proposal = generateCourseProposal({
    profile,
    records: proposalCtx.records,
    standing: proposalCtx.standing,
    offerings: [],
    term: 'guz',
    requireOffering: false
});
check('öneri üretildi', proposal.proposal.length > 0);
check('AKTS sınırı aşılmadı', proposal.totalEcts <= 45, `${proposal.totalEcts}`);
eq('FF dersi 1. öncelikte', proposal.proposal[0].priority, 1);
eq('FF dersi listenin başında', proposal.proposal[0].course.code, 'MAT1011');
check('AA alınan ders tekrar önerilmedi', !proposal.proposal.some(p => p.course.code === 'FİZ105'));

// ===========================================================================
section('Geçmiş dönem GNO’su geriye dönük değişmemeli (Madde 19/6)');

// 2022 Güz'de FF alınmış, 2023 Güz'de tekrar edilip CC ile geçilmiş.
// Tekrar SONRAKİ dönemdedir; 2022 Güz'ün DNO/GNO'sunu değiştirmemelidir.
// Aksi hâlde uyarının hangi dönemde verildiği kayar ve CC altı tekrar
// kapsamı yanlış dönemden başlar.
const retroText = `2022-2023 Güz Dönemi
MAT1011  Calculus I  7.5  BA  24.75  Z
FİZ105   Physics I   6.0  CC  12.00  Z
FİZ107   Physics Laboratory I  1.5  BB  4.50  Z
KİM1005  General Chemistry  6.0  DD  6.00  Z
BİM122   Discrete Computational Structures  5.0  FF  0.00  Z

2022-2023 Bahar Dönemi
MAT1012  Calculus II  7.5  DC  9.75  Z
FİZ106   Physics II   6.0  DD  6.00  Z
EEM102   Intro to EE  7.5  DD  7.50  Z

2023-2024 Güz Dönemi
BİM122   Discrete Computational Structures  5.0  CC  10.00  Z`;

const retroRecords = parseTranscript(retroText).records;
const retroHistory = buildSemesterHistory(retroRecords);
const retroStanding = assessAcademicStanding(retroHistory);

// (24.75 + 12 + 4.5 + 6 + 0) / (7.5 + 6 + 1.5 + 6 + 5) = 47.25 / 26 = 1.8173
eq('2022 Güz DNO’su FF dahil hesaplandı', retroHistory[0].dno, 1.82);
eq('2022 Güz GNO’su da 2.00 altında', retroHistory[0].gno, 1.82);
eq('uyarı İLK dönemde verildi', retroStanding.warningSemester, '2022-2023 Güz Dönemi');
eq('ikinci dönemde de düzelmediği için tekrar aşaması', retroStanding.stage, 'tekrar');

// Kapsam ilk dönemden başladığı için o dönemin DD'si de tekrara girmeli.
const retroResolved = resolveRecords(retroRecords).active;
const retroRetakes = determineRetakes(retroResolved, retroStanding, profile).map(r => r.courseCode);
check('ilk dönemdeki KİM1005 (DD) tekrar kapsamında', retroRetakes.includes('KİM1005'),
    retroRetakes.join(','));
check('tekrar edilip geçilen BİM122 tekrar kapsamında değil', !retroRetakes.includes('BİM122'));

// Çözümlenmiş liste beslenirse hata geri gelir — bu, hatanın imzasıdır.
const wrongHistory = buildSemesterHistory(retroResolved);
check('regresyon imzası: çözümlenmiş liste 2022 Güz’ü 2.25’e çıkarır',
    wrongHistory[0].dno === 2.25 && retroHistory[0].dno !== wrongHistory[0].dno);

// ===========================================================================
section('Ortalama hedefi planlayıcısı');

const targetRecords = parseTranscript(`2023-2024 Güz Dönemi
MAT1011  Calculus I   7.5  DD
FİZ105   Physics I    6.0  DC
EEM102   Intro to EE  7.5  CC
TÜR125   Türk Dili I  2.0  AA`).records;

const targetBase = computeBase(targetRecords);
// (1.0*7.5 + 1.3*6.0 + 2.0*7.5 + 4.0*2.0) / 23 = (7.5+7.8+15+8)/23 = 38.3/23 = 1.665
eq('taban GNO', Math.round(targetBase.gno * 100) / 100, 1.67);

const targetCandidates = buildCandidates(targetRecords);
check('AA alınan ders aday değil (Madde 8/5)',
    !targetCandidates.some(c => c.courseCode === 'TÜR125'));
eq('en verimli aday en düşük notlu/yüksek AKTS', targetCandidates[0].courseCode, 'MAT1011');

// Tek ders projeksiyonu
const proj = projectCandidate(targetBase, targetCandidates[0], 2.0);
const aa = proj.outcomes.find(o => o.letter === 'AA')!;
// MAT1011 DD→AA: (38.3 - 7.5 + 30) / 23 = 60.8/23 = 2.643
eq('MAT1011 AA ile GNO', aa.gno, 2.64);
check('tekrar paydayı değiştirmedi', proj.outcomes.every(o => o.gno > 0));
eq('hedefe yeten en düşük not', proj.minimumSufficientGrade, 'CB');

// Çoklu plan
const plan = buildTargetPlan(targetRecords, 3.0, targetCandidates);
check('hedef 3.00 için plan üretildi', plan.steps.length > 0);
check('plan hedefe ulaşıyor', plan.projectedGno >= 3.0, `${plan.projectedGno}`);
check('adımlarda gereken not belirtildi', plan.steps.every(s => !!s.requiredGrade));

// Tüm adaylar AA olursa tavan 4.00'dür; hepsi tekrar edilebildiği için 3.95 ulaşılabilir.
eq('tüm adaylar AA ile tavan 4.00',
    buildTargetPlan(targetRecords, 3.95, targetCandidates).maxPossibleGno, 4.0);

// Tek ders elde varsa hedef gerçekten ulaşılamaz olabilir — dürüstçe raporlanmalı.
const onlyOne = targetCandidates.filter(c => c.courseCode === 'EEM102');
const impossible = buildTargetPlan(targetRecords, 3.5, onlyOne);
check('ulaşılamaz hedef achievable=false', impossible.achievable === false);
check('tavan GNO bildirildi', impossible.maxPossibleGno > 0 && impossible.maxPossibleGno < 3.5,
    `${impossible.maxPossibleGno}`);
check('gerekçe açıklandı', impossible.notes.some(n => n.includes('erişilemiyor')));

// Zaten hedefin üstündeyse boş plan
const already = buildTargetPlan(targetRecords, 1.5, targetCandidates);
check('hedef zaten sağlanıyorsa adım yok', already.steps.length === 0 && already.achievable);

// ===========================================================================
section('Ders programı oluşturucu');

const off = (o: Partial<ParsedOffering> & { courseCode: string; day: string; startTime: string; endTime: string }): ParsedOffering => ({
    courseName: o.courseName ?? o.courseCode, section: o.section ?? 'All', type: o.type ?? 'lecture',
    groups: o.groups ?? [], instructor: null, classYear: null, rawText: '', async: false, ...o
});

const catalogue: ParsedOffering[] = [
    // EEM206: herkese teorik + gruplara ayrılmış lab
    off({ courseCode: 'EEM206', day: 'Salı', startTime: '12:00', endTime: '13:00' }),
    off({ courseCode: 'EEM206', day: 'Pazartesi', startTime: '14:00', endTime: '16:00', groups: ['A'], section: 'A', type: 'lab' }),
    off({ courseCode: 'EEM206', day: 'Pazartesi', startTime: '17:00', endTime: '19:00', groups: ['B'], section: 'B', type: 'lab' }),
    // BİL200: A-E ve B-C-D ayrı teorik şubeler
    off({ courseCode: 'BİL200', day: 'Perşembe', startTime: '16:00', endTime: '18:00', groups: ['A', 'E'], section: 'A-E' }),
    off({ courseCode: 'BİL200', day: 'Çarşamba', startTime: '16:00', endTime: '18:00', groups: ['B', 'C', 'D'], section: 'B-C-D' }),
    // EEM209: A grubu lab Pazartesi 14-16 ile çakışacak
    off({ courseCode: 'EEM209', day: 'Pazartesi', startTime: '15:00', endTime: '17:00' })
];

const grouped = groupOfferings(catalogue);
eq('EEM206 teorik oturumu ayrıldı', grouped.get('EEM206')!.plenary.length, 1);
eq('EEM206 iki lab grubu', grouped.get('EEM206')!.availableGroups.join(','), 'A,B');
check('EEM206 grup seçimi gerektiriyor', grouped.get('EEM206')!.requiresGroupChoice);
check('BİL200 grupları A,B,C,D,E', grouped.get('BİL200')!.availableGroups.join(',') === 'A,B,C,D,E');

// A grubu öğrencisi
const planA = buildSchedulePlan({
    courseCodes: ['EEM206', 'BİL200'], offerings: catalogue, preferredGroup: 'A'
});
const eem206A = planA.placements.find(p => p.courseCode === 'EEM206')!;
eq('A grubu labı seçildi', eem206A.chosenGroup, 'A');
check('teorik + lab birlikte eklendi', eem206A.sessions.length === 2);
eq('BİL200 A-E şubesi seçildi', planA.placements.find(p => p.courseCode === 'BİL200')!.chosenGroup, 'A');
eq('çakışma yok', planA.conflicts.length, 0);

// Çakışma varsa başka gruba kayar
const planShift = buildSchedulePlan({
    courseCodes: ['EEM209', 'EEM206'], offerings: catalogue, preferredGroup: 'A'
});
eq('çakışan A yerine B grubuna geçildi',
    planShift.placements.find(p => p.courseCode === 'EEM206')!.chosenGroup, 'B');
eq('sonuçta çakışma kalmadı', planShift.conflicts.length, 0);

// Programda olmayan ders
const planMissing = buildSchedulePlan({ courseCodes: ['EEM999'], offerings: catalogue });
eq('açılmayan ders bildirildi', planMissing.placements[0].status, 'not_offered');

// ---------------------------------------------------------------------------
section('Sabit teorik saat vs seçmeli grup');

// EEM206: herkese ortak teorik + üç lab grubu.
const withGroups: ParsedOffering[] = [
    off({ courseCode: 'EEM206', day: 'Salı', startTime: '12:00', endTime: '13:00' }),
    off({ courseCode: 'EEM206', day: 'Pazartesi', startTime: '14:00', endTime: '16:00', groups: ['A'], section: 'A', type: 'lab', room: 'Lab' }),
    off({ courseCode: 'EEM206', day: 'Pazartesi', startTime: '16:00', endTime: '18:00', groups: ['B'], section: 'B', type: 'lab', room: 'Lab' }),
    off({ courseCode: 'EEM206', day: 'Çarşamba', startTime: '09:00', endTime: '11:00', groups: ['C'], section: 'C', type: 'lab', room: 'Lab' })
];

const groupPlan = buildSchedulePlan({ offerings: withGroups, courseCodes: ['EEM206'] });
const gp = groupPlan.placements[0];
eq('sabit teorik oturum ayrı tutuldu', gp.fixedSessions.length, 1);
eq('üç grup seçeneği listelendi', gp.options.length, 3);
check('tüm seçenekler uygun', gp.options.every(o => o.available));
check('seçenek saatleri okunur biçimde',
    gp.options[0].label.includes('Pzt') && gp.options[0].label.includes('14:00'),
    gp.options[0].label);
check('seçenek türü lab olarak işaretli', gp.options.every(o => o.type === 'lab'));
check('kaç grubun uygun olduğu mesajda', gp.message.includes('3/3'), gp.message);

// Öğrenci elle grup seçebilir
const manualPick = buildSchedulePlan({
    offerings: withGroups, courseCodes: ['EEM206'], groupChoices: { EEM206: 'C' }
});
eq('elle seçilen grup uygulandı', manualPick.placements[0].chosenGroup, 'C');

// Bir grup çakışırsa: o seçenek "uygun değil" işaretlenir, diğerine geçilir
const busyMonday: ParsedOffering[] = [
    ...withGroups,
    off({ courseCode: 'EEM301', day: 'Pazartesi', startTime: '14:00', endTime: '16:00' })
];
const shifted = buildSchedulePlan({
    offerings: busyMonday, courseCodes: ['EEM301', 'EEM206'], preferredGroup: 'A'
});
const shiftedPlacement = shifted.placements.find(p => p.courseCode === 'EEM206')!;
check('çakışan grup uygun değil olarak işaretlendi',
    shiftedPlacement.options.find(o => o.group === 'A')!.available === false);
check('çakışmayan gruplar hâlâ uygun',
    shiftedPlacement.options.filter(o => o.group !== 'A').every(o => o.available));
check('otomatik olarak uygun bir gruba geçildi',
    shiftedPlacement.chosenGroup !== 'A' && shiftedPlacement.status !== 'conflict',
    `${shiftedPlacement.chosenGroup}`);
eq('programda çakışma yok', shifted.conflicts.length, 0);

// SABİT teorik saat çakışırsa hiçbir grup kurtaramaz — esneklik yok
const fixedClash: ParsedOffering[] = [
    ...withGroups,
    off({ courseCode: 'EEM342', day: 'Salı', startTime: '12:00', endTime: '14:00' })
];
const hardConflict = buildSchedulePlan({
    offerings: fixedClash, courseCodes: ['EEM342', 'EEM206']
});
const hc = hardConflict.placements.find(p => p.courseCode === 'EEM206')!;
eq('sabit saat çakışması conflict', hc.status, 'conflict');
eq('çakışma türü "sabit"', hc.conflictKind, 'sabit');
check('mesaj değiştirilemezliği söylüyor', hc.message.includes('değiştirilemez'), hc.message);

// Aynı saate düşen gruplar TEK seçenekte birleşir — "(Class-A-E Groups)" gibi
// kayıtlar beş grubu aynı saatte toplar; bu bir seçim değildir.
const sharedHour: ParsedOffering[] = [
    off({ courseCode: 'BİL200', day: 'Salı', startTime: '16:00', endTime: '18:00', groups: ['A', 'B', 'C', 'D', 'E'], section: 'A-B-C-D-E' })
];
const sharedPlan = buildSchedulePlan({ offerings: sharedHour, courseCodes: ['BİL200'] });
const sp = sharedPlan.placements[0];
eq('aynı saatteki gruplar tek seçenekte birleşti', sp.options.length, 1);
eq('birleşen gruplar korundu', sp.options[0].groups.join(''), 'ABCDE');
eq('tek seçenek varsa seçim beklenmiyor', sp.status, 'placed');
check('mesaj seçim gerekmediğini söylüyor',
    sp.message.includes('Seçim gerektirmez'), sp.message);

// Teorik uygun ama TÜM gruplar dolu → farklı bir çakışma türü
const allGroupsBusy: ParsedOffering[] = [
    off({ courseCode: 'EEM206', day: 'Salı', startTime: '12:00', endTime: '13:00' }),
    off({ courseCode: 'EEM206', day: 'Pazartesi', startTime: '14:00', endTime: '16:00', groups: ['A'], section: 'A', type: 'lab' }),
    off({ courseCode: 'EEM206', day: 'Pazartesi', startTime: '15:00', endTime: '17:00', groups: ['B'], section: 'B', type: 'lab' }),
    off({ courseCode: 'EEM301', day: 'Pazartesi', startTime: '14:00', endTime: '17:00' })
];
const groupsBlocked = buildSchedulePlan({
    offerings: allGroupsBusy, courseCodes: ['EEM301', 'EEM206']
});
const gb = groupsBlocked.placements.find(p => p.courseCode === 'EEM206')!;
eq('grup kaynaklı çakışma türü', gb.conflictKind, 'grup');
check('mesaj teoriğin uygun olduğunu söylüyor', gb.message.includes('Teorik saati uygun'), gb.message);
check('yine de tüm seçenekler raporlandı', gb.options.length === 2);

// Grubu olmayan ders: seçim gerektirmez
const plainPlan = buildSchedulePlan({
    offerings: [off({ courseCode: 'EEM301', day: 'Salı', startTime: '09:00', endTime: '11:00' })],
    courseCodes: ['EEM301']
});
eq('grupsuz ders doğrudan yerleşti', plainPlan.placements[0].status, 'placed');
eq('seçenek yok', plainPlan.placements[0].options.length, 0);
check('mesaj seçim gerekmediğini söylüyor',
    plainPlan.placements[0].message.includes('Seçim gerektirmez'),
    plainPlan.placements[0].message);

// ---------------------------------------------------------------------------
section('Tekrar durumunda yerleştirme önceliği (Madde 19/5, 19/6, 10/2)');

const req = (code: string, priority: 1 | 2 | 3, planSemester: number | null, ects: number) => ({
    courseCode: code, priority, planSemester, ects,
    reason: 'test', regulation: priority === 1 ? 'Madde 19/5' : priority === 2 ? 'Madde 19/6' : 'Ders planı'
});

// Çakışan iki ders: kıt kaynak (saat aralığı) zorunlu tekrara gider.
const clash: ParsedOffering[] = [
    off({ courseCode: 'EEM301', day: 'Pazartesi', startTime: '09:00', endTime: '11:00' }),
    off({ courseCode: 'EEM209', day: 'Pazartesi', startTime: '10:00', endTime: '12:00' })
];
// Normal akış dersi listede ÖNCE gelse bile zorunlu tekrar önce yerleşmeli.
const priorityPlan = buildSchedulePlan({
    offerings: clash,
    courses: [req('EEM301', 3, 5, 6), req('EEM209', 1, 3, 7.5)]
});
eq('zorunlu tekrar yerleşti',
    priorityPlan.placements.find(p => p.courseCode === 'EEM209')!.status, 'placed');
eq('normal akış dersi yerleşemedi',
    priorityPlan.placements.find(p => p.courseCode === 'EEM301')!.status, 'conflict');
check('gerekçede çakıştığı ders yazıyor',
    priorityPlan.placements.find(p => p.courseCode === 'EEM301')!.message.includes('EEM209'));
eq('programda çakışma kalmadı', priorityPlan.conflicts.length, 0);
check('öncelik sırası listede korunuyor',
    priorityPlan.placements[0].courseCode === 'EEM209');

// İki zorunlu tekrar çakışırsa hiçbiri diğerini çıkaramaz; durum bildirilir.
const bothMandatory = buildSchedulePlan({
    offerings: clash,
    courses: [req('EEM209', 1, 3, 7.5), req('EEM301', 1, 5, 6)]
});
eq('ikinci zorunlu tekrar çakışma olarak bildirildi',
    bothMandatory.placements.find(p => p.courseCode === 'EEM301')!.status, 'conflict');
check('danışman uyarısı üretildi',
    bothMandatory.notes.some(n => n.includes('danışman')));

// Yarıyılı en küçük olan önce yerleşir (Madde 19/5).
const orderPlan = buildSchedulePlan({
    offerings: clash,
    courses: [req('EEM301', 1, 5, 6), req('EEM209', 1, 3, 7.5)]
});
eq('yarıyılı küçük olan yerleşti',
    orderPlan.placements.find(p => p.courseCode === 'EEM209')!.status, 'placed');

// AKTS sınırı: zorunlu tekrar, sınıra sığmak için normal akış dersini çıkarır.
const roomy: ParsedOffering[] = [
    off({ courseCode: 'EEM301', day: 'Salı', startTime: '09:00', endTime: '11:00' }),
    off({ courseCode: 'EEM209', day: 'Perşembe', startTime: '09:00', endTime: '11:00' })
];
const ectsPlan = buildSchedulePlan({
    offerings: roomy,
    ectsLimit: 10,
    courses: [req('EEM301', 3, 5, 6), req('EEM209', 1, 3, 7.5)]
});
eq('AKTS kotası zorunlu tekrara gitti',
    ectsPlan.placements.find(p => p.courseCode === 'EEM209')!.status, 'placed');
eq('normal akış dersi kotaya sığmadı',
    ectsPlan.placements.find(p => p.courseCode === 'EEM301')!.status, 'ects_limit');
check('toplam AKTS sınırı aşmadı', ectsPlan.totalEcts <= 10, `${ectsPlan.totalEcts}`);
check('AKTS notu üretildi', ectsPlan.notes.some(n => n.includes('AKTS')));

// Sınıra sığmayan düşük öncelikli ders açıkça bildirilir.
const overflow = buildSchedulePlan({
    offerings: roomy,
    ectsLimit: 8,
    courses: [req('EEM209', 1, 3, 7.5), req('EEM301', 3, 5, 6)]
});
eq('sığmayan ders ects_limit olarak işaretlendi',
    overflow.placements.find(p => p.courseCode === 'EEM301')!.status, 'ects_limit');
check('kalan kontenjan mesajda yazıyor',
    overflow.placements.find(p => p.courseCode === 'EEM301')!.message.includes('AKTS'));

// ---------------------------------------------------------------------------
section('Ortalama hedefi — birden çok alternatif');

const multi = buildTargetPlans(targetRecords, 3.0, targetCandidates);
check('birden çok plan üretildi', multi.length > 1, `${multi.length}`);
check('her planın etiketi var', multi.every(p => !!p.strategyLabel));
check('planlar birbirinden farklı',
    new Set(multi.map(p => p.steps.map(s => `${s.candidate.courseCode}:${s.requiredGrade}`).join('|'))).size === multi.length);
check('hedefe ulaşan planlar önce sıralandı',
    multi.every((p, i, arr) => i === 0 || Number(arr[i - 1].achievable) >= Number(p.achievable)));

const spread = multi.find(p => p.strategy === 'en-kolay-notlar');
const fewest = multi.find(p => p.strategy === 'en-az-ders');
if (spread && fewest) {
    check('"notlar düşük olsun" daha çok ders içeriyor',
        spread.steps.length >= fewest.steps.length,
        `${spread.steps.length} vs ${fewest.steps.length}`);
    const worst = (p: typeof spread) => Math.max(...p.steps.map(s => s.requiredCoefficient));
    check('"notlar düşük olsun" daha düşük not istiyor',
        worst(spread) <= worst(fewest), `${worst(spread)} vs ${worst(fewest)}`);
}

// "Notlar daha düşük olsun" gerçekten daha DÜŞÜK not istemeli ve hedefi
// gereksiz yere aşmamalı. Eski sürüm tam tersini yapıyordu: yükü en verimli
// derslere AA olarak yıkıp hedefi 0.70 aşıyordu.
const spreadRecords = parseTranscript(`2023-2024 Güz Dönemi
MAT1011  Calculus I  7.5  DD  7.50  Z
FİZ105   Physics I   6.0  CC  12.00  Z
EEM209   Circuit Analysis I  7.5  DC  9.75  Z
KİM1005  Chemistry   6.0  DD  6.00  Z
BİM122   Discrete    5.0  CD  8.50  Z`).records;
const spreadCands = buildCandidates(spreadRecords);

for (const hedef of [2.0, 2.5, 3.0]) {
    const list = buildTargetPlans(spreadRecords, hedef, spreadCands);
    const az = list.find(p => p.strategy === 'en-az-ders');
    const yay = list.find(p => p.strategy === 'en-kolay-notlar');
    if (!az || !yay) continue;

    const enZor = (p: typeof az) => Math.max(...p.steps.map(s => s.requiredCoefficient));
    check(`hedef ${hedef}: yayılmış plan daha düşük not istiyor`,
        enZor(yay) <= enZor(az), `${enZor(yay)} vs ${enZor(az)}`);
    check(`hedef ${hedef}: yayılmış plan hedefi aşırı geçmiyor`,
        yay.projectedGno <= hedef + 0.10, `sonuç ${yay.projectedGno}`);
    check(`hedef ${hedef}: yayılmış plan hedefi tutturuyor`,
        yay.projectedGno >= hedef - 0.005, `sonuç ${yay.projectedGno}`);
}

// Plandaki her adım gerçekten iyileştirme olmalı: mevcut notundan daha kötü
// ya da eşit bir not "plan adımı" olarak gösterilmemeli.
const planSteps = buildTargetPlans(spreadRecords, 2.5, spreadCands)
    .flatMap(p => p.steps.filter(s => s.candidate.kind === 'tekrar'));
check('hiçbir adım mevcut nottan kötü değil',
    planSteps.every(s => s.requiredCoefficient > (s.candidate.currentCoefficient ?? 0)),
    planSteps.filter(s => s.requiredCoefficient <= (s.candidate.currentCoefficient ?? 0))
        .map(s => `${s.candidate.courseCode}:${s.requiredGrade}`).join(','));

// Son adımın GNO'su planın gerçek sonucudur
for (const p of buildTargetPlans(spreadRecords, 2.5, spreadCands)) {
    if (!p.steps.length) continue;
    eq(`${p.strategy}: bildirilen sonuç son adımla tutarlı`,
        p.projectedGno, p.steps[p.steps.length - 1].gnoAfter);
}

// Kullanıcının uyguladığı ders AA olsa bile listede kalmalı (Madde 8/5 kilidi
// korunur ama kendi seçimi geri alınabilsin diye).
const aaRecords = parseTranscript(`2023-2024 Güz Dönemi
MAT1011  Calculus I  7.5  AA  30.00  Z
FİZ105   Physics I   6.0  CC  12.00  Z`).records;
check('AA alınan ders normalde aday değil',
    !buildCandidates(aaRecords).some(c => c.courseCode === 'MAT1011'));
check('kullanıcı uyguladıysa aday listesinde kalır',
    buildCandidates(aaRecords, { alwaysInclude: ['MAT1011'] }).some(c => c.courseCode === 'MAT1011'));

const onlyRetakes = multi.find(p => p.strategy === 'sadece-tekrar');
if (onlyRetakes) {
    check('"sadece tekrar" planında yeni ders yok',
        onlyRetakes.steps.every(s => s.candidate.kind === 'tekrar'));
}

// Haftalık ızgara
const weekly = buildWeeklyGrid(planA.sessions);
check('ızgarada Salı 12:00 dolu', weekly.cells['Salı']['12:00']?.offering.courseCode === 'EEM206');
eq('2 saatlik ders 2 dilim kaplıyor', weekly.cells['Pazartesi']['14:00']?.span, 2);

// ===========================================================================
console.log(`\n${'═'.repeat(64)}`);
console.log(`Toplam: ${passed + failed} · Başarılı: ${passed} · Başarısız: ${failed}`);
if (failed) {
    console.log('\nBaşarısız testler:');
    failures.forEach(f => console.log(`  · ${f}`));
    process.exit(1);
}
