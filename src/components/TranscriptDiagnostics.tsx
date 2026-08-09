import React, { useState } from 'react';
import { AlertCircle, AlertTriangle, ChevronDown, ChevronRight, Info } from 'lucide-react';
import type { TranscriptDiagnostic } from '../utils/transcriptParser';
import type { SupersededRecord } from '../utils/gpaCalculator';

interface Props {
    diagnostics: TranscriptDiagnostic[];
    superseded: SupersededRecord[];
}

const STYLES = {
    error: { icon: AlertCircle, box: 'bg-red-50 border-red-200 text-red-800', label: 'Hata' },
    warning: { icon: AlertTriangle, box: 'bg-amber-50 border-amber-200 text-amber-900', label: 'Uyarı' },
    info: { icon: Info, box: 'bg-blue-50 border-blue-200 text-blue-800', label: 'Bilgi' }
} as const;

/**
 * Transkript okunurken DİKKAT GEREKTİREN bir şey olduysa gösterilir.
 *
 * Sorunsuz okumada hiç çıkmaz. Öğrencinin işi transkriptini yüklemek, parser'ın
 * iç kararlarını denetlemek değil; her yüklemede tanı paneli göstermek gereksiz
 * gürültü. Ama okuma HATALI olduğunda ortalama da yanlış çıkar — bunu sessizce
 * geçmek çok daha kötüdür. Bu yüzden panel yalnızca hata ya da uyarı varken
 * görünür.
 *
 * Ortalamadan düşürülen dersler (tekrar / yerine) yalnızca panel açıldığında,
 * yani zaten bir sorun varken listelenir.
 */
export function TranscriptDiagnostics({ diagnostics, superseded }: Props) {
    const [open, setOpen] = useState(false);

    const errors = diagnostics.filter(d => d.level === 'error');
    const warnings = diagnostics.filter(d => d.level === 'warning');
    const infos = diagnostics.filter(d => d.level === 'info');

    // Sorunsuz okuma → kullanıcıya hiçbir şey gösterme.
    if (!errors.length && !warnings.length) return null;

    const headline = errors.length
        ? `${errors.length} satır okunamadı`
        : `${warnings.length} nokta kontrol edilmeli`;

    return (
        <div className={`rounded-lg shadow-md p-4 mb-4 border ${
            errors.length ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
        }`}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between text-left"
            >
                <span className={`font-semibold ${errors.length ? 'text-red-900' : 'text-amber-900'}`}>
                    {errors.length
                        ? 'Transkriptin bir kısmı okunamadı'
                        : 'Transkriptinizde kontrol etmeniz gereken noktalar var'}
                </span>
                <span className={`flex items-center gap-2 text-sm ${errors.length ? 'text-red-800' : 'text-amber-800'}`}>
                    {headline}
                    {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </span>
            </button>

            {!open && (
                <p className={`mt-1 text-sm ${errors.length ? 'text-red-800' : 'text-amber-800'}`}>
                    Ayrıntı için tıklayın — hangi satırın nasıl okunduğunu görebilirsiniz.
                </p>
            )}

            {open && (
                <div className="mt-4 space-y-4">
                    {[...errors, ...warnings, ...infos].map((d, i) => {
                        const style = STYLES[d.level];
                        const Icon = style.icon;
                        return (
                            <div key={i} className={`flex gap-2 border rounded-md p-3 text-sm ${style.box}`}>
                                <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                    <p>{d.message}</p>
                                    {d.line && (
                                        <pre className="mt-1 text-xs opacity-75 overflow-x-auto whitespace-pre-wrap break-all">
                                            {d.lineNumber ? `satır ${d.lineNumber}: ` : ''}{d.line}
                                        </pre>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {superseded.length > 0 && (
                        <div>
                            <h4 className="font-medium text-gray-800 mb-2">Ortalamadan düşürülen dersler</h4>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 text-gray-600">
                                        <tr>
                                            <th className="text-left px-3 py-2">Ders</th>
                                            <th className="text-left px-3 py-2">Not</th>
                                            <th className="text-left px-3 py-2">Dönem</th>
                                            <th className="text-left px-3 py-2">Neden</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {superseded.map((s, i) => (
                                            <tr key={i} className="border-t border-gray-100 align-top">
                                                <td className="px-3 py-2 font-mono">{s.record.courseCode}</td>
                                                <td className="px-3 py-2">{s.record.grade.letter}</td>
                                                <td className="px-3 py-2 whitespace-nowrap">{s.record.semester}</td>
                                                <td className="px-3 py-2 text-gray-600">{s.explanation}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
