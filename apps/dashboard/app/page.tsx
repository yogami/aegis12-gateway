"use client";

import React, { useState, useEffect, useRef } from 'react';

export default function ControlPlane() {
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
    setTimeout(() => addLog("✅ Execution successful!"), 2500);
  };

  const handleSimulateLockdown = () => {
    setEnclaveState("LOCKDOWN");
    addLog("🔴 [ALERT] MULTIPLE ANOMALOUS INTENTS DETECTED!");
    addLog("🔒 [CIRCUIT BREAKER] LOCKDOWN INITIATED. ENCLAVE HALTED.");
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
    </div>
  );
}
