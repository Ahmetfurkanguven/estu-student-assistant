import React, { useMemo, useRef, useState } from 'react';
import { Upload, CalendarDays, AlertCircle, CheckCircle2, Wand2 } from 'lucide-react';
import type { ParsedOffering, ScheduleParseDiagnostic, ScheduleMeta } from '../utils/schedulePdfParser';
import { parseSchedulePdf, readSchedulePdf } from '../utils/schedulePdfParser';
import { buildSchedulePlan, buildWeeklyGrid, groupOfferings, describeSessions } from '../utils/schedulePlanner';
import type { ProposedCourse } from '../utils/courseSelectionRules';
import type { RetakeItem, TermType } from '../utils/repeatRules';

interface Props {
    /** Bölüm profilindeki ders kodları — ders/derslik ayrımını kesinleştirir. */
    knownCourseCodes: string[];
    /** Motorun önerdiği dersler (zorunlu tekrarlar başta). */
    proposal: ProposedCourse[];
    retakes: RetakeItem[];
    /** Madde 10/2 dönem AKTS üst sınırı. */
    ectsLimit?: number;
    /** Ders önerisiyle ortak dönem — ikisi ayrışırsa öneri ve program çelişir. */
    term: TermType;
    onTermChange: (term: TermType) => void;
    /**
     * Okunan program App'e bildirilir; ders önerisi "bu dönem açılan dersler"
     * filtresini buradan besler. Bildirilmezse öneri hangi dersin açıldığını
     * bilemez ve açılmayan dersleri önerir.
     */
    onOfferingsChange?: (offerings: ParsedOffering[]) => void;
}

const TERM_LABEL: Record<TermType, string> = {
    guz: 'Güz yarıyılı',
    bahar: 'Bahar yarıyılı',
    yaz: 'Yaz okulu'
};

/**
 * Ders planındaki yarıyıl ile dönem uyumu.
 *
 * Tek sayılı yarıyıllar (1, 3, 5, 7) güz; çift sayılılar (2, 4, 6, 8) bahardır.
 * Madde 19/5 tekrar derslerinin "ders planında gösterilen döneminde"
 * alınmasını ister; ancak aynı madde "kendi dönemi dışında açılan bir dersi
 * talep etmesi durumunda alabilir" der. Bu yüzden uyumsuzluk ENGEL değil,
 * bilgilendirmedir — ders programda açıldıysa alınabilir.
 */
function matchesTerm(planSemester: number | null, term: TermType): boolean {
    if (planSemester == null || term === 'yaz') return true;
    return term === 'guz' ? planSemester % 2 === 1 : planSemester % 2 === 0;
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
export function ScheduleBuilder({
    knownCourseCodes, proposal, retakes, ectsLimit, term, onTermChange, onOfferingsChange
}: Props) {
    const [offerings, setOfferings] = useState<ParsedOffering[]>([]);
    const [diagnostics, setDiagnostics] = useState<ScheduleParseDiagnostic[]>([]);
    const [availableGroups, setAvailableGroups] = useState<string[]>([]);
    const [detectedTerm, setDetectedTerm] = useState<ScheduleMeta | null>(null);
    const [preferredGroup, setPreferredGroup] = useState<string>('');
    const [selected, setSelected] = useState<string[]>([]);
    const [groupChoices, setGroupChoices] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const catalogue = useMemo(() => groupOfferings(offerings), [offerings]);

    /**
     * Seçilen dersleri yönetmelik önceliğiyle birlikte motora verir.
     * Öncelik bilgisi ders önerisinden gelir; elle eklenenler normal akış sayılır.
     */
    const planCourses = useMemo(() => {
        const byCode = new Map(proposal.map(p => [p.course.code.toUpperCase(), p]));
        const retakeByCode = new Map(retakes.map(r => [r.courseCode.toUpperCase(), r]));

        return selected.map(code => {
            const p = byCode.get(code);
            const r = retakeByCode.get(code);
            if (p) {
                return {
                    courseCode: code,
                    courseName: p.course.name,
                    priority: p.priority,
                    planSemester: p.course.semester ?? null,
                    ects: p.course.ects,
                    reason: p.reason,
                    regulation: p.regulation
                };
            }
            if (r) {
                return {
                    courseCode: code,
                    courseName: r.courseName,
                    priority: (r.kind === 'basarisiz' ? 1 : 2) as 1 | 2,
                    planSemester: r.planSemester,
                    ects: r.ects,
                    reason: r.reason,
                    regulation: r.regulation
                };
            }
            return {
                courseCode: code,
                priority: 3 as const,
                planSemester: null,
                ects: 0,
                reason: 'Elle eklendi',
                regulation: '—'
            };
        });
    }, [selected, proposal, retakes]);

    const plan = useMemo(
        () => buildSchedulePlan({
            courses: planCourses,
            offerings,
            preferredGroup: preferredGroup || null,
            groupChoices,
            ectsLimit
        }),
        [planCourses, offerings, preferredGroup, groupChoices, ectsLimit]
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
            onOfferingsChange?.(result.offerings);
            setDiagnostics(result.diagnostics);
            setAvailableGroups(result.availableGroups);
            setDetectedTerm(result.meta);
            // Dosyanın kendi dönemi, elle seçilenden daha güvenilirdir.
            if (result.meta.term) onTermChange(result.meta.term);
            setSelected([]);
            setGroupChoices({});
        } catch (err) {
            setDiagnostics([{ level: 'error', code: 'READ_FAILED', message: `PDF okunamadı: ${(err as Error).message}` }]);
        } finally {
            setBusy(false);
        }
    }

    /**
     * Tekrar edilmesi zorunlu dersler + önerilenleri, yönetmelik önceliğine
     * göre ekler. Sıralama motorda da uygulanır; buradaki sıra yalnızca
     * hangi derslerin seçileceğini belirler.
     */
    function autoFill() {
        const wanted = [
            // Madde 19/5 & 19/6: tekrar dersleri önce, yarıyılı küçük olandan.
            ...[...retakes].sort((a, b) =>
                (a.kind === b.kind ? 0 : a.kind === 'basarisiz' ? -1 : 1) ||
                (a.planSemester ?? 99) - (b.planSemester ?? 99)
            ).map(r => r.courseCode),
            ...proposal.map(p => p.course.code)
        ];
        const mandatory = new Set(retakes.map(r => r.courseCode.toUpperCase()));
        const seen = new Set<string>();

        const picked = wanted
            .map(c => c.toUpperCase())
            .filter(c => {
                if (seen.has(c)) return false;
                // Tekrar dersleri programda AÇILMAMIŞ olsa bile listeye girer:
                // öğrenci "bu dönem yok" bilgisini görmeli. Madde 19/5 bu dersin
                // ders planındaki döneminde alınacağını söyler; sessizce
                // gizlemek öğrenciyi yükümlülüğünden habersiz bırakır.
                if (!catalogue.has(c) && !mandatory.has(c)) return false;
                seen.add(c);
                return true;
            });
        setSelected(picked);
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

                {/* Öğrenci her zaman DÖNEMLİK program hazırlar; hangi yarıyıl
                    olduğu ders önerisini ve AKTS sınırını da belirler. */}
                <div className="mb-4">
                    <span className="block text-sm text-gray-600 mb-1.5">Hangi yarıyıl için program hazırlıyorsunuz?</span>
                    <div className="flex flex-wrap gap-2">
                        {(['guz', 'bahar', 'yaz'] as TermType[]).map(t => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => onTermChange(t)}
                                className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                                    term === t
                                        ? 'border-indigo-500 bg-indigo-50 text-indigo-900 font-medium'
                                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                                }`}
                            >
                                {TERM_LABEL[t]}
                            </button>
                        ))}
                    </div>

                    {detectedTerm?.term && (
                        <p className="text-xs text-gray-500 mt-1.5">
                            Yüklenen dosyanın başlığından okundu:{' '}
                            <strong>{detectedTerm.academicYear ?? ''} {TERM_LABEL[detectedTerm.term]}</strong>
                            {detectedTerm.term !== term && ' — elle değiştirdiniz.'}
                        </p>
                    )}
                    {detectedTerm && !detectedTerm.term && (
                        <p className="text-xs text-amber-700 mt-1.5">
                            Dosyanın dönemi başlıktan okunamadı; yukarıdan doğru yarıyılı seçin.
                        </p>
                    )}
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-700">
                        {TERM_LABEL[term]} için bölümün yayımladığı haftalık ders programı PDF'ini yükleyin
                    </p>
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

                    {/* ---- Grup seçenekleri ---- */}
                    {plan.placements.some(p => p.options.length > 0) && (
                        <div className="bg-white rounded-lg shadow-md p-4">
                            <h4 className="font-medium text-gray-800 mb-1">Grup seçenekleriniz</h4>
                            <p className="text-xs text-gray-500 mb-4">
                                <strong>Teorik saatler</strong> (tüm gruplara ortak) sabittir — dersi
                                alan herkes aynı saatte bulunur, seçim hakkı yoktur.{' '}
                                <strong>Laboratuvar ve şube grupları</strong> ise farklı saatlerde açılır;
                                aşağıdan size uyanı seçebilirsiniz.
                            </p>

                            <div className="space-y-4">
                                {plan.placements.filter(p => p.options.length > 0).map(p => (
                                    <div key={p.courseCode} className="border border-gray-200 rounded-lg p-3">
                                        <div className="flex flex-wrap items-baseline gap-2 mb-2">
                                            <span className="font-mono font-medium">{p.courseCode}</span>
                                            <span className="text-sm text-gray-600">{p.courseName}</span>
                                        </div>

                                        {p.fixedSessions.length > 0 && (
                                            <div className="mb-2 text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1.5">
                                                <span className="font-medium text-gray-700">Sabit teorik saat</span>
                                                <span className="text-gray-500"> (tüm gruplar) — </span>
                                                <span className="text-gray-700">{describeSessions(p.fixedSessions)}</span>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                            {p.options.map(o => {
                                                const selected = o.group === p.chosenGroup;
                                                return (
                                                    <button
                                                        key={o.group}
                                                        type="button"
                                                        onClick={() => setGroupChoices(prev => ({ ...prev, [p.courseCode]: o.group }))}
                                                        className={`text-left px-2.5 py-2 rounded border text-xs transition-colors ${
                                                            selected
                                                                ? 'border-indigo-500 bg-indigo-50'
                                                                : o.available
                                                                    ? 'border-gray-200 hover:bg-gray-50'
                                                                    : 'border-red-200 bg-red-50 opacity-80'
                                                        }`}
                                                    >
                                                        <span className="flex items-center gap-1.5 font-medium">
                                                            {o.groups.length > 1
                                                                ? `${o.groups.join(', ')} grupları`
                                                                : `${o.groups[0]} grubu`}
                                                            <span className="text-[10px] px-1 rounded bg-gray-200 text-gray-700">
                                                                {o.type === 'lab' ? 'Lab' : 'Şube'}
                                                            </span>
                                                            {selected && <span className="text-indigo-700">✓ seçili</span>}
                                                        </span>
                                                        <span className="block text-gray-600 mt-0.5">{o.label}</span>
                                                        {!o.available && (
                                                            <span className="block text-red-700 mt-0.5">
                                                                {o.conflictsWith.join(', ')} ile çakışıyor
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <p className="text-xs text-gray-500 mt-2">{p.message}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ---- Öncelik sırası ve yerleşim durumu ---- */}
                    {selected.length > 0 && (
                        <div className="bg-white rounded-lg shadow-md p-4">
                            <h4 className="font-medium text-gray-800 mb-1">Yerleşim sırası</h4>
                            <p className="text-xs text-gray-500 mb-3">
                                Dersler yönetmelik önceliğine göre yerleştirilir: önce tekrar edilmesi
                                zorunlu dersler (FF/YZ/DZ — Madde 19/5), sonra akademik yetersizlik
                                kapsamındakiler (Madde 19/6), en son normal akış. Her grupta yarıyılı
                                en küçük olan ders önce gelir. Yüksek öncelikli ders yeri önce
                                kaptığı için, saat ya da AKTS kotası yetmediğinde eksik kalan her
                                zaman düşük öncelikli ders olur.
                            </p>

                            <div className="space-y-1.5">
                                {plan.placements.map(p => {
                                    const tone =
                                        p.status === 'placed' || p.status === 'needs_choice'
                                            ? 'border-gray-200'
                                            : p.status === 'displaced' || p.status === 'ects_limit'
                                                ? 'border-amber-300 bg-amber-50'
                                                : 'border-red-300 bg-red-50';
                                    const badge =
                                        p.priority === 1 ? 'bg-red-100 text-red-800'
                                            : p.priority === 2 ? 'bg-amber-100 text-amber-800'
                                                : 'bg-gray-100 text-gray-700';
                                    return (
                                        <div key={p.courseCode} className={`border rounded p-2 text-sm ${tone}`}>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-mono font-medium">{p.courseCode}</span>
                                                <span className={`text-xs px-1.5 py-0.5 rounded ${badge}`}>
                                                    {p.priority === 1 ? 'Zorunlu tekrar'
                                                        : p.priority === 2 ? 'Yetersizlik tekrarı' : 'Normal akış'}
                                                </span>
                                                {p.planSemester && (
                                                    <span className={`text-xs ${
                                                        matchesTerm(p.planSemester, term) ? 'text-gray-500' : 'text-amber-700'
                                                    }`}>
                                                        {p.planSemester}. yarıyıl
                                                        {!matchesTerm(p.planSemester, term) && ' · kendi dönemi değil'}
                                                    </span>
                                                )}
                                                {p.ects > 0 && <span className="text-xs text-gray-500">{p.ects} AKTS</span>}
                                                <span className="text-xs text-gray-400 ml-auto">{p.regulation}</span>
                                            </div>
                                            <p className={`text-xs mt-1 ${
                                                p.status === 'placed' || p.status === 'needs_choice'
                                                    ? 'text-gray-500' : 'text-gray-700'
                                            }`}>
                                                {p.message}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>

                            {(() => {
                                // Madde 19/5: ders kendi döneminde alınır, ancak kendi
                                // dönemi dışında açılmışsa talep edilerek alınabilir.
                                const offTerm = plan.placements.filter(
                                    p => p.sessions.length > 0 && !matchesTerm(p.planSemester, term)
                                );
                                if (!offTerm.length) return null;
                                return (
                                    <p className="mt-3 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                                        {offTerm.map(p => p.courseCode).join(', ')} normalde{' '}
                                        {term === 'guz' ? 'bahar' : 'güz'} yarıyılı dersi ama bu dönem programda
                                        açılmış. Madde 19/5 uyarınca kendi dönemi dışında açılan bir dersi
                                        talep ederek alabilirsiniz.
                                    </p>
                                );
                            })()}

                            {plan.notes.length > 0 && (
                                <ul className="mt-3 space-y-1 text-xs text-gray-600">
                                    {plan.notes.map((n, i) => <li key={i}>• {n}</li>)}
                                </ul>
                            )}
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
