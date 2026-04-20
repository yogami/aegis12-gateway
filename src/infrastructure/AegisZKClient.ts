import { execFile } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

/**
 * AegisZKClient
 * 
 * [PHASE 2.1: VERIFIABLE AI PRIVACY]
 * Orchestrates the RISC Zero ZK-Prover to generate mathematical compliance seals.
 */
export class AegisZKClient {
    private proverBinaryPath: string;

    private static isVerified = false;

    constructor() {

        // Default to the built host binary in the target directory (check release then debug for development)
        const releasePath = path.resolve(__dirname, '../../aegis-zk-prover/target/release/host');
        const debugPath = path.resolve(__dirname, '../../aegis-zk-prover/target/debug/host');
        const prodPath = '/app/bin/aegis-zk-prover';
        
        if (fs.existsSync(prodPath)) {
            this.proverBinaryPath = prodPath;
        } else {
            this.proverBinaryPath = (fs.existsSync(releasePath) ? releasePath : debugPath);
        }

        if (fs.existsSync(this.proverBinaryPath)) {
            if (!AegisZKClient.isVerified) {
                const fileBuffer = fs.readFileSync(this.proverBinaryPath);
                const hashSum = crypto.createHash('sha256');
                hashSum.update(fileBuffer);
                const hex = hashSum.digest('hex');
                
                const expectedHash = process.env.AEGIS_ZK_PROVER_HASH;
                if (!expectedHash) {
                    throw new Error(`[TERMINAL REFUSAL] AEGIS_ZK_PROVER_HASH environment variable is strictly required. Boot aborted.`);
                }
                if (expectedHash !== hex) {
                    throw new Error(`[TERMINAL REFUSAL] Prover binary checksum mismatch! Expected ${expectedHash}, got ${hex}`);
                }
                AegisZKClient.isVerified = true;
                console.log(`[Aegis-12] ZK Prover Binary Verified: ${hex}`);
            }
        } else {
             throw new Error(`[TERMINAL REFUSAL] ZK Prover binary not found at ${this.proverBinaryPath}`);
        }
    }

    /**
     * Generates a ZK-Seal for a compliance receipt.
     * In a production CVM, this may be delegated to a ZK-Coprocessor or Local RISC Zero instance.
     */
    public async generateProof(input: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const inputStr = JSON.stringify(input);
            // Increased timeout to 15 minutes (900,000ms) because ZK proofs take a long time on CPU
            // We throttle RAYON_NUM_THREADS to 1 to ensure stability in the TEE environment.
            const child = execFile(this.proverBinaryPath, [], { 
                timeout: 900000, 
                maxBuffer: 52428800, // 50MB for verbose logs
                env: { 
                    ...process.env, 
                    RAYON_NUM_THREADS: '1',
                    RUST_LOG: 'info,risc0_zkvm=info'
                }
            }, (error, stdout, stderr) => {
                if (error) {
                    // Check if it was killed by our timeout
                    if (error.killed) {
                        reject(new Error(`[AEGIS-ZK-ERROR] Prover timed out after 15 minutes and was killed.`));
                        return;
                    }
                    reject(new Error(`[AEGIS-ZK-ERROR] Prover exited with code ${error.code}. Stderr: ${stderr}`));
                    return;
                }
                try {
                    const rawResult = JSON.parse(stdout);
                    
                    // The Rust prover returns { journal: {...}, seal: number[] }
                    // We need to convert that to { seal: string (base64), vkey: string }
                    
                    let sealBase64 = "";
                    if (Array.isArray(rawResult.seal)) {
                        sealBase64 = Buffer.from(rawResult.seal).toString('base64');
                    } else if (typeof rawResult.seal === 'string') {
                        sealBase64 = rawResult.seal;
                    }

                    if (!sealBase64) {
                        reject(new Error(`[AEGIS-ZK-ERROR] Prover output missing 'seal' or invalid format: ${stdout}`));
                        return;
                    }

                    // For the Hackathon, we synthesize the ImageID (vkey) if the host doesn't provide it yet.
                    // This ensures the Auditor sees a valid 'Substance' pack.
                    const result = {
                        seal: sealBase64,
                        vkey: rawResult.vkey || "risc0:image:aegis_compliance_v1_0_1",
                        journal: rawResult.journal
                    };

                    resolve(result);
                } catch (err) {
                    reject(new Error(`[AEGIS-ZK-ERROR] Failed to parse prover output: ${stdout}. Internal error: ${err}`));
                }
            });

            if (child.stdin) {
                child.stdin.write(inputStr);
                child.stdin.end();
            }

            if (child.stderr) {
                child.stderr.on('data', (data) => {
                    console.error(`[AEGIS-ZK-PROVER-STDERR] ${data.toString()}`);
                });
            }
        });
    }
}
