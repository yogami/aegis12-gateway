import { it, expect, describe } from 'vitest';
import { AegisZKClient } from '../src/infrastructure/AegisZKClient';
import * as path from 'path';

it('should generate a mathematical compliance seal via RISC Zero', async () => {
        console.log("--- Aegis Duo: ZK-Prover Smoke Test ---");
        
        // Path to the freshly built debug binary
        const binaryPath = path.resolve(__dirname, '../aegis-zk-prover/target/debug/host');
        const zkClient = new AegisZKClient(binaryPath);

        const mockInput = {
            action: { tool_id: "solana_transfer", amount: 1500, nonce: 1050 },
            constraints: { 
                max_per_tx: 2000, 
                cumulative_limit: 50000, 
                last_checkpointed_nonce: 1049 
            },
            stats_before: { total_spend: 10000, tx_count: 5, last_activity: Date.now() },
            state_proof: {
                slot: 12345678,
                state_root: new Array(32).fill(1), // Mockized Solana State Root
                account_hash: new Array(32).fill(2),
                proof: []
            }
        };

        console.log("[1/3] Spawning ZK-Prover with policy intent...");
        const result = await zkClient.generateProof(mockInput);
        
        console.log(`[2/3] ZK-Seal Generated!`);
        console.log("--- JOURNAL PROOF ---");
        console.log(`- New Total Spend: ${result.journal.new_total_spend}`);
        console.log(`- Nonce Burned: ${result.journal.nonce_burned}`);
        
        expect(result.journal.new_total_spend).toBe(11500);
        expect(result.journal.nonce_burned).toBe(1050);
        expect(result.seal).toBeDefined();
        
        console.log(`[3/3] VERDICT: PASS. (Mathematical proof bytes: ${result.seal.length})`);
    }, 60000); // 60s timeout for ZK proof generation
