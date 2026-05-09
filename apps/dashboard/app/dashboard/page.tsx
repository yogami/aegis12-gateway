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

        <div className="mt-8 bg-white dark:bg-slate-800 rounded-xl shadow border border-gray-200 dark:border-slate-700 p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Recent Fiduciary Audits</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-slate-900 dark:text-gray-400">
                <tr>
                  <th scope="col" className="px-6 py-3">Timestamp</th>
                  <th scope="col" className="px-6 py-3">Intent Hash</th>
                  <th scope="col" className="px-6 py-3">Verification Status</th>
                  <th scope="col" className="px-6 py-3 text-center">Latency</th>
                  <th scope="col" className="px-6 py-3 text-right">RiscZero Proof</th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-white border-b dark:bg-slate-800 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                  <td className="px-6 py-4 font-mono text-xs">2026-05-09 14:52:11</td>
                  <td className="px-6 py-4 font-mono text-xs truncate max-w-[150px]">0x732e6f893573e119f...</td>
                  <td className="px-6 py-4">
                    <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-green-900 dark:text-green-300">✅ VERIFIED</span>
                  </td>
                  <td className="px-6 py-4 text-center font-mono text-xs">0.8ms</td>
                  <td className="px-6 py-4 text-right font-mono text-xs text-blue-500 hover:underline cursor-pointer">View</td>
                </tr>
                <tr className="bg-red-50/50 border-b dark:bg-red-900/10 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-red-900/20">
                  <td className="px-6 py-4 font-mono text-xs">2026-05-09 14:46:10</td>
                  <td className="px-6 py-4 font-mono text-xs truncate max-w-[150px] text-red-500">0x8a9b2c3d4e5f6g7h8...</td>
                  <td className="px-6 py-4">
                    <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-red-900 dark:text-red-300">❌ INTERCEPTED (CIRCUIT BREAKER)</span>
                  </td>
                  <td className="px-6 py-4 text-center font-mono text-xs text-red-500 font-bold">2.1ms</td>
                  <td className="px-6 py-4 text-right font-mono text-xs text-slate-500">N/A</td>
                </tr>
                <tr className="bg-white border-b dark:bg-slate-800 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                  <td className="px-6 py-4 font-mono text-xs">2026-05-09 13:12:04</td>
                  <td className="px-6 py-4 font-mono text-xs truncate max-w-[150px]">0x11223344556677889...</td>
                  <td className="px-6 py-4">
                    <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-green-900 dark:text-green-300">✅ VERIFIED</span>
                  </td>
                  <td className="px-6 py-4 text-center font-mono text-xs">0.7ms</td>
                  <td className="px-6 py-4 text-right font-mono text-xs text-blue-500 hover:underline cursor-pointer">View</td>
                </tr>
                <tr className="bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                  <td className="px-6 py-4 font-mono text-xs">2026-05-09 10:45:22</td>
                  <td className="px-6 py-4 font-mono text-xs truncate max-w-[150px]">0x99887766554433221...</td>
                  <td className="px-6 py-4">
                    <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded dark:bg-green-900 dark:text-green-300">✅ VERIFIED</span>
                  </td>
                  <td className="px-6 py-4 text-center font-mono text-xs">0.9ms</td>
                  <td className="px-6 py-4 text-right font-mono text-xs text-blue-500 hover:underline cursor-pointer">View</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
