import { AuditRegistry } from '../ports/TransactionExecutor';
import { TradeIntent } from '../domain/TradeIntent';

export class RailwayAuditRegistry implements AuditRegistry {
    constructor(private readonly webhookUrl: string) {}

    async logDecision(
        intent: TradeIntent,
        decision: { approved: boolean; escalated: boolean; reason: string },
        metadata?: any
    ): Promise<void> {
        console.log(`[RailwayAudit] Forwarding decision to Control Panel: ${decision.reason}`);
        
        try {
            const payload = {
                timestamp: new Date().toISOString(),
                intent: {
                    destination: intent.destination,
                    amountSol: intent.amountSol
                },
                decision,
                metadata
            };

            const response = await fetch(this.webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                console.warn(`[RailwayAudit] ⚠️ Failed to log to Railway: ${response.statusText}`);
            }
        } catch (error: any) {
            console.warn(`[RailwayAudit] ⚠️ Network error logging to Railway: ${error.message}`);
        }
    }
}
