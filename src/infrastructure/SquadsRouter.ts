import { AegisComplianceReceipt } from '../types';

/**
 * Squads V4 Router
 * 
 * Routes high-risk agent intents to the DAO's Squads Multisig.
 * If the TEE evaluates a transaction and decides to 'escalate', this router
 * intercepts the receipt and creates a Draft Proposal on-chain.
 */
export class SquadsRouter {
    /**
     * Inspects a compliance receipt and routes it to Squads if escalated.
     * @param receipt The final compliance receipt from the Aegis TEE
     */
    public static async routeIfEscalated(receipt: AegisComplianceReceipt): Promise<void> {
        if (receipt.decision !== 'escalated' || !receipt.envelope) {
            // Intent is within autonomous bounds. Allow direct execution.
            return;
        }

        console.log(`[Aegis-12] ⚠️ HIGH RISK INTENT DETECTED. Routing to Squads V4 Multisig...`);
        console.log(`[Aegis-12] Target Vault: ${receipt.envelope.vault_pda}`);
        
        await this.createMultisigProposal(receipt);
    }

    /**
     * Mocks the creation of a Squads V4 proposal for the hackathon demo.
     */
    private static async createMultisigProposal(receipt: AegisComplianceReceipt): Promise<void> {
        // In production, this uses @sqds/multisig to build and send a transaction
        // that creates a proposal containing the agent's intent, appending the 
        // TEE's signature as proof that the intent was cryptographically audited.

        await new Promise(resolve => setTimeout(resolve, 300)); // Simulate RPC call

        const proposalId = `sqds-prop-${receipt.receiptId.substring(0, 8)}`;
        console.log(`[Aegis-12] ✅ Squads Proposal Created: ${proposalId}`);
        console.log(`[Aegis-12] Human signers must now approve this transaction via the Squads UI.`);
        
        // Mutate the receipt slightly to append the external proposal ID for tracking
        (receipt as any).squadsProposalId = proposalId;
    }
}
