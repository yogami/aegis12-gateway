import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AegisPEP } from '../../src/infrastructure/AegisPEP';
import { AegisSigner } from '../../src/infrastructure/AegisSigner';
import { AegisEnclave } from '../../src/application/PhalaEntrypoint';
import { AegisLocalStateStore } from '../../src/infrastructure/AegisLocalStateStore';
import * as fs from 'fs';

vi.mock('../../src/infrastructure/AegisSigner', () => ({
    AegisSigner: { create: vi.fn().mockResolvedValue({ enclaveDid: 'did:aegis:123', sign: vi.fn().mockResolvedValue('sig') }) }
}));

describe('Aegis-12 Hardening Tests', () => {
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

    const createHardenedReq = (amount: string, nonce: string, limits?: string) => ({
        agent: { currentTier: 'T1', did: 'did:agent:1' },
        action: { toolId: 'transfer', parameters: { recipient: '0xabc', amount } },
        dynamicPolicy: {
            policyConfig: {
                policyId: 'pol-hardening',
                tenantId: 'tenant-1',
                version: '1.0.0',
                chainId: 1399811149,
                crossChainTarget: 'solana:devnet',
                maxAnomalyScore: 60,
                financialLimitsString: limits || '{"T1":"500"}',
                expiresAt: Math.floor(Date.now() / 1000) + 3600,
                nonce
            },
            signature: '0x' + '1b'.repeat(65)
        },
        context: { currentAnomalyScore: 0 }
    });

    describe('JSON Resilience', () => {
        it('should handle malformed JSON payload in phalaEntrypoint', async () => {
            const enclave = AegisEnclave.getInstance();
            const responseJson = await enclave.processRequest('{invalid-json');
            const response = JSON.parse(responseJson);
            expect(response.status).toBe('denied');
            expect(response.error).toBe('Malformed JSON');
        });

        it('should handle malformed financialLimitsString in AegisPEP', async () => {
            const request = createHardenedReq('100', 'nonce-hardening-json', '{invalid-json');
            await expect(pep.enforce(request as any)).rejects.toThrow('Malformed limits');
        });
    });

    describe('BigInt Logic Integrity', () => {
        it('should handle amounts exceeding MAX_SAFE_INTEGER without precision loss', async () => {
            const hugeAmount = '9007199254740992'; 
            const request = createHardenedReq(hugeAmount, 'nonce-hardening-bigint');
            await expect(pep.enforce(request as any)).rejects.toThrow('exceeds signed Tier limit 500');
        });
    });
});
