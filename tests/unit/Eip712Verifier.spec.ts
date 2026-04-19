import { describe, it, expect, vi } from 'vitest';
import { Eip712Verifier } from '../../src/domain/Eip712Verifier';
import { ethers } from 'ethers';

vi.mock('ethers', () => ({
    ethers: {
        utils: {
            verifyTypedData: vi.fn()
        }
    }
}));

describe('Eip712Verifier (Unit)', () => {
    it('throws if signer is not in tenant trust store', () => {
        vi.mocked(ethers.utils.verifyTypedData).mockReturnValueOnce('0xMalicious');

        const policy = {
            signature: 'sig',
            policyConfig: {
                policyId: '1',
                tenantId: 'tenant-1',
                version: '1',
                chainId: 1,
                crossChainTarget: 'solana:devnet',
                maxAnomalyScore: 50,
                financialLimitsString: '{}',
                expiresAt: 100,
                nonce: '1'
            }
        };

        const trustStore = { 'tenant-1': ['0xTrusted'] };

        expect(() => Eip712Verifier.verifySignature(policy, trustStore, 'domain', '1', 1, '0xContract'))
            .toThrow('Signer not found in provisioned TEE Root-of-Trust. Found: 0xmalicious');
    });

    it('throws if crossChainTarget does not match environment', () => {
        vi.mocked(ethers.utils.verifyTypedData).mockReturnValueOnce('0xTrusted');

        const policy = {
            signature: 'sig',
            policyConfig: {
                policyId: '1',
                tenantId: 'tenant-1',
                version: '1',
                chainId: 1,
                crossChainTarget: 'solana:mainnet-beta', // environment will default to devnet
                maxAnomalyScore: 50,
                financialLimitsString: '{}',
                expiresAt: 100,
                nonce: '1'
            }
        };

        const trustStore = { 'tenant-1': ['0xTrusted'] };

        process.env.SOLANA_CLUSTER = 'devnet';

        expect(() => Eip712Verifier.verifySignature(policy, trustStore, 'domain', '1', 1, '0xContract'))
            .toThrow('[TERMINAL REFUSAL] crossChainTarget mismatch. Expected solana:devnet, got solana:mainnet-beta.');
    });

    it('passes if signature is valid, authorized, and crossChainTarget matches', () => {
        vi.mocked(ethers.utils.verifyTypedData).mockReturnValueOnce('0xTrusted');

        const policy = {
            signature: 'sig',
            policyConfig: {
                policyId: '1',
                tenantId: 'tenant-1',
                version: '1',
                chainId: 1,
                crossChainTarget: 'solana:devnet',
                maxAnomalyScore: 50,
                financialLimitsString: '{}',
                expiresAt: 100,
                nonce: '1'
            }
        };

        const trustStore = { 'tenant-1': ['0xTrusted'] };

        process.env.SOLANA_CLUSTER = 'devnet';

        expect(() => Eip712Verifier.verifySignature(policy, trustStore, 'domain', '1', 1, '0xContract'))
            .not.toThrow();
    });
});
