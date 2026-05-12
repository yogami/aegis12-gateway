'use client';

import React from 'react';

interface StatsCardProps {
    title: string;
    value: string | number;
    description?: string;
    icon?: React.ReactNode;
}

export function StatsCard({ title, value, description, icon }: StatsCardProps) {
    return (
        <div className="glass-card p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium uppercase tracking-wider">{title}</h3>
                {icon && <div className="text-blue-500 dark:text-blue-400">{icon}</div>}
            </div>
            <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-gray-900 dark:text-white">{value}</span>
            </div>
            {description && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{description}</p>
            )}
        </div>
    );
}
