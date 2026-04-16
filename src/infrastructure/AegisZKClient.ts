import { spawn } from 'child_process';
import * as path from 'path';
import { AegisComplianceReceipt } from '../types';

/**
 * AegisZKClient
 * 
 * [PHASE 2.1: VERIFIABLE AI PRIVACY]
 * Orchestrates the RISC Zero ZK-Prover to generate mathematical compliance seals.
 */
export class AegisZKClient {
    private proverBinaryPath: string;

    constructor(binaryPath?: string) {
        // Default to the built host binary in the target directory
        this.proverBinaryPath = binaryPath || path.resolve(__dirname, '../../aegis-zk-prover/target/release/host');
    }

    /**
     * Generates a ZK-Seal for a compliance receipt.
     * In a production CVM, this may be delegated to a ZK-Coprocessor or Local RISC Zero instance.
     */
    public async generateProof(input: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const child = spawn(this.proverBinaryPath, [], { stdio: ['pipe', 'pipe', 'pipe'] });
            
            let stdout = '';
            let stderr = '';

            child.stdin.write(JSON.stringify(input));
            child.stdin.end();

            child.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            child.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            child.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`[AEGIS-ZK-ERROR] Prover exited with code ${code}. Stderr: ${stderr}`));
                    return;
                }

                try {
                    const result = JSON.parse(stdout);
                    resolve(result);
                } catch (err) {
                    reject(new Error(`[AEGIS-ZK-ERROR] Failed to parse prover output: ${stdout}`));
                }
            });
        });
    }
}
