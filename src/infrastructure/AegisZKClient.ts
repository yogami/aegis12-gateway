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
            const child = execFile(this.proverBinaryPath, [], { timeout: 30000, maxBuffer: 10485760 }, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`[AEGIS-ZK-ERROR] Prover exited with code ${error.code}. Stderr: ${stderr}`));
                    return;
                }
                try {
                    const result = JSON.parse(stdout);
                    if (!result || typeof result !== 'object' || typeof result.seal !== 'string' || typeof result.vkey !== 'string') {
                        reject(new Error(`[AEGIS-ZK-ERROR] Invalid proof schema. Expected { seal: string, vkey: string }, got ${JSON.stringify(result)}`));
                        return;
                    }
                    resolve(result);
                } catch (err) {
                    reject(new Error(`[AEGIS-ZK-ERROR] Failed to parse prover output: ${stdout}`));
                }
            });

            if (child.stdin) {
                child.stdin.write(inputStr);
                child.stdin.end();
            }
        });
    }
}
