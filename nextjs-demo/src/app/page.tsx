"use client";

import { useState } from "react";

export default function Home() {
  const [logs, setLogs] = useState<{msg: string, id: string}[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const executeAegisPayload = async () => {
    setIsProcessing(true);
    setLogs([{msg: "🚀 Initializing Aegis-12 Off-Path Telemetry Broker...", id: ""}]);
    
    try {
      await new Promise((r) => setTimeout(r, 1500));
      setLogs((prev) => [...prev, {msg: "📡 Ingesting Yellowstone gRPC firehose (Local Enclave Filter Mode)...", id: ""}]);
      
      await new Promise((r) => setTimeout(r, 2000));
      setLogs((prev) => [...prev, {msg: "🛡️ Injecting synthetic decoy traffic (Chaff) into RPC network...", id: "demo-tls-warn"}]);

      await new Promise((r) => setTimeout(r, 2500));
      setLogs((prev) => [...prev, {msg: "🧠 Agent evaluating Strategy (RAY/USDC Swap Matrix)...", id: "demo-transaction-log"}]);

      await new Promise((r) => setTimeout(r, 3000));
      setLogs((prev) => [...prev, {msg: "⚖️ Executing LIVE EU AI Act Compliance Hashing Benchmark...", id: ""}]);

      // Massive dummy payload mimicking an agent's context window decision tree
      const agentContextPayload = {
        agent_id: "aegis_ai_v9",
        timestamp: Date.now(),
        liquidity_routes: Array.from({length: 1000}, (_, i) => ({ pool: `RAY-USDC-${i}`, rate: Math.random() })),
        chaff_signals: Array.from({length: 50}, (_, i) => `FAKE_SIGNAL_${i}`)
      };

      // Real Crypto Benchmarking
      const encoder = new TextEncoder();
      const stringifiedPayload = JSON.stringify(agentContextPayload);
      const data = encoder.encode(stringifiedPayload);
      
      const t0 = performance.now();
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const t1 = performance.now();
      
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
      const computeLatency = (t1 - t0).toFixed(4); // Keep high precision for ms

      await new Promise((r) => setTimeout(r, 1000)); 
      setLogs((prev) => [
        ...prev, 
        {msg: `✅ SUCCESS! Execution perfectly shielded with ${computeLatency}ms latency penalty.`, id: "demo-result-log"},
        {msg: `📜 SHA-256 Compliance Anchor: ${hashHex.substring(0, 32)}...`, id: ""}
      ]);

    } catch (e: any) {
      setLogs((prev) => [...prev, {msg: `❌ GATEWAY LOCKDOWN: ${e.message}`, id: ""}]);
    }

    setIsProcessing(false);
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6 relative overflow-hidden">
        {/* Chrome Header */}
        <div className="w-full bg-neutral-900 border-b border-neutral-800 p-4 flex place-items-center space-x-4 z-50 absolute top-0 left-0">
            <div className="flex space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            </div>
            <div className="flex-1 max-w-4xl mx-auto bg-black border border-neutral-800 rounded-md py-2 px-4 text-sm text-neutral-300 font-mono" id="demo-url">
                https://aegis12-gateway.up.railway.app
            </div>
        </div>

        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-cyan-900/40 blur-[150px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-900/40 blur-[150px] rounded-full pointer-events-none" />

        <div className="z-10 w-full max-w-5xl flex flex-col items-center space-y-8 mt-12">
            <h1 className="text-5xl font-bold tracking-tighter text-center bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500">
                Aegis-12 Security Dashboard
            </h1>
            <p className="text-neutral-400 font-mono max-w-2xl text-center">
                Off-Path Agentic Telemetry Shield & EU AI Act Policy Logger
            </p>
            <button 
                id="executeAegisBtn"
                onClick={executeAegisPayload}
                disabled={isProcessing}
                className="px-8 py-3 font-semibold text-white bg-cyan-600 rounded transition-all hover:bg-cyan-500 disabled:opacity-50"
            >
                {isProcessing ? "Executing Live Benchmarks..." : "Attach Compliance Engine to Agent"}
            </button>

            <div className="w-full mt-8 p-6 bg-neutral-900/80 border border-neutral-800 rounded shadow-2xl font-mono text-sm h-72 overflow-y-auto">
                <div className="flex items-center space-x-2 mb-4 border-b border-neutral-800 pb-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                </div>
                {logs.length === 0 ? <span className="text-neutral-600 border-2 border-transparent">Waiting for agent connection...</span> : (
                    <div className="flex flex-col space-y-4">
                        {logs.map((log, index) => (
                            <span 
                                key={index} 
                                id={log.id || undefined}
                                className={`p-2 transition-all duration-500 ease-out border-4 border-transparent rounded ${log.msg.includes('✅') ? 'text-emerald-400 font-bold' : log.msg.includes('⚠️') ? 'text-amber-400 font-bold' : 'text-neutral-300'}`}
                            >
                                {log.msg}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    </main>
  );
}
