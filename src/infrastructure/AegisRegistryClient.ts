import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { AegisComplianceReceipt } from '../types';

/**
 * AegisRegistryClient
 * 
 * [ARTICLE 12 & 14 ANCHORING]
 * Handles the immutable indexing of AegisComplianceReceipts on the Solana blockchain.
 */
export class AegisRegistryClient {
    private program: Program;
    private connection: Connection;
    private provider: anchor.AnchorProvider;

    constructor(rpcUrl: string, wallet: anchor.Wallet, programId: string) {
        this.connection = new Connection(rpcUrl, 'confirmed');
        this.provider = new anchor.AnchorProvider(this.connection, wallet, {
            preflightCommitment: 'confirmed',
        });
        
        // Load the static IDL so CI/CD and Docker environments don't require the Rust compiler
        const idl = require('./idl/aegis_onchain.json');
        
        this.program = new Program(idl as any, this.provider);
    }

    /**
     * Anchors a Compliance Receipt to the Solana Devnet.
     * Fulfills Item 1.2 of the Product Backlog.
     */
    public async anchorReceipt(receipt: AegisComplianceReceipt): Promise<string> {
        const [registryPda] = PublicKey.findProgramAddressSync(
            [
                anchor.utils.bytes.utf8.encode('aegis_compliance_v1'),
                this.provider.wallet.publicKey.toBuffer(),
                anchor.utils.bytes.utf8.encode(receipt.receiptId)
            ],
            this.program.programId
        );

        // Convert the Keccak-256 hex string to Buffer
        const logHashBytes = Buffer.from(receipt.article12LogHash.slice(2), 'hex');
        
        // Convert the Ed25519 signature to byte array
        const teeSignatureBytes = Buffer.from(receipt.signature.slice(2), 'hex');

        try {
            const tx = await this.program.methods
                .anchorComplianceReceipt(
                    receipt.receiptId,
                    Array.from(logHashBytes), // Must be Array for [u8; 32]
                    receipt.article14OversightSignature || "none",
                    teeSignatureBytes
                )
                .accounts({
                    registryEntry: registryPda,
                    agentSigner: this.provider.wallet.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                } as any)
                .rpc();

            return tx;
        } catch (error: any) {
            console.error(`[AEGIS-REGISTRY-ERROR] Failed to anchor receipt ${receipt.receiptId}:`, error.message);
            throw error;
        }
    }

    /**
     * Anchors the ZK Proof of Policy Execution to the Solana Ledger
     * This provides the physical "Must-Have" hardware moat.
     */
    public async enforceExecutionIntent(agentId: string, zkReceiptProof: string): Promise<string> {
        try {
            const tx = await this.program.methods
                .enforceExecutionIntent(agentId, zkReceiptProof)
                .accounts({
                    authority: this.provider.wallet.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                } as any)
                .rpc();

            return tx;
        } catch (error: any) {
            console.error(`[AEGIS-REGISTRY-ERROR] Failed to enforce ZK execution intent for ${agentId}:`, error.message);
            throw error;
        }
    }

    /**
     * Checkpoints the last used nonce to the Solana cluster.
     * Prevents cross-replica replay attacks during failover.
     */
    public async checkpointNonce(tenantId: string, nonce: number): Promise<string> {
        const [checkpointPda] = PublicKey.findProgramAddressSync(
            [
                anchor.utils.bytes.utf8.encode('aegis_nonce_checkpoint'),
                anchor.utils.bytes.utf8.encode(tenantId)
            ],
            this.program.programId
        );

        try {
            const tx = await this.program.methods
                .checkpointNonce(tenantId, new anchor.BN(nonce))
                .accounts({
                    nonceCheckpoint: checkpointPda,
                    authority: this.provider.wallet.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                } as any)
                .rpc();

            return tx;
        } catch (error: any) {
            console.error(`[AEGIS-REGISTRY-ERROR] Failed to checkpoint nonce for tenant ${tenantId}:`, error.message);
            throw error;
        }
    }

    /**
     * Retrieves the last checkpointed nonce from the blockchain.
     */
    public async getLastNonce(tenantId: string): Promise<number> {
        const [checkpointPda] = PublicKey.findProgramAddressSync(
            [
                anchor.utils.bytes.utf8.encode('aegis_nonce_checkpoint'),
                anchor.utils.bytes.utf8.encode(tenantId)
            ],
            this.program.programId
        );

        try {
            const account: any = await (this.program.account as any).nonceCheckpoint.fetch(checkpointPda);
            return account.lastNonce.toNumber();
        } catch (error) {
            return 0; // Assume new tenant
        }
    }
}
