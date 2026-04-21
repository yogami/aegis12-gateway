import { AegisJournal } from '../infrastructure/AegisJournal';
import { AegisSigner } from '../infrastructure/AegisSigner';
import { AegisCanonicalMessage } from '../types';
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';

export interface BatchCommitment {
    batchId: string;
    merkleRoot: string;
    pqSignature: string;
    proofs: Record<string, string[]>; // nonce -> proof
}

export class AegisBatchProcessor {
    private journal: AegisJournal;
    private signer: AegisSigner;

    constructor(journal: AegisJournal, signer: AegisSigner) {
        this.journal = journal;
        this.signer = signer;
    }

    private hashMessage(msg: AegisCanonicalMessage): Buffer {
        const canonicalString = JSON.stringify({
            tenantId: msg.tenantId,
            nonce: msg.nonce,
            article12LogHash: msg.article12LogHash,
            timestamp: msg.timestamp
        });
        return keccak256(canonicalString);
    }

    public async processBatch(): Promise<BatchCommitment | null> {
        const entries = this.journal.getUnbatchedEntries();
        if (entries.length === 0) return null;

        console.log(`[AegisBatchProcessor] 🌳 Processing batch of ${entries.length} intents...`);

        // 1. Construct Merkle Tree
        const leaves = entries.map(msg => this.hashMessage(msg));
        const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
        const rootHash = tree.getHexRoot();

        // 2. Generate NIST FIPS 204 Signature over the Root Hash
        const pqSignature = this.signer.signMLDSA(rootHash);

        // 3. Generate proofs for each entry
        const proofs: Record<string, string[]> = {};
        for (let i = 0; i < entries.length; i++) {
            const proof = tree.getHexProof(leaves[i]);
            proofs[entries[i].nonce] = proof;
        }

        const batchId = `batch-${Date.now()}`;
        const commitment: BatchCommitment = {
            batchId,
            merkleRoot: rootHash,
            pqSignature,
            proofs
        };

        // 4. Mark as batched in WAL
        this.journal.markAsBatched(entries.map(e => e.nonce));
        
        console.log(`[AegisBatchProcessor] ✅ Batch ${batchId} finalized. Merkle Root: ${rootHash}`);

        return commitment;
    }
}
