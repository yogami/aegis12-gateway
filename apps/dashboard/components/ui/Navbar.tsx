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
                    <Link href="/dashboard" className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-4 py-2 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 transition-all hover:scale-105">
                        Institutional Registry
                    </Link>
                </div>
            </div>
        </nav>
    );
}
