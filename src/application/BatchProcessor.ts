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

    private buildMerkleTree(entries: AegisCanonicalMessage[]): { tree: MerkleTree, rootHash: string, leaves: Buffer[] } {
        const leaves = entries.map(msg => this.hashMessage(msg));
        const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
        return { tree, rootHash: tree.getHexRoot(), leaves };
    }

    private generateProofs(tree: MerkleTree, entries: AegisCanonicalMessage[], leaves: Buffer[]): Record<string, string[]> {
        const proofs: Record<string, string[]> = {};
        for (let i = 0; i < entries.length; i++) {
            proofs[entries[i].nonce] = tree.getHexProof(leaves[i]);
        }
        return proofs;
    }

    public async processBatch(): Promise<BatchCommitment | null> {
        const entries = this.journal.getUnbatchedEntries();
        if (entries.length === 0) return null;

        console.log(`[AegisBatchProcessor] 🌳 Processing batch of ${entries.length} intents...`);

        const { tree, rootHash, leaves } = this.buildMerkleTree(entries);
        const commitment: BatchCommitment = {
            batchId: `batch-${Date.now()}`,
            merkleRoot: rootHash,
            pqSignature: this.signer.signMLDSA(rootHash),
            proofs: this.generateProofs(tree, entries, leaves)
        };

        this.journal.markAsBatched(entries.map(e => e.nonce));
        console.log(`[AegisBatchProcessor] ✅ Batch ${commitment.batchId} finalized. Merkle Root: ${rootHash}`);

        return commitment;
    }
}
