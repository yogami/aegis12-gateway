import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ITeeAnchor, AgentEvidenceRecord } from '../../packages/telemetry-shield/src/types';
import { EvidenceWAL } from '../../packages/telemetry-shield/src/wal';

// Mock @solana/web3.js Connection to prevent live RPC calls (429 rate limits from public Solana endpoints)
vi.mock('@solana/web3.js', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        ...actual,
        Connection: class {
            getLatestBlockhash = vi.fn().mockResolvedValue({ blockhash: 'MockBlockhash', lastValidBlockHeight: 100000 });
            getSlot = vi.fn().mockResolvedValue(200000);
            getAccountInfo = vi.fn().mockResolvedValue(null);
        }
    };
});

// Import AFTER mock is hoisted
import { AegisShield } from '../../packages/telemetry-shield/src';

/**
 * TelemetryShield.spec.ts
 * 
 * Deterministic unit tests for the Aegis-12 Telemetry Shield.
 * Replaces the 'bunk' Python-based LLM chaos scripts with verifiable logic.
 */

describe('AegisShield (Telemetry Shield SDK)', () => {
    let shield: AegisShield;
    let mockAnchor: ITeeAnchor;

    beforeEach(() => {
        // Clear mocks and initialize fresh instances
        vi.clearAllMocks();
        mockAnchor = {
            anchorName: 'mock-tee-anchor',
            submitEvidence: vi.fn().mockResolvedValue(undefined)
        };
        shield = new AegisShield({
            teeAnchors: [mockAnchor],
            chaffEnabled: true
        });
    });

    it('should initialize with provided configuration', () => {
        expect(shield).toBeDefined();
    });

    it('should generate deterministic SHA-256 fingerprints for intents', async () => {
        const intent = { action: 'transfer', to: 'recipient', amount: 500 };
        
        // Accessing private method for cryptographic verification
        const hash1 = await (shield as any).hashIntent(intent);
        const hash2 = await (shield as any).hashIntent(intent);
        
        expect(hash1).toBe(hash2);
        expect(hash1).toMatch(/^[a-f0-9]{64}$/); // Valid hex SHA-256
        
        const differentIntent = { ...intent, amount: 501 };
        const hash3 = await (shield as any).hashIntent(differentIntent);
        expect(hash3).not.toBe(hash1);
    });

    it('should execute decoy traffic (Chaff) and return measurable stats', { timeout: 10000 }, async () => {
        const dummyBlockhash = '8E5vP...dummy-blockhash';
        const stats = await shield.deployDecoyTraffic(dummyBlockhash);
        
        expect(stats.calls).toBeGreaterThan(0);
        expect(parseFloat(stats.execution_ms)).toBeGreaterThanOrEqual(0);
        console.log(`[Test] Decoy Traffic executed ${stats.calls} calls in ${stats.execution_ms}ms`);
    });

    it('should bypass decoy traffic when chaffEnabled is false', async () => {
        const silentShield = new AegisShield({ chaffEnabled: false });
        const stats = await silentShield.deployDecoyTraffic('any-blockhash');
        
        expect(stats.calls).toBe(0);
        expect(stats.execution_ms).toBe("0.00");
    });

    it('should log intent and trigger anchors asynchronously', async () => {
        const agentId = 'agent-alpha';
        const intent = { type: 'swap', pair: 'SOL/USDC', amount: 10 };
        
        await shield.logIntent(agentId, intent);
        
        // The anchor is triggered in a forEach(anchor => anchor.submitEvidence(...))
        // We verify that the record reaching the anchor matches our expectations.
        expect(mockAnchor.submitEvidence).toHaveBeenCalled();
        const record: AgentEvidenceRecord = (mockAnchor.submitEvidence as any).mock.calls[0][0];
        
        expect(record.agent_id).toBe(agentId);
        expect(record.policy_flags).toContain('EU_AI_ACT_ART_12_HARDENED');
        expect(record.input_snapshot_hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should maintain operational continuity if an anchor fails', async () => {
        const failingAnchor: ITeeAnchor = {
            anchorName: 'unstable-tee',
            submitEvidence: vi.fn().mockRejectedValue(new Error('TEE_DISCONNECTED'))
        };
        const resilientShield = new AegisShield({ teeAnchors: [failingAnchor] });
        
        // The SDK must NEVER throw and crash the user's trading process due to an anchor failure
        await expect(resilientShield.logIntent('agent-1', { foo: 'bar' })).resolves.not.toThrow();
        expect(failingAnchor.submitEvidence).toHaveBeenCalled();
    });
});

describe('EvidenceWAL (Write-Ahead Log)', () => {
    it('should protect against Out Of Memory (OOM) via FIFO ejection', async () => {
        const wal = new EvidenceWAL();
        // Manually trigger OOM protection logic by filling the queue
        // Since MAX_QUEUE_SIZE is 5000, we push enough to trigger ejection
        
        const record: AgentEvidenceRecord = {
            timestamp: new Date().toISOString(),
            agent_id: 'test',
            input_snapshot_hash: 'hash',
            policy_flags: []
        };

        // We mock the Map size to avoid actually pushing 5000 items in a unit test
        const queue = (wal as any).inMemoryQueue;
        
        // Seed the map with one item so there is something to "evict"
        queue.set('old-id', { id: 'old-id', record });
        
        const deleteSpy = vi.spyOn(queue, 'delete');
        
        // Fake 5000 items
        Object.defineProperty(queue, 'size', { get: () => 5000 });
        
        await wal.storeIntent(record);
        
        // Verify that the oldest item was deleted to make room
        expect(deleteSpy).toHaveBeenCalled();
    });
});
