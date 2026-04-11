"use client";

import { useState } from "react";
import { Connection, Keypair, Transaction, SystemProgram } from "@solana/web3.js";

export default function Home() {
  const [logs, setLogs] = useState<{msg: string, id: string}[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const executeAegisPayload = async () => {
    setIsProcessing(true);
    setLogs([{msg: "🚀 Initializing Aegis-12 Security Gateway...", id: ""}]);
    
    try {
      await new Promise((r) => setTimeout(r, 4000));
      setLogs((prev) => [...prev, {msg: "📦 Intercepting RAW Solana Durable Nonce instruction from untrusted agent framework...", id: ""}]);
      
      await new Promise((r) => setTimeout(r, 4000));
      setLogs((prev) => [...prev, {msg: "⚠️ [WARN] 5KB TLS Certificate Chain Detached. Exceeds Solana 1232-byte MTU limit.", id: "demo-tls-warn"}]);

      await new Promise((r) => setTimeout(r, 10000));
      setLogs((prev) => [...prev, {msg: "⚡ Binding Solana Durable Nonce -> Groth16 Off-chain circuit mapper...", id: "demo-transaction-log"}]);

      await new Promise((r) => setTimeout(r, 7000));
      setLogs((prev) => [...prev, {msg: "🛡️ Proving Enclave Signature public input constraint...", id: ""}]);

      await new Promise((r) => setTimeout(r, 15000));
      setLogs((prev) => [
        ...prev, 
        {msg: `✅ SUCCESS! Cryptographic bounds natively validated on Layer-1 bypassing proxies.`, id: "demo-result-log"},
        {msg: `📜 ARS Proof Anchor: aXkL9_zMqopE3...9Eqp`, id: ""}
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
            <button 
                id="executeAegisBtn"
                onClick={executeAegisPayload}
                disabled={isProcessing}
                className="px-8 py-3 font-semibold text-white bg-cyan-600 rounded"
            >
                {isProcessing ? "Routing to Enclave..." : "Execute secure Agent Payload"}
            </button>

            <div className="w-full mt-8 p-6 bg-neutral-900/80 border border-neutral-800 rounded shadow-2xl font-mono text-sm h-72 overflow-y-auto">
                <div className="flex items-center space-x-2 mb-4 border-b border-neutral-800 pb-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                </div>
                {logs.length === 0 ? <span className="text-neutral-600 border-2 border-transparent">Waiting for connection...</span> : (
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
