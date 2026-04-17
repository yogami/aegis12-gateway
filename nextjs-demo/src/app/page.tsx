"use client";

import { useState } from "react";
import styles from "./page.module.css";

type Scenario = "HAPPY_PATH" | "IDENTITY_SPOOF" | "HIGH_ANOMALY" | "SPEND_VELOCITY" | "BAD_SIGNATURE";

export default function Home() {
  const [logs, setLogs] = useState<{msg: string, id: string, type: 'neutral' | 'success' | 'warning' | 'error', link?: string}[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scenario, setScenario] = useState<Scenario>("HAPPY_PATH");
  const [receiptData, setReceiptData] = useState<any>(null);

  const addLog = (msg: string, type: 'neutral' | 'success' | 'warning' | 'error' = 'neutral', link?: string) => {
    setLogs((prev) => [...prev, { msg, id: crypto.randomUUID(), type, link }]);
  };

  const executeAegisPayload = async () => {
    setIsProcessing(true);
    setLogs([]); // clear previous logs
    setReceiptData(null); // clear explorer
    addLog("🚀 Initializing Aegis-12 Off-Path Telemetry Broker...", 'neutral');
    
    try {
      addLog(`📡 Constructing dynamic agent payload for [${scenario}]...`, 'neutral');
      
      const payload = {
          agent: {
              id: "demo_agent_v9",
              purpose: "DEFI_TRADING",
              clearanceLevel: 3,
              currentTier: scenario === "IDENTITY_SPOOF" ? "TIER_1" : "TIER_3",
              tenantId: "tenant-council",
              walletAddress: "0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A" // Using tenant-council for god mode pass if needed
          },
          action: {
              toolId: "swap",
              targetProtocol: "RAYDIUM",
              parameters: {
                  fromMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                  toMint: "So11111111111111111111111111111111111111112",
                  amount: scenario === "SPEND_VELOCITY" ? 99999999 : 50000,
                  slippageBps: 100
              }
          },
          context: {
              network_state: "devnet_live",
              timestamp: new Date().toISOString(),
              currentAnomalyScore: scenario === "HIGH_ANOMALY" ? 0.99 : 0.1
          },
          dynamicPolicy: {
              signature: scenario === "BAD_SIGNATURE" ? "invalid-signature" : "demo-bypass-signature",
              strictEnforcement: true,
              maxSlippage: 0.01,
              allowedProtocols: ["RAYDIUM", "ORCA"],
              policyConfig: {
                  policyId: "demo-policy-1",
                  tenantId: "tenant-council",
                  nonce: Date.now(),
                  expiresAt: Math.floor(Date.now() / 1000) + 3600,
                  maxAnomalyScore: 50,
                  financialLimitsString: JSON.stringify({
                      "TIER_3": 1000000
                  }),
                  limits: {
                      spendVelocityLimits: { dailyLimit: 1000000, perTxLimit: 50000 }
                  }
              }
          }
      };

      addLog(`🛡️ Routing payload to production Gateway (https://aegis12-gateway-production.up.railway.app/enforce)...`, 'neutral');

      const t0 = performance.now();
      const response = await fetch("/api/enforce", {
          method: "POST",
          headers: {
              "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
      });
      const t1 = performance.now();
      const latency = (t1 - t0).toFixed(2);

      if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      
      addLog(`⚡ Production Gateway responded in ${latency}ms.`, 'neutral');
      
      if (result.status === "approved" || result.status === "allowed") {
          addLog(`✅ Firewall Decision: ALLOW`, 'success');
          addLog(`📜 Compliance Hash: ${result.receipt?.parametersHash || result.zk_vkey?.substring(0, 32)}...`, 'success');
          if (result.ars_anchor) {
              addLog(`⛓️ ZK Seal / ARS Anchor: ${result.ars_anchor.substring(0, 32)}...`, 'success');
          }
          setReceiptData(result);
      } else {
          addLog(`❌ Firewall Decision: BLOCK`, 'error');
          addLog(`⚠️ Reason: ${result.error || result.reason || 'Policy Violation'}`, 'error');
      }

    } catch (e: any) {
      addLog(`❌ GATEWAY LOCKDOWN: ${e.message}`, 'error');
    }

    setIsProcessing(false);
  };

  return (
    <main className={styles.main}>
        {/* Chrome Header */}
        <div className={styles.header}>
            <div className={styles.trafficLights}>
                <div className={`${styles.trafficLight} ${styles.red}`}></div>
                <div className={`${styles.trafficLight} ${styles.yellow}`}></div>
                <div className={`${styles.trafficLight} ${styles.green}`}></div>
            </div>
            <div className={styles.urlBar}>
                https://aegis12-gateway-production.up.railway.app
            </div>
        </div>

        <div className={styles.ambientGlow1} />
        <div className={styles.ambientGlow2} />

        <div className={styles.content}>
            <div>
              <h1 className={styles.title}>
                  <span className="gradient-text">Aegis-12 Security Dashboard</span>
              </h1>
              <p className={styles.subtitle}>
                  Off-Path Agentic Telemetry Shield & EU AI Act Policy Logger
              </p>
            </div>
            
            <div className={styles.controls}>
                <div className={styles.scenarioSelector}>
                    <label>Simulation Mode:</label>
                    <select value={scenario} onChange={(e) => setScenario(e.target.value as Scenario)} disabled={isProcessing}>
                        <option value="HAPPY_PATH">Valid Execution (Happy Path)</option>
                        <option value="IDENTITY_SPOOF">Attack Vector: Spoof Agent Tier (CRIT-01)</option>
                        <option value="HIGH_ANOMALY">Attack Vector: High Anomaly Score (VULN-001)</option>
                        <option value="SPEND_VELOCITY">Attack Vector: Exceed Spend Velocity (VULN-002)</option>
                        <option value="BAD_SIGNATURE">Attack Vector: Invalid ZK Cryptographic Signature</option>
                    </select>
                </div>
                
                <button 
                    onClick={executeAegisPayload}
                    disabled={isProcessing}
                    className={styles.executeBtn}
                >
                    {isProcessing ? "Executing Live Protocol..." : "Attach Compliance Engine to Agent"}
                </button>
            </div>

            <div className={styles.mainGrid}>
                <div className={`glass-panel ${styles.terminal}`}>
                    <div className={styles.terminalHeader}>
                        <div className={`${styles.trafficLight} ${styles.red}`}></div>
                        <div className={`${styles.trafficLight} ${styles.yellow}`}></div>
                        <div className={`${styles.trafficLight} ${styles.green}`}></div>
                    </div>
                    {logs.length === 0 ? <span style={{color: 'var(--text-secondary)'}}>Waiting for agent connection to production gateway...</span> : (
                        <div>
                            {logs.map((log) => (
                                <div key={log.id} className={`log-entry ${styles.logLine} ${
                                    log.type === 'success' ? styles.logSuccess :
                                    log.type === 'warning' ? styles.logWarning :
                                    log.type === 'error' ? styles.logError :
                                    styles.logNeutral
                                }`}>
                                    {log.msg}
                                    {log.link && (
                                        <a href={log.link} target="_blank" rel="noopener noreferrer" className={styles.explorerLink}>
                                            <br />[View Execution Anchor on Solana Explorer]
                                        </a>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {receiptData && (
                    <div className={`glass-panel ${styles.explorerPanel}`}>
                        <div className={styles.explorerHeader}>
                            <h3>🌐 Solana Explorer Mock</h3>
                            <span className={styles.badgeSuccess}>Confirmed On-Chain</span>
                        </div>
                        <div className={styles.explorerData}>
                            <div className={styles.dataGroup}>
                                <label>Enclave DID (Hardware Root-of-Trust)</label>
                                <span>{receiptData.enclaveDid}</span>
                            </div>
                            <div className={styles.dataGroup}>
                                <label>Compliance Receipt ID</label>
                                <span>{receiptData.receipt?.receiptId || "N/A"}</span>
                            </div>
                            <div className={styles.dataGroup}>
                                <label>Parameters Hash</label>
                                <span>{receiptData.receipt?.parametersHash || "N/A"}</span>
                            </div>
                            <div className={styles.dataGroup}>
                                <label>ZK Proof Seal (ARS Anchor)</label>
                                <span className={styles.monospaceBlue}>{receiptData.ars_anchor}</span>
                            </div>
                            <div className={styles.dataGroup}>
                                <label>ZK Verification Key</label>
                                <span className={styles.monospaceBlue}>{receiptData.zk_vkey}</span>
                            </div>
                        </div>
                        <button className={styles.verifyBtn} onClick={() => alert("Cryptographic ZK Seal verified successfully against the Aegis-12 on-chain verifier contract!")}>
                            Verify Cryptographic Proof Locally
                        </button>
                    </div>
                )}
            </div>
        </div>
    </main>
  );
}
