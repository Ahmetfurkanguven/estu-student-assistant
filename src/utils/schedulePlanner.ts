import type { ParsedOffering } from './schedulePdfParser';
import { detectScheduleConflicts, type ScheduleConflict } from './scheduleUtils';

/**
 * Ders programı oluşturucu.
 *
 * Bir dersin programdaki kaydı tek parça değildir:
 *
 *   EEM206 Electrical Circuits Lab. (Class - All Groups)  E 6   ← herkese teorik
 *   EEM206 Elect. Circ. Lab. (A)                          Lab   ← A grubu lab
 *   EEM206 Elect. Circ. Lab. (B)                          Lab   ← B grubu lab
 *
 * Öğrenci teorik oturumu ZORUNLU olarak alır, laboratuvarın ise yalnızca KENDİ
 * grubunu alır. Bu ayrım yapılmazsa hem sahte çakışma çıkar hem de program
 * anlamsız şişer.
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

export interface PlanRequest {
    /** Programa girmesi istenen ders kodları (öncelik sırasıyla). */
    courseCodes: string[];
    offerings: ParsedOffering[];
    /** Öğrencinin şube/grup harfi (ör. "A"). Bilinmiyorsa null. */
    preferredGroup?: string | null;
    /** Ders bazında elle seçilmiş grup: { EEM206: "C" } */
    groupChoices?: Record<string, string>;
}

export type PlacementStatus =
    | 'placed'          // tamamı yerleşti
    | 'needs_choice'    // grup seçimi bekliyor
    | 'conflict'        // çakışma nedeniyle yerleşemedi
    | 'not_offered';    // bu dönem programda yok

export interface CoursePlacement {
    courseCode: string;
    courseName: string;
    status: PlacementStatus;
    /** Programa eklenen oturumlar. */
    sessions: ParsedOffering[];
    /** Seçilen grup (varsa). */
    chosenGroup: string | null;
    availableGroups: string[];
    /** Çakışma varsa hangi derslerle. */
    conflictsWith: string[];
    message: string;
}

export interface SchedulePlan {
    placements: CoursePlacement[];
    /** Nihai programa giren tüm oturumlar. */
    sessions: ParsedOffering[];
    conflicts: ScheduleConflict[];
    /** Grup seçimi bekleyen dersler. */
    pendingChoices: CoursePlacement[];
}

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
 * İstenen dersleri sırayla programa yerleştirir.
 *
 * Her ders için:
 *   1. Tüm gruplara açık (teorik) oturumlar koşulsuz eklenir.
 *   2. Grup gerektiren oturumlarda önce elle seçim, sonra tercih edilen grup,
 *      sonra çakışmayan ilk grup denenir.
 */
export function buildSchedulePlan(request: PlanRequest): SchedulePlan {
    const grouped = groupOfferings(request.offerings);
    const placements: CoursePlacement[] = [];
    const accepted: ParsedOffering[] = [];

    for (const rawCode of request.courseCodes) {
        const code = rawCode.trim().toUpperCase();
        const entry = grouped.get(code);

        if (!entry) {
            placements.push({
                courseCode: code, courseName: code, status: 'not_offered',
                sessions: [], chosenGroup: null, availableGroups: [], conflictsWith: [],
                message: 'Bu dönemin yüklenen programında açılmamış görünüyor.'
            });
            continue;
        }

        // 1) Teorik (tüm gruplar) oturumları
        const sessions: ParsedOffering[] = [...entry.plenary];

        // 2) Grup gerektiren oturumlar
        let chosenGroup: string | null = null;
        const manual = request.groupChoices?.[code];

        if (entry.availableGroups.length > 0) {
            const order = [
                manual,
                request.preferredGroup ?? undefined,
                ...entry.availableGroups
            ].filter((g): g is string => !!g && entry.byGroup.has(g));

            for (const group of order) {
                const groupSessions = entry.byGroup.get(group)!;
                const blamed = wouldConflict(accepted.concat(sessions), groupSessions);
                if (blamed.length === 0) {
                    chosenGroup = group;
                    sessions.push(...groupSessions);
                    break;
                }
            }

            if (!chosenGroup) {
                const blamed = wouldConflict(
                    accepted.concat(sessions),
                    entry.byGroup.get(entry.availableGroups[0])!
                );
                placements.push({
                    courseCode: code, courseName: entry.courseName, status: 'conflict',
                    sessions: [], chosenGroup: null,
                    availableGroups: entry.availableGroups, conflictsWith: blamed,
                    message: `Hiçbir grup çakışmasız yerleşmedi. Çakışan: ${blamed.join(', ') || '—'}`
                });
                continue;
            }
        }

        const blamed = wouldConflict(accepted, sessions);
        if (blamed.length > 0) {
            placements.push({
                courseCode: code, courseName: entry.courseName, status: 'conflict',
                sessions: [], chosenGroup,
                availableGroups: entry.availableGroups, conflictsWith: blamed,
                message: `Teorik saatler çakışıyor: ${blamed.join(', ')}`
            });
            continue;
        }

        accepted.push(...sessions);
        placements.push({
            courseCode: code,
            courseName: entry.courseName,
            status: entry.requiresGroupChoice && !manual ? 'needs_choice' : 'placed',
            sessions,
            chosenGroup,
            availableGroups: entry.availableGroups,
            conflictsWith: [],
            message: chosenGroup
                ? `${chosenGroup} grubu seçildi${entry.requiresGroupChoice && !manual ? ' (otomatik — değiştirebilirsiniz)' : ''}.`
                : 'Tüm gruplara açık.'
        });
    }

    return {
        placements,
        sessions: accepted,
        conflicts: detectScheduleConflicts(accepted),
        pendingChoices: placements.filter(p => p.status === 'needs_choice')
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
