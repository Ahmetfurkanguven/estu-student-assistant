import React from 'react';
import { ListChecks } from 'lucide-react';
import type { ProposalResult } from '../utils/courseSelectionRules';
import type { TermType } from '../utils/repeatRules';

interface Props {
    result: ProposalResult | null;
    term: TermType;
    onTermChange: (term: TermType) => void;
    doubleMajor: boolean;
    onDoubleMajorChange: (value: boolean) => void;
    disabledReason?: string;
}

const PRIORITY_LABEL: Record<number, { text: string; className: string }> = {
    1: { text: 'Zorunlu tekrar', className: 'bg-red-100 text-red-800' },
    2: { text: 'Yetersizlik tekrarı', className: 'bg-amber-100 text-amber-800' },
    3: { text: 'Normal akış', className: 'bg-blue-100 text-blue-800' }
};

/**
 * Ders önerisi motorunun çıktısı.
 * (Bu motor kodda mevcuttu ama arayüze hiç bağlanmamıştı.)
 */
export function CourseProposalPanel({
    result, term, onTermChange, doubleMajor, onDoubleMajorChange, disabledReason
}: Props) {
    return (
        <div className="bg-white rounded-lg shadow-md p-4">
            <h3 className="flex items-center gap-2 font-semibold text-gray-800 mb-3">
                <ListChecks className="w-5 h-5" />
                Ders önerisi
            </h3>

            <div className="flex flex-wrap items-center gap-4 mb-4 text-sm">
                <label className="flex items-center gap-2">
                    <span className="text-gray-600">Dönem:</span>
                    <select
                        className="border border-gray-300 rounded px-2 py-1"
                        value={term}
                        onChange={e => onTermChange(e.target.value as TermType)}
                    >
                        <option value="guz">Güz</option>
                        <option value="bahar">Bahar</option>
                        <option value="yaz">Yaz okulu</option>
                    </select>
                </label>
                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={doubleMajor}
                        onChange={e => onDoubleMajorChange(e.target.checked)}
                    />
                    <span className="text-gray-600">Çift anadal (60 AKTS)</span>
                </label>
            </div>

            {disabledReason && (
                <p className="text-sm text-gray-500">{disabledReason}</p>
            )}

            {result && (
                <>
                    <div className="flex items-baseline gap-2 mb-3">
                        <span className="text-2xl font-bold text-gray-900">{result.totalEcts.toFixed(1)}</span>
                        <span className="text-sm text-gray-500">/ {result.ectsLimit} AKTS — {result.ectsLimitNote}</span>
                    </div>

                    {result.proposal.length === 0 ? (
                        <p className="text-sm text-gray-500">Önerilecek ders bulunamadı.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-600">
                                    <tr>
                                        <th className="text-left px-3 py-2">Ders</th>
                                        <th className="text-right px-3 py-2">AKTS</th>
                                        <th className="text-left px-3 py-2">Öncelik</th>
                                        <th className="text-left px-3 py-2">Gerekçe</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.proposal.map(p => {
                                        const badge = PRIORITY_LABEL[p.priority];
                                        return (
                                            <tr key={p.course.code} className="border-t border-gray-100 align-top">
                                                <td className="px-3 py-2">
                                                    <span className="font-mono">{p.course.code}</span>
                                                    <span className="block text-xs text-gray-500">{p.course.name}</span>
                                                </td>
                                                <td className="px-3 py-2 text-right">{p.course.ects}</td>
                                                <td className="px-3 py-2">
                                                    <span className={`inline-block px-2 py-0.5 rounded text-xs ${badge.className}`}>
                                                        {badge.text}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 text-gray-600">
                                                    {p.reason}
                                                    <span className="block text-xs text-gray-400 mt-0.5">{p.regulation}</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {result.deferred.length > 0 && (
                        <details className="mt-4">
                            <summary className="text-sm text-gray-600 cursor-pointer">
                                AKTS sınırına sığmayan {result.deferred.length} ders
                            </summary>
                            <ul className="mt-2 text-sm text-gray-500 space-y-1">
                                {result.deferred.map(p => (
                                    <li key={p.course.code}>
                                        <span className="font-mono">{p.course.code}</span> — {p.course.name} ({p.course.ects} AKTS)
                                    </li>
                                ))}
                            </ul>
                        </details>
                    )}

                    {result.logs.length > 0 && (
                        <details className="mt-3">
                            <summary className="text-sm text-gray-600 cursor-pointer">
                                Karar günlüğü ({result.logs.length})
                            </summary>
                            <ul className="mt-2 text-xs text-gray-500 space-y-1">
                                {result.logs.map((log, i) => <li key={i}>{log}</li>)}
                            </ul>
                        </details>
                    )}
                </>
            )}
        </div>
    );
}
