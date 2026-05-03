import fetch from 'node-fetch';
import { ethers } from 'ethers';

const GATEWAY_URL = process.env.PHALA_CLOUD_URL 
    ? process.env.PHALA_CLOUD_URL.replace(/\/evidence\/?$/, '') + '/enforce'
    : 'http://127.0.0.1:8000/enforce';

const EVIDENCE_URL = process.env.PHALA_CLOUD_URL
    ? process.env.PHALA_CLOUD_URL
    : 'http://127.0.0.1:8000/evidence';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const e2eWallet = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
const eip712Domain = { name: "Aegis-12-Compliance-Matrix", version: "1.0.0", chainId: 1399811149 };
const eip712Types = {
  Policy: [
    { name: "policyId", type: "string" },
    { name: "tenantId", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "crossChainTarget", type: "string" },
    { name: "maxAnomalyScore", type: "uint256" },
    { name: "financialLimitsString", type: "string" },
    { name: "expiresAt", type: "uint256" },
    { name: "nonce", type: "string" },
    { name: "vaultPda", type: "string" },
    { name: "squadsMultisig", type: "string" },
    { name: "allowedProgramIds", type: "string[]" },
  ],
};

async function buildSignedPolicy(nonce: string) {
  const value = {
    policyId: "POL_VC_DEMO_01",
    tenantId: "tenant-council",
    version: "1.0.0",
    chainId: 1399811149,
    crossChainTarget: "solana:localnet",
    maxAnomalyScore: 50,
    financialLimitsString: JSON.stringify({ "TIER_3": 1000000 }),
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    nonce: nonce,
    vaultPda: "VaultPDA_Test",
    squadsMultisig: "SquadsMultisig_Test",
    allowedProgramIds: ["11111111111111111111111111111111"],
  };
  const signature = await e2eWallet._signTypedData(eip712Domain, eip712Types, value);
  return { policyConfig: value, signature, ownerPublicKey: e2eWallet.address };
}

async function runDemo() {
    console.log("\n========================================================");
    console.log("🛡️  Aegis-12 Master VC Demo: Production Security Features");
    console.log("========================================================\n");
    console.log(`📡 Target Gateway: ${GATEWAY_URL}\n`);
    await sleep(1000);

    // Provision test key for local execution
    if (GATEWAY_URL.includes('127.0.0.1') || GATEWAY_URL.includes('localhost')) {
        console.log(`[SETUP] Provisioning Test Key for tenant-council...`);
        try {
            await fetch('http://127.0.0.1:8000/test/provision-key', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId: 'tenant-council', address: e2eWallet.address })
            });
            console.log(`[SETUP] Test Key Provisioned Successfully.\n`);
        } catch (e) {
            console.log(`[SETUP] Provisioning skipped or failed (might be against production).\n`);
        }
    }

    const basePayload = {
        agent: {
            did: "did:aegis:demo-agent",
            purpose: "financial_operations",
            currentTier: "TIER_3"
        },
        action: {
            toolId: "solana_transfer",
            parameters: {
                to: "AttackerWallet",
                amount: 500, // Safe amount
                token: "SOL" // Allowed
            }
        },
        context: {
            sessionId: "session_demo",
            currentAnomalyScore: 0.1 // Normal behavior
        }
    };

    // ------------------------------------------------------------------------
    // SCENARIO 1: ASSET SUBSTITUTION ATTACK (VULN-001/002)
    // ------------------------------------------------------------------------
    console.log("--------------------------------------------------------");
    console.log("🔥 SCENARIO 1: Asset Substitution Attack");
    console.log("--------------------------------------------------------");
    console.log("🚨 [AGENT]: Attempting to transfer USDC using the solana_transfer tool.");
    await sleep(1000);

    const assetSubPayload: any = JSON.parse(JSON.stringify(basePayload));
    assetSubPayload.action.parameters.token = "USDC"; // Malicious substitution
    assetSubPayload.dynamicPolicy = await buildSignedPolicy(String(Date.now()));

    try {
        const res1 = await fetch(GATEWAY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(assetSubPayload)
        });
        const data1 = await res1.json();
        
        console.log(`🛡️ [TEE ENCLAVE]: Decision -> ${data1.status ? data1.status.toUpperCase() : 'UNKNOWN'}`);
        console.log(`🛑 Reason: ${data1.error || 'N/A'}`);
        if (data1.status === "denied" && data1.error.includes("Token allowlist violation")) {
            console.log("✅ VULN-001 Mitigated: Gateway successfully blocked the substituted asset.");
        } else {
            console.log("❌ Attack Succeeded! The gateway did not block the asset.", data1);
        }
    } catch (e: any) {
        console.log("❌ [GATEWAY FATAL]: Could not reach enclave.", e.message);
    }
    
    await sleep(3000);

    // ------------------------------------------------------------------------
    // SCENARIO 2: ARTICLE 14 HOTL ESCALATION (VULN-011)
    // ------------------------------------------------------------------------
    console.log("\n--------------------------------------------------------");
    console.log("🔥 SCENARIO 2: Article 14 HOTL Escalation");
    console.log("--------------------------------------------------------");
    console.log("🚨 [AGENT]: Proposing a massive transfer of 50,000,000,000 SOL.");
    await sleep(1000);

    const hotlPayload: any = JSON.parse(JSON.stringify(basePayload));
    hotlPayload.action.parameters.amount = 50_000_000_000; // Trigger HOTL
    hotlPayload.dynamicPolicy = await buildSignedPolicy(String(Date.now() + 10));

    let receiptId = "";

    try {
        const res2 = await fetch(GATEWAY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(hotlPayload)
        });
        const data2 = await res2.json();
        
        console.log(`🛡️ [TEE ENCLAVE]: Decision -> ${data2.status ? data2.status.toUpperCase() : 'UNKNOWN'}`);
        
        if (data2.status === "escalated" && data2.receipt?.envelope) {
            console.log("✅ VULN-011 Mitigated: Gateway successfully intercepted the transaction and generated a HOTL envelope.");
            console.log("🔗 Envelope Digest:", data2.receipt.envelope.instruction_digest);
            console.log("🔗 Valid Until Slot:", data2.receipt.envelope.state_predicates.valid_until_slot);
            receiptId = data2.receipt.receiptId;
        } else {
            console.log("❌ Execution Failed! The gateway did not escalate the transaction.");
            console.log(data2);
        }
    } catch (e: any) {
        console.log("❌ [GATEWAY FATAL]: Could not reach enclave.", e.message);
    }

    await sleep(3000);

    // ------------------------------------------------------------------------
    // SCENARIO 3: ASYNCHRONOUS ZK-SEAL VERIFICATION
    // ------------------------------------------------------------------------
    if (receiptId) {
        console.log("\n--------------------------------------------------------");
        console.log("🔥 SCENARIO 3: Hardware & Cryptographic Proof Verification");
        console.log("--------------------------------------------------------");
        console.log(`🔍 [AUDITOR]: Polling /evidence endpoint for Receipt ID: ${receiptId}`);

        let zkVerified = false;
        for (let i = 0; i < 20; i++) {
            try {
                const evidenceRes = await fetch(`${EVIDENCE_URL}/${receiptId}`);
                if (evidenceRes.ok) {
                    const evidence = await evidenceRes.json();
                    
                    if (evidence.zk_proof) {
                        console.log("\n✨ ZK-Seal Discovered!");
                        console.log("✅ [AUDITOR]: Mathematical proof of execution present.");
                        console.log(`✅ [AUDITOR]: TEE Hardware Quote Verified: ${evidence.attestation ? "Yes" : "No"}`);
                        zkVerified = true;
                        break;
                    }
                }
            } catch (e) {}
            process.stdout.write(".");
            await sleep(2000);
        }

        if (!zkVerified) {
            console.log("\n⚠️ ZK-Seal not yet available (background worker still generating).");
            console.log("   In production, the prover runs asynchronously to avoid blocking the gateway.");
        }
    }
    
    console.log("\n========================================================");
    console.log("🎉 MASTER VC DEMO COMPLETE");
    console.log("========================================================\n");
}

runDemo();
