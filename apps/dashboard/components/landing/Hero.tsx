'use client';

import { Button } from '@/components/ui/Button';

export function Hero() {
    return (
        <section className="relative pt-32 pb-20 overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl mix-blend-multiply animate-pulse" style={{ animationDuration: '4s' }}></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl mix-blend-multiply animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }}></div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
                <span className="inline-block py-1 px-3 rounded-full bg-blue-100/50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 text-sm font-medium mb-8 backdrop-blur-sm">
                    🚀 Live on Solana Colosseum
                </span>

                <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8">
                    Hardware Firewall for <br />
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-600 dark:from-blue-400 dark:via-indigo-300 dark:to-violet-400 animate-gradient-x">
                        Autonomous Agents
                    </span>
                </h1>

                <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-600 dark:text-gray-300 mb-10 leading-relaxed">
                    Runtime protection for agentic wallets. We prevent VaultBot heists and secure autonomous DeFi transactions using the Phala TEE.
                </p>

                <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <Button href="/simulator" size="lg" className="w-full sm:w-auto">
                        Run Heist Simulator
                    </Button>
                    <Button href="#" variant="secondary" size="lg" className="w-full sm:w-auto">
                        View SDK Docs
                    </Button>
                </div>

                <div className="mt-16 pt-8 border-t border-gray-100 dark:border-gray-800">
                    <p className="text-sm text-gray-500 uppercase tracking-widest font-semibold mb-6">Trusted by innovators in Berlin</p>
                    <div className="flex justify-center flex-wrap gap-8 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
                        {/* Placeholder logos */}
                        <div className="h-8 w-24 bg-gray-300 dark:bg-gray-700 rounded animate-pulse"></div>
                        <div className="h-8 w-24 bg-gray-300 dark:bg-gray-700 rounded animate-pulse"></div>
                        <div className="h-8 w-24 bg-gray-300 dark:bg-gray-700 rounded animate-pulse"></div>
                        <div className="h-8 w-24 bg-gray-300 dark:bg-gray-700 rounded animate-pulse"></div>
                    </div>
                </div>
            </div>
        </section>
    );
}
