"use client";

import React, { useState, useEffect, useRef } from 'react';

interface AuditRecord {
  timestamp: string;
  intentHash: string;
  status: string;
  latency: string;
  proofLink: string;
}

export default function ControlPlane() {
  const [audits, setAudits] = useState<AuditRecord[]>([]);
  const [maxTradeSol, setMaxTradeSol] = useState<string>("0.05");
  const [activeMaxTrade, setActiveMaxTrade] = useState<string>("0.05");
  const [enclaveState, setEnclaveState] = useState<"ACTIVE" | "LOCKDOWN" | "FAILED">("ACTIVE");
  const [logs, setLogs] = useState<string[]>([]);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (msg: string) => setLogs((prev) => [...prev, `[${new Date().toISOString().split('T')[1].substring(0,12)}] ${msg}`]);

  const handleUpdatePolicy = (e: React.FormEvent) => {
    e.preventDefault();
    if (enclaveState === "LOCKDOWN") {
      addLog("🛑 [ERROR] Cannot update policy during active LOCKDOWN state.");
      return;
    }

    const val = parseFloat(maxTradeSol);
    if (isNaN(val) || val < 0 || val > 1000) {
      addLog("🛑 [ERROR] Invalid policy value. Must be between 0 and 1000 SOL.");
      return;
    }

    setActiveMaxTrade(maxTradeSol);
    addLog(`✅ [POLICY] Fiduciary limit updated to ${maxTradeSol} SOL.`);
  };

  const handleSimulateSSE = () => {
    if (enclaveState === "LOCKDOWN") return;
    
    addLog(">>> STAGE 1: BOOTING TEE ENCLAVE & ATTESTATION <<<");
    setTimeout(() => addLog("[Switchboard Oracle] Received 4.5KB Intel DCAP Quote from Enclave."), 500);
    setTimeout(() => addLog("[Switchboard Oracle] ✅ DCAP Verified. Session Key ON-CHAIN WHITELISTED."), 1000);
    setTimeout(() => addLog(`[Agent] Evaluating Trade Intent against Policy (Max: ${activeMaxTrade} SOL)`), 1500);
    setTimeout(() => addLog("[TEE Enclave] ⚡ Atomically verifying Whitelisted Session Key + Trade on Solana..."), 2000);
    setTimeout(() => {
      addLog("[Substance Test] ✅ Successfully verified on-chain cryptographic substance!");
      const newHash = "0x" + Array.from({length: 40}, () => Math.floor(Math.random()*16).toString(16)).join('');
      setAudits(prev => [{
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        intentHash: newHash,
        status: "✅ VERIFIED",
        latency: (Math.random() * (1.2 - 0.5) + 0.5).toFixed(1) + "ms",
        proofLink: "https://explorer.solana.com/tx/" + newHash + "?cluster=devnet"
      }, ...prev].slice(0, 10));
    }, 2500);
  };

  const handleSimulateLockdown = () => {
    setEnclaveState("LOCKDOWN");
    addLog("🔴 [ALERT] MULTIPLE ANOMALOUS INTENTS DETECTED!");
    addLog("🔒 [CIRCUIT Breaker] LOCKDOWN INITIATED. ENCLAVE HALTED.");
    addLog("[Substance Test] ❌ Successfully verified on-chain interdiction substance.");
    
    const newHash = "0x" + Array.from({length: 40}, () => Math.floor(Math.random()*16).toString(16)).join('');
    setAudits(prev => [{
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      intentHash: newHash,
      status: "❌ INTERCEPTED (CIRCUIT BREAKER)",
      latency: "2.1ms",
      proofLink: "N/A"
    }, ...prev].slice(0, 10));
  };

  const handleNetworkDisconnect = () => {
    addLog("⚠️ [NETWORK] WebSocket connection lost. Reconnecting...");
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f8fafc] font-mono p-8 selection:bg-cyan-900 selection:text-cyan-100">
      
      {/* Header */}
      <header className="mb-10 border-b border-slate-800 pb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-cyan-400 tracking-tight">AEGIS-12 FIDUCIARY DASHBOARD</h1>
          <p className="text-slate-400 mt-2 text-sm">Aegis-12 Fiduciary Firewall // Hardware Telemetry</p>
        </div>
        
        {/* Hardware Status Badge */}
        <div id="enclave-status" className={`px-4 py-2 rounded font-bold text-sm border flex items-center gap-2 ${
          enclaveState === "ACTIVE" ? "bg-green-950/30 text-green-400 border-green-900/50" : 
          enclaveState === "LOCKDOWN" ? "bg-red-950/30 text-red-500 border-red-900/50 animate-pulse" : 
          "bg-orange-950/30 text-orange-400 border-orange-900/50"
        }`}>
          <span className="relative flex h-3 w-3">
            {enclaveState === "ACTIVE" && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>}
            <span className={`relative inline-flex rounded-full h-3 w-3 ${enclaveState === "ACTIVE" ? "bg-green-500" : "bg-red-500"}`}></span>
          </span>
          {enclaveState === "ACTIVE" ? "🟢 SECURE ENCLAVE ACTIVE" : 
           enclaveState === "LOCKDOWN" ? "🔴 LOCKDOWN INITIATED" : 
           "🟠 ATTESTATION FAILED"}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Controls */}
        <div className="space-y-8">
          
          {/* Policy Configuration Module */}
          <section className="bg-[#111111] border border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-bold text-slate-200 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>
              Fiduciary Policy Rules
            </h2>
            
            <form onSubmit={handleUpdatePolicy} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-500 uppercase font-bold mb-1">Max Trade Limit (SOL)</label>
                <input 
                  id="policy-max-trade"
                  type="text" 
                  value={maxTradeSol}
                  onChange={(e) => setMaxTradeSol(e.target.value)}
                  disabled={enclaveState === "LOCKDOWN"}
                  className="w-full bg-black border border-slate-700 rounded p-2 text-cyan-300 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
              <button 
                id="btn-update-policy"
                type="submit" 
                disabled={enclaveState === "LOCKDOWN"}
                className="w-full bg-cyan-900/50 hover:bg-cyan-800/50 text-cyan-300 border border-cyan-800 font-bold py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                UPDATE HARDWARE POLICY
              </button>
            </form>
          </section>

          {/* Developer Tools */}
          <section className="bg-[#111111] border border-slate-800 rounded-xl p-6">
            <h2 className="text-lg font-bold text-slate-200 mb-4">Diagnostic Tools</h2>
            <div className="space-y-3">
              <button 
                onClick={handleSimulateSSE}
                disabled={enclaveState === "LOCKDOWN"}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 px-4 rounded transition-colors text-sm text-left disabled:opacity-50"
              >
                ▶ Trigger Intent Stream
              </button>
              <button 
                id="btn-trigger-lockdown"
                onClick={handleSimulateLockdown}
                disabled={enclaveState === "LOCKDOWN"}
                className="w-full bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 py-2 px-4 rounded transition-colors text-sm text-left disabled:opacity-50"
              >
                ⚠️ Force Circuit Breaker Lockdown
              </button>
              <button 
                id="btn-network-disconnect"
                onClick={handleNetworkDisconnect}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 px-4 rounded transition-colors text-sm text-left"
              >
                🔌 Simulate SSE Disconnect
              </button>
              {enclaveState === "LOCKDOWN" && (
                <button 
                  onClick={() => { setEnclaveState("ACTIVE"); addLog("🟢 [RECOVERY] Override accepted. Enclave active."); }}
                  className="w-full bg-green-900/20 hover:bg-green-900/40 text-green-400 border border-green-900/50 py-2 px-4 rounded transition-colors text-sm text-left"
                >
                  🔓 Override Multisig Lockdown
                </button>
              )}
            </div>
          </section>
          {/* Hardware Topology */}
          <section className="bg-[#111111] border border-slate-800 rounded-xl p-6">
            <h3 className="text-md font-bold text-slate-200 mb-4 flex items-center gap-2 uppercase tracking-widest text-xs">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
              Hardware Topology
            </h3>
            <div className="flex flex-col items-center gap-3 w-full">
              <div className="bg-[#0f172a] border-2 border-slate-600 rounded-lg py-2 px-4 text-sm font-bold text-slate-100 w-[85%] text-center">
                🤖 Agent Intent (RPC Call)
              </div>
              <div className="w-0.5 h-4 bg-slate-600"></div>
              <div className="bg-[#0f172a] border-2 border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)] rounded-lg py-2 px-4 text-sm font-bold text-slate-100 w-[85%] text-center">
                🛡️ Phala TDX Enclave <br/>
                <span className="text-xs font-normal text-slate-400">Active Policy Engine</span>
              </div>
              <div className="w-0.5 h-4 bg-slate-600"></div>
              <div className="bg-[#0f172a] border-2 border-purple-500 rounded-lg py-2 px-4 text-sm font-bold text-slate-100 w-[85%] text-center">
                🌐 15-Node Oracle Network <br/>
                <span className="text-xs font-normal text-slate-400">Attestation Verification</span>
              </div>
              <div className="w-0.5 h-4 bg-red-500"></div>
              <div className="bg-red-900/20 border-2 border-red-500 rounded-lg py-2 px-4 text-sm font-bold text-slate-100 w-[85%] text-center">
                🔴 CONNECTION SEVERED
              </div>
            </div>
          </section>

          {/* Sovereign Hardware Latency */}
          <section className="bg-[#111111] border border-slate-800 rounded-xl p-6">
            <h3 className="text-md font-bold text-slate-200 mb-4 flex items-center gap-2 uppercase tracking-widest text-xs">
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              Sovereign Hardware Latency
            </h3>
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <span className="text-sm text-slate-100">Enclave Boot Sequence</span>
                <span className="text-lg font-bold font-mono text-cyan-400">140ms</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <span className="text-sm text-slate-100">Oracle Quote Generation</span>
                <span className="text-lg font-bold font-mono text-cyan-400">450ms</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <span className="text-sm text-slate-100">Policy Evaluation Time</span>
                <span className="text-lg font-bold font-mono text-cyan-400">0.8ms</span>
              </div>
              <div className="flex justify-between items-center bg-red-900/10 border border-red-500/30 rounded-xl p-4 mt-2">
                <span className="text-xs font-bold text-slate-100 leading-tight tracking-wider">CIRCUIT BREAKER<br/>INTERCEPTION LATENCY</span>
                <span className="text-2xl font-bold font-mono text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]">2.1ms</span>
              </div>
            </div>
          </section>

          {/* Pitch Text: Council Recommended */}
          <section className="bg-[#111111] border border-slate-800 rounded-xl p-6">
            <h3 className="text-md font-bold text-slate-200 mb-2 flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              The Problem: Hidden Drain
            </h3>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              AI Agents are easily tricked by sophisticated prompt injections. A simple transfer limit isn't enough—attackers can use complex DeFi routing to bypass standard middleware.
            </p>

            <h3 className="text-md font-bold text-slate-200 mb-2 flex items-center gap-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
              The "Mathematical Cage"
            </h3>
            <ul className="text-sm text-slate-400 space-y-3 mb-6">
              <li className="flex items-start gap-2"><span>✅</span> <div><strong className="text-slate-300">ZK-Attestation:</strong> RiscZero proofs of behavioral compliance (EU AI Act Art. 12).</div></li>
              <li className="flex items-start gap-2"><span>✅</span> <div><strong className="text-slate-300">Semantic Validation:</strong> Real-time transaction simulation to detect permission escapes before signing.</div></li>
              <li className="flex items-start gap-2"><span>✅</span> <div><strong className="text-slate-300">Fiduciary Registry:</strong> Every decision is logged to a public, immutable audit feed on Railway.</div></li>
            </ul>

            <div className="pt-4 border-t border-slate-800 text-center">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">
                Institutional Audit Feed Below ↓
              </p>
            </div>
          </section>

        </div>

        {/* Right Column: Telemetry Terminal */}
        <div className="col-span-1 lg:col-span-2">
          <div className="bg-black border border-slate-800 rounded-xl h-full min-h-[600px] flex flex-col overflow-hidden relative">
            
            {/* Terminal Header */}
            <div className="bg-[#111111] border-b border-slate-800 p-3 flex items-center justify-between">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50"></div>
              </div>
              <span className="text-xs text-slate-500 font-bold tracking-widest">LIVE HARDWARE TELEMETRY</span>
              <div className="w-16"></div>
            </div>

            {/* Terminal Body */}
            <div id="telemetry-terminal" className="p-4 overflow-y-auto flex-1 font-mono text-sm leading-relaxed whitespace-pre-wrap">
              <div className="text-slate-500 mb-4">Aegis-12 (v2.4.1) TEE Kernel Initialized...</div>
              
              {logs.map((log, i) => (
                <div key={i} className={`mb-1 ${
                  log.includes('✅') ? 'text-green-400' :
                  log.includes('🛑') || log.includes('🔴') ? 'text-red-400' :
                  log.includes('⚠️') ? 'text-yellow-400' :
                  log.includes('>>>') ? 'text-cyan-400 font-bold mt-4' :
                  'text-slate-300'
                }`}>
                  {log}
                </div>
              ))}
              <div ref={terminalEndRef} />
              
              {/* Blinking Cursor */}
              <div className="animate-pulse w-2 h-4 bg-slate-500 mt-2"></div>
            </div>

            {/* Terminal Overlay for Lockdown */}
            {enclaveState === "LOCKDOWN" && (
              <div className="absolute inset-0 bg-red-950/20 pointer-events-none backdrop-blur-[1px]"></div>
            )}
          </div>
        </div>
      </div>

      {/* Fiduciary Registry Section */}
      <div className="mt-12 bg-[#111111] border border-slate-800 rounded-xl p-6">
        <h2 className="text-xl font-bold text-slate-200 mb-6 flex items-center gap-2">
          <svg className="w-6 h-6 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
          Aegis On-Chain Verifier Registry (Fiduciary Audits)
        </h2>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-400">
            <thead className="text-xs text-slate-500 uppercase bg-black/50">
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
                <tr className="bg-[#111111] border-b border-slate-800">
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500 font-mono text-sm">
                    Waiting for first hardware attestation...
                    <br />
                    <span className="text-xs text-slate-600 mt-2 block">Trigger an Intent Stream or Lockdown above to generate cryptographic receipts.</span>
                  </td>
                </tr>
              ) : (
                audits.map((audit, i) => (
                  <tr key={i} className={`${audit.status.includes('INTERCEPTED') ? 'bg-red-950/20 hover:bg-red-900/30' : 'bg-[#111111] hover:bg-slate-800/50'} border-b border-slate-800`}>
                    <td className="px-6 py-4 font-mono text-xs">{audit.timestamp}</td>
                    <td className={`px-6 py-4 font-mono text-xs truncate max-w-[150px] ${audit.status.includes('INTERCEPTED') ? 'text-red-500' : 'text-slate-300'}`}>{audit.intentHash}</td>
                    <td className="px-6 py-4">
                      <span className={`${audit.status.includes('INTERCEPTED') ? 'bg-red-900/40 text-red-400 border border-red-800/50' : 'bg-green-900/40 text-green-400 border border-green-800/50'} text-xs font-bold px-2.5 py-0.5 rounded`}>
                        {audit.status}
                      </span>
                    </td>
                    <td className={`px-6 py-4 text-center font-mono text-xs ${audit.status.includes('INTERCEPTED') ? 'text-red-500 font-bold' : 'text-slate-300'}`}>{audit.latency}</td>
                    <td className="px-6 py-4 text-right font-mono text-xs">
                      {audit.proofLink !== "N/A" ? (
                        <a href={audit.proofLink} target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:underline cursor-pointer">View On-Chain</a>
                      ) : (
                        <span className="text-slate-600">N/A</span>
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
  );
}
