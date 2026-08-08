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
import { computeBase, buildCandidates, projectCandidate, buildTargetPlan } from '../src/utils/gpaTarget';
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
