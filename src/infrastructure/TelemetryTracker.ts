export class TelemetryTracker {
    private timestamps: Map<string, number> = new Map();

    constructor() {
        this.start();
    }

    public start(): void {
        this.timestamps.set('start', performance.now());
    }

    public mark(phase: string): void {
        this.timestamps.set(phase, performance.now());
    }

    public getMetrics(): Record<string, number> {
        const total = performance.now() - (this.timestamps.get('start') || performance.now());
        
        const getDelta = (endPhase: string, startPhase: string) => {
            const end = this.timestamps.get(endPhase);
            const start = this.timestamps.get(startPhase);
            if (end !== undefined && start !== undefined) {
                return parseFloat((end - start).toFixed(2));
            }
            return 0;
        };

        return {
            total_ms: parseFloat(total.toFixed(2)),
            parse_and_init_ms: getDelta('init', 'start'),
            pep_enforce_ms: getDelta('pep', 'init'),
            hardware_attest_ms: getDelta('attest', 'pep'),
            ledger_anchor_ms: getDelta('anchor', 'attest')
        };
    }
}
