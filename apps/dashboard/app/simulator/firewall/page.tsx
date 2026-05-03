'use client';

import { useState } from 'react';
import { Navbar } from '@/components/ui/Navbar';

export default function FirewallSimulatorPage() {
    const [agentTier, setAgentTier] = useState('T1');
    const [txType, setTxType] = useState('transfer');
    const [amount, setAmount] = useState(100);
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleSimulate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setResult(null);

        try {
            const res = await fetch('/api/firewall/simulate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agent_tier: agentTier, tx_type: txType, amount })
            });
            const data = await res.json();
            setResult(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="min-h-screen pt-24 pb-16 px-4 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
            <Navbar />
            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-10">
                    <h1 className="text-3xl md:text-4xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-red-600 to-orange-600">
                        Wallet Firewall Simulator
                    </h1>
                    <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                        Test how the Aegis-12 deterministic firewall enforces on-chain security policies based on an agent's TrustScore tier.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    {/* Input Form */}
                    <div className="glass-panel rounded-3xl p-8 shadow-xl border border-white/20 dark:border-slate-700/50">
                        <h2 className="text-2xl font-bold mb-6 text-slate-800 dark:text-white">Transaction Parameters</h2>
                        <form onSubmit={handleSimulate} className="space-y-6">
                            <div>
                                <label className="block mb-2 font-medium text-slate-700 dark:text-slate-300">Agent Tier</label>
                                <select 
                                    value={agentTier}
                                    onChange={(e) => setAgentTier(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-lg focus:ring-red-500 focus:border-red-500 p-3 dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                                >
                                    <option value="T1">Tier 1 (New / Untrusted / Low Score)</option>
                                    <option value="T2">Tier 2 (Verified / Moderate Score)</option>
                                    <option value="T3">Tier 3 (Highly Trusted)</option>
                                </select>
                                <p className="text-xs text-slate-500 mt-2">T1 agents are restricted to read-only operations.</p>
                            </div>

                            <div>
                                <label className="block mb-2 font-medium text-slate-700 dark:text-slate-300">Instruction Type</label>
                                <select 
                                    value={txType}
                                    onChange={(e) => setTxType(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-lg focus:ring-red-500 focus:border-red-500 p-3 dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                                >
                                    <option value="read_only">Read-Only Observation</option>
                                    <option value="transfer">Standard SOL Transfer</option>
                                    <option value="set_authority">SPL Token SetAuthority</option>
                                    <option value="unknown_program">CPI to Unknown Program</option>
                                </select>
                            </div>

                            {txType === 'transfer' && (
                                <div>
                                    <label className="block mb-2 font-medium text-slate-700 dark:text-slate-300">Transfer Amount (USDC)</label>
                                    <input 
                                        type="number"
                                        value={amount}
                                        onChange={(e) => setAmount(Number(e.target.value))}
                                        className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-lg focus:ring-red-500 focus:border-red-500 p-3 dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                                    />
                                </div>
                            )}

                            <button 
                                type="submit" 
                                disabled={isLoading}
                                className="w-full text-white bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 focus:ring-4 focus:ring-red-300 font-bold rounded-lg px-5 py-4 transition-all hover:scale-[1.02] disabled:opacity-50"
                            >
                                {isLoading ? 'Simulating...' : 'Simulate Firewall Execution'}
                            </button>
                        </form>
                    </div>

                    {/* Output Panel */}
                    <div className="glass-panel rounded-3xl p-8 shadow-xl border border-white/20 dark:border-slate-700/50 bg-slate-900 text-green-400 font-mono flex flex-col">
                        <h2 className="text-xl font-bold mb-4 text-white font-sans border-b border-slate-700 pb-2">Firewall Evaluation Output</h2>
                        
                        {!result && !isLoading && (
                            <div className="flex-1 flex items-center justify-center text-slate-500">
                                Waiting for transaction payload...
                            </div>
                        )}

                        {isLoading && (
                            <div className="flex-1 flex flex-col items-center justify-center text-blue-400 gap-4">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
                                <span>Evaluating policy graph...</span>
                            </div>
                        )}

                        {result && (
                            <div className="space-y-6">
                                <div className={`p-4 rounded-lg border-2 ${
                                    result.decision === 'approved' ? 'bg-green-900/30 border-green-500 text-green-400' :
                                    result.decision === 'escalated' ? 'bg-yellow-900/30 border-yellow-500 text-yellow-400' :
                                    'bg-red-900/30 border-red-500 text-red-400'
                                }`}>
                                    <h3 className="text-2xl font-black uppercase tracking-widest">{result.decision}</h3>
                                </div>

                                <div className="space-y-2">
                                    <p className="text-slate-400 text-sm uppercase">Risk Score</p>
                                    <div className="w-full bg-slate-800 rounded-full h-4 border border-slate-700">
                                        <div className={`h-4 rounded-full ${result.riskScore > 0.6 ? 'bg-red-500' : result.riskScore > 0.3 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, Math.max(5, result.riskScore * 100))}%` }}></div>
                                    </div>
                                    <p className="text-xs text-right text-slate-500">{(result.riskScore * 100).toFixed(0)}%</p>
                                </div>

                                {result.flags && result.flags.length > 0 && (
                                    <div className="space-y-3">
                                        <p className="text-slate-400 text-sm uppercase">Security Flags Triggered</p>
                                        {result.flags.map((flag: any, i: number) => (
                                            <div key={i} className="bg-slate-800 p-3 rounded border border-slate-700">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="px-2 py-0.5 bg-red-900/50 text-red-400 text-xs font-bold rounded">
                                                        {flag.severity}
                                                    </span>
                                                    <span className="text-white font-bold text-sm">
                                                        {flag.rule}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-400 leading-relaxed">{flag.detail}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}
