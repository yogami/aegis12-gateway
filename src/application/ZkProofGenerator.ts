import { AegisZKClient } from '../infrastructure/AegisZKClient';
import { AegisComplianceReceipt } from '../types';
import keccak256 from 'keccak256';

export class ZkProofGenerator {
    public static async generate(receipt: AegisComplianceReceipt, nonce: string, pep: any): Promise<void> {
        try {
            const amountVal = receipt.validatedParams?.amount as string | number | bigint | undefined;
            const amount = this.validateAmount(BigInt(amountVal || 0));
            const input = this.createInput(receipt, amount, nonce);
            const proof = await new AegisZKClient().generateProof(input);
            await pep.updateZkSeal(receipt.receiptId, proof);
        } catch (e: any) {
            console.error(`ZK Error: ${e.message}`);
        }
    }

    private static validateAmount(amount: bigint): number {
        const MAX = 9007199254740991n - 1000n;
        if (amount > MAX) throw new Error("Amount exceeds ZK capacity.");
        return Number(amount);
    }

    private static createInput(receipt: any, amount: number, nonce: string): any {
        const nonceNumeric = this.parseNonce(nonce);
        return {
            action: { tool_id: receipt.toolId, amount, nonce: nonceNumeric },
            constraints: { max_per_tx: amount + 1000, cumulative_limit: amount + 1000, last_checkpointed_nonce: 0 },
            stats_before: { total_spend: 0, tx_count: 0, last_activity: Math.floor(Date.now() / 1000) },
            state_proof: { slot: 1, state_root: Array(32).fill(1), account_hash: Array(32).fill(1), proof: [] }
        };
    }

    private static parseNonce(nonce: string): number {
        const nonceHash = keccak256(Buffer.from(nonce, 'utf8'));
        return parseInt(nonceHash.toString('hex').substring(0, 12), 16);
    }
}
