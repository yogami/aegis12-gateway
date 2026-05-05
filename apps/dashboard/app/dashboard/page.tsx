import React from 'react';
import { Navbar } from '@/components/ui/Navbar';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <Navbar />
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Firewall Control Panel</h1>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
            Deploy New Policy
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow border border-gray-200 dark:border-slate-700 p-8 text-center">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No Active Policies</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
            You haven&apos;t configured any hardware constraints for your autonomous agents yet. Use the Aegis-12 SDK to deploy rules.
          </p>
          <a href="#" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">
            Read the SDK Documentation &rarr;
          </a>
        </div>

        <div className="mt-8 bg-white dark:bg-slate-800 rounded-xl shadow border border-gray-200 dark:border-slate-700 p-8">
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
