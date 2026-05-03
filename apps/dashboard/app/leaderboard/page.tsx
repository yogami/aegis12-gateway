'use client';

import { useState, useEffect } from 'react';
import { Navbar } from '@/components/ui/Navbar';

interface LeaderboardEntry {
    id: string;
    name: string;
    description: string;
    compliance_tags: string[];
    trust_score: number;
}

export default function LeaderboardPage() {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            try {
                const res = await fetch('/api/leaderboard');
                if (res.ok) {
                    const data = await res.json();
                    setEntries(data);
                }
            } catch (err) {
                console.error('Failed to fetch leaderboard', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchLeaderboard();
    }, []);

    const getMedal = (index: number) => {
        if (index === 0) return '🥇';
        if (index === 1) return '🥈';
        if (index === 2) return '🥉';
        return <span className="text-gray-400 font-bold w-6 text-center">{index + 1}</span>;
    };

    return (
        <main className="min-h-screen pt-24 pb-16 px-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
            <Navbar />
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                        Aegis Score Leaderboard
                    </h1>
                    <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                        The top verified digital health AI agents, ranked by their deterministic TrustScore and on-chain compliance.
                    </p>
                </div>

                <div className="glass-panel rounded-3xl p-6 shadow-xl border border-white/20 dark:border-gray-700/50 backdrop-blur-xl">
                    {isLoading ? (
                        <div className="flex justify-center items-center py-20">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                    ) : entries.length === 0 ? (
                        <div className="text-center py-16 text-gray-500">
                            No verified agents found yet.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {entries.map((entry, index) => (
                                <div 
                                    key={entry.id}
                                    className={`group relative flex items-center p-4 rounded-2xl transition-all duration-300 hover:scale-[1.02] hover:shadow-lg
                                        ${index === 0 ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/10 border border-yellow-200 dark:border-yellow-700/30' : 
                                          index === 1 ? 'bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/40 dark:to-gray-800/20 border border-gray-200 dark:border-gray-700/30' : 
                                          index === 2 ? 'bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/10 border border-orange-200 dark:border-orange-700/30' : 
                                          'bg-white dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/30'}`}
                                >
                                    <div className="flex items-center justify-center w-12 h-12 text-3xl mr-4">
                                        {getMedal(index)}
                                    </div>
                                    
                                    <div className="flex-1">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between">
                                            <div>
                                                <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                                    {entry.name}
                                                    {index === 0 && <span className="text-xs px-2 py-1 bg-yellow-200 dark:bg-yellow-600/30 text-yellow-800 dark:text-yellow-400 rounded-full font-semibold">CROWNED</span>}
                                                </h3>
                                                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 mt-1">
                                                    {entry.description}
                                                </p>
                                            </div>
                                            
                                            <div className="flex items-center gap-4 mt-3 md:mt-0">
                                                <div className="flex flex-wrap gap-1">
                                                    {entry.compliance_tags.slice(0, 3).map(tag => (
                                                        <span key={tag} className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded border border-blue-100 dark:border-blue-800/50">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                                
                                                <div className="flex flex-col items-end min-w-[80px]">
                                                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Score</span>
                                                    <span className={`text-3xl font-black ${
                                                        entry.trust_score >= 80 ? 'text-green-500' :
                                                        entry.trust_score >= 60 ? 'text-yellow-500' : 'text-red-500'
                                                    }`}>
                                                        {entry.trust_score}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
