'use client';

import React from 'react';
import Link from 'next/link';

export function Navbar() {
    return (
        <nav className="fixed w-full z-50 top-0 start-0 border-b border-white/20 dark:border-slate-700/50 glass-panel">
            <div className="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
                <Link href="/" className="flex items-center space-x-3 rtl:space-x-reverse">
                    <span className="self-center text-2xl font-bold whitespace-nowrap bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-violet-600 dark:from-blue-400 dark:to-violet-400">
                        Aegis-12
                    </span>
                </Link>
                <div className="flex md:order-2 space-x-3 md:space-x-0 rtl:space-x-reverse items-center gap-4">
                    <span className="text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 font-mono font-medium rounded text-xs px-3 py-1.5 flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        Telemetry Active
                    </span>
                </div>
            </div>
        </nav>
    );
}
