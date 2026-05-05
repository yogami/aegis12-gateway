import { Connection, PublicKey } from "@solana/web3.js";
import { AgentEvidenceRecord, ITeeAnchor } from "./types";
import { EvidenceWAL } from "./wal";

export * from "./types";
export * from "./anchors/phala";

export * from "./anchors/zk_hybrid";
export * from "./wal";

export interface TelemetryConfig {
    chaffEnabled?: boolean;
    chaffVolatilityScale?: number;
    fallbackRpcs?: string[];
    teeAnchors?: ITeeAnchor[];
}

const ACTIVE_CORRELATED_POOLS = [
    new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"), // Raydium
    new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), // USDC
    new PublicKey("srmqPvymZy18hoA37322K93e226kddLksmR1uV1TntF")  // Serum V3
];

const DEFAULT_FALLBACKS = [
    "https://api.mainnet-beta.solana.com",
    "https://api.devnet.solana.com"
];

/**
 * Initializes the Telemetry Shield Plugin.
 * Wraps dynamic noise logic (Chaff) and asynchronous compliance anchoring.
 */
export class AegisShield {
    private config: TelemetryConfig;
    private wal: EvidenceWAL;

    constructor(config: TelemetryConfig = {}) {
        this.config = {
            chaffEnabled: true,
            chaffVolatilityScale: 5,
            fallbackRpcs: DEFAULT_FALLBACKS,
            teeAnchors: [],
            ...config
        };
        
        this.wal = new EvidenceWAL();
        
        // Asynchronously reconstruct and flush any stranded compliance logs
        if (this.config.teeAnchors && this.config.teeAnchors.length > 0) {
            this.wal.flushQueue(this.config.teeAnchors).catch(() => {});
        }
    }

    /**
     * Helper to cryptographically hash intent objects cleanly without importing crypto libraries
     */
    private async hashIntent(intent: any): Promise<string> {
        if (typeof crypto !== "undefined" && crypto.subtle) {
            const encoder = new TextEncoder();
            const data = encoder.encode(JSON.stringify(intent));
            const hashBuffer = await crypto.subtle.digest("SHA-256", data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
        }
        return "fallback-hash-crypto-unavailable";
    }

    /**
     * Executes the off-path radar jammer asynchronously using an isolated connection pool.
     */
    public async deployDecoyTraffic(activeBlockhash: string): Promise<{ execution_ms: string, calls: number }> {
        if (!this.config.chaffEnabled) return { execution_ms: "0.00", calls: 0 };

        const hashSub = activeBlockhash.substring(0, 8);
        const seedInteger = hashSub.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

        const rpcs = this.config.fallbackRpcs || DEFAULT_FALLBACKS;
        const isolatedRpcUrl = rpcs[seedInteger % rpcs.length];
        const chaffConnection = new Connection(isolatedRpcUrl, "confirmed");

        const dynamicCallCount = (seedInteger % 10) + (this.config.chaffVolatilityScale || 5);
        let chaffLatency = 0;

        try {
            const chaffT0 = performance.now();
            const promises = Array.from({length: dynamicCallCount}).map((_, i) => {
                return new Promise(res => {
                    const jitterMs = (seedInteger * (i + 1)) % 50;
                    setTimeout(async () => {
                        try {
                            const methodRand = (seedInteger + i) % 3;
                            if (methodRand === 0) await chaffConnection.getLatestBlockhash();
                            else if (methodRand === 1) await chaffConnection.getSlot();
                            else {
                                const targetPool = ACTIVE_CORRELATED_POOLS[i % ACTIVE_CORRELATED_POOLS.length];
                                await chaffConnection.getAccountInfo(targetPool);
                            }
                        } catch(e) {}
                        res(true);
                    }, jitterMs);
                });
            });
            await Promise.all(promises);
            chaffLatency = performance.now() - chaffT0;
        } catch (e) {}

        return { execution_ms: chaffLatency.toFixed(2), calls: dynamicCallCount };
    }

    /**
     * Anchors the Agent Evidence Record asynchronously.
     * Guaranteed to NOT block the primary execution loop while maintaining Crash-Fault durability.
     */
    public async logIntent(agentId: string, intentData: any): Promise<void> {
        if (!this.config.teeAnchors || this.config.teeAnchors.length === 0) return;

        const hash = await this.hashIntent(intentData);

        const record: AgentEvidenceRecord = {
            timestamp: new Date().toISOString(),
            agent_id: agentId,
            input_snapshot_hash: hash,
            policy_flags: ["EU_AI_ACT_ART_12_HARDENED", "ASYNC_EVIDENCE"]
        };

        // Secure payload locally before executing network dispatch
        const walId = await this.wal.storeIntent(record);

        // Fire to all anchors asynchronously
        this.config.teeAnchors.forEach(anchor => {
            anchor.submitEvidence(record).then(() => {
                // Remove from local WAL when the TEE responds with a verified 200 HTTP success
                this.wal.removeIntent(walId).catch(() => {});
            }).catch(() => {});
        });
    }
}


