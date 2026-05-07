import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { createMemoInstruction } from '@solana/spl-memo';
import { keccak256 } from 'ethers/lib/utils';
import * as fs from 'fs';
import * as crypto from 'crypto';

export interface TradeIntent {
    destination: string;
    amountSol: number;
}

export interface EnclaveConfig {
    maxTradeSol: number;
    allowedDestinations: string[];
}

/**
 * PolicyEnclave.ts
 * 
 * Represents the code running inside the Phala TDX / SGX enclave.
 * In a real enclave, this code is measured (MRTD/MRENCLAVE) and produces a DCAP quote.
 */
export class PolicyEnclave {
    private keypair: Keypair;
    private config: EnclaveConfig;
    private dcapQuoteHash: string;

    constructor(config: EnclaveConfig) {
        this.config = config;
        this.keypair = this.loadOrGenerateKey();
        
        // In a real TDX enclave, we would call the Intel DCAP library here.
        // For the MVP, we generate a deterministic hash simulating the DCAP quote hash.
        this.dcapQuoteHash = keccak256(Buffer.from(`MOCK_DCAP_QUOTE_${this.keypair.publicKey.toBase58()}`));
        
        console.log(`[TEE Enclave] Booted securely. Hardware Key: ${this.keypair.publicKey.toBase58()}`);
        console.log(`[TEE Enclave] DCAP Quote Hash: ${this.dcapQuoteHash}`);
    }

    private loadOrGenerateKey(): Keypair {
        try {
            if (fs.existsSync('.tee_session.json')) {
                const secret = JSON.parse(fs.readFileSync('.tee_session.json', 'utf8'));
                return Keypair.fromSecretKey(new Uint8Array(secret));
            }
        } catch (e) {
            console.warn("[TEE Enclave] Could not load .tee_session.json. Generating new ephemeral key.");
        }
        return Keypair.generate();
    }

    public getPublicKey(): PublicKey {
        return this.keypair.publicKey;
    }

    /**
     * Evaluates a trading intent against the hardcoded ML/Security policy.
     * If approved, it constructs, signs, and executes the transaction at zero latency,
     * embedding the DCAP quote hash into the Solana Memo for off-chain verification.
     */
    public async evaluateAndExecute(intent: TradeIntent, connection: Connection): Promise<string> {
        console.log(`\n[TEE Enclave] Evaluating Intent: Transfer ${intent.amountSol} SOL to ${intent.destination}`);

        // 1. Policy Evaluation
        if (intent.amountSol > this.config.maxTradeSol) {
            throw new Error(`POLICY DENIED: Amount ${intent.amountSol} SOL exceeds max allowed ${this.config.maxTradeSol} SOL.`);
        }

        if (!this.config.allowedDestinations.includes(intent.destination)) {
            throw new Error(`POLICY DENIED: Destination ${intent.destination} is not in the allowlist.`);
        }

        console.log(`[TEE Enclave] ✅ Policy check passed.`);

        // 2. Transaction Construction
        const destPubkey = new PublicKey(intent.destination);
        const lamports = Math.floor(intent.amountSol * LAMPORTS_PER_SOL);

        const transferIx = SystemProgram.transfer({
            fromPubkey: this.keypair.publicKey,
            toPubkey: destPubkey,
            lamports
        });

        // 3. The On-Chain Oracle Verification (Atomic Instruction)
        // For the hackathon MVP, we use the Memo program to simulate our deployed Oracle program.
        // In production, this is a CPI call to our `aegis_oracle` smart contract (see aegis_onchain/programs).
        const policyHash = keccak256(Buffer.from(JSON.stringify(this.config)));
        const oraclePayload = JSON.stringify({
            program: "aegis_oracle",
            instruction: "verify_attestation",
            quote_hash: this.dcapQuoteHash,
            policy_hash: policyHash
        });
        const oracleIx = createMemoInstruction(oraclePayload, [this.keypair.publicKey]);

        // The Atomic Transaction: Oracle verification MUST succeed before the Transfer.
        const tx = new Transaction().add(oracleIx).add(transferIx);

        // 4. Execution
        console.log(`[TEE Enclave] ⚡ Atomically submitting Oracle Proof + Trade to Solana...`);
        const startTime = Date.now();
        
        try {
            const txSig = await sendAndConfirmTransaction(connection, tx, [this.keypair]);
            const elapsed = Date.now() - startTime;
            
            console.log(`[TEE Enclave] ✅ Execution successful in ${elapsed}ms.`);
            console.log(`[TEE Enclave] 📜 Signature: https://explorer.solana.com/tx/${txSig}?cluster=devnet`);
            return txSig;
        } catch (error: any) {
            throw new Error(`Execution failed: ${error.message}`);
        }
    }
}
