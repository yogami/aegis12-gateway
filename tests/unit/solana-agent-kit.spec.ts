import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AegisSolanaAgent, AegisAgentConfig } from '../../src/solana-agent-kit';
import { Keypair, Connection } from '@solana/web3.js';

const mockFetch = vi.hoisted(() => vi.fn());

vi.mock('node-fetch', () => ({
    default: mockFetch
}));

let agent: AegisSolanaAgent;
    let config: AegisAgentConfig;

    beforeEach(() => {
        vi.clearAllMocks();
        config = {
            gatewayUrl: 'http://localhost:8000',
            agentKeypair: Keypair.generate(),
            agentTier: 'T2',
            agentDid: 'did:sol:agent-1',
            connection: new Connection('http://localhost'),
            multisigPda: 'mock-pda'
        };
        agent = new AegisSolanaAgent(config);
    });

    it('throws if squads cosign requested without multisigPda', async () => {
        const noPdaConfig = { ...config, multisigPda: undefined };
        const badAgent = new AegisSolanaAgent(noPdaConfig);

        await expect(badAgent.executeSafeTransaction('tx', true, 1))
            .rejects.toThrow('multisigPda and txIndex required for co-signing');
    });

    it('throws if squads cosign requested without txIndex', async () => {
        await expect(agent.executeSafeTransaction('tx', true))
            .rejects.toThrow('multisigPda and txIndex required for co-signing');
    });

    it('handles squads cosign success', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockResolvedValue({ status: 'success' })
        });

        const res = await agent.executeSafeTransaction('tx', true, 5);
        
        expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/solana/cosign-proposal', expect.any(Object));
        expect(res).toBe('Squads Proposal 5 co-signed by Aegis. Transaction is ready to execute on-chain.');
    });

    it('handles squads cosign rejection', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            json: vi.fn().mockResolvedValue({ reason: 'Policy Denied' })
        });

        await expect(agent.executeSafeTransaction('tx', true, 5))
            .rejects.toThrow('Aegis rejected co-signing: Policy Denied');
    });

    it('handles standard enforcement success', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockResolvedValue({ riskScore: 0.2 })
        });

        const res = await agent.executeSafeTransaction('tx-base64', false);
        
        expect(mockFetch).toHaveBeenCalledWith('http://localhost:8000/solana/enforce-tx', expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('tx-base64')
        }));
        expect(res).toBe('Transaction allowed. Aegis risk score: 0.2.');
    });

    it('handles standard enforcement failure fallback to error', async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            json: vi.fn().mockResolvedValue({ error: 'System Error' })
        });

        await expect(agent.executeSafeTransaction('tx-base64', false))
            .rejects.toThrow('Aegis enforcement failed: System Error');
    });
