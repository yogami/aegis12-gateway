'use client';

import { useState } from 'react';
import { Agent } from '@/lib/agents/agent.types';
import { AgentCard } from './AgentCard';

interface AgentDirectoryProps {
    agents: Agent[];
}

export function AgentDirectory({ agents }: AgentDirectoryProps) {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredAgents = agents.filter(agent => {
        const query = searchQuery.toLowerCase();
        return (
            agent.name.toLowerCase().includes(query) ||
            agent.description?.toLowerCase().includes(query) ||
            agent.compliance_tags.some(tag => tag.toLowerCase().includes(query))
        );
    });

    return (
        <div>
            {/* Search Bar */}
            <div className="mb-8 max-w-md mx-auto">
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search agents by name, description, or compliance tags..."
                        className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}
                </div>
                {searchQuery && (
                    <p className="mt-2 text-sm text-gray-500 text-center">
                        {filteredAgents.length} agent{filteredAgents.length !== 1 ? 's' : ''} found
                    </p>
                )}
            </div>

            {/* Agent Grid */}
            {filteredAgents.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredAgents.map((agent) => (
                        <AgentCard key={agent.id} agent={agent} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-12">
                    <svg className="w-12 h-12 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-gray-500 dark:text-gray-400">No agents match your search.</p>
                    <button
                        onClick={() => setSearchQuery('')}
                        className="mt-4 text-blue-600 hover:text-blue-700 font-medium"
                    >
                        Clear search
                    </button>
                </div>
            )}
        </div>
    );
}
