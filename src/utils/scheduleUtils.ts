import type { ScheduleOffering } from '../types';

/**
 * Ders programı çakışma analizi.
 *
 * PDF ayrıştırma bu dosyada DEĞİLDİR — bkz. `schedulePdfParser.ts`.
 * (Daha önce burada ikinci bir parser vardı; iki parser birbirinden sapınca
 * hangisinin çalıştığı belirsizleşiyordu, bu yüzden tek parser bırakıldı.)
 */

export const DAYS_ORDER = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

export interface ScheduleConflict {
    courses: string[];
    day: string;
    time: string;
    detail: string;
}

/**
 * İki oturum çakışır mı?
 *
 * Çakışma SAYILMAYAN durumlar:
 *  - Asenkron dersler (gün/saati yoktur).
 *  - Aynı dersin iki oturumu (teorik + kendi laboratuvarı, ya da yinelenen hücre).
 *    Eski sürüm bunları çakışma sayıyor ve her lablı derste sahte uyarı üretiyordu.
 */
export function detectScheduleConflicts(selected: ScheduleOffering[]): ScheduleConflict[] {
    const conflicts: ScheduleConflict[] = [];

    for (let i = 0; i < selected.length; i++) {
        for (let j = i + 1; j < selected.length; j++) {
            const a = selected[i];
            const b = selected[j];

            if (a.async || b.async) continue;
            if (a.day !== b.day) continue;
            if (a.courseCode.toUpperCase() === b.courseCode.toUpperCase()) continue;

            if (a.startTime < b.endTime && b.startTime < a.endTime) {
                const overlapStart = a.startTime > b.startTime ? a.startTime : b.startTime;
                const overlapEnd = a.endTime < b.endTime ? a.endTime : b.endTime;
                conflicts.push({
                    courses: [a.courseCode, b.courseCode],
                    day: a.day,
                    time: `${overlapStart}-${overlapEnd}`,
                    detail:
                        `${a.courseCode} (${a.section}, ${a.type === 'lab' ? 'lab' : 'teorik'}` +
                        `${a.room ? ', ' + a.room : ''}) ile ` +
                        `${b.courseCode} (${b.section}, ${b.type === 'lab' ? 'lab' : 'teorik'}` +
                        `${b.room ? ', ' + b.room : ''})`
                });
            }
        }
    }

    return conflicts;
}
