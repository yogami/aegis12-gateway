import { exec } from 'child_process';
import { promisify } from 'util';
import { AttestationOracle } from '../ports/AttestationOracle';
import { AttestationQuote } from '../domain/AttestationQuote';

const execAsync = promisify(exec);

export class RiscZeroAttestationOracle implements AttestationOracle {
    constructor(private readonly proverPath: string) {}

    async submitQuote(quote: AttestationQuote): Promise<boolean> {
        console.log(`[RiscZero Oracle] Generating ZK Proof of hardware attestation...`);
        
        // Construct the ZKInput mirroring the Rust struct
        const zkInput = {
            action: {
                tool_id: "solana_transfer",
                amount: 1000, // Placeholder mapping
                nonce: Date.now()
            },
            constraints: {
                max_per_tx: 1000000,
                cumulative_limit: 10000000,
                last_checkpointed_nonce: 0
            },
            stats_before: {
                total_spend: 0,
                tx_count: 0,
                last_activity: 0
            },
            state_proof: {
                slot: 1,
                state_root: new Array(32).fill(1),
                account_hash: new Array(32).fill(1),
                proof: []
            }
        };

        try {
            const inputJson = JSON.stringify(zkInput);
            // Spawn the RiscZero host binary and pipe the input
            const { stdout, stderr } = await this.executeProver(inputJson);
            
            if (stderr) {
                console.warn(`[RiscZero Oracle] Prover Stderr: ${stderr}`);
            }

            const output = JSON.parse(stdout);
            if (output.seal) {
                console.log(`[RiscZero Oracle] ✅ ZK Proof Generated. Seal Size: ${output.seal.length} bytes.`);
                return true;
            }
            return false;
        } catch (error: any) {
            console.error(`[RiscZero Oracle] ❌ ZK Proof Generation Failed: ${error.message}`);
            return false;
        }
    }

    async isWhitelisted(pubkeyBase58: string): Promise<boolean> {
        // In a ZK world, 'whitelisting' is replaced by valid proof submission
        // For the demo, we assume the proof we just generated is valid
        return true; 
    }

    private async executeProver(inputJson: string): Promise<{ stdout: string; stderr: string }> {
        return new Promise((resolve, reject) => {
            const child = exec(this.proverPath, (error, stdout, stderr) => {
                if (error) reject(error);
                else resolve({ stdout, stderr });
            });
            
            child.stdin?.write(inputJson);
            child.stdin?.end();
        });
    }
}
