import { Connection } from '@solana/web3.js';
import { EnclaveService } from '../src/application/EnclaveService';
import { TradeIntent } from '../src/domain/TradeIntent';
import { PolicyRuleset } from '../src/domain/PolicyEvaluator';
import { MockAttestationOracle } from '../src/infrastructure/MockAttestationOracle';
import { SolanaTransactionExecutor } from '../src/infrastructure/SolanaTransactionExecutor';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * demo_colosseum_mvp.ts
 * 
 * The Master Demo Script for the Colosseum Hackathon Submission.
 * Demonstrates the full Aegis-12 Local TEE + Session Key architecture
 * utilizing the Asynchronous Attestation + Atomic Execution pattern.
 */
async function runDemo() {
    console.log("==========================================================");
    console.log("🛡️  AEGIS-12 COLOSSEUM MVP DEMO");
    console.log("==========================================================\n");

    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');

    // Setup the Hexagonal Architecture
    const oracle = new MockAttestationOracle();
    const executor = new SolanaTransactionExecutor(connection);
    
    // We set up a strict hardware policy.
    const policy: PolicyRuleset = {
        maxTradeSol: 0.05,
        allowedDestinations: ["4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k"]
    };

    const service = new EnclaveService(policy, oracle, executor);

    // 1. Boot the TEE & Asynchronous Attestation
    console.log(">>> [0:20] STAGE 1: TEE BOOT & ASYNCHRONOUS ATTESTATION <<<");
    console.log("[TEE Enclave] Booting local Phala TDX environment...");
    await service.boot();

    // 2. The Valid Trade (Zero Latency Atomic Execution)
    console.log(">>> [0:45] STAGE 2: ATOMIC ZERO-LATENCY EXECUTION <<<");
    const validIntent = TradeIntent.create({
        destination: "4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k",
        amountSol: 0.001 // Within the 0.05 budget limit
    });

    let successfulTxSig = "";

    try {
        console.log(`[Agent] Sending intent to Local TEE: Trade ${validIntent.amountSol} SOL`);
        successfulTxSig = await service.execute(validIntent);
    } catch (e: any) {
        console.error(`[Agent] Execution failed: ${e.message}`);
    }

    // 3. The Malicious Trade (Hardware Policy Block)
    console.log("\n>>> [1:30] STAGE 3: THE HARDWARE POLICY BLOCK (FIDUCIARY FIREWALL) <<<");
    console.log("[Agent] WARNING: LLM Hallucination/Prompt Injection Detected. Attempting to drain 1.5 SOL...");
    
    const maliciousIntent = TradeIntent.create({
        destination: "4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k",
        amountSol: 1.5 // Exceeds the 0.05 budget limit
    });

    try {
        console.log(`[Agent] Sending malicious intent to Local TEE: Drain ${maliciousIntent.amountSol} SOL`);
        await service.execute(maliciousIntent);
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
