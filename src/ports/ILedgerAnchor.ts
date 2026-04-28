import { AegisComplianceReceipt } from '../domain/types';

export interface AnchorResult {
    txSignature: string;
    explorerUrl: string;
}

export interface VerificationResult {
    verified: boolean;
    error?: string;
    onChainMemo?: string;
    memoObj?: any;
    timestamp?: number;
}

export interface ILedgerAnchor {
    getNetworkName(): string;
    getPayerPublicKey(): string;
    
    /**
     * Anchors a receipt to the blockchain ledger.
     */
    anchorReceipt(
        receipt: AegisComplianceReceipt, 
        decision: 'approved' | 'denied', 
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
}
