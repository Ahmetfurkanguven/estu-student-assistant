import React from 'react';
import { AlertTriangle, CheckCircle2, RotateCcw } from 'lucide-react';
import type { AcademicStanding, RetakeItem } from '../utils/repeatRules';
import type { SemesterSnapshot } from '../utils/gpaCalculator';

interface Props {
    standing: AcademicStanding;
    retakes: RetakeItem[];
    history: SemesterSnapshot[];
}

const STAGE_STYLE = {
    normal: { box: 'bg-green-50 border-green-200', text: 'text-green-900', icon: CheckCircle2, title: 'Akademik durum normal' },
    uyari: { box: 'bg-amber-50 border-amber-200', text: 'text-amber-900', icon: AlertTriangle, title: 'Akademik yetersizlik uyarısı' },
    tekrar: { box: 'bg-red-50 border-red-200', text: 'text-red-900', icon: RotateCcw, title: 'Genişletilmiş ders tekrarı' }
} as const;

/**
 * Madde 19/6'nın üç aşamasını ve her aşamada ne yapılması gerektiğini gösterir.
 */
export function AcademicStandingPanel({ standing, retakes, history }: Props) {
    const style = STAGE_STYLE[standing.stage];
    const Icon = style.icon;

    const failed = retakes.filter(r => r.kind === 'basarisiz');
    const belowCC = retakes.filter(r => r.kind === 'cc_alti');

    return (
        <div className="space-y-4">
            <div className={`border rounded-lg p-4 ${style.box}`}>
                <div className={`flex items-center gap-2 font-semibold ${style.text}`}>
                    <Icon className="w-5 h-5" />
                    {style.title}
                    <span className="ml-auto text-sm font-normal">GNO {standing.gno.toFixed(2)}</span>
                </div>
                <ul className={`mt-3 space-y-1.5 text-sm ${style.text}`}>
                    {standing.explanation.map((line, i) => <li key={i}>• {line}</li>)}
                </ul>
            </div>

            {history.length > 0 && (
                <div className="bg-white rounded-lg shadow-md p-4">
                    <h3 className="font-semibold text-gray-800 mb-3">Dönem dönem durum</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-600">
                                <tr>
                                    <th className="text-left px-3 py-2">Dönem</th>
                                    <th className="text-right px-3 py-2">DNO</th>
                                    <th className="text-right px-3 py-2">GNO</th>
                                    <th className="text-right px-3 py-2">AKTS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map(s => (
                                    <tr key={s.label} className="border-t border-gray-100">
                                        <td className="px-3 py-2">{s.label}</td>
                                        <td className="px-3 py-2 text-right font-mono">{s.dno.toFixed(2)}</td>
                                        <td className={`px-3 py-2 text-right font-mono ${s.gno < 2 ? 'text-red-600 font-semibold' : ''}`}>
                                            {s.gno.toFixed(2)}
                                        </td>
                                        <td className="px-3 py-2 text-right">{s.ectsEarned.toFixed(1)}/{s.ectsTaken.toFixed(1)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {retakes.length > 0 && (
                <div className="bg-white rounded-lg shadow-md p-4">
                    <h3 className="font-semibold text-gray-800 mb-1">Tekrar edilmesi gereken dersler</h3>
                    <p className="text-xs text-gray-500 mb-3">
                        Yarıyılı en küçük olandan başlayarak sıralandı (Madde 19/5).
                    </p>

                    <RetakeTable title={`Başarısız dersler (FF/YZ/DZ) — ${failed.length}`} items={failed} />
                    {standing.stage === 'tekrar' && (
                        <RetakeTable
                            title={`CC altı dersler — ${belowCC.length}`}
                            items={belowCC}
                            note={`Yalnızca ${standing.warningSemester ?? 'uyarı'} döneminden itibaren alınan dersler kapsamdadır.`}
                        />
                    )}
                </div>
            )}
        </div>
    );
}

function RetakeTable({ title, items, note }: { title: string; items: RetakeItem[]; note?: string }) {
    if (!items.length) return null;
    return (
        <div className="mt-4 first:mt-0">
            <h4 className="text-sm font-medium text-gray-700">{title}</h4>
            {note && <p className="text-xs text-gray-500 mb-2">{note}</p>}
            <div className="overflow-x-auto mt-2">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                        <tr>
                            <th className="text-left px-3 py-2">Yarıyıl</th>
                            <th className="text-left px-3 py-2">Ders</th>
                            <th className="text-left px-3 py-2">Not</th>
                            <th className="text-left px-3 py-2">Gerekçe</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map(item => (
                            <tr key={`${item.courseCode}-${item.semester}`} className="border-t border-gray-100 align-top">
                                <td className="px-3 py-2 text-gray-500">{item.planSemester ?? '—'}</td>
                                <td className="px-3 py-2">
                                    <span className="font-mono">{item.courseCode}</span>
                                    <span className="block text-xs text-gray-500">{item.courseName}</span>
                                </td>
                                <td className="px-3 py-2 font-semibold">{item.grade}</td>
                                <td className="px-3 py-2 text-gray-600">
                                    {item.reason}
                                    <span className="block text-xs text-gray-400 mt-0.5">{item.regulation}</span>
                                    {item.canSubstitute && (
                                        <span className="block text-xs text-blue-600 mt-0.5">
                                            Danışman onayıyla aynı statüde başka bir ders alınabilir.
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
