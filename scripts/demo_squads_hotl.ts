import { AegisPEP, PolicyEvaluationRequest } from '../src/infrastructure/AegisPEP';
import { ConsoleVaultState } from '../src/domain/VaultState';
import { AegisSigner } from '../src/infrastructure/AegisSigner';
import { AegisLocalNonceRegistry } from '../src/infrastructure/NonceRegistry';

process.env.WAL_SECRET = 'demo_mock_secret_for_hotl_bypass';
process.env.AUTHORIZED_TENANTS = JSON.stringify({ "tenant-demo": ["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"] });
process.env.PHALA_SIMULATED_ROOT_SEED = '0xb5f3e28f43d0eaa68bb479b41f6c4747783ac5d0f7699ae57814402e94922c40';

// This script simulates the "Production Readiness" demonstration for the Colosseum Hackathon.
// It proves that Aegis-12 isn't just an enclave, but an enterprise risk-management engine
// that automatically bridges the gap between machine speed and human governance via Squads V4.

class DemoStateStore implements ConsoleVaultState {
    async getTenantLimits(tenantId: string) { return { limit: 10000n, timeframe: '1h' }; }
    async getTenantSpend(tenantId: string) { return 0n; }
    async tryIncrementSpend(tenantId: string, amount: bigint, limit: bigint) { return true; }
    async saveEvidence(receipt: any) { return; }
    async getEvidence(receiptId: string) { return null; }
    async getPolicy(policyId: string) { return await this.fetchPolicy(policyId); }
    async fetchPolicy(policyId: string) {
        return {
            policyId,
            tenantId: "tenant-demo",
            version: "1.0.0",
            chainId: 1399811149,
            crossChainTarget: "solana:devnet",
            maxAnomalyScore: 100,
            financialLimitsString: JSON.stringify({ T1: 1000000 }),
            expiresAt: Math.floor(Date.now() / 1000) + 3600,
            nonce: "nonce-123",
            vaultPda: "CouncilVault_Default",
            squadsMultisig: "SquadsV4_Governance_Multisig",
            allowedProgramIds: ["11111111111111111111111111111111"]
        };
    }
}

import { ethers } from 'ethers';

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
        { name: "allowedProgramIds", type: "string[]" }
    ]
};

async function runSquadsHOTLDemo() {
    console.log("==================================================");
    console.log("🏛️  AEGIS-12 PRODUCTION READINESS: SQUADS V4 HOTL  🏛️");
    console.log("==================================================");

    const signer = await AegisSigner.create();
    const tenantTrustStore = { "tenant-demo": ["0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"] };
    
    const pep = new AegisPEP(
        signer, 
        tenantTrustStore, 
        new AegisLocalNonceRegistry(), 
        new DemoStateStore() as any
    );
    
    const policyConfig = await new DemoStateStore().fetchPolicy("POL_DEMO");
    const signature = await e2eWallet._signTypedData(eip712Domain, eip712Types, policyConfig);

    console.log("[Agent] Attempting massive $50,000,000 USDC treasury transfer...");
    
    const request: PolicyEvaluationRequest = {
        agent: {
            id: "trading_bot_alpha",
            purpose: "financial_operations",
            currentTier: "T1"
        },
        action: {
            toolId: "solana_transfer",
            actionType: "token_transfer",
            estimatedValue: 50_000_000_000n, // Breaches the $10,000 HOTL threshold
            parameters: {
                to: "11111111111111111111111111111111",
                amount: 50000000000,
                token: "SOL"
            }
        },
        context: {
            prompt: "Liquidate position and transfer 50M USDC to cold storage.",
            modelVersion: "GPT-4",
            jurisdiction: "GLOBAL",
            currentAnomalyScore: 0,
            actionsThisSession: 1,
            actionsThisHour: 1,
            recentIncidents: 0,
            sessionId: "demo-hotl"
        },
        x402PaymentHeader: "mock_x402_sig",
        dynamicPolicy: {
            policyConfig: policyConfig,
            ownerPublicKey: e2eWallet.address,
            signature: signature
        }
    };

    try {
        console.log("[Aegis-12] Analyzing execution intent within secure hardware enclave...");
        const result = await pep.enforce(request);

        console.log("\n==================================================");
        console.log("🛡️  AEGIS-12 HUMAN-ON-THE-LOOP (HOTL) TRIGGERED 🛡️");
        console.log("==================================================");
        
        if (result.decision === 'escalated') {
            console.log(`[Aegis-12] 🚨 Massive transfer exceeds automated risk thresholds!`);
            console.log(`[Aegis-12] 🛑 Raw transaction physically severed.`);
            console.log(`[Aegis-12] ✅ Wrapping intent into a Squads V4 Multisig Proposal for human review...`);
            console.log(`[Squads V4] 🏛️ Multisig PDA: ${result.envelope?.squads_multisig}`);
            console.log(`[Squads V4] 🔗 Envelope Digest: ${result.envelope?.instruction_digest}`);
            console.log("\n✅ PRODUCTION READINESS DEMONSTRATION SUCCESSFUL:");
            console.log("Aegis-12 bridges machine execution speed with human institutional governance, making it the only viable enterprise-grade security engine.");
        }

    } catch (error) {
        console.error("Enforcement failed:", error);
    }
}

runSquadsHOTLDemo().catch(console.error);
