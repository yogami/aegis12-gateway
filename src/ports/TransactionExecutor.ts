/**
 * TransactionExecutor — Port (Secondary Interface)
 *
 * Defines the contract for building and broadcasting atomic
 * Solana transactions. Infrastructure adapters implement this.
 *
 * In production: SolanaTransactionExecutor
 * In tests: Mock implementation via vitest
 */
import { SessionKey } from '../domain/SessionKey';
import { TradeIntent } from '../domain/TradeIntent';
import { AttestationQuote } from '../domain/AttestationQuote';

export interface TransactionExecutor {
    execute(
        sessionKey: SessionKey,
        intent: TradeIntent,
        quote: AttestationQuote,
    ): Promise<string>;

    simulate(
        sessionKey: SessionKey,
        intent: TradeIntent,
        quote: AttestationQuote,
    ): Promise<{ success: boolean; error?: string; logs?: string[] }>;
}

export interface AuditRegistry {
    logDecision(
        intent: TradeIntent,
        decision: { approved: boolean; escalated: boolean; reason: string },
        metadata?: any
    ): Promise<void>;
}

