"use client";

import { useState } from "react";

export default function TraceExplorer() {
  const [signature, setSignature] = useState("");
  const [payload, setPayload] = useState('{"agent_id": "aegis_ai_v9"}');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
           signature: signature.trim(),
           payload: JSON.parse(payload) // Needs to exactly match the payload hashed
        })
      });

      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setResult({ status: 500, error: e.message });
    }
    setLoading(false);
  };

  return (
    <main className="flex flex-col items-center min-h-screen bg-black text-white p-12">
      <div className="w-full max-w-4xl space-y-8">
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-500">
          Aegis-12 Evidence Explorer
        </h1>
        <p className="text-neutral-400 font-mono">
          Cryptographic Regulatory Verification for EU AI Act Article 12 Compliance.
        </p>

        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-lg space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2 text-neutral-300">Solana Transaction Signature</label>
            <input 
              type="text" 
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              className="w-full bg-black border border-neutral-700 rounded p-3 font-mono text-sm"
              placeholder="5N... hash signature"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2 text-neutral-300">Agent Source Intent (JSON Payload)</label>
            <textarea 
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              className="w-full h-32 bg-black border border-neutral-700 rounded p-3 font-mono text-xs"
              placeholder="{...agent context}"
            />
          </div>

          <button 
            onClick={handleVerify}
            disabled={loading || !signature}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 font-bold rounded transition-all disabled:opacity-50"
          >
            {loading ? "Verifying Ledger..." : "Execute Cryptographic Attestation"}
          </button>
        </div>

        {result && (
          <div className={`p-6 border rounded-lg font-mono text-sm ${result.status === 200 && result.verification === 'SUCCESS' ? 'bg-emerald-900/20 border-emerald-500/50 text-emerald-400' : 'bg-red-900/20 border-red-500/50 text-red-400'}`}>
             <h3 className="text-xl font-bold mb-4">{result.verification === 'SUCCESS' ? "✅ PROOF ACCEPTED" : "❌ PROOF REJECTED"}</h3>
             <pre className="whitespace-pre-wrap text-xs">
                {JSON.stringify(result, null, 2)}
             </pre>
          </div>
        )}
      </div>
    </main>
  );
}
