import type { ParsedOffering } from './schedulePdfParser';
import { detectScheduleConflicts, type ScheduleConflict } from './scheduleUtils';

/**
 * Ders programı oluşturucu.
 *
 * Bir dersin programdaki kaydı tek parça değildir ve parçaların BAĞLAYICILIĞI
 * farklıdır. Bu ayrım programın tamamının doğruluğunu belirler:
 *
 *   EEM206 Electrical Circuits Lab. (Class - All Groups)  E 6   ← SABİT
 *   EEM206 Elect. Circ. Lab. (A)                          Lab   ← SEÇENEK
 *   EEM206 Elect. Circ. Lab. (B)                          Lab   ← SEÇENEK
 *
 * SABİT oturumlar — "Class - All Groups", "All Class", "tüm gruplar/sınıflar"
 * diye işaretlenen teorik saatlerdir. Dersi alan HERKES aynı saatte bulunur;
 * öğrencinin seçme hakkı yoktur. Ders programa giriyorsa bu saat de girmek
 * ZORUNDADIR. Bu saat başka bir dersle çakışıyorsa iki ders birlikte alınamaz.
 *
 * SEÇENEK oturumlar — laboratuvar grupları ve grup bazlı şubelerdir. Aynı ders
 * için birden çok saat sunulur; öğrenci bunlardan BİRİNİ seçer. Burada esneklik
 * vardır: bir grup doluysa/çakışıyorsa diğerine geçilebilir. Bu yüzden motor
 * seçeneklerin HEPSİNİ değerlendirir, uygun olanı seçer ve diğerlerini de
 * uygunluk durumlarıyla birlikte döndürür — öğrenci kendi tercihini yapabilsin.
 */

export interface CourseOfferingGroup {
    courseCode: string;
    courseName: string;
    /** Tüm gruplara açık oturumlar (teorik). */
    plenary: ParsedOffering[];
    /** Grup harfine göre lab/şube oturumları. */
    byGroup: Map<string, ParsedOffering[]>;
    /** Bu ders için seçim gerektiren grup harfleri. */
    availableGroups: string[];
    /** Grup seçimi gerekiyor mu (birden çok grup varsa). */
    requiresGroupChoice: boolean;
}

/** Programdaki oturumları derse ve gruba göre toplar. */
export function groupOfferings(offerings: ParsedOffering[]): Map<string, CourseOfferingGroup> {
    const map = new Map<string, CourseOfferingGroup>();

    for (const offering of offerings) {
        const code = offering.courseCode.toUpperCase();
        if (!map.has(code)) {
            map.set(code, {
                courseCode: code,
                courseName: offering.courseName || code,
                plenary: [],
                byGroup: new Map(),
                availableGroups: [],
                requiresGroupChoice: false
            });
        }
        const entry = map.get(code)!;
        if (!entry.courseName && offering.courseName) entry.courseName = offering.courseName;

        if (offering.groups.length === 0) {
            entry.plenary.push(offering);
        } else {
            for (const group of offering.groups) {
                if (!entry.byGroup.has(group)) entry.byGroup.set(group, []);
                entry.byGroup.get(group)!.push(offering);
            }
        }
    }

    for (const entry of map.values()) {
        entry.availableGroups = [...entry.byGroup.keys()].sort();
        entry.requiresGroupChoice = entry.availableGroups.length > 1;
    }

    return map;
}

// ---------------------------------------------------------------------------
// Otomatik yerleştirme
// ---------------------------------------------------------------------------

/**
 * Programa girmesi istenen bir ders ve yönetmelikteki önceliği.
 *
 * Öncelik sırası Madde 19/5 ve 19/6'dan gelir:
 *   1 — FF/YZ/DZ zorunlu tekrarı        ("tekrar almak zorundadır")
 *   2 — akademik yetersizlik tekrarı     (CC altı, Madde 19/6 3. aşama)
 *   3 — normal akış (ders planı dersi)
 *
 * Her iki madde de "yarıyılı EN KÜÇÜK olandan başlayarak" der; bu yüzden aynı
 * öncelik içinde `planSemester` küçük olan önce yerleştirilir.
 */
export interface PlanCourseRequest {
    courseCode: string;
    courseName?: string;
    priority: 1 | 2 | 3;
    planSemester: number | null;
    ects: number;
    reason: string;
    regulation: string;
}

export interface PlanRequest {
    /** Öncelik bilgisiyle birlikte dersler. */
    courses?: PlanCourseRequest[];
    /** Kısayol: yalnızca kod verilirse hepsi "normal akış" sayılır. */
    courseCodes?: string[];
    offerings: ParsedOffering[];
    /** Öğrencinin şube/grup harfi (ör. "A"). Bilinmiyorsa null. */
    preferredGroup?: string | null;
    /** Ders bazında elle seçilmiş grup: { EEM206: "C" } */
    groupChoices?: Record<string, string>;
    /** Madde 10/2 dönem AKTS üst sınırı. Verilmezse sınır uygulanmaz. */
    ectsLimit?: number;
}

export type PlacementStatus =
    | 'placed'          // tamamı yerleşti
    | 'needs_choice'    // grup seçimi bekliyor
    | 'conflict'        // çakışma nedeniyle yerleşemedi
    | 'displaced'       // daha yüksek öncelikli bir ders için programdan çıkarıldı
    | 'ects_limit'      // AKTS sınırına sığmadı
    | 'not_offered';    // bu dönem programda yok

/** Öğrencinin seçebileceği bir grup/şube ve o seçeneğin uygunluğu. */
export interface GroupOption {
    /** Seçim anahtarı — bu seçeneği temsil eden grup harfi. */
    group: string;
    /**
     * Bu oturumu PAYLAŞAN tüm gruplar.
     *
     * "(Class-A-E Groups)" gibi bir kayıt A'dan E'ye beş grubu aynı saatte
     * toplar; bu bir seçenek değil, o grupların ortak saatidir. Aynı saate
     * düşen gruplar tek seçenekte birleştirilir — aksi hâlde arayüzde aynı
     * saatin beş kez tekrarlandığı anlamsız bir liste çıkıyordu.
     */
    groups: string[];
    sessions: ParsedOffering[];
    /** "Pzt 14:00-16:00 · Lab" gibi okunur özet. */
    label: string;
    type: 'lecture' | 'lab';
    /** Programın geri kalanıyla çakışmıyor mu. */
    available: boolean;
    /** Çakışıyorsa hangi derslerle. */
    conflictsWith: string[];
}

export type ConflictKind =
    | 'sabit'   // herkesin aldığı teorik saat çakışıyor — esneklik yok
    | 'grup';   // teorik uygun ama hiçbir grup seçeneği boş değil

export interface CoursePlacement {
    courseCode: string;
    courseName: string;
    status: PlacementStatus;
    priority: 1 | 2 | 3;
    planSemester: number | null;
    ects: number;
    /** Neden bu listede — yönetmelik gerekçesi. */
    reason: string;
    regulation: string;
    /** Programa eklenen oturumlar (sabit + seçilen grup). */
    sessions: ParsedOffering[];
    /** Herkesin aldığı, seçim gerektirmeyen teorik oturumlar. */
    fixedSessions: ParsedOffering[];
    /** Seçime açık gruplar — hepsi, uygunluk durumlarıyla. */
    options: GroupOption[];
    /** Seçilen grup (varsa). */
    chosenGroup: string | null;
    availableGroups: string[];
    /** Çakışma varsa hangi derslerle. */
    conflictsWith: string[];
    /** Çakışma sabit saatten mi grup seçeneklerinden mi kaynaklanıyor. */
    conflictKind: ConflictKind | null;
    message: string;
}

const DAY_SHORT: Record<string, string> = {
    'Pazartesi': 'Pzt', 'Salı': 'Sal', 'Çarşamba': 'Çar',
    'Perşembe': 'Per', 'Cuma': 'Cum', 'Cumartesi': 'Cmt', 'Pazar': 'Paz'
};

/** "Pzt 14:00-16:00, Çar 09:00-11:00 · Lab" */
export function describeSessions(sessions: ParsedOffering[]): string {
    if (!sessions.length) return '—';
    const times = sessions
        .filter(s => !s.async)
        .map(s => `${DAY_SHORT[s.day] ?? s.day} ${s.startTime}-${s.endTime}`);
    if (sessions.some(s => s.async)) times.push('Asenkron');
    const rooms = [...new Set(sessions.map(s => s.room).filter(Boolean))];
    return times.join(', ') + (rooms.length ? ` · ${rooms.join('/')}` : '');
}

export interface SchedulePlan {
    placements: CoursePlacement[];
    /** Nihai programa giren tüm oturumlar. */
    sessions: ParsedOffering[];
    conflicts: ScheduleConflict[];
    /** Grup seçimi bekleyen dersler. */
    pendingChoices: CoursePlacement[];
    /** Yerleşen derslerin toplam AKTS'i. */
    totalEcts: number;
    ectsLimit: number | null;
    /** Kullanıcıya gösterilecek, madde referanslı açıklamalar. */
    notes: string[];
}

const PRIORITY_LABEL: Record<1 | 2 | 3, string> = {
    1: 'zorunlu tekrar',
    2: 'yetersizlik tekrarı',
    3: 'normal akış'
};

function wouldConflict(existing: ParsedOffering[], additions: ParsedOffering[]): string[] {
    const conflicts = detectScheduleConflicts([...existing, ...additions]);
    const addedCodes = new Set(additions.map(a => a.courseCode.toUpperCase()));
    const blamed = new Set<string>();

    for (const c of conflicts) {
        const [a, b] = c.courses.map(x => x.toUpperCase());
        if (addedCodes.has(a) && !addedCodes.has(b)) blamed.add(b);
        else if (addedCodes.has(b) && !addedCodes.has(a)) blamed.add(a);
        else if (addedCodes.has(a) && addedCodes.has(b)) { blamed.add(a); blamed.add(b); }
    }
    return [...blamed];
}

/**
 * İstenen dersleri YÖNETMELİK ÖNCELİĞİNE göre programa yerleştirir.
 *
 * Sıra: önce öncelik (zorunlu tekrar → yetersizlik tekrarı → normal akış),
 * aynı öncelikte "yarıyılı en küçük olandan başlayarak" (Madde 19/5, 19/6).
 *
 * Yerleştirme sırası önemlidir çünkü ilk gelen yeri kapar. Bu yüzden düşük
 * öncelikli bir ders, sonradan gelen ZORUNLU bir tekrarla çakışırsa programdan
 * ÇIKARILIR — tekrar alınması yönetmelik gereği zorunlu, diğeri değil. Aynı
 * kural AKTS sınırı için de geçerlidir (Madde 10/2).
 */
export function buildSchedulePlan(request: PlanRequest): SchedulePlan {
    const grouped = groupOfferings(request.offerings);
    const ectsLimit = request.ectsLimit ?? null;
    const notes: string[] = [];

    const requested: PlanCourseRequest[] = request.courses ?? (request.courseCodes ?? []).map(code => ({
        courseCode: code,
        priority: 3 as const,
        planSemester: null,
        ects: 0,
        reason: 'Seçildi',
        regulation: '—'
    }));

    // Madde 19/5 & 19/6: öncelik, sonra yarıyılı en küçük olan.
    //
    // Sıralama YERLEŞTİRME SIRASINI belirler ve yönetmeliğin asıl karşılığıdır:
    // yüksek öncelikli ders yeri önce kaptığı için, kıt kaynak (saat aralığı ya
    // da AKTS kotası) her zaman tekrar edilmesi zorunlu derse gider. Eşit
    // öncelik ve yarıyılda çağıranın verdiği sıra korunur.
    const ordered = requested
        .map((course, index) => ({ course, index }))
        .sort((a, b) => {
            if (a.course.priority !== b.course.priority) return a.course.priority - b.course.priority;
            const sa = a.course.planSemester ?? Number.MAX_SAFE_INTEGER;
            const sb = b.course.planSemester ?? Number.MAX_SAFE_INTEGER;
            if (sa !== sb) return sa - sb;
            return a.index - b.index;
        })
        .map(x => x.course);

    const placements = new Map<string, CoursePlacement>();
    const accepted: ParsedOffering[] = [];
    let totalEcts = 0;

    for (const req of ordered) {
        const code = req.courseCode.trim().toUpperCase();
        const entry = grouped.get(code);
        const base = {
            courseCode: code,
            courseName: entry?.courseName || req.courseName || code,
            priority: req.priority,
            planSemester: req.planSemester,
            ects: req.ects,
            reason: req.reason,
            regulation: req.regulation,
            availableGroups: entry?.availableGroups ?? []
        };

        if (!entry) {
            placements.set(code, {
                ...base, status: 'not_offered', sessions: [], fixedSessions: [], options: [],
                chosenGroup: null, conflictsWith: [], conflictKind: null,
                message: req.priority < 3
                    ? 'Bu dönem açılmamış. Madde 19/5 uyarınca kendi dönemi dışında açılırsa talep ederek alabilirsiniz.'
                    : 'Bu dönemin yüklenen programında açılmamış görünüyor.'
            });
            continue;
        }

        // --- 1) SABİT oturumlar: herkesin aldığı teorik saat ---
        //
        // Seçim hakkı yok. Ders alınıyorsa bu saat de alınır. Bu yüzden önce
        // bunu sınarız: çakışıyorsa dersin hiçbir grup seçeneği kurtaramaz.
        const fixedSessions: ParsedOffering[] = [...entry.plenary];
        const fixedBlocking = wouldConflict(accepted, fixedSessions);

        if (fixedBlocking.length > 0) {
            const blockers = fixedBlocking.map(c => placements.get(c))
                .filter((p): p is CoursePlacement => !!p);
            placements.set(code, {
                ...base, status: 'conflict', sessions: [], fixedSessions, options: [],
                chosenGroup: null, conflictsWith: fixedBlocking, conflictKind: 'sabit',
                message:
                    `Herkesin aldığı teorik saati ${fixedBlocking.join(', ')} ile çakışıyor ` +
                    `(${describeSessions(fixedSessions)}). Bu saat tüm gruplar için ortaktır, ` +
                    'değiştirilemez — iki ders aynı dönemde birlikte alınamaz. ' +
                    (req.priority < 3 && blockers.some(p => p.priority < 3)
                        ? 'İkisi de tekrar kapsamında; danışmanınıza bildirin.'
                        : 'Çakıştığı dersi listeden çıkarıp tekrar deneyin.')
            });
            continue;
        }

        // --- 2) SEÇENEK oturumlar: grup/şube — burada esneklik var ---
        //
        // Her seçeneğin uygunluğunu ayrı ayrı hesapla ve HEPSİNİ döndür;
        // öğrenci hangi grupları alabildiğini görebilsin.
        const withFixed = accepted.concat(fixedSessions);

        // Aynı saat/oturum kümesine düşen grupları TEK seçenekte birleştir.
        const bySignature = new Map<string, { groups: string[]; sessions: ParsedOffering[] }>();
        for (const group of entry.availableGroups) {
            const groupSessions = entry.byGroup.get(group)!;
            const signature = groupSessions
                .map(s => `${s.day}|${s.startTime}|${s.endTime}|${s.type}|${s.room ?? ''}`)
                .sort()
                .join(';');
            if (!bySignature.has(signature)) bySignature.set(signature, { groups: [], sessions: groupSessions });
            bySignature.get(signature)!.groups.push(group);
        }

        const options: GroupOption[] = [...bySignature.values()].map(({ groups, sessions: groupSessions }) => {
            const clash = wouldConflict(withFixed, groupSessions);
            return {
                group: groups[0],
                groups,
                sessions: groupSessions,
                label: describeSessions(groupSessions),
                type: groupSessions.some(s => s.type === 'lab') ? 'lab' as const : 'lecture' as const,
                available: clash.length === 0,
                conflictsWith: clash
            };
        });

        let chosenGroup: string | null = null;
        const manual = request.groupChoices?.[code];

        if (options.length > 0) {
            // Sıra: elle seçim → öğrencinin şubesi → çakışmayan ilk seçenek.
            // Grup harfi birleştirilmiş bir seçeneğin İÇİNDE olabilir.
            const optionContaining = (g: string) => options.find(o => o.groups.includes(g));

            const manualOption = manual ? optionContaining(manual) : undefined;
            const preferredOption = request.preferredGroup ? optionContaining(request.preferredGroup) : undefined;

            if (manualOption) {
                // Elle seçim çakışsa bile öğrencinin tercihine saygı göster;
                // uyarıyı mesajda ver.
                chosenGroup = manualOption.group;
            } else if (preferredOption?.available) {
                chosenGroup = preferredOption.group;
            } else {
                chosenGroup = options.find(o => o.available)?.group ?? null;
            }

            if (!chosenGroup) {
                placements.set(code, {
                    ...base, status: 'conflict', sessions: [], fixedSessions, options,
                    chosenGroup: null, conflictsWith: [...new Set(options.flatMap(o => o.conflictsWith))],
                    conflictKind: 'grup',
                    message:
                        `Teorik saati uygun ama ${options.length} grubun hiçbiri boş değil. ` +
                        'Çakışan dersi listeden çıkarırsanız gruplardan biri açılabilir.'
                });
                continue;
            }
        }

        const chosenOption = options.find(o => o.group === chosenGroup);
        const sessions = [...fixedSessions, ...(chosenOption?.sessions ?? [])];

        // --- AKTS sınırı (Madde 10/2) ---
        if (ectsLimit !== null && totalEcts + req.ects > ectsLimit) {
            const remaining = ectsLimit - totalEcts;
            placements.set(code, {
                ...base, status: 'ects_limit', sessions: [], fixedSessions, options,
                chosenGroup, conflictsWith: [], conflictKind: null,
                message:
                    `${ectsLimit} AKTS sınırına sığmadı (Madde 10/2): bu ders ${req.ects} AKTS, ` +
                    `geriye ${remaining.toFixed(1)} AKTS kaldı. ` +
                    (req.priority < 3
                        ? 'Tekrar kapsamında olduğu hâlde sığmıyor — daha düşük öncelikli bir dersi ' +
                          'listeden çıkarın ya da danışmanınıza bildirin.'
                        : 'Almak isterseniz listeden başka bir dersi çıkarın.')
            });
            continue;
        }

        accepted.push(...sessions);
        totalEcts += req.ects;

        const usableOptions = options.filter(o => o.available || o.group === chosenGroup).length;
        const groupsLabel = (o: GroupOption) =>
            o.groups.length > 1 ? `${o.groups.join(', ')} grupları` : `${o.groups[0]} grubu`;

        placements.set(code, {
            ...base,
            // Tek seçenek varsa gerçek bir seçim yoktur — o saat zaten ortaktır.
            status: options.length > 1 && !manual ? 'needs_choice' : 'placed',
            sessions,
            fixedSessions,
            options,
            chosenGroup,
            conflictsWith: [],
            conflictKind: null,
            message: !options.length
                ? `Tüm gruplara ortak teorik ders — ${describeSessions(fixedSessions)}. Seçim gerektirmez.`
                : chosenOption && !chosenOption.available
                    ? `${groupsLabel(chosenOption)} sizin seçiminiz ama ${chosenOption.conflictsWith.join(', ')} ile çakışıyor.`
                    : options.length === 1 && chosenOption
                        ? `${groupsLabel(chosenOption)} için tek saat açılmış — ${chosenOption.label}. Seçim gerektirmez.`
                        : `${groupsLabel(chosenOption!)}${manual ? ' seçildi' : ' otomatik seçildi'} — ` +
                          `${chosenOption?.label ?? ''}. ` +
                          `${usableOptions}/${options.length} seçenek uygun${manual ? '' : ', değiştirebilirsiniz'}.`
        });
    }

    const result = [...placements.values()];
    const mandatoryUnplaced = result.filter(p => p.priority < 3 && p.status !== 'placed' && p.status !== 'needs_choice');

    if (mandatoryUnplaced.length) {
        notes.push(
            `${mandatoryUnplaced.length} tekrar dersi programa yerleşemedi ` +
            `(${mandatoryUnplaced.map(p => p.courseCode).join(', ')}). ` +
            'Madde 19/5 uyarınca bu derslerin alınması zorunludur; danışmanınıza durumu bildirin.'
        );
    }
    const displaced = result.filter(p => p.status === 'displaced');
    if (displaced.length) {
        notes.push(
            `${displaced.length} ders, tekrar edilmesi zorunlu derslere yer açmak için programdan çıkarıldı ` +
            `(${displaced.map(p => p.courseCode).join(', ')}). Tekrar dersleri yönetmelik gereği önceliklidir.`
        );
    }
    if (ectsLimit !== null) {
        notes.push(`Toplam ${totalEcts.toFixed(1)} / ${ectsLimit} AKTS (Madde 10/2).`);
    }

    return {
        placements: result.sort((a, b) =>
            a.priority - b.priority ||
            (a.planSemester ?? 99) - (b.planSemester ?? 99) ||
            a.courseCode.localeCompare(b.courseCode, 'tr')),
        sessions: accepted,
        conflicts: detectScheduleConflicts(accepted),
        pendingChoices: result.filter(p => p.status === 'needs_choice'),
        totalEcts,
        ectsLimit,
        notes
    };
}

// ---------------------------------------------------------------------------
// Haftalık ızgara
// ---------------------------------------------------------------------------

export interface GridCell {
    offering: ParsedOffering;
    /** Kaç saat dilimi kapladığı. */
    span: number;
}

export interface WeeklyGrid {
    days: string[];
    /** "08:00" … "18:00" */
    slots: string[];
    /** cells[day][slot] */
    cells: Record<string, Record<string, GridCell | null>>;
    asyncSessions: ParsedOffering[];
}

export function buildWeeklyGrid(sessions: ParsedOffering[], days = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma']): WeeklyGrid {
    const timed = sessions.filter(s => !s.async);
    const asyncSessions = sessions.filter(s => s.async);

    const hours = timed.flatMap(s => [parseInt(s.startTime, 10), parseInt(s.endTime, 10)]);
    const min = hours.length ? Math.min(...hours, 8) : 8;
    const max = hours.length ? Math.max(...hours, 18) : 18;

    const slots: string[] = [];
    for (let h = min; h < max; h++) slots.push(`${h.toString().padStart(2, '0')}:00`);

    const cells: WeeklyGrid['cells'] = {};
    for (const day of days) {
        cells[day] = {};
        for (const slot of slots) cells[day][slot] = null;
    }

    for (const session of timed) {
        if (!cells[session.day]) continue;
        const start = parseInt(session.startTime, 10);
        const end = parseInt(session.endTime, 10);
        const startSlot = `${start.toString().padStart(2, '0')}:00`;
        if (!(startSlot in cells[session.day])) continue;
        cells[session.day][startSlot] = { offering: session, span: Math.max(1, end - start) };
    }

    return { days, slots, cells, asyncSessions };
}
