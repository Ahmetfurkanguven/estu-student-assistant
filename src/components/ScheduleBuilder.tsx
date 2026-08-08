import React, { useMemo, useRef, useState } from 'react';
import { Upload, CalendarDays, AlertCircle, CheckCircle2, Wand2 } from 'lucide-react';
import type { ParsedOffering, ScheduleParseDiagnostic } from '../utils/schedulePdfParser';
import { parseSchedulePdf, readSchedulePdf } from '../utils/schedulePdfParser';
import { buildSchedulePlan, buildWeeklyGrid, groupOfferings } from '../utils/schedulePlanner';
import type { ProposedCourse } from '../utils/courseSelectionRules';
import type { RetakeItem } from '../utils/repeatRules';

interface Props {
    /** Bölüm profilindeki ders kodları — ders/derslik ayrımını kesinleştirir. */
    knownCourseCodes: string[];
    /** Motorun önerdiği dersler (zorunlu tekrarlar başta). */
    proposal: ProposedCourse[];
    retakes: RetakeItem[];
}

const DAY_COLORS = [
    'bg-indigo-100 border-indigo-300 text-indigo-900',
    'bg-emerald-100 border-emerald-300 text-emerald-900',
    'bg-amber-100 border-amber-300 text-amber-900',
    'bg-sky-100 border-sky-300 text-sky-900',
    'bg-rose-100 border-rose-300 text-rose-900',
    'bg-violet-100 border-violet-300 text-violet-900'
];

/**
 * Okulun yayımladığı ders programı PDF'ini yükleyip, öğrencinin durumuna göre
 * haftalık program kuran ekran.
 *
 * Teorik ("All Groups") oturumlar koşulsuz eklenir; laboratuvar/şube
 * oturumlarında yalnızca öğrencinin grubu eklenir.
 */
export function ScheduleBuilder({ knownCourseCodes, proposal, retakes }: Props) {
    const [offerings, setOfferings] = useState<ParsedOffering[]>([]);
    const [diagnostics, setDiagnostics] = useState<ScheduleParseDiagnostic[]>([]);
    const [availableGroups, setAvailableGroups] = useState<string[]>([]);
    const [preferredGroup, setPreferredGroup] = useState<string>('');
    const [selected, setSelected] = useState<string[]>([]);
    const [groupChoices, setGroupChoices] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const catalogue = useMemo(() => groupOfferings(offerings), [offerings]);

    const plan = useMemo(
        () => buildSchedulePlan({
            courseCodes: selected,
            offerings,
            preferredGroup: preferredGroup || null,
            groupChoices
        }),
        [selected, offerings, preferredGroup, groupChoices]
    );

    const grid = useMemo(() => buildWeeklyGrid(plan.sessions), [plan.sessions]);

    /** rowSpan ile kaplanan hücreler tekrar <td> basılmamalı. */
    const covered = useMemo(() => {
        const set = new Set<string>();
        for (const day of grid.days) {
            grid.slots.forEach((slot, i) => {
                const cell = grid.cells[day][slot];
                if (!cell) return;
                for (let k = 1; k < cell.span; k++) {
                    const next = grid.slots[i + k];
                    if (next) set.add(`${day}|${next}`);
                }
            });
        }
        return set;
    }, [grid]);

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = '';
        setBusy(true);
        try {
            const items = await readSchedulePdf(file);
            const result = parseSchedulePdf(items, { knownCourseCodes });
            setOfferings(result.offerings);
            setDiagnostics(result.diagnostics);
            setAvailableGroups(result.availableGroups);
            setSelected([]);
            setGroupChoices({});
        } catch (err) {
            setDiagnostics([{ level: 'error', code: 'READ_FAILED', message: `PDF okunamadı: ${(err as Error).message}` }]);
        } finally {
            setBusy(false);
        }
    }

    /** Zorunlu tekrarlar + önerilen dersleri, programda açık olanlarla sınırlayarak ekler. */
    function autoFill() {
        const wanted = [
            ...retakes.map(r => r.courseCode),
            ...proposal.map(p => p.course.code)
        ];
        const seen = new Set<string>();
        const available = wanted
            .map(c => c.toUpperCase())
            .filter(c => {
                if (seen.has(c) || !catalogue.has(c)) return false;
                seen.add(c);
                return true;
            });
        setSelected(available);
    }

    function toggle(code: string) {
        setSelected(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
    }

    const problems = diagnostics.filter(d => d.level !== 'info');

    return (
        <div className="space-y-4">
            {/* ---- Yükleme ---- */}
            <div className="bg-white rounded-lg shadow-md p-4">
                <h3 className="flex items-center gap-2 font-semibold text-gray-800 mb-3">
                    <CalendarDays className="w-5 h-5" />
                    Ders programı oluştur
                </h3>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-700">Bölümün yayımladığı haftalık ders programı PDF'ini yükleyin</p>
                    <input ref={fileRef} type="file" accept=".pdf" onChange={handleUpload} className="hidden" id="scheduleFile" />
                    <label
                        htmlFor="scheduleFile"
                        className="mt-3 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer text-sm"
                    >
                        {busy ? 'Okunuyor…' : 'PDF Seç'}
                    </label>
                </div>

                {diagnostics.length > 0 && (
                    <div className="mt-3 space-y-1 text-xs">
                        {diagnostics.map((d, i) => (
                            <p key={i} className={
                                d.level === 'error' ? 'text-red-700'
                                    : d.level === 'warning' ? 'text-amber-700' : 'text-gray-500'
                            }>
                                {d.level === 'info' ? 'ℹ️' : d.level === 'warning' ? '⚠️' : '⛔'} {d.message}
                            </p>
                        ))}
                    </div>
                )}
            </div>

            {offerings.length > 0 && (
                <>
                    {/* ---- Grup ve otomatik doldurma ---- */}
                    <div className="bg-white rounded-lg shadow-md p-4">
                        <div className="flex flex-wrap items-end gap-4">
                            <label className="text-sm">
                                <span className="block text-gray-600 mb-1">Şube / grubunuz</span>
                                <select
                                    className="border border-gray-300 rounded px-2 py-1"
                                    value={preferredGroup}
                                    onChange={e => setPreferredGroup(e.target.value)}
                                >
                                    <option value="">Farketmez</option>
                                    {availableGroups.map(g => <option key={g} value={g}>{g}</option>)}
                                </select>
                            </label>

                            <button
                                type="button"
                                onClick={autoFill}
                                disabled={!proposal.length && !retakes.length}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:bg-gray-300"
                            >
                                <Wand2 className="w-4 h-4" />
                                Zorunlu ve önerilen dersleri otomatik yerleştir
                            </button>

                            {selected.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => { setSelected([]); setGroupChoices({}); }}
                                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                                >
                                    Temizle
                                </button>
                            )}
                        </div>

                        {!proposal.length && !retakes.length && (
                            <p className="mt-2 text-xs text-gray-500">
                                Otomatik yerleştirme için önce transkript yükleyip bölüm seçin.
                            </p>
                        )}
                    </div>

                    {/* ---- Ders seçimi ---- */}
                    <div className="bg-white rounded-lg shadow-md p-4">
                        <h4 className="font-medium text-gray-800 mb-1">
                            Programdaki dersler ({catalogue.size})
                        </h4>
                        <p className="text-xs text-gray-500 mb-3">
                            Teorik oturumlar tüm gruplara açıktır ve otomatik eklenir; laboratuvar/şube
                            oturumlarında yalnızca sizin grubunuz eklenir.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto">
                            {[...catalogue.values()].map(entry => {
                                const isSelected = selected.includes(entry.courseCode);
                                const placement = plan.placements.find(p => p.courseCode === entry.courseCode);
                                return (
                                    <label
                                        key={entry.courseCode}
                                        className={`flex items-start gap-2 p-2 rounded border cursor-pointer text-sm ${
                                            isSelected ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggle(entry.courseCode)}
                                            className="mt-0.5"
                                        />
                                        <span className="min-w-0">
                                            <span className="font-mono">{entry.courseCode}</span>
                                            <span className="block text-xs text-gray-500 truncate">{entry.courseName}</span>
                                            {entry.availableGroups.length > 0 && (
                                                <span className="block text-xs text-gray-400">
                                                    Gruplar: {entry.availableGroups.join(', ')}
                                                </span>
                                            )}
                                            {isSelected && placement?.status === 'conflict' && (
                                                <span className="block text-xs text-red-600 mt-0.5">{placement.message}</span>
                                            )}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>

                    {/* ---- Grup seçimleri ---- */}
                    {plan.placements.some(p => p.availableGroups.length > 1 && p.sessions.length > 0) && (
                        <div className="bg-white rounded-lg shadow-md p-4">
                            <h4 className="font-medium text-gray-800 mb-3">Grup seçimleri</h4>
                            <div className="space-y-2">
                                {plan.placements
                                    .filter(p => p.availableGroups.length > 1 && p.sessions.length > 0)
                                    .map(p => (
                                        <div key={p.courseCode} className="flex flex-wrap items-center gap-3 text-sm">
                                            <span className="font-mono w-24">{p.courseCode}</span>
                                            <select
                                                className="border border-gray-300 rounded px-2 py-1"
                                                value={groupChoices[p.courseCode] ?? p.chosenGroup ?? ''}
                                                onChange={e => setGroupChoices(prev => ({ ...prev, [p.courseCode]: e.target.value }))}
                                            >
                                                {p.availableGroups.map(g => <option key={g} value={g}>{g} grubu</option>)}
                                            </select>
                                            <span className="text-xs text-gray-500">{p.message}</span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}

                    {/* ---- Çakışmalar ---- */}
                    {selected.length > 0 && (
                        <div className="bg-white rounded-lg shadow-md p-4">
                            <h4 className="font-medium text-gray-800 mb-3">Çakışma analizi</h4>
                            {plan.conflicts.length === 0 ? (
                                <p className="flex items-center gap-2 text-sm text-green-800 bg-green-50 border border-green-200 rounded p-3">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Çakışma yok — {plan.sessions.length} oturum yerleşti.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {plan.conflicts.map((c, i) => (
                                        <div key={i} className="flex gap-2 bg-red-50 border border-red-200 rounded p-3 text-sm text-red-900">
                                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="font-medium">{c.courses.join(' ↔ ')}</p>
                                                <p className="text-xs">{c.day} {c.time} — {c.detail}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ---- Haftalık ızgara ---- */}
                    {plan.sessions.length > 0 && (
                        <div className="bg-white rounded-lg shadow-md p-4">
                            <h4 className="font-medium text-gray-800 mb-3">Haftalık program</h4>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs border-collapse">
                                    <thead>
                                        <tr>
                                            <th className="border border-gray-200 bg-gray-50 px-2 py-1 w-16">Saat</th>
                                            {grid.days.map(d => (
                                                <th key={d} className="border border-gray-200 bg-gray-50 px-2 py-1">{d}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {grid.slots.map(slot => (
                                            <tr key={slot}>
                                                <td className="border border-gray-200 px-2 py-1 text-gray-500 font-mono">{slot}</td>
                                                {grid.days.map((day, di) => {
                                                    if (covered.has(`${day}|${slot}`)) return null;
                                                    const cell = grid.cells[day][slot];
                                                    if (!cell) return <td key={day} className="border border-gray-200 px-2 py-1" />;
                                                    return (
                                                        <td
                                                            key={day}
                                                            rowSpan={cell.span}
                                                            className={`border px-2 py-1 align-top ${DAY_COLORS[di % DAY_COLORS.length]}`}
                                                        >
                                                            <div className="font-mono font-semibold">{cell.offering.courseCode}</div>
                                                            <div className="opacity-80">
                                                                {cell.offering.type === 'lab' ? 'Lab' : 'Teorik'}
                                                                {cell.offering.section !== 'All' && ` · ${cell.offering.section}`}
                                                            </div>
                                                            {cell.offering.room && <div className="opacity-70">{cell.offering.room}</div>}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {grid.asyncSessions.length > 0 && (
                                <p className="mt-3 text-xs text-gray-600">
                                    Asenkron: {grid.asyncSessions.map(s => s.courseCode).join(', ')}
                                </p>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
