export interface Course {
    code: string;
    name: string;
    credits: number;
    ects: number;
    type: 'zorunlu' | 'mesleki_secmeli' | 'secmeli' | 'universite_secmeli';
    prerequisites?: string[];
    semester?: number;
}

export interface Grade {
    letter: string;
    coefficient: number;
    passed: boolean;
}

export interface StudentRecord {
    id: string;
    courseCode: string;
    courseName: string;
    semester: string;
    credits: number;
    ects: number;
    grade: Grade;
    retake?: boolean;
    status?: string; // MS, MUAF, etc.
    countInGPA?: boolean; // S statülü dersler GNO'ya katılmaz
    equivalentCourse?: string; // Bu dersin yerine sayıldığı eski ders kodu (Yerine-1/2) OR bu dersin sayıldığı ana kod
}

export interface ScheduleOffering {
    courseCode: string;
    section: string;
    day: string;
    startTime: string;
    endTime: string;
    room?: string;
    type: 'lecture' | 'lab';
    async?: boolean;
}

export interface GPAResult {
    gno: number;
    dno: number;
    totalCredits: number;
    passedCredits: number;
    totalECTS: number;
    totalAttempted: number;
    usedCourses: StudentRecord[]; // Hesaplamada kullanılan derslerin listesi
    replacedCourses?: StudentRecord[]; // Yerine sayıldığı için listeden çıkarılan dersler
}

export interface SpecializationArea {
    id: string;
    name: string;
    nameEn: string;
    requiredCourses: string[];
    minCourses: number;
    minECTS: number;
}

export interface IntibakMapping {
    oldCode: string;
    newCode: string;
    note: string;
}

// New interfaces for Advanced Schedule Parser
export interface ScheduleEntry {
    day: 'Pazartesi' | 'Salı' | 'Çarşamba' | 'Perşembe' | 'Cuma' | 'Cumartesi' | 'Pazar';
    start: string; // HH:MM
    end: string;   // HH:MM
    course_code: string;
    course_name: string;
    group: string | null;
    instructor: string | null;
    session_type: 'Lecture' | 'Lab' | 'Other';
    room: string | null;
    column: string; // "Ders I", "Ders II" etc.
    raw_text: string;
    confidence: number;
}

export interface ScheduleTable {
    class_year: number;
    entries: ScheduleEntry[];
}

export interface ParsedSchedule {
    meta: {
        department: string;
        academic_year: string;
        term: string;
        source_pages: number;
        notes: string[];
    };
    tables: ScheduleTable[];
}
