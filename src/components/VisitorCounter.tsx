import React, { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';

export const VisitorCounter: React.FC<{ label?: string }> = (props) => {
    const [count, setCount] = useState<number | null>(null);

    useEffect(() => {
        // Use a unique namespace based on the username and repo
        // This makes sure it doesn't conflict easily
        const NAMESPACE = 'estu-student-assistant';
        const KEY = 'visits';

        // Using counterapi.dev which is free and simple
        // 'up' endpoint increments and returns the new value
        fetch(`https://api.counterapi.dev/v1/${NAMESPACE}/${KEY}/up`)
            .then(res => res.json())
            .then(data => {
                if (data && data.count) {
                    setCount(data.count);
                }
            })
            .catch(err => console.error('Counter error:', err));
    }, []);

    if (count === null) return null;

    return (
        <div className="fixed bottom-4 right-4 bg-white/90 backdrop-blur-sm shadow-lg rounded-full px-4 py-2 flex items-center gap-2 text-sm text-gray-600 border border-gray-200 z-50 animate-fade-in transition-all hover:scale-105">
            <Eye className="w-4 h-4 text-blue-500" />
            <span className="font-medium">{count.toLocaleString()}</span>
            {/* @ts-ignore */}
            <span className="text-xs text-gray-400">{props.label || 'görüntülenme'}</span>
        </div>
    );
};
