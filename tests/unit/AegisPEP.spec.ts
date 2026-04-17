import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AegisPEP } from '../../src/infrastructure/AegisPEP';
import crypto from 'crypto';

// Mock ethers before anything else
vi.mock('ethers', async (importOriginal) => {
    const actual = await importOriginal<any>();
    return {
        ...actual,
        ethers: {
            ...actual.ethers,
            utils: {
                ...actual.ethers.utils,
                verifyTypedData: vi.fn().mockReturnValue('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'),
                keccak256: vi.fn((bytes) => 'mock-hash-' + Array.from(bytes).join('')),
                toUtf8Bytes: vi.fn((str) => new TextEncoder().encode(str)),
                arrayify: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3]))
            }
        }
    };
});

describe('AegisPEP (Unit)', () => {
    let mockSigner: any;
    let trustStore: Record<string, string[]>;
    let pep: AegisPEP;

    beforeEach(() => {
        mockSigner = {
            signEIP712: vi.fn().mockReturnValue('mock-signature'),
            enclaveDid: 'did:aegis:enclave:mock'
        };
        trustStore = {
            'tenant-1': ['0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266']
        };
        pep = new AegisPEP(mockSigner, trustStore);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('rejects enforces when dynamicPolicy is missing', async () => {
        const req: any = { action: { toolId: 'solana_transfer', parameters: {} }, context: {} };
        await expect(pep.enforce(req)).rejects.toThrow('Missing Cryptographic Policy envelope');
    });

    it('rejects enforce when anomaly score is not properly scaled', async () => {
        const req: any = { 
            dynamicPolicy: { policyConfig: { tenantId: 'tenant-1', nonce: 'nonce-1', expiresAt: Math.floor(Date.now() / 1000) + 1000 } }, 
            action: { toolId: 'solana_transfer', parameters: {} }, 
            context: { currentAnomalyScore: 100 } // out of bounds > 1.0!
        };
        await expect(pep.enforce(req)).rejects.toThrow(/Invalid or unscaled contextual anomaly score/);
    });

    it('denies unknown tools during parameter normalization', async () => {
        const req: any = { 
            dynamicPolicy: { policyConfig: { tenantId: 'tenant-1', nonce: crypto.randomUUID(), policyId: '1' } }, 
            action: { toolId: 'hacker_tool', parameters: {} }, 
            context: { currentAnomalyScore: 0.1 }
        };
        await expect(pep.enforce(req)).rejects.toThrow(/Unrecognized tool execution request/);
    });

    it('approves a valid solana_transfer action', async () => {
        const validReq: any = {
            dynamicPolicy: {
                signature: '0xabc',
                policyConfig: {
                    tenantId: 'tenant-1',
                    policyId: 'pol-1',
                    nonce: crypto.randomUUID(),
                    version: '1',
                    crossChainTarget: 'solana:devnet',
                    maxAnomalyScore: 50,
                    financialLimitsString: '{"T2": 1000}',
                    expiresAt: Math.floor(Date.now() / 1000) + 1000
                }
            },
            agent: { purpose: 'financial_operations', currentTier: 'T2' },
            action: {
                toolId: 'solana_transfer',
                parameters: { to: '11111111111111111111111111111111', token: 'SOL', amount: 50, estimatedValue: 50 },
            },
            context: { currentAnomalyScore: 0.1 }
        };

        const result = await pep.enforce(validReq);
        expect(result.toolId).toBe('solana_transfer');
        expect(result.signature).toBe('mock-signature');
    });

    it('rejects solana_transfer if token is not SOL', async () => {
        const req: any = {
            dynamicPolicy: { signature: '0xabc', policyConfig: { tenantId: 'tenant-1', policyId: '1', nonce: crypto.randomUUID() } },
            agent: { purpose: 'financial_operations', currentTier: 'T2' },
            action: {
                toolId: 'solana_transfer',
                parameters: { to: '11111111111111111111111111111111', token: 'FAKE', amount: 50, estimatedValue: 50 },
            },
            context: { currentAnomalyScore: 0.1 }
        };
        await expect(pep.enforce(req)).rejects.toThrow("Missing or invalid 'token' field");
    });

    it('approves a valid swap action', async () => {
        const req: any = {
            dynamicPolicy: { signature: '0xabc', policyConfig: { tenantId: 'tenant-1', policyId: '1', nonce: crypto.randomUUID(), version: '1', crossChainTarget: 'solana:devnet', maxAnomalyScore: 50, financialLimitsString: '{"T2": 1000}', expiresAt: Math.floor(Date.now() / 1000) + 1000 } },
            agent: { purpose: 'financial_operations', currentTier: 'T2' },
            action: {
                toolId: 'swap',
                parameters: { fromMint: 'So11111111111111111111111111111111111111112', toMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', amount: 50, slippageBps: 50, estimatedValue: 50 },
            },
            context: { currentAnomalyScore: 0.1 }
        };
        const res = await pep.enforce(req);
        expect(res.toolId).toBe('swap');
    });

    it('denies swap if mints are identical', async () => {
        const req: any = {
            dynamicPolicy: { signature: '0xabc', policyConfig: { tenantId: 'tenant-1', policyId: '1', nonce: crypto.randomUUID(), version: '1', crossChainTarget: 'solana:devnet', maxAnomalyScore: 50, financialLimitsString: '{"T2": 1000}', expiresAt: Math.floor(Date.now() / 1000) + 1000 } },
            agent: { purpose: 'financial_operations', currentTier: 'T2' },
            action: {
                toolId: 'swap',
                parameters: { fromMint: 'SOL', toMint: 'SOL', amount: 50, slippageBps: 50, estimatedValue: 50 },
            },
            context: { currentAnomalyScore: 0.1 }
        };
        await expect(pep.enforce(req)).rejects.toThrow('Must be Base58 public key.');
    });

    it('denies if financialLimitsString exceeds bounds', async () => {
        const giantString = '{"T2": 1000' + ' '.repeat(1030) + '}';
        const req: any = {
            dynamicPolicy: { signature: '0xabc', policyConfig: { tenantId: 'tenant-1', policyId: '1', nonce: crypto.randomUUID(), version: '1', crossChainTarget: 'solana:devnet', maxAnomalyScore: 50, financialLimitsString: giantString, expiresAt: Math.floor(Date.now() / 1000) + 1000 } },
            agent: { purpose: 'financial_operations', currentTier: 'T2' },
            action: {
                toolId: 'solana_transfer',
                parameters: { to: '11111111111111111111111111111111', token: 'SOL', amount: 50, estimatedValue: 50 },
            },
            context: { currentAnomalyScore: 0.1 }
        };
        await expect(pep.enforce(req)).rejects.toThrow(/financialLimitsString exceeds 1024 byte safety bound/);
    });
});
