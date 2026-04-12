import { Connection, PublicKey } from "@solana/web3.js";

export interface TelemetryConfig {
    chaffEnabled?: boolean;
    chaffVolatilityScale?: number;
    fallbackRpcs?: string[];
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
 * Wraps dynamic noise logic (Chaff) and telemetry hashing without acting as an in-line proxy.
 */
export class AegisShield {
    private config: TelemetryConfig;

    constructor(config: TelemetryConfig = {}) {
        this.config = {
            chaffEnabled: true,
            chaffVolatilityScale: 5,
            fallbackRpcs: DEFAULT_FALLBACKS,
            ...config
        };
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
}

/**
 * Extends the raw Solana Connection object for seamless generic integration with Agent Kits.
 */
export const wrapRpc = (connection: Connection, config: TelemetryConfig = {}): Connection => {
    const shield = new AegisShield(config);
    const originalGetLatestBlockhash = connection.getLatestBlockhash.bind(connection);

    // Proxy the getLatestBlockhash to transparently fire the jammer off-path.
    connection.getLatestBlockhash = async (...args) => {
        const result = await originalGetLatestBlockhash(...args);
        // Non-blocking asynchronous chaff deployment
        shield.deployDecoyTraffic(result.blockhash).catch(() => {});
        return result;
    };
    
    return connection;
};
