'use client';

import { useState } from 'react';
import { Navbar } from '@/components/ui/Navbar';
import { useAuth } from '@/lib/auth/auth.context';

export default function NewAgentPage() {
    const [isLoading, setIsLoading] = useState(false);

    const { user } = useAuth();

    // This would need to call the API in a real implementation
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);

        const formData = new FormData(e.currentTarget);

        // Since we migrated from Supabase, client-side DB access is disabled.
        // For the hackathon demo, we simply mock the registration visually.
        if (user) {
            alert('Agent successfully registered! (Demo Mode)');
            const agentName = formData.get('name') as string;
            window.location.href = `/agents?demo_agent=${encodeURIComponent(agentName)}`;
        } else {
            alert('Please login first to register an agent.');
        }
        setIsLoading(false);
    };

    return (
        <main className="min-h-screen pt-24 pb-16 px-4">
            <Navbar />
            <div className="max-w-2xl mx-auto glass-panel p-8 rounded-2xl">
                <h1 className="text-3xl font-bold mb-8">Register New Agent</h1>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Agent Name</label>
                        <input name="name" type="text" className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" placeholder="e.g., MediChat AI" required />
                    </div>

                    <div>
                        <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Description</label>
                        <textarea name="description" rows={4} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" placeholder="Describe the agent's purpose..." required></textarea>
                    </div>

                    <div>
                        <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Website URL</label>
                        <input name="website_url" type="url" className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" placeholder="https://..." />
                    </div>

                    <div>
                        <label className="block mb-2 text-sm font-medium text-gray-900 dark:text-white">Compliance Tags (comma separated)</label>
                        <input name="compliance_tags" type="text" className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white" placeholder="GDPR, HIPAA, MDR" />
                    </div>

                    <button type="submit" disabled={isLoading} className="w-full text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800 transition-all">
                        {isLoading ? 'Submitting...' : 'Register Agent'}
                    </button>
                </form>
            </div>
        </main>
    );
}
