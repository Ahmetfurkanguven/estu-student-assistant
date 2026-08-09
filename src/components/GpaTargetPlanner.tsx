import React, { useMemo, useState } from 'react';
import { Target, TrendingUp, AlertTriangle } from 'lucide-react';
import type { StudentRecord } from '../types';
import type { Course } from '../types';
import {
    computeBase, buildCandidates, projectCandidate, buildTargetPlans,
    COEFFICIENT_GRADES, suggestTarget, TARGET_THRESHOLDS, type TargetCandidate, type TargetPlan
} from '../utils/gpaTarget';

interface Props {
    records: StudentRecord[];
    /** Bölüm profilinden, henüz alınmamış dersler (yeni ders seçeneği için). */
    newCourseOptions?: Course[];
    /**
     * Not kutusuna tıklanınca senaryoya uygular.
     *
     * Buradaki tablo zaten "bu dersten şu notu alırsam GNO ne olur" sorusunu
     * yanıtlıyor; aynı kutuya tıklayıp senaryoya eklemek, listede zaten duran
     * bir dersi ayrıca elle girmeyi gereksiz kılar.
     */
    onApplyGrade?: (courseCode: string, grade: string) => void;
    /** Senaryoda o an geçerli olan notlar — seçili kutuyu işaretlemek için. */
    currentGrades?: Record<string, string>;
}

/**
 * "Hedef ortalamaya nasıl ulaşırım?" ekranı.
 *
 * İki soruyu ayrı ayrı yanıtlar:
 *   1. Hedefe ulaşmak için hangi dersleri tekrar almalıyım ve her birinden
 *      en az hangi notu almalıyım?  → plan
 *   2. Şu dersi bu dönem alırsam hangi not bana ne kazandırır? → not tablosu
 */
export function GpaTargetPlanner({ records, newCourseOptions = [], onApplyGrade, currentGrades }: Props) {
    // Hedef, öğrencinin durumuna göre OTOMATİK önerilir. Kullanıcı elle
    // değiştirene kadar öneriyi izler; değiştirdiği an kendi seçimi geçerli olur.
    const [manualTarget, setManualTarget] = useState<number | null>(null);
    const [includeNew, setIncludeNew] = useState(false);
    const [expanded, setExpanded] = useState<string | null>(null);

    const base = useMemo(() => computeBase(records), [records]);
    const suggestion = useMemo(() => suggestTarget(base.gno), [base.gno]);
    const target = manualTarget ?? suggestion.target;
    const setTarget = (v: number) => setManualTarget(v);
    const candidates = useMemo(
        () => buildCandidates(records, {
            newCourses: includeNew ? newCourseOptions : [],
            // Kullanıcının senaryoda uyguladığı dersler, AA verilse bile
            // listede kalsın — seçimini değiştirebilsin.
            alwaysInclude: Object.keys(currentGrades ?? {})
        }),
        [records, includeNew, newCourseOptions, currentGrades]
    );
    const plans = useMemo(
        () => buildTargetPlans(records, target, candidates),
        [records, target, candidates]
    );
    const [activePlan, setActivePlan] = useState(0);
    const [filter, setFilter] = useState('');

    /**
     * Adaylar iki gruba ayrılır: daha önce ALINMIŞ dersler (tekrar edilerek
     * notu değiştirilebilir) ve HİÇ ALINMAMIŞ dersler (ileride alınacak).
     *
     * Ders planının tamamı aday olabildiği için tek bir uzun liste seçimi
     * zorlaştırıyordu. Ayrım, öğrencinin "geçmişimi düzelteyim" ile
     * "geleceğimi planlayayım" niyetini ayırmasını sağlıyor.
     */
    const [kindFilter, setKindFilter] = useState<'all' | 'tekrar' | 'yeni'>('all');

    const visibleCandidates = useMemo(() => {
        const q = filter.trim().toLowerCase();
        return candidates.filter(c =>
            (!q || c.courseCode.toLowerCase().includes(q) || c.courseName.toLowerCase().includes(q)) &&
            (kindFilter === 'all' || c.kind === kindFilter));
    }, [candidates, filter, kindFilter]);

    const taken = visibleCandidates.filter(c => c.kind === 'tekrar');
    const untaken = visibleCandidates.filter(c => c.kind === 'yeni');
    const plan: TargetPlan = plans[Math.min(activePlan, plans.length - 1)] ?? plans[0];

    if (!records.length) return null;

    return (
        <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="flex items-center gap-2 font-semibold text-gray-800 mb-1">
                <Target className="w-5 h-5" />
                Ortalama hedefi
            </h3>
            <p className="text-xs text-gray-500 mb-4">
                Tekrar edilen derste eski not tamamen düşer, yeni not yerine geçer (Madde 19/3).
                AA veya YT alınmış dersler tekrar edilemez (Madde 8/5).
            </p>

            {/* Otomatik öneri — hedefi kullanıcının bulmasına gerek yok. */}
            <div className={`rounded-lg border p-3 mb-4 ${
                suggestion.critical ? 'bg-red-50 border-red-200' : 'bg-indigo-50 border-indigo-200'
            }`}>
                <p className={`text-sm ${suggestion.critical ? 'text-red-900' : 'text-indigo-900'}`}>
                    <strong>Önerilen hedef: {suggestion.target.toFixed(2)}</strong>
                    {manualTarget !== null && manualTarget !== suggestion.target && (
                        <span className="ml-2 text-xs opacity-80">
                            (şu an {target.toFixed(2)} ile hesaplanıyor)
                        </span>
                    )}
                </p>
                <p className={`text-xs mt-1 ${suggestion.critical ? 'text-red-800' : 'text-indigo-800'}`}>
                    {suggestion.reason}
                </p>

                {!suggestion.atCeiling && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className="text-xs text-gray-600 mr-1">Başka bir hedef:</span>
                        {TARGET_THRESHOLDS.filter(t => t > plan.currentGno).map(t => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setTarget(t)}
                                className={`px-2.5 py-1 rounded border text-xs font-mono transition-colors ${
                                    Math.abs(target - t) < 0.001
                                        ? 'border-indigo-500 bg-indigo-600 text-white'
                                        : 'border-gray-300 bg-white hover:bg-gray-50 text-gray-700'
                                }`}
                            >
                                {t.toFixed(2)}
                            </button>
                        ))}
                        {manualTarget !== null && (
                            <button
                                type="button"
                                onClick={() => setManualTarget(null)}
                                className="px-2.5 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 text-xs text-gray-600"
                            >
                                öneriye dön
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="flex flex-wrap items-end gap-4 mb-4">
                <div className="text-sm">
                    <span className="block text-gray-600 mb-1">Mevcut</span>
                    <span className="font-mono text-lg font-semibold">{plan.currentGno.toFixed(2)}</span>
                </div>
                <div className="text-sm">
                    <span className="block text-gray-600 mb-1">Hedef</span>
                    <span className="font-mono text-lg font-semibold text-indigo-700">{target.toFixed(2)}</span>
                </div>
                <div className="text-sm">
                    <span className="block text-gray-600 mb-1">Plan sonunda</span>
                    <span className={`font-mono text-lg font-semibold ${plan.achievable ? 'text-green-700' : 'text-red-700'}`}>
                        {plan.projectedGno.toFixed(2)}
                    </span>
                </div>
                {newCourseOptions.length > 0 && (
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                        <input type="checkbox" checked={includeNew} onChange={e => setIncludeNew(e.target.checked)} />
                        Yeni ders almayı da hesaba kat
                    </label>
                )}
            </div>

            {!plan.achievable && (
                <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-900 mb-4">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-medium">Bu hedef mevcut derslerle erişilemiyor.</p>
                        <p>Ulaşılabilecek en yüksek GNO: <strong>{plan.maxPossibleGno.toFixed(2)}</strong> (tüm dersler AA).</p>
                    </div>
                </div>
            )}

            {plans.length > 1 && (
                <div className="mb-4">
                    <p className="text-sm text-gray-600 mb-2">
                        Hedefe ulaşmanın birden çok yolu var — size uyanı seçin:
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {plans.map((p, i) => (
                            <button
                                key={p.strategy ?? i}
                                type="button"
                                onClick={() => setActivePlan(i)}
                                className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                                    i === activePlan
                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-900'
                                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                                }`}
                            >
                                <span className="font-medium block">{p.strategyLabel}</span>
                                <span className="text-xs opacity-80">
                                    {p.steps.length} ders · en zoru{' '}
                                    {/* Adımlar arasında GEREKEN EN YÜKSEK not — planın zorluğu bu. */}
                                    {p.steps.reduce((hardest, s) =>
                                        s.requiredCoefficient > hardest.requiredCoefficient ? s : hardest,
                                        p.steps[0]
                                    )?.requiredGrade ?? '—'}
                                    {!p.achievable && ' · hedefe ulaşmıyor'}
                                </span>
                            </button>
                        ))}
                    </div>
                    {plan.strategyNote && (
                        <p className="mt-2 text-xs text-gray-500">{plan.strategyNote}</p>
                    )}
                </div>
            )}

            {plan.steps.length > 0 && (
                <>
                    <h4 className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                        <TrendingUp className="w-4 h-4" />
                        {plan.strategyLabel ?? 'En kısa yol'} — {plan.steps.length} ders
                    </h4>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-600">
                                <tr>
                                    <th className="text-left px-3 py-2">Ders</th>
                                    <th className="text-center px-3 py-2">Şu an</th>
                                    <th className="text-center px-3 py-2">En az almalısın</th>
                                    <th className="text-right px-3 py-2">Sonra GNO</th>
                                </tr>
                            </thead>
                            <tbody>
                                {plan.steps.map(step => (
                                    <tr key={step.candidate.courseCode} className="border-t border-gray-100">
                                        <td className="px-3 py-2">
                                            <span className="font-mono">{step.candidate.courseCode}</span>
                                            <span className="block text-xs text-gray-500">
                                                {step.candidate.courseName} · {step.candidate.ects} AKTS
                                                {step.candidate.kind === 'yeni' && ' · yeni ders'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-center text-gray-500">
                                            {step.candidate.currentGrade ?? '—'}
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            <span className="inline-block px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-semibold">
                                                {step.requiredGrade}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono">{step.gnoAfter.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {plan.notes.length > 0 && (
                <ul className="mt-3 text-xs text-gray-500 space-y-1">
                    {plan.notes.map((n, i) => <li key={i}>• {n}</li>)}
                </ul>
            )}

            <details className="mt-5">
                <summary className="text-sm font-medium text-gray-700 cursor-pointer">
                    Tek tek: hangi dersten hangi notu alırsam ne olur? ({candidates.length} ders)
                </summary>

                {/* Liste eskiden ilk 25 derste kesiliyordu; "yeni ders almayı da
                    hesaba kat" seçilince ders planının tamamı aday olduğu için
                    çoğu ders hiç görünmüyordu. Artık hepsi listeleniyor, arama
                    ile daraltılıyor. */}
                {plan.currentGno >= target && (
                    <p className="mt-3 text-sm bg-green-50 border border-green-200 rounded p-3 text-green-900">
                        GNO'nuz ({plan.currentGno.toFixed(2)}) hedefin üzerinde — bu hedef için
                        hiçbir dersi tekrar almanız gerekmiyor. Aşağıdaki tablo yine de
                        "şu dersi tekrar alsam ne olurdu" sorusunu yanıtlar; daha yüksek bir
                        hedef girerek gerçek bir plan alabilirsiniz.
                    </p>
                )}

                <input
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    placeholder="Ders kodu veya adıyla süz…"
                    className="mt-3 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                />

                <div className="flex flex-wrap gap-1.5 mt-2">
                    {([
                        ['all', 'Hepsi', candidates.length],
                        ['tekrar', 'Daha önce aldıklarım', candidates.filter(c => c.kind === 'tekrar').length],
                        ['yeni', 'Henüz almadıklarım', candidates.filter(c => c.kind === 'yeni').length]
                    ] as const).map(([key, label, count]) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setKindFilter(key)}
                            disabled={count === 0}
                            className={`px-3 py-1.5 rounded-lg border text-xs transition-colors disabled:opacity-40 ${
                                kindFilter === key
                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-900 font-medium'
                                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                            }`}
                        >
                            {label} ({count})
                        </button>
                    ))}
                </div>

                <div className="mt-2 max-h-[28rem] overflow-y-auto space-y-4 pr-1">
                    {visibleCandidates.length === 0 && (
                        <p className="text-sm text-gray-500 py-2">Aramanıza uyan ders yok.</p>
                    )}

                    {([
                        ['Daha önce aldığınız dersler', taken,
                            'Tekrar alırsanız eski not tamamen düşer, yeni not yerine geçer (Madde 19/3).'],
                        ['Henüz almadığınız dersler', untaken,
                            'Yeni ders paydayı da büyütür; ortalamayı tekrar kadar hızlı yükseltmez.']
                    ] as const).map(([title, list, hint]) => list.length === 0 ? null : (
                        <div key={title}>
                            <div className="sticky top-0 bg-white pb-1 z-10">
                                <h5 className="text-xs font-semibold text-gray-700">
                                    {title} <span className="font-normal text-gray-400">({list.length})</span>
                                </h5>
                                <p className="text-[11px] text-gray-400">{hint}</p>
                            </div>
                            <div className="space-y-2 mt-1">
                                {list.map(candidate => (
                                    <CandidateRow
                                        key={candidate.courseCode + candidate.kind}
                                        candidate={candidate}
                                        base={base}
                                        target={target}
                                        open={expanded === candidate.courseCode}
                                        onToggle={() => setExpanded(expanded === candidate.courseCode ? null : candidate.courseCode)}
                                        onApplyGrade={onApplyGrade}
                                        appliedGrade={currentGrades?.[candidate.courseCode.toUpperCase()]}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </details>
        </div>
    );
}

function CandidateRow({
    candidate, base, target, open, onToggle, onApplyGrade, appliedGrade
}: {
    candidate: TargetCandidate;
    base: ReturnType<typeof computeBase>;
    target: number;
    open: boolean;
    onToggle: () => void;
    onApplyGrade?: (courseCode: string, grade: string) => void;
    appliedGrade?: string;
}) {
    const projection = useMemo(() => projectCandidate(base, candidate, target), [base, candidate, target]);

    return (
        <div className="border border-gray-200 rounded">
            <button type="button" onClick={onToggle} className="w-full flex items-center justify-between px-3 py-2 text-left text-sm">
                <span>
                    <span className="font-mono">{candidate.courseCode}</span>
                    <span className="text-gray-500 ml-2">{candidate.courseName}</span>
                </span>
                <span className="text-xs text-gray-500 shrink-0 ml-3">
                    {candidate.currentGrade ?? 'yeni'} · {candidate.ects} AKTS ·{' '}
                    {projection.alreadyOptimal
                        ? <span className="text-gray-400">yükseltme payı yok</span>
                        : projection.minimumSufficientGrade
                            ? <span className="text-green-700 font-medium">en az {projection.minimumSufficientGrade} almalısın</span>
                            : <span className="text-gray-400">tek başına yetmez</span>}
                </span>
            </button>

            {open && (
                <div className="px-3 pb-3">
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(74px,1fr))] gap-1.5">
                        {projection.outcomes.map(o => {
                            const selected = appliedGrade === o.letter;
                            const clickable = Boolean(onApplyGrade);
                            return (
                                <button
                                    key={o.letter}
                                    type="button"
                                    disabled={!clickable}
                                    onClick={() => onApplyGrade?.(candidate.courseCode, o.letter)}
                                    title={clickable
                                        ? `${candidate.courseCode} dersini ${o.letter} ile senaryoya uygula`
                                        : undefined}
                                    className={`text-center rounded px-2 py-1.5 text-xs border transition-colors ${
                                        selected
                                            ? 'bg-indigo-600 border-indigo-700 text-white font-semibold'
                                            : o.lowersGno
                                                // Ortalamayı düşüren not: seçilebilir ama tavsiye değil.
                                                ? 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100'
                                                : o.reachesTarget
                                                    ? 'bg-green-50 border-green-300 text-green-900 hover:bg-green-100'
                                                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                    } ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                                >
                                    <div className="font-semibold">{o.letter}</div>
                                    <div className="font-mono">{o.gno.toFixed(2)}</div>
                                    {selected
                                        ? <div className="text-[10px] mt-0.5">senaryoda</div>
                                        : o.lowersGno && <div className="text-[10px] mt-0.5">düşürür</div>}
                                </button>
                            );
                        })}
                    </div>
                    <p className="mt-2 text-xs text-gray-400">
                        Yeşil kutular {target.toFixed(2)} hedefini tek başına sağlayan notlardır.
                        Kırmızı kutular ortalamanızı <strong>düşürür</strong>: tekrar edilen dersin
                        en son notu geçerli olduğu için (Madde 19/3) mevcut notunuzdan kötü bir
                        not almak zarar verir.
                        {onApplyGrade && ' Bir nota tıklayınca ders o notla senaryoya işlenir.'}
                    </p>
                </div>
            )}
        </div>
    );
}
