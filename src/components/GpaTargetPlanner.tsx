import React, { useMemo, useState } from 'react';
import { Target, TrendingUp, AlertTriangle } from 'lucide-react';
import type { StudentRecord } from '../types';
import type { Course } from '../types';
import {
    computeBase, buildCandidates, projectCandidate, buildTargetPlans,
    COEFFICIENT_GRADES, type TargetCandidate, type TargetPlan
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
    const [target, setTarget] = useState(2.5);
    const [includeNew, setIncludeNew] = useState(false);
    const [expanded, setExpanded] = useState<string | null>(null);

    const base = useMemo(() => computeBase(records), [records]);
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

    const visibleCandidates = useMemo(() => {
        const q = filter.trim().toLowerCase();
        if (!q) return candidates;
        return candidates.filter(c =>
            c.courseCode.toLowerCase().includes(q) || c.courseName.toLowerCase().includes(q));
    }, [candidates, filter]);
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

            <div className="flex flex-wrap items-end gap-4 mb-4">
                <label className="text-sm">
                    <span className="block text-gray-600 mb-1">Hedef GNO</span>
                    <input
                        type="number" min={0} max={4} step={0.05} value={target}
                        onChange={e => setTarget(Math.min(4, Math.max(0, Number(e.target.value) || 0)))}
                        className="w-28 border border-gray-300 rounded px-2 py-1 font-mono"
                    />
                </label>
                <div className="text-sm">
                    <span className="block text-gray-600 mb-1">Mevcut</span>
                    <span className="font-mono text-lg font-semibold">{plan.currentGno.toFixed(2)}</span>
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
                <input
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    placeholder="Ders kodu veya adıyla süz…"
                    className="mt-3 w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                />

                <div className="mt-2 max-h-[28rem] overflow-y-auto space-y-2 pr-1">
                    {visibleCandidates.length === 0 && (
                        <p className="text-sm text-gray-500 py-2">Aramanıza uyan ders yok.</p>
                    )}
                    {visibleCandidates.map(candidate => (
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
                    {projection.minimumSufficientGrade
                        ? <span className="text-green-700 font-medium">tek başına {projection.minimumSufficientGrade} yeter</span>
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
                                            : o.reachesTarget
                                                ? 'bg-green-50 border-green-300 text-green-900 hover:bg-green-100'
                                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                    } ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                                >
                                    <div className="font-semibold">{o.letter}</div>
                                    <div className="font-mono">{o.gno.toFixed(2)}</div>
                                    {selected && <div className="text-[10px] mt-0.5">senaryoda</div>}
                                </button>
                            );
                        })}
                    </div>
                    <p className="mt-2 text-xs text-gray-400">
                        Yeşil kutular {target.toFixed(2)} hedefini tek başına sağlayan notlardır.
                        {onApplyGrade && ' Bir nota tıklayınca ders o notla senaryoya işlenir.'}
                        {' '}Toplam {COEFFICIENT_GRADES.length} harf notu (Madde 18/4).
                    </p>
                </div>
            )}
        </div>
    );
}
