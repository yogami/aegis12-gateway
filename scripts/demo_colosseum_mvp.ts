import { Connection, Keypair } from '@solana/web3.js';
import { PolicyEnclave, EnclaveConfig, TradeIntent } from '../src/tee/PolicyEnclave';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * demo_colosseum_mvp.ts
 * 
 * The Master Demo Script for the Colosseum Hackathon Submission.
 * Demonstrates the full Aegis-12 Local TEE + Session Key architecture.
 */
async function runDemo() {
    console.log("==========================================================");
    console.log("🛡️  AEGIS-12 COLOSSEUM MVP DEMO");
    console.log("==========================================================\n");

    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    // 1. Boot the TEE
    console.log(">>> [0:20] STAGE 1: BOOT LOCAL TEE ENCLAVE <<<");
    
    // We set up a strict hardware policy.
    // In a real scenario, this is the ML model's static ruleset loaded into the enclave.
    const policy: EnclaveConfig = {
        maxTradeSol: 0.05,
        allowedDestinations: [
            // Just a random devnet address for testing, simulating a Jupiter swap router
            "4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k"
        ]
    };

    const enclave = new PolicyEnclave(policy);

    // 2. The Valid Trade (Zero Latency)
    console.log("\n>>> [0:45] STAGE 2: THE ZERO-LATENCY TRADE <<<");
    const validIntent: TradeIntent = {
        destination: "4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k",
        amountSol: 0.01 // Within the 0.05 budget limit
    };

    let successfulTxSig = "";

    try {
        console.log(`[Agent] Sending intent to Local TEE: Trade ${validIntent.amountSol} SOL`);
        successfulTxSig = await enclave.evaluateAndExecute(validIntent, connection);
    } catch (e: any) {
        console.error(`[Agent] Execution failed: ${e.message}`);
    }

    // 3. The Hardware Block
    console.log("\n>>> [1:30] STAGE 3: THE HARDWARE POLICY BLOCK <<<");
    const maliciousIntent: TradeIntent = {
        destination: "4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k",
        amountSol: 1.5 // Massively exceeds budget!
    };

    try {
        console.log(`[Agent] Sending malicious intent to Local TEE: Drain ${maliciousIntent.amountSol} SOL`);
        await enclave.evaluateAndExecute(maliciousIntent, connection);
    } catch (e: any) {
        console.log(`[Agent] 🛑 BLOCKED BY TEE: ${e.message}`);
    }

    // 4. The Attestation Verify Command
    console.log("\n>>> [2:00] STAGE 4: THE ATTESTATION VERIFIER (KILL SHOT) <<<");
    console.log(`To cryptographically prove the trade was signed inside Intel TDX, run:`);
    console.log(`\n    npx tsx src/cli/aegis-verify.ts ${successfulTxSig}\n`);

    console.log("==========================================================");
    console.log("✅ DEMO COMPLETE. Zero Latency. Hardware Secured.");
    console.log("==========================================================");
}

runDemo().catch(console.error);
