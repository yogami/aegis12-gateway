/**
 * TradeIntent — Value Object
 *
 * Immutable representation of an AI agent's trading request.
 * Validates invariants at construction time (fail-fast).
 *
 * SRP: Only responsible for holding and validating intent data.
 */
export interface TradeIntentParams {
    destination: string;
    amountSol: number;
}

export class TradeIntent {
    public readonly destination: string;
    public readonly amountSol: number;

    private constructor(params: TradeIntentParams) {
        this.destination = params.destination;
        this.amountSol = params.amountSol;
    }

    static create(params: TradeIntentParams): TradeIntent {
        if (params.amountSol <= 0) {
            throw new Error('Amount must be positive');
        }
        return new TradeIntent(params);
    }
}
