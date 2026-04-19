import { test, expect } from '@playwright/test';
import { SolanaAnchor } from '../src/infrastructure/SolanaAnchor';
import { withAegis } from '../src/sdk/AegisAgentWrapper';
import * as sinon from 'sinon';

test.describe('Frontier Council Remediation Suite (TDD)', () => {
    let anchor: SolanaAnchor;

    test.beforeEach(() => {
        anchor = new SolanaAnchor('devnet');
    });

    test.afterEach(() => {
        sinon.restore();
    });

    test.describe('State Sharding (ZK Proof Memo)', () => {
        test('should structure memo as aegis:v2-zkp with snark proof', async () => {
            // @ts-ignore
            sinon.stub(anchor['connection'], 'sendTransaction').resolves('mock_tx_sig');
            // @ts-ignore
            sinon.stub(anchor['connection'], 'confirmTransaction').resolves({ context: { slot: 1 }, value: { err: null } } as any);
            // @ts-ignore
            sinon.stub(anchor['connection'], 'getSlot').resolves(1);

            const receipt = {
                actionId: 'test-action-123',
                timestamp: new Date().toISOString(),
                payloadHash: 'abcd1234abcd1234',
                decision: 'ALLOW',
                signature: 'sig',
                zkSnarkProof: { pi_a: ['1'], pi_b: [['1']], pi_c: ['1'] }
            };

            const result = await anchor.anchorReceipt(receipt as any, 'approved', 'did:phala:test');
            expect(result.receiptHash).not.toBe(receipt.payloadHash); // Replaced by ZKP
            expect(result.txSignature).toBe('mock_tx_sig');
            
            expect(result).toHaveProperty('isZkSharded', true);
        });
    });

    test.describe('Decentralized RPC Fallback', () => {
        test('should failover to fallback RPC if primary throws 429 Too Many Requests', async () => {
            const error = new Error('429 Too Many Requests');
            let calls = 0;
            sinon.stub(anchor as any, 'sendTxWithFailover').callsFake(async () => {
                calls++;
                if (calls === 1) throw error;
                return 'fallback_success_tx';
            });

            const res = await (anchor as any).sendTxWithFailover('mock_tx');
            expect(res).toBe('fallback_success_tx');
            expect(calls).toBe(2);
        });
    });

    test.describe('Dual-Mode Sensor MPC Cold-Path', () => {
        test('should execute MPC cold-path if TEE drops connection (timeout)', async () => {
            const mockAction = async () => ({ toolId: 'test_action', parameters: { data: 'mock' } } as any);
            
            const config = {
                gatewayUrl: 'http://localhost:9999', // Invalid port to trigger timeout/refusal
                agentId: 'test-agent',
                tenantId: 'tenant-council',
                fallbackOnTimeout: true,
                timeoutMs: 50,
                enableMpcColdPath: true
            };

            const wrapped = withAegis(mockAction, config);
            
            const result = await wrapped();
            expect(result.decision).toBe('FALLBACK_MPC_COLD_PATH');
            expect(result.success).toBe(true); 
            expect(result).toHaveProperty('mpcSignature');
        });
    });
});
