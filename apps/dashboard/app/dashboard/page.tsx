import React from 'react';
import { Navbar } from '@/components/ui/Navbar';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <Navbar />
      <div className="max-w-7xl mx-auto">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow border border-gray-200 dark:border-slate-700 p-8 mt-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Aegis On-Chain Verifier Registry</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Hardware Trust Anchor configuration for external smart contract integration. Protect your protocol&apos;s vault by requiring agents to present a valid TEE hardware proof.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 dark:bg-slate-900 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Active Enclave Root Key</h3>
              <p className="font-mono text-sm text-green-600 dark:text-green-400 break-all">
                VALID_SQUADS_PCR0_WHITELIST
              </p>
            </div>
            
            <div className="bg-gray-50 dark:bg-slate-900 p-4 rounded-lg border border-gray-200 dark:border-slate-700 relative">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 uppercase tracking-wide">Anchor Integration Snippet</h3>
              <pre className="font-mono text-sm text-blue-600 dark:text-blue-400 overflow-x-auto">
                <code>require!(aegis::verify_attestation());</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
