import React, { useEffect, useState } from 'react';
import { AlertCircle, GraduationCap } from 'lucide-react';
import type { DepartmentIndexEntry, DepartmentProfile } from '../types/department';
import { loadDepartmentIndex, loadDepartmentProfile, DepartmentProfileError } from '../utils/departmentRegistry';

interface Props {
    value: string | null;
    onChange: (code: string, profile: DepartmentProfile) => void;
}

const STORAGE_KEY = 'estu-planner-department';

export function DepartmentSelector({ value, onChange }: Props) {
    const [departments, setDepartments] = useState<DepartmentIndexEntry[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        loadDepartmentIndex()
            .then(async list => {
                if (cancelled) return;
                setDepartments(list);

                const remembered = value ?? localStorage.getItem(STORAGE_KEY);
                const initial = list.find(d => d.code === remembered) ?? (list.length === 1 ? list[0] : null);
                if (initial) await select(initial.code);
            })
            .catch((err: Error) => { if (!cancelled) setError(err.message); })
            .finally(() => { if (!cancelled) setLoading(false); });

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function select(code: string) {
        try {
            const profile = await loadDepartmentProfile(code);
            localStorage.setItem(STORAGE_KEY, code);
            setError(null);
            onChange(code, profile);
        } catch (err) {
            setError(err instanceof DepartmentProfileError ? err.message : String(err));
        }
    }

    return (
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <GraduationCap className="w-4 h-4" />
                Bölüm
            </label>

            <select
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:bg-gray-100"
                value={value ?? ''}
                disabled={loading || departments.length === 0}
                onChange={e => select(e.target.value)}
            >
                <option value="" disabled>
                    {loading ? 'Bölümler yükleniyor…' : 'Bölüm seçin'}
                </option>
                {departments.map(d => (
                    <option key={d.code} value={d.code}>
                        {d.name}{d.faculty ? ` — ${d.faculty}` : ''}
                    </option>
                ))}
            </select>

            {error && (
                <div className="mt-3 flex gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                        <p className="font-medium">Bölüm profili yüklenemedi</p>
                        <p className="mt-1">{error}</p>
                    </div>
                </div>
            )}

            {!loading && !error && departments.length === 0 && (
                <p className="mt-3 text-sm text-gray-600">
                    Henüz tanımlı bölüm yok. <code className="bg-gray-100 px-1 rounded">public/data/departments/</code> altına
                    bir profil ekleyip <code className="bg-gray-100 px-1 rounded">index.json</code> dosyasına kaydedin.
                </p>
            )}
        </div>
    );
}
