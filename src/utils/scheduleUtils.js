// --- Conflict Detection ---
export function detectScheduleConflicts(selected) {
    const conflicts = [];
    for (let i = 0; i < selected.length; i++) {
        for (let j = i + 1; j < selected.length; j++) {
            const a = selected[i];
            const b = selected[j];
            if (a.async || b.async || a.day !== b.day)
                continue;
            if (a.startTime < b.endTime && b.startTime < a.endTime) {
                conflicts.push({
                    courses: [a.courseCode, b.courseCode],
                    time: `${a.day} ${a.startTime}-${a.endTime}`
                });
            }
        }
    }
    return conflicts;
}
const DAYS_ORDER = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
export function parseScheduleFromItems(items) {
    console.log('='.repeat(60));
    console.log('[Parser] STARTING - Total items:', items.length);
    const offerings = [];
    // Group items by page
    const pages = new Map();
    items.forEach(item => {
        if (!pages.has(item.page))
            pages.set(item.page, []);
        pages.get(item.page).push(item);
    });
    pages.forEach((pageItems, pageNum) => {
        console.log(`\n[Parser] ===== PAGE ${pageNum} =====`);
        // Find ALL time slots
        const TIME_REGEX = /^(\d{1,2})[-–](\d{1,2})$/;
        const timeSlots = [];
        for (const item of pageItems) {
            const str = item.str.trim();
            const match = str.match(TIME_REGEX);
            if (match) {
                const start = parseInt(match[1]);
                const end = parseInt(match[2]);
                if (start >= 8 && start <= 20 && end > start) {
                    timeSlots.push({ y: item.y, start, end });
                }
            }
        }
        // Sort time slots by Y descending (top of page first)
        timeSlots.sort((a, b) => b.y - a.y);
        console.log(`[Parser] Found ${timeSlots.length} time slots`);
        // Find day boundaries by looking for "8-9" (start of day)
        // Each "8-9" marks a new day
        const dayStarts = [];
        let dayCounter = 0;
        for (const slot of timeSlots) {
            if (slot.start === 8 && slot.end === 9) {
                dayStarts.push({ y: slot.y, dayIndex: dayCounter });
                console.log(`[Parser] Day ${dayCounter} (${DAYS_ORDER[dayCounter] || '?'}) starts at Y=${slot.y.toFixed(0)}`);
                dayCounter++;
            }
        }
        console.log(`[Parser] Found ${dayStarts.length} days on this page`);
        if (dayStarts.length === 0) {
            console.log('[Parser] No 8-9 slots found, skipping page');
            return;
        }
        // For each course, find which day it belongs to
        const COURSE_REGEX = /\b([A-ZİĞÜŞÖÇ]{2,4}\d{3,4}[A-Z]?)\b/;
        // Known classroom/room prefixes that should NOT be treated as course codes
        const CLASSROOM_PREFIXES = ['MAK', 'E', 'B', 'A', 'C', 'D', 'LAB', 'SINIF', 'DERSLİK', 'ODA'];
        // Known valid course prefixes (department codes)
        const VALID_DEPT_PREFIXES = ['EEM', 'MAT', 'FİZ', 'KİM', 'ENG', 'TÜR', 'TAR', 'İST', 'İSG', 'BİL', 'ENF', 'İNS', 'MAK', 'END', 'MİM', 'ÇEV', 'GID', 'JEO', 'MET', 'ULA', 'HRT', 'KMB'];
        for (const item of pageItems) {
            const match = item.str.match(COURSE_REGEX);
            if (!match)
                continue;
            const courseCode = match[1];
            if (courseCode.length < 5)
                continue;
            if (['SAAT', 'DERS', 'SINIF'].some(s => courseCode.includes(s)))
                continue;
            // Extract the letter prefix from the code
            const prefixMatch = courseCode.match(/^([A-ZİĞÜŞÖÇ]+)/);
            const prefix = prefixMatch ? prefixMatch[1] : '';
            // Skip if it looks like a classroom (short prefix + number, like E5, MAK228)
            // Classroom codes usually have 1-3 letter prefix that's NOT a department
            if (prefix.length <= 3 && !VALID_DEPT_PREFIXES.includes(prefix)) {
                // Likely a classroom, skip unless prefix is a known department
                console.log(`[Parser] Skipped likely classroom: ${courseCode}`);
                continue;
            }
            const itemY = item.y;
            // Find day based on Y position
            // The item belongs to the day whose start Y is just above (greater than or equal to) the item's Y
            let dayIndex = -1;
            for (let i = 0; i < dayStarts.length; i++) {
                const dayStartY = dayStarts[i].y;
                const nextDayStartY = (i < dayStarts.length - 1) ? dayStarts[i + 1].y : 0;
                // Item Y should be <= dayStartY (at or below the day start)
                // AND > nextDayStartY (above the next day's start)
                if (itemY <= dayStartY + 10 && itemY > nextDayStartY) {
                    dayIndex = dayStarts[i].dayIndex;
                    break;
                }
            }
            if (dayIndex < 0 || dayIndex >= DAYS_ORDER.length) {
                continue; // Skip if no valid day found
            }
            const dayName = DAYS_ORDER[dayIndex];
            // Find closest time slot
            let closestTime = { start: 0, end: 0 };
            let minDist = Infinity;
            for (const slot of timeSlots) {
                const dist = Math.abs(itemY - slot.y);
                if (dist < minDist && dist < 15) {
                    minDist = dist;
                    closestTime = { start: slot.start, end: slot.end };
                }
            }
            if (closestTime.start === 0)
                continue;
            // ========== SECTION & TYPE DETECTION ==========
            // Flexible rules:
            // - Groups(X-Y-Z), Group(ö,ç,ş), (A-B-C-D), (A-B), class, all groups = Teorik (lecture)
            // - (A), (B), (Ö) etc. (single character in parentheses) = Lab group
            const textOriginal = item.str;
            let section = 'All'; // Default for lectures
            let type = 'lecture';
            // Pattern for multi-group formats:
            // Groups(A-B-C), Group(X,Y,Z), (A-B-C-D), All Groups, Class, etc.
            const multiGroupPatterns = [
                /groups?\s*\(([^)]+)\)/i, // Groups(A-B-C) or Group(X,Y,Z)
                /\(([A-Za-zÖÜŞÇİĞ][-–,\s][A-Za-zÖÜŞÇİĞ])/, // (A-B) or (X,Y)
                /class/i, // class
                /all\s*groups?/i, // all groups
                /tüm\s*grup/i // tüm gruplar
            ];
            // Pattern for single group: exactly one character in parentheses
            // Matches (A), (B), (Ö), (Ş), etc.
            const singleGroupMatch = textOriginal.match(/\(([A-Za-zÖÜŞÇİĞ])\)/);
            // Check if any multi-group pattern matches
            const hasMultiGroup = multiGroupPatterns.some(pattern => pattern.test(textOriginal));
            if (singleGroupMatch && !hasMultiGroup) {
                // Single letter like (A) without multi-group indicator -> Lab group
                type = 'lab';
                section = singleGroupMatch[1].toUpperCase();
            }
            else if (hasMultiGroup) {
                // Multiple groups or "all" -> Lecture for all
                type = 'lecture';
                section = 'All';
            }
            else {
                // No group info -> assume lecture for all
                type = 'lecture';
                section = 'All';
            }
            offerings.push({
                courseCode,
                day: dayName,
                startTime: `${closestTime.start.toString().padStart(2, '0')}:00`,
                endTime: `${closestTime.end.toString().padStart(2, '0')}:00`,
                section,
                type,
                async: false
            });
            console.log(`[Parser] ${courseCode} -> ${dayName} ${closestTime.start}:00-${closestTime.end}:00`);
        }
    });
    // Merge consecutive slots
    const merged = mergeConsecutiveSlots(offerings);
    console.log('='.repeat(60));
    console.log(`[Parser] DONE - ${merged.length} total offerings`);
    const summary = {};
    merged.forEach(o => { summary[o.day] = (summary[o.day] || 0) + 1; });
    console.log('[Parser] By day:', summary);
    return merged;
}
function mergeConsecutiveSlots(offerings) {
    if (offerings.length === 0)
        return [];
    const sorted = [...offerings].sort((a, b) => {
        const dayDiff = DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day);
        if (dayDiff !== 0)
            return dayDiff;
        if (a.courseCode !== b.courseCode)
            return a.courseCode.localeCompare(b.courseCode);
        if (a.section !== b.section)
            return a.section.localeCompare(b.section);
        return a.startTime.localeCompare(b.startTime);
    });
    const merged = [];
    for (const curr of sorted) {
        if (merged.length === 0) {
            merged.push({ ...curr });
            continue;
        }
        const last = merged[merged.length - 1];
        if (last.day === curr.day &&
            last.courseCode === curr.courseCode &&
            last.section === curr.section &&
            last.endTime === curr.startTime) {
            last.endTime = curr.endTime;
        }
        else {
            merged.push({ ...curr });
        }
    }
    return merged;
}
// Legacy exports
export function parseScheduleText(text) {
    return [];
}
export function parseEstuScheduleJson(items) {
    return {
        meta: { department: "EEM", academic_year: "-", term: "-", source_pages: 0, notes: [] },
        tables: []
    };
}
export function convertJsonToSchedule(parsed) {
    return [];
}
