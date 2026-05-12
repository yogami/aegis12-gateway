import { AegisComplianceReceipt } from '../types';

export interface AnchorResult {
    txSignature: string;
    explorerUrl: string;
    receiptHash?: string;
    slot?: number;
    cluster?: string;
    anchoredAt?: string;
    isZkSharded?: boolean;
}

export interface VerificationResult {
    verified: boolean;
    error?: string;
    onChainMemo?: string;
    memoObj?: any;
    timestamp?: number;
    txSignature?: string;
    recomputedHash?: string;
    enclaveSignatureValid?: boolean;
    slot?: number;
    blockTime?: number;
}

export interface ILedgerAnchor {
    getNetworkName(): string;
    getPayerPublicKey(): string;
    
    /**
     * Anchors a receipt to the blockchain ledger.
     */
    anchorReceipt(
        receipt: AegisComplianceReceipt, 
        decision: 'approved' | 'denied' | 'escalated', 
        enclaveDid: string
    ): Promise<AnchorResult>;

    /**
     * Verifies that a transaction signature exists on-chain and matches the expected receipt.
     */
    verifyAnchoredReceipt(
        txSignature: string,
        localEvidence?: AegisComplianceReceipt,
        signer?: any
    ): Promise<VerificationResult>;

    /**
     * Anchors the ZK Proof of Execution to the blockchain ledger.
     */
    anchorZkProof?(agentId: string, zkReceiptProof: string): Promise<string>;
}
