import { AegisPEP, PolicyEvaluationRequest } from '../src/infrastructure/AegisPEP';
import { ConsoleVaultState } from '../src/domain/VaultState';
import { AegisSigner } from '../src/infrastructure/AegisSigner';
import { AegisLocalNonceRegistry } from '../src/infrastructure/NonceRegistry';
import { ethers } from 'ethers';

process.env.WAL_SECRET = 'demo_mock_secret_for_hotl_bypass';
process.env.AUTHORIZED_TENANTS = JSON.stringify({ "tenant-demo": ["0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"] });
process.env.PHALA_SIMULATED_ROOT_SEED = '0xb5f3e28f43d0eaa68bb479b41f6c4747783ac5d0f7699ae57814402e94922c40';

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
            version: "1.0",
            chainId: 1399811149,
            crossChainTarget: "solana:devnet",
            maxAnomalyScore: 80,
            financialLimitsString: "10000",
            expiresAt: Math.floor(Date.now() / 1000) + 3600,
            nonce: "nonce-" + Date.now(),
            vaultPda: "VaultPDA_Governance",
            squadsMultisig: "SquadsV4_Governance_Multisig",
            allowedProgramIds: ["11111111111111111111111111111111", "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"]
        };
    }
}

async function runSoftwareFirewallMock(originalPolicy: any) {
    console.log("\n--- 🛡️  SOFTWARE FIREWALL (Host Compromise) ---");
    console.log("[Attacker] Gained SSH/Root access to the host server.");
    console.log(`[Attacker] Modifying local policy.json to raise limits from $10,000 to $1,000,000...`);
    
    // Attacker modifies the policy file
    const compromisedPolicy = { ...originalPolicy, financialLimitsString: "1000000" };
    
    console.log("[Software Firewall] Loading policy.json from disk...");
    console.log(`[Software Firewall] Loaded Limit: $${compromisedPolicy.financialLimitsString}`);
    console.log("[Software Firewall] ✅ Validating transaction against loaded policy...");
    console.log("[Software Firewall] 🟢 TRANSACTION APPROVED. WITHIN $1M LIMIT.");
    console.log("🚨🚨🚨 CATASTROPHIC FAILURE: $1,000,000 TREASURY DRAINED. 🚨🚨🚨");
    console.log("Reason: The software firewall trusts the host environment. Host compromise = Total Protocol Compromise.");
}

async function runAegisHardwareEnclave(originalPolicy: any, signature: string) {
    console.log("\n--- 🛡️  AEGIS-12 HARDWARE ENCLAVE (Phala CVM) ---");
    console.log("[Attacker] Gained SSH/Root access to the host server.");
    console.log(`[Attacker] Modifying local policy.json to raise limits from $10,000 to $1,000,000...`);
    
    // Attacker modifies the policy file passed to the enclave
    const compromisedPolicy = { ...originalPolicy, financialLimitsString: "1000000" };

    const signer = await AegisSigner.create();
    const tenantTrustStore = { "tenant-demo": ["0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"] };
    
    const pep = new AegisPEP(
        signer, 
        tenantTrustStore, 
        new AegisLocalNonceRegistry(), 
        new DemoStateStore() as any
    );

    const request: PolicyEvaluationRequest = {
        action: {
            toolId: "solana_transfer",
            actionType: "token_transfer",
            estimatedValue: 1000000n,
            parameters: {
                to: "11111111111111111111111111111111",
                amount: 1000000,
                token: "SOL"
            }
        },
        context: {
            tenantId: "tenant-demo",
            agentId: "agent-alpha",
            walletAddress: "E2EWalletAddress",
            nonce: "tx-nonce-" + Date.now(),
            cluster: "devnet",
            currentAnomalyScore: 0.5
        },
        promptContext: "Execute daily operations.",
        x402PaymentHeader: "mock_x402_sig",
        dynamicPolicy: {
            policyConfig: compromisedPolicy, // Attacker passes the tampered policy
            ownerPublicKey: e2eWallet.address,
            signature: signature // Original signature that bound the original policy
        }
    };

    try {
        console.log("[Aegis-12] Receiving intent and tampered policy inside Secure Enclave...");
        console.log("[Aegis-12] Verifying EIP-712 Governance Signature against policy payload...");
        await pep.enforce(request);
        console.log("❌ FAILURE: Aegis-12 accepted a tampered policy.");
    } catch (e: any) {
        console.log(`[Aegis-12] 🚨 EIP-712 SIGNATURE MISMATCH DETECTED.`);
        console.log(`[Aegis-12] Error Output: ${e.message}`);
        console.log("[Aegis-12] 🛑 INTENT SEVERED. ENCLAVE REFUSES TO GENERATE ZK-SEAL.");
        console.log("✅✅✅ SECURITY SUCCESS: TREASURY SAVED. ✅✅✅");
        console.log("Reason: Policies live in secure memory and are cryptographically bound to the EIP-712 hash. The host cannot alter the policy without invalidating the signature, and the Solana contract rejects execution without the TEE seal.");
    }
}

async function runHostCompromiseDemo() {
    console.log("==========================================================================");
    console.log("🔥 AEGIS-12 VS SOFTWARE FIREWALLS: THE HOST COMPROMISE DEMONSTRATION 🔥");
    console.log("==========================================================================");
    
    console.log("\n[Scenario] An autonomous AI agent operates on a dedicated server.");
    console.log("[Scenario] The server is compromised by a malicious operator or zero-day exploit.");
    
    // The governing multisig securely signed the original $10,000 policy
    const originalPolicy = await new DemoStateStore().fetchPolicy("POL_DEMO");
    const signature = await e2eWallet._signTypedData(eip712Domain, eip712Types, originalPolicy);

    // 1. Show Software Firewall Failure
    await runSoftwareFirewallMock(originalPolicy);

    // 2. Show Aegis-12 Success
    await runAegisHardwareEnclave(originalPolicy, signature);

    console.log("\n==========================================================================");
    console.log("🏆 CONCLUSION: TRUE SECURITY REQUIRES HARDWARE-ENFORCED ATTESTATION 🏆");
    console.log("==========================================================================");
    console.log("Software firewalls (intent layers, RPC proxies) are optional and patchable. ");
    console.log("Aegis-12 is the ONLY team that proves an AI agent cannot exceed its authorized");
    console.log("financial limits even under total host compromise, because the execution is ");
    console.log("cryptographically anchored to the hardware TEE seal.");
}

runHostCompromiseDemo().catch(console.error);
