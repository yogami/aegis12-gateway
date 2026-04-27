/**
 * SolanaAnchor — On-Chain Receipt Anchoring & Verification
 */

import {
    Connection,
    Keypair,
    Transaction,
    sendAndConfirmTransaction,
    clusterApiUrl,
} from '@solana/web3.js';
import { createMemoInstruction } from '@solana/spl-memo';
import { AegisComplianceReceipt } from '../types';
import { AegisSigner } from './AegisSigner';
import { JsonUtils } from './JsonUtils';

interface AnchorResult {
    txSignature: string;
    receiptHash: string;
    slot: number;
    cluster: string;
    explorerUrl: string;
    anchoredAt: string;
    isZkSharded?: boolean;
}

export class SolanaAnchor {
    private connection: Connection;
    private payer: Keypair;
    private cluster: string;

    constructor(cluster: string = process.env.SOLANA_CLUSTER || 'devnet', payerSecretKey?: Uint8Array) {
        this.cluster = cluster;
        const primaryRpc = process.env.SOLANA_RPC_URL || clusterApiUrl(cluster as any);
        this.connection = new Connection(primaryRpc, 'confirmed');

        if (payerSecretKey) {
            this.payer = Keypair.fromSecretKey(payerSecretKey);
        } else if (process.env.SOLANA_PAYER_SECRET) {
            const decoded = Buffer.from(process.env.SOLANA_PAYER_SECRET, 'base64');
            this.payer = Keypair.fromSecretKey(new Uint8Array(decoded));
        } else {
            if (cluster === 'mainnet-beta') throw new Error('SOLANA_PAYER_SECRET required for mainnet-beta.');
            this.payer = Keypair.generate();
        }
    }

    public computeReceiptHash(receipt: any): string {
        return JsonUtils.computeReceiptHash(receipt);
    }

    public async anchorReceipt(
        receipt: any, 
        decision: 'approved' | 'denied',
        enclaveDid: string
    ): Promise<AnchorResult> {
        const isZkSharded = !!receipt.zkSnarkProof;
        const receiptHash = this.computeReceiptHash(receipt);
        
        const memoObj = {
            v: 'aegis:v8',
            act: receipt.actionId,
            h: receiptHash, 
            d: decision,
            did: enclaveDid,
            ts: receipt.timestamp
        };
        const memo = `a12:${Buffer.from(JSON.stringify(memoObj)).toString('base64url')}`;

        const transaction = new Transaction().add(createMemoInstruction(memo));
        const { blockhash } = await this.connection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = this.payer.publicKey;

        const txSignature = await sendAndConfirmTransaction(this.connection, transaction, [this.payer]);
        const slot = await this.connection.getSlot('confirmed');

        return {
            txSignature,
            receiptHash,
            slot,
            cluster: this.cluster,
            explorerUrl: `https://explorer.solana.com/tx/${txSignature}?cluster=${this.cluster}`,
            anchoredAt: new Date().toISOString(),
            isZkSharded
        };
    }

    public async verifyAnchoredReceipt(
        txSignature: string,
        receipt: AegisComplianceReceipt,
        signer: AegisSigner
    ): Promise<any> {
        try {
            const tx = await this.connection.getParsedTransaction(txSignature, { commitment: 'confirmed' });
            if (!tx) throw new Error('Transaction not found');

            const onChainMemo = this.extractMemo(tx);
            if (!onChainMemo.startsWith('a12:')) throw new Error('Invalid memo prefix');
            
            const memoObj = JsonUtils.safeParse(Buffer.from(onChainMemo.substring(4), 'base64url').toString('utf-8'), 'SolanaMemo');
            const recomputedHash = this.computeReceiptHash(receipt);
            const hashMatch = this.compareMemo(memoObj, receipt, recomputedHash);

            const signatureValid = signer.verify(recomputedHash, receipt.signature, signer.getPublicKeyHex());
            if (!signatureValid) throw new Error('Enclave signature invalid.');

            return { verified: hashMatch && signatureValid, txSignature, onChainMemo, recomputedHash, enclaveSignatureValid: signatureValid, slot: tx.slot, blockTime: tx.blockTime ?? null };
        } catch (e: any) {
            return { verified: false, error: e.message };
        }
    }

    private extractMemo(tx: any): string {
        const instructions = tx.transaction.message.instructions || [];
        for (const ix of instructions) {
            if (ix.programId.toBase58() === 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr') {
                const raw = (ix as any).data;
                return Buffer.isBuffer(raw) ? raw.toString('utf8') : Buffer.from(raw, 'base64').toString('utf8');
            }
        }
        throw new Error('No memo found');
    }

    private compareMemo(memoObj: any, receipt: AegisComplianceReceipt, recomputedHash: string): boolean {
        const expectedDecision = (receipt as any).decision || 'approved';
        const expectedDid = receipt.enclaveDid || "unknown";
        return (memoObj.h === recomputedHash) && 
               (memoObj.act === receipt.actionId) && 
               (memoObj.d === expectedDecision) &&
               (memoObj.did === expectedDid);
    }
}
