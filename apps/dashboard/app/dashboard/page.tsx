'use client';

import React, { useEffect, useState } from 'react';
import { Navbar } from '@/components/ui/Navbar';

interface AuditRecord {
  timestamp: string;
  intentHash: string;
  status: string;
  latency: string;
  proofLink: string;
}

export default function Dashboard() {
  const [audits, setAudits] = useState<AuditRecord[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('fiduciary_audits');
    if (stored) {
      setAudits(JSON.parse(stored));
    }
  }, []);
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
                {audits.length === 0 ? (
                  <tr className="bg-white border-b dark:bg-slate-800 dark:border-slate-700">
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500 font-mono text-sm">
                      Waiting for first hardware attestation...
                      <br />
                      <span className="text-xs text-slate-600 mt-2 block">Trigger an Intent Stream or Lockdown on the Control Plane to generate cryptographic receipts.</span>
                    </td>
                  </tr>
                ) : (
                  audits.map((audit, i) => (
                    <tr key={i} className={`${audit.status.includes('INTERCEPTED') ? 'bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20' : 'bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50'} border-b dark:border-slate-700`}>
                      <td className="px-6 py-4 font-mono text-xs">{audit.timestamp}</td>
                      <td className={`px-6 py-4 font-mono text-xs truncate max-w-[150px] ${audit.status.includes('INTERCEPTED') ? 'text-red-500' : ''}`}>{audit.intentHash}</td>
                      <td className="px-6 py-4">
                        <span className={`${audit.status.includes('INTERCEPTED') ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'} text-xs font-medium px-2.5 py-0.5 rounded`}>
                          {audit.status}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-center font-mono text-xs ${audit.status.includes('INTERCEPTED') ? 'text-red-500 font-bold' : ''}`}>{audit.latency}</td>
                      <td className="px-6 py-4 text-right font-mono text-xs">
                        {audit.proofLink !== "N/A" ? (
                          <a href={audit.proofLink} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline cursor-pointer">View</a>
                        ) : (
                          <span className="text-slate-500">N/A</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
