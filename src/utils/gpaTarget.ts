import type { Course } from '../types';
import type { StudentRecord } from '../types';
import { GRADES, getGrade, isLockedFromRetake } from '../data/gradeSystem';

/**
 * "Hedef ortalamaya nasıl ulaşırım?" planlayıcısı.
 *
 * Dayanak — MADDE 19/3: "GNO hesaplanırken tekrar edilen zorunlu veya seçmeli
 * dersin EN SON notu ve kredisi ... esas alınır."
 * Yani bir ders tekrar edildiğinde eski not ortalamadan tamamen çıkar; yeni not
 * onun yerine geçer. Payda (toplam AKTS) değişmez.
 *
 * Yeni (daha önce alınmamış) bir ders eklendiğinde ise hem pay hem payda büyür.
 *
 * MADDE 8/5 gereği AA veya YT alınmış ders tekrar edilemez; bu dersler aday
 * listesine hiç girmez.
 */

/** Katsayılı notlar, yüksekten düşüğe. */
export const COEFFICIENT_GRADES = Object.values(GRADES)
    .filter(g => g.kind === 'coefficient' && g.coefficient !== null && !g.legacy)
    .sort((a, b) => (b.coefficient ?? 0) - (a.coefficient ?? 0));

export interface GpaBase {
    /** Σ(katsayı × AKTS) */
    weighted: number;
    /** Σ AKTS (ortalamaya giren dersler) */
    credits: number;
    gno: number;
}

export function computeBase(records: StudentRecord[]): GpaBase {
    let weighted = 0;
    let credits = 0;
    for (const r of records) {
        const g = getGrade(r.grade.letter);
        if (!g?.countsInGpa || g.coefficient === null) continue;
        weighted += g.coefficient * r.ects;
        credits += r.ects;
    }
    return { weighted, credits, gno: credits > 0 ? weighted / credits : 0 };
}

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Adaylar
// ---------------------------------------------------------------------------

export type CandidateKind = 'tekrar' | 'yeni';

export interface TargetCandidate {
    courseCode: string;
    courseName: string;
    ects: number;
    kind: CandidateKind;
    /** Tekrar adaylarında mevcut not. */
    currentGrade: string | null;
    currentCoefficient: number | null;
    /** AA alınırsa GNO'ya katkısı (puan). Sıralama için. */
    maxGain: number;
}

/**
 * Tekrar edilebilecek dersler: ortalamaya giren, AA/YT olmayan tüm dersler.
 * "Keyfi tekrar" (ortalama yükseltmek için) burada listelenir; zorunlu tekrar
 * ayrı bir konudur (bkz. repeatRules.determineRetakes).
 */
export function buildCandidates(
    records: StudentRecord[],
    options: {
        newCourses?: Course[];
        /**
         * Madde 8/5 kilidine (AA/YT tekrar edilemez) rağmen listede kalacak
         * ders kodları.
         *
         * Kullanıcı senaryoda bir derse AA verdiğinde ders kilitleniyor ve
         * listeden düşüyordu; böylece kendi seçimini değiştiremiyor ya da geri
         * alamıyordu. Kullanıcının uyguladığı dersler görünür kalmalı.
         */
        alwaysInclude?: string[];
    } = {}
): TargetCandidate[] {
    const base = computeBase(records);
    const candidates: TargetCandidate[] = [];
    const pinned = new Set((options.alwaysInclude ?? []).map(c => c.trim().toUpperCase()));

    for (const r of records) {
        const g = getGrade(r.grade.letter);
        if (!g?.countsInGpa || g.coefficient === null) continue;
        if (isLockedFromRetake(r.grade.letter) && !pinned.has(r.courseCode.trim().toUpperCase())) {
            continue; // Madde 8/5
        }

        // Tekrar: payda sabit, pay (4.00 - mevcut) × AKTS kadar artabilir.
        const gain = base.credits > 0 ? ((4.0 - g.coefficient) * r.ects) / base.credits : 0;
        candidates.push({
            courseCode: r.courseCode,
            courseName: r.courseName || r.courseCode,
            ects: r.ects,
            kind: 'tekrar',
            currentGrade: r.grade.letter,
            currentCoefficient: g.coefficient,
            maxGain: gain
        });
    }

    for (const c of options.newCourses ?? []) {
        const denom = base.credits + c.ects;
        const gain = denom > 0 ? (base.weighted + 4.0 * c.ects) / denom - base.gno : 0;
        candidates.push({
            courseCode: c.code,
            courseName: c.name,
            ects: c.ects,
            kind: 'yeni',
            currentGrade: null,
            currentCoefficient: null,
            maxGain: gain
        });
    }

    return candidates.sort((a, b) => b.maxGain - a.maxGain);
}

// ---------------------------------------------------------------------------
// Tek ders senaryosu
// ---------------------------------------------------------------------------

export interface GradeOutcome {
    letter: string;
    coefficient: number;
    /** Bu not alınırsa oluşacak GNO. */
    gno: number;
    /** Hedefe ulaşır mı. */
    reachesTarget: boolean;
}

export interface CandidateProjection {
    candidate: TargetCandidate;
    outcomes: GradeOutcome[];
    /** Hedefe TEK BAŞINA ulaştıran en düşük not; yoksa null. */
    minimumSufficientGrade: string | null;
    /** Bu ders AA ile bile hedefe yetmiyorsa true. */
    insufficientAlone: boolean;
}

function applyOne(base: GpaBase, candidate: TargetCandidate, coefficient: number): GpaBase {
    if (candidate.kind === 'tekrar') {
        // Madde 19/3: eski not düşer, yenisi yerine geçer; payda değişmez.
        const weighted = base.weighted - (candidate.currentCoefficient ?? 0) * candidate.ects + coefficient * candidate.ects;
        return { weighted, credits: base.credits, gno: base.credits > 0 ? weighted / base.credits : 0 };
    }
    const weighted = base.weighted + coefficient * candidate.ects;
    const credits = base.credits + candidate.ects;
    return { weighted, credits, gno: credits > 0 ? weighted / credits : 0 };
}

export function projectCandidate(
    base: GpaBase,
    candidate: TargetCandidate,
    target: number
): CandidateProjection {
    const outcomes: GradeOutcome[] = COEFFICIENT_GRADES.map(g => {
        const next = applyOne(base, candidate, g.coefficient!);
        return {
            letter: g.letter,
            coefficient: g.coefficient!,
            gno: round2(next.gno),
            reachesTarget: round2(next.gno) >= target
        };
    });

    const sufficient = [...outcomes].reverse().find(o => o.reachesTarget);

    return {
        candidate,
        outcomes,
        minimumSufficientGrade: sufficient?.letter ?? null,
        insufficientAlone: !outcomes.some(o => o.reachesTarget)
    };
}

// ---------------------------------------------------------------------------
// Çoklu ders planı
// ---------------------------------------------------------------------------

export interface PlanStep {
    candidate: TargetCandidate;
    /** Bu derste hedeflenmesi gereken en düşük not. */
    requiredGrade: string;
    requiredCoefficient: number;
    /** Bu adım uygulandıktan sonraki GNO. */
    gnoAfter: number;
}

export type PlanStrategy = 'en-az-ders' | 'en-kolay-notlar' | 'sadece-tekrar' | 'en-dusuk-notlar';

export interface TargetPlan {
    /** Bu planın hangi yaklaşımla kurulduğu. */
    strategy?: PlanStrategy;
    strategyLabel?: string;
    strategyNote?: string;
    target: number;
    currentGno: number;
    achievable: boolean;
    /** Hedefe ulaşmak için gereken en küçük ders kümesi. */
    steps: PlanStep[];
    /** Plan tamamlandığında oluşacak GNO. */
    projectedGno: number;
    /** Tüm adaylar AA alınsa ulaşılabilecek en yüksek GNO. */
    maxPossibleGno: number;
    notes: string[];
}

/**
 * Hedefe ulaştıran en küçük ders kümesini bulur.
 *
 * Strateji: dersleri "AA alınırsa sağlayacağı kazanç" sırasına koy, hedefe
 * ulaşana kadar ekle (hepsi AA varsayımıyla). Sonra sondan başlayarak her
 * dersin notunu hedefi bozmadan düşürebildiğin kadar düşür — böylece
 * "en az hangi notu almalıyım" sorusunun cevabı çıkar.
 */
/**
 * Hedefe ulaştıran BİRDEN ÇOK alternatif üretir.
 *
 * Tek bir "en kısa yol" çoğu zaman yeterli değildir: en verimli ders o dönem
 * açılmamış olabilir, öğrenci o dersi tekrar almak istemeyebilir ya da daha
 * çok derse yayıp her birinden daha düşük not hedeflemeyi tercih edebilir.
 * Bu yüzden farklı yaklaşımlarla kurulmuş planlar döner; aynı sonuca çıkanlar
 * elenir.
 */
export function buildTargetPlans(
    records: StudentRecord[],
    target: number,
    candidates: TargetCandidate[],
    options: { maxCourses?: number } = {}
): TargetPlan[] {
    const strategies: Array<{
        id: PlanStrategy; label: string; note: string;
        pick: (all: TargetCandidate[]) => TargetCandidate[];
        maxCourses?: number;
    }> = [
        {
            id: 'en-az-ders',
            label: 'En az ders',
            note: 'Ortalamayı en hızlı yükselten dersler. En az sayıda ders, ama her birinden yüksek not gerekir.',
            pick: all => all
        },
        {
            id: 'en-kolay-notlar',
            label: 'Notlar daha düşük olsun',
            note: 'Yük daha çok derse yayılır; her bir dersten beklenen not düşer, karşılığında ders sayısı artar.',
            pick: all => all,
            maxCourses: (options.maxCourses ?? 8) + 4
        },
        {
            id: 'sadece-tekrar',
            label: 'Sadece tekrar',
            note: 'Yalnızca daha önce alınmış dersler. Yeni ders eklenmez; payda büyümez.',
            pick: all => all.filter(c => c.kind === 'tekrar')
        },
        {
            id: 'en-dusuk-notlar',
            label: 'En düşük notlardan başla',
            note: 'En zayıf notlu derslerden başlanır. Yükseltme payı en büyük olan dersler.',
            pick: all => [...all].sort((a, b) =>
                (a.currentCoefficient ?? 99) - (b.currentCoefficient ?? 99) || b.ects - a.ects)
        }
    ];

    const plans: TargetPlan[] = [];
    const seen = new Set<string>();

    for (const s of strategies) {
        const pool = s.pick(candidates);
        if (!pool.length) continue;

        const plan = buildTargetPlan(records, target, pool, {
            maxCourses: s.maxCourses ?? options.maxCourses,
            spread: s.id === 'en-kolay-notlar'
        });

        // Aynı ders kümesi + aynı notlar → yinelenen plan, gösterme.
        const key = plan.steps.map(x => `${x.candidate.courseCode}:${x.requiredGrade}`).join('|');
        if (!plan.steps.length || seen.has(key)) continue;
        seen.add(key);

        plans.push({ ...plan, strategy: s.id, strategyLabel: s.label, strategyNote: s.note });
    }

    // Hiçbiri hedefe ulaşmıyorsa yine de en iyisini göster.
    if (!plans.length) {
        const fallback = buildTargetPlan(records, target, candidates, options);
        return [{ ...fallback, strategy: 'en-az-ders', strategyLabel: 'En az ders', strategyNote: '' }];
    }

    // Hedefe ulaşanlar önce, sonra az dersli olan.
    return plans.sort((a, b) =>
        Number(b.achievable) - Number(a.achievable) || a.steps.length - b.steps.length);
}

export function buildTargetPlan(
    records: StudentRecord[],
    target: number,
    candidates: TargetCandidate[],
    options: { maxCourses?: number; spread?: boolean } = {}
): TargetPlan {
    const base = computeBase(records);
    const currentGno = round2(base.gno);
    const notes: string[] = [];
    const maxCourses = options.maxCourses ?? 8;

    if (currentGno >= target) {
        return {
            target, currentGno, achievable: true, steps: [], projectedGno: currentGno,
            maxPossibleGno: currentGno,
            notes: [`Mevcut GNO'nuz (${currentGno.toFixed(2)}) zaten hedefin üzerinde.`]
        };
    }

    // Tüm adaylar AA ile alınırsa ulaşılabilecek tavan
    let ceiling = base;
    for (const c of candidates) ceiling = applyOne(ceiling, c, 4.0);
    const maxPossibleGno = round2(ceiling.gno);

    // 1) Hedefe ulaşana kadar en verimli dersleri AA varsayımıyla ekle.
    //
    // `spread` açıkken hedefe ulaşıldıktan sonra da ders eklenmeye devam edilir:
    // yük daha çok derse dağıldığı için 2. adımdaki not düşürme her dersten
    // beklenen notu aşağı çeker. "Az ders ama yüksek not" yerine "çok ders ama
    // düşük not" isteyen öğrenci için.
    const chosen: TargetCandidate[] = [];
    let running = base;
    for (const c of candidates) {
        if (chosen.length >= maxCourses) break;
        if (round2(running.gno) >= target && !options.spread) break;
        chosen.push(c);
        running = applyOne(running, c, 4.0);
    }

    const achievable = round2(running.gno) >= target;
    if (!achievable) {
        notes.push(
            `Seçilebilecek ${candidates.length} dersin tamamı AA ile alınsa bile ulaşılabilecek ` +
            `en yüksek GNO ${maxPossibleGno.toFixed(2)}. Hedef bu dönem için erişilemiyor.`
        );
        if (chosen.length >= maxCourses) {
            notes.push(`Plan en fazla ${maxCourses} dersle sınırlandı.`);
        }
    }

    // 2) Sondan başlayarak notları hedefi bozmadan düşür
    const assigned = new Map<string, number>(chosen.map(c => [c.courseCode, 4.0]));

    const gnoWith = (coefficients: Map<string, number>): number => {
        let state = base;
        for (const c of chosen) state = applyOne(state, c, coefficients.get(c.courseCode) ?? 4.0);
        return round2(state.gno);
    };

    if (achievable) {
        for (let i = chosen.length - 1; i >= 0; i--) {
            const c = chosen[i];
            for (const g of [...COEFFICIENT_GRADES].reverse()) { // düşükten yükseğe
                const trial = new Map(assigned);
                trial.set(c.courseCode, g.coefficient!);
                if (gnoWith(trial) >= target) { assigned.set(c.courseCode, g.coefficient!); break; }
            }
        }
    }

    // 3) Adımları sırayla üret
    const steps: PlanStep[] = [];
    let state = base;
    for (const c of chosen) {
        const coefficient = assigned.get(c.courseCode) ?? 4.0;
        const grade = COEFFICIENT_GRADES.find(g => g.coefficient === coefficient);
        state = applyOne(state, c, coefficient);
        steps.push({
            candidate: c,
            requiredGrade: grade?.letter ?? 'AA',
            requiredCoefficient: coefficient,
            gnoAfter: round2(state.gno)
        });
    }

    // Katkısı sıfır olan adımları at (nota gerek yokmuş)
    const trimmed = steps.filter((s, i) => i === 0 || s.gnoAfter > steps[i - 1].gnoAfter);

    if (trimmed.some(s => s.candidate.kind === 'tekrar')) {
        notes.push('Tekrar edilen derste eski not tamamen düşer, yeni not yerine geçer (Madde 19/3).');
    }
    if (trimmed.some(s => s.candidate.kind === 'yeni')) {
        notes.push('Yeni ders eklemek paydayı da büyüttüğü için ortalamayı tekrar kadar hızlı yükseltmez.');
    }

    return {
        target,
        currentGno,
        achievable,
        steps: trimmed,
        projectedGno: trimmed.length ? trimmed[trimmed.length - 1].gnoAfter : currentGno,
        maxPossibleGno,
        notes
    };
}
