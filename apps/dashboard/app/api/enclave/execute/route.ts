import { NextResponse } from 'next/server';
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { createMemoInstruction } from '@solana/spl-memo';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Ensure it runs dynamically on Node backend, not Edge.
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        // Load root .env file to get the funded SOLANA_PAYER_SECRET
        dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

        const body = await req.json();
        
        // Use Devnet
        const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
        const connection = new Connection(rpcUrl, 'confirmed');
        
        let secret: Uint8Array;
        if (process.env.SOLANA_PAYER_SECRET) {
            secret = new Uint8Array(Buffer.from(process.env.SOLANA_PAYER_SECRET, 'base64'));
        } else {
            // Find .tee_session.json in project root
            const sessionPath = path.resolve(process.cwd(), '../../.tee_session.json');
            if (fs.existsSync(sessionPath)) {
                secret = new Uint8Array(JSON.parse(fs.readFileSync(sessionPath, 'utf8')));
            } else {
                throw new Error("No funded keypair found to execute transaction. Ensure .tee_session.json exists.");
            }
        }
        
        const keypair = Keypair.fromSecretKey(secret);
        
        // Execute a microscopic trade to generate a real TxSig without draining the wallet
        const destPubkey = new PublicKey("4jKwb8h2vWjZkLzM6pBxk7tUqVbWv8W4u1gL7tFk5g6k");
        const lamports = Math.floor(0.000001 * LAMPORTS_PER_SOL);
        const transferIx = SystemProgram.transfer({
            fromPubkey: keypair.publicKey,
            toPubkey: keypair.publicKey,
            lamports
        });

        // Add the Oracle Attestation Hash to the transaction (mimicking the TEE EnclaveService)
        const mockQuoteHash = "0x" + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');
        const oraclePayload = JSON.stringify({
            program: "aegis_oracle",
            instruction: "verify_attestation",
            quote_hash: mockQuoteHash,
            policy_hash: "fiduciary-matrix-v1"
        });
        const oracleIx = createMemoInstruction(oraclePayload, [keypair.publicKey]);

        const tx = new Transaction().add(oracleIx).add(transferIx);
        const txSig = await sendAndConfirmTransaction(connection, tx, [keypair]);
        
        return NextResponse.json({ success: true, txSig, pubkey: keypair.publicKey.toBase58() });
    } catch (error: any) {
        console.error("Enclave API Error:", error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
