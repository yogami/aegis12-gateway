import { assertSafeFinancialAmount } from './PolicyValidator';

export class IncaInsurancePolicy {
    private static MAX_AUTO_PAYOUT = 10000n; // $10,000 threshold for human-in-the-loop

    public static validateClaim(parameters: Record<string, unknown>): Record<string, unknown> {
        const claimId = parameters.claimId as string;
        if (!claimId || typeof claimId !== 'string') {
            throw new Error(`Invalid 'claimId'. Must be a valid string.`);
        }
        
        const amount = assertSafeFinancialAmount(parameters.amount, 'amount');
        
        // Inca Insurance specific logic: Enforce Article 14 (Human Oversight) for large payouts
        if (amount > this.MAX_AUTO_PAYOUT) {
            throw new Error(`[TERMINAL REFUSAL] claim amount (${amount}) exceeds maximum automated payout threshold of ${this.MAX_AUTO_PAYOUT}. Human-in-the-loop (Article 14) required.`);
        }

        return Object.assign(Object.create(null), {
            claimId: parameters.claimId,
            policyNumber: parameters.policyNumber,
            amount: amount,
            currency: parameters.currency || 'USD'
        });
    }
}
