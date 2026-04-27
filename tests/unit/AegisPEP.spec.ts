import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AegisPEP } from '../../src/infrastructure/AegisPEP';
import { AegisSigner } from '../../src/infrastructure/AegisSigner';
import { AegisLocalStateStore } from '../../src/infrastructure/AegisLocalStateStore';
import * as fs from 'fs';

vi.mock('../../src/infrastructure/AegisSigner', () => ({
    AegisSigner: { create: vi.fn().mockResolvedValue({ enclaveDid: 'did:aegis:123', sign: vi.fn().mockResolvedValue('sig') }) }
}));

describe('AegisPEP (Unit)', () => {
    let pep: AegisPEP;
    let signer: any;

    beforeEach(async () => {
        // Cleanup WAL files before each test
        if (fs.existsSync('/tmp/tenant_stats.wal')) fs.unlinkSync('/tmp/tenant_stats.wal');
        if (fs.existsSync('/tmp/evidence_store.wal')) fs.unlinkSync('/tmp/evidence_store.wal');
        if (fs.existsSync('/tmp/nonce_registry.json')) fs.unlinkSync('/tmp/nonce_registry.json');

        signer = await AegisSigner.create();
        const stateStore = new AegisLocalStateStore('/tmp');
        await stateStore.initialize();
        pep = new AegisPEP(signer, { 'tenant-1': ['0x123'] }, undefined, stateStore);
        
        const { Eip712Verifier } = await import('../../src/domain/Eip712Verifier');
        vi.spyOn(Eip712Verifier, 'verifySignature').mockImplementation(() => {});
    });

    const createValidReq = (amount: string, nonce: string) => ({
        agent: { currentTier: 'T1', did: 'did:agent:1' },
        action: { actionId: 'act-1', toolId: 'transfer', parameters: { recipient: '0xabc', amount } },
        dynamicPolicy: {
            policyConfig: {
                policyId: 'pol-1',
                tenantId: 'tenant-1',
                version: '1.0.0',
                chainId: 1399811149,
                crossChainTarget: 'solana:devnet',
                maxAnomalyScore: 60,
                financialLimitsString: '{"T1":"500"}',
                expiresAt: Math.floor(Date.now() / 1000) + 3600,
                nonce
            },
            signature: '0x' + '1b'.repeat(65)
        },
        context: { currentAnomalyScore: 0.1 }
    } as any);

    it('approves a valid transfer action', async () => {
        const req = createValidReq('100', 'nonce-pep-1');
        const receipt = await pep.enforce(req);
        expect(receipt.decision).toBe('approved');
        expect(receipt.tenantId).toBe('tenant-1');
    });

    it('denies if spend limit breached', async () => {
        const req = createValidReq('600', 'nonce-pep-2');
        await expect(pep.enforce(req)).rejects.toThrow('exceeds signed Tier limit 500');
    });
});
