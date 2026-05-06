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

    // Concurrency control to prevent OOM Kills on 2GB Phala CVMs
    private static activeProvers = 0;
    private static readonly MAX_CONCURRENT_PROVERS = 2;
    private static queue: (() => void)[] = [];

    private static async acquireSlot(): Promise<void> {
        if (AegisZKClient.activeProvers < AegisZKClient.MAX_CONCURRENT_PROVERS) {
            AegisZKClient.activeProvers++;
            return;
        }
        return new Promise<void>(resolve => {
            AegisZKClient.queue.push(resolve);
        });
    }

    private static releaseSlot(): void {
        const next = AegisZKClient.queue.shift();
        if (next) {
            next();
        } else {
            AegisZKClient.activeProvers--;
        }
    }

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
        await AegisZKClient.acquireSlot();
        try {
            return await this.executeProverProcess(input);
        } finally {
            AegisZKClient.releaseSlot();
        }
    }

    private async executeProverProcess(input: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const inputStr = JSON.stringify(input);
            const child = execFile(this.proverBinaryPath, [], { 
                timeout: 60000, 
                maxBuffer: 52428800, // 50MB for verbose logs
                env: { 
                    ...process.env, 
                    RAYON_NUM_THREADS: '1',
                    RUST_LOG: 'info,risc0_zkvm=info'
                }
            }, (error, stdout, stderr) => this.handleProverResult(error, stdout, stderr, resolve, reject));

            this.setupProverProcess(child, inputStr);
        });
    }

    private handleProverResult(error: any, stdout: string, stderr: string, resolve: Function, reject: Function): void {
        if (error) {
            if (error.killed) return reject(new Error(`[AEGIS-ZK-ERROR] Prover timed out and was killed.`));
            return reject(new Error(`[AEGIS-ZK-ERROR] Prover exited with code ${error.code}. Stderr: ${stderr}`));
        }
        try {
            const rawResult = JSON.parse(stdout);
            let sealBase64 = "";
            if (Array.isArray(rawResult.seal)) sealBase64 = Buffer.from(rawResult.seal).toString('base64');
            else if (typeof rawResult.seal === 'string') sealBase64 = rawResult.seal;

            if (!sealBase64) return reject(new Error(`[AEGIS-ZK-ERROR] Prover output missing 'seal' or invalid: ${stdout}`));

            resolve({
                seal: sealBase64,
                vkey: rawResult.vkey || "risc0:image:aegis_compliance_v1_0_1",
                journal: rawResult.journal
            });
        } catch (err) {
            reject(new Error(`[AEGIS-ZK-ERROR] Failed to parse prover output. Internal error: ${err}`));
        }
    }

    private setupProverProcess(child: any, inputStr: string): void {
        if (child.pid) {
            const { spawn } = require('child_process');
            const watcher = spawn('sh', ['-c', `cat > /dev/null; kill -9 ${child.pid} 2>/dev/null`], {
                stdio: ['pipe', 'ignore', 'ignore'],
                detached: true
            });
            watcher.unref();
        }
        if (child.stdin) {
            child.stdin.write(inputStr);
            child.stdin.end();
        }
        if (child.stderr) {
            child.stderr.on('data', (data: any) => console.error(`[AEGIS-ZK-PROVER-STDERR] ${data.toString()}`));
        }
    }
}
