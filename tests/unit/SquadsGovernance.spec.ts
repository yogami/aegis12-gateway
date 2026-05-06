import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SquadsGovernance } from '../../src/infrastructure/SquadsGovernance';
import { TrustTier } from '../../src/types';
import { Keypair, PublicKey } from '@solana/web3.js';
import * as multisig from '@sqds/multisig';

vi.mock('@sqds/multisig', () => ({
    rpc: {
        proposalApprove: vi.fn().mockResolvedValue('mock-signature')
    }
}));

let gov: SquadsGovernance;
    const actionCtx = { agentDid: 'did:aegis:123', toolId: 't1', actionType: 'tx', parameters: {} };

    beforeEach(() => {
        vi.clearAllMocks();
        gov = new SquadsGovernance({ multisigPda: 'TestMultisigPda11111111111111111111111111111' });
    });

    it('blocks if anomaly score >= hardBlockThreshold', async () => {
        const res = await gov.evaluateAction(0.85, TrustTier.T3, 0, actionCtx);
        expect(res.decision).toBe('BLOCKED');
        expect(res.reason).toMatch(/exceeds hard block threshold/);
        expect(res.proposal).toBeUndefined();
    });

    it('requires human if anomaly score >= humanReviewThreshold', async () => {
        const res = await gov.evaluateAction(0.65, TrustTier.T3, 0, actionCtx);
        expect(res.decision).toBe('REQUIRE_HUMAN');
        expect(res.reason).toMatch(/triggers human oversight/);
        expect(res.proposal).toBeDefined();
        expect(res.proposal?.requiredApprovals).toBe(1);
    });

    it('requires 2 approvals if anomaly score >= 0.75', async () => {
        const res = await gov.evaluateAction(0.76, TrustTier.T3, 0, actionCtx);
        expect(res.decision).toBe('REQUIRE_HUMAN');
        expect(res.proposal?.requiredApprovals).toBe(2);
    });

    it('requires human if estimated value exceeds tier spending limit', async () => {
        // T2 limit is 1 SOL = 1_000_000_000 lamports
        const res = await gov.evaluateAction(0.1, TrustTier.T2, 2_000_000_000, actionCtx);
        expect(res.decision).toBe('REQUIRE_HUMAN');
        expect(res.reason).toMatch(/exceeds T2 spending limit/);
        expect(res.proposal).toBeDefined();
    });

    it('is autonomous if risk is low and value within limit', async () => {
        // T3 limit is 10 SOL
        const res = await gov.evaluateAction(0.1, TrustTier.T3, 5_000_000_000, actionCtx);
        expect(res.decision).toBe('AUTONOMOUS');
        expect(res.reason).toMatch(/operating within spending limit/);
        expect(res.proposal).toBeUndefined();
    });

    it('co-signs proposal successfully', async () => {
        const sig = await gov.coSignProposal(Keypair.generate().publicKey, 1n, Keypair.generate());
        expect(sig).toBe('mock-signature');
        expect(multisig.rpc.proposalApprove).toHaveBeenCalled();
    });

    it('throws error if co-signing fails', async () => {
        vi.mocked(multisig.rpc.proposalApprove).mockRejectedValueOnce(new Error('RPC failed'));
        await expect(gov.coSignProposal(Keypair.generate().publicKey, 1n, Keypair.generate()))
            .rejects.toThrow(/Failed to co-sign Squads proposal: RPC failed/);
    });

    it('returns multisig config correctly', () => {
        const config = gov.getMultisigConfig(['pubkey1', 'pubkey2'], 1);
        expect(config.threshold).toBe(1);
        expect(config.members).toHaveLength(2);
        expect(config.members[0].key).toBe('pubkey1');
        expect(config.members[0].permissions).toBe('Proposer, Voter, Executor');
        expect(config.members[1].permissions).toBe('Voter');
        expect(config.instructions).toContain('multisigCreateV2');
    });
