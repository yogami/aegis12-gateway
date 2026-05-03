'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/ui/Navbar';
import { useAuth } from '@/lib/auth/auth.context';
import { supabase } from '@/lib/supabase';
import { Agent } from '@/lib/agents/agent.types';

export default function AdminPage() {
    const { user, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const [agents, setAgents] = useState<Agent[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    useEffect(() => {
        const fetchPendingAgents = async () => {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('agents')
                .select('*')
                .eq('is_verified', false)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error fetching agents:', error);
            } else {
                setAgents(data || []);
            }
            setIsLoading(false);
        };

        fetchPendingAgents();
    }, []);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    const handleApprove = async (agentId: string) => {
        setActionLoading(agentId);
        const { error } = await supabase
            .from('agents')
            .update({ is_verified: true })
            .eq('id', agentId);

        if (error) {
            console.error('Error approving agent:', error);
            alert('Failed to approve agent: ' + error.message);
        } else {
            // Remove from list
            setAgents(agents.filter(a => a.id !== agentId));
        }
        setActionLoading(null);
    };

    const handleReject = async (agentId: string) => {
        if (!confirm('Are you sure you want to reject and delete this agent?')) {
            return;
        }

        setActionLoading(agentId);
        const { error } = await supabase
            .from('agents')
            .delete()
            .eq('id', agentId);

        if (error) {
            console.error('Error rejecting agent:', error);
            alert('Failed to reject agent: ' + error.message);
        } else {
            setAgents(agents.filter(a => a.id !== agentId));
        }
        setActionLoading(null);
    };

    if (authLoading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <main className="min-h-screen pt-24 pb-16 px-4 md:px-8">
            <Navbar />

            <div className="max-w-7xl mx-auto">
                <header className="mb-10">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
                    <p className="text-gray-600 dark:text-gray-400">Review and approve pending agent registrations.</p>
                </header>

                <section className="glass-panel rounded-xl p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold">Pending Agents</h2>
                        <span className="bg-yellow-100 text-yellow-800 text-sm font-medium px-3 py-1 rounded-full dark:bg-yellow-900 dark:text-yellow-300">
                            {agents.length} pending
                        </span>
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                        </div>
                    ) : agents.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <p>No pending agents to review!</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {agents.map((agent) => (
                                <div
                                    key={agent.id}
                                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                                >
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-gray-900 dark:text-white">{agent.name}</h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
                                            {agent.description || 'No description'}
                                        </p>
                                        <div className="flex gap-2 mt-2">
                                            {agent.compliance_tags?.map((tag) => (
                                                <span
                                                    key={tag}
                                                    className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300"
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 ml-4">
                                        <button
                                            onClick={() => handleApprove(agent.id)}
                                            disabled={actionLoading === agent.id}
                                            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                                        >
                                            {actionLoading === agent.id ? '...' : '✓ Approve'}
                                        </button>
                                        <button
                                            onClick={() => handleReject(agent.id)}
                                            disabled={actionLoading === agent.id}
                                            className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                                        >
                                            ✕ Reject
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
