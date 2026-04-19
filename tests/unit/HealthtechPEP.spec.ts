import { expect, test, describe, beforeEach } from 'vitest';
import { HealthtechPEP } from '../../src/infrastructure/HealthtechPEP';
import { HealthtechRequest, HealthtechPolicy } from '../../src/healthtech-types';
import { AegisSigner } from '../../src/infrastructure/AegisSigner';

describe('HealthtechPEP (Unit)', () => {
    let pep: HealthtechPEP;
    let mockPolicy: HealthtechPolicy;
    let signer: AegisSigner;

    beforeEach(() => {
        signer = AegisSigner.createSync();
        mockPolicy = {
            allowedActions: {
                'doctor': ['read_ehr', 'write_ehr'],
                'intern': ['read_ehr']
            },
            blockedDataPatterns: [/SSN-\d{4}/, /CREDIT-\d{4}/]
        };
        pep = new HealthtechPEP(mockPolicy, signer);
    });

    test('allows valid request', async () => {
        const req: HealthtechRequest = {
            agentId: 'agent-1',
            targetAction: 'read_ehr',
            agentRole: 'doctor'
        };
        const result = await pep.evaluate(req);
        expect(result.status).toBe('approved');
    });

    test('denies invalid role action', async () => {
        const req: HealthtechRequest = {
            agentId: 'agent-1',
            targetAction: 'write_ehr',
            agentRole: 'intern'
        };
        const result = await pep.evaluate(req);
        expect(result.status).toBe('denied');
        expect(result.evidencePack.decisionReason).toContain('not authorized');
    });

    test('denies matching PII blocked data pattern', async () => {
        const req: HealthtechRequest = {
            agentId: 'agent-1',
            targetAction: 'write_ehr',
            agentRole: 'doctor',
            payloadData: { notes: "Patient SSN-1234 is restricted." }
        };
        const result = await pep.evaluate(req);
        expect(result.status).toBe('denied');
        expect(result.evidencePack.decisionReason).toContain('Payload contains restricted PII');
    });
});
