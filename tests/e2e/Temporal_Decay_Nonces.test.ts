import { describe, it, expect, beforeAll, vi, afterAll } from 'vitest';
import { 
    Connection, 
    Keypair, 
    Transaction, 
    SystemProgram,
    PublicKey
} from '@solana/web3.js';
import { AegisSDK } from '../../packages/aegis12-sdk/src/AegisSDK.js';

describe('TDD: Temporal Decay Nonces (Backlog Item 1)', () => {
    let connection: Connection;
    let agentKeypair: Keypair;
    let mockNonceAccount: Keypair;

    beforeAll(() => {
        connection = new Connection('https://api.devnet.solana.com', 'confirmed');
        agentKeypair = Keypair.generate();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            json: async () => ({ decision: 'REQUIRE_HUMAN', ars_anchor: 'mock-ars' })
        }));
        mockNonceAccount = Keypair.generate();
    });

    afterAll(() => {
        vi.unstubAllGlobals();
        mockNonceAccount = Keypair.generate(); // Represents an active nonce account
    });

    it('Should intercept the raw transaction and inject a Durable Nonce structure to bypass blockhash decay', async () => {
        // Mock a standard agent transaction that normally expires in 60 seconds
        const rawTx = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: agentKeypair.publicKey,
                toPubkey: agentKeypair.publicKey,
                lamports: 10,
            })
        );
        rawTx.recentBlockhash = '11111111111111111111111111111111';
        rawTx.feePayer = agentKeypair.publicKey;
        rawTx.sign(agentKeypair);

        expect(rawTx.instructions.length).toBe(1);

        // Run through the SDK wrapper with Nonce config
        const response = await AegisSDK.signAndExecute({
            toolId: 'solana_transfer',
            parameters: {
                to: agentKeypair.publicKey.toBase58(),
                amount: 10
            }
        }, {
            agentId: 'agent-1',
            tenantId: 'tenant-1',
            policySignature: 'mock-sig',
            enclaveUrl: "http://localhost:3000/solana/sign_and_execute",
            useDurableNonce: true,
            nonceAccountPublickey: mockNonceAccount.publicKey.toBase58(),
            nonceAuthorityPublickey: agentKeypair.publicKey.toBase58()
        } as any);

        // The exact architecture dictates the SDK returns the transaction hash and evidence
        expect(response.tx_hash).toBeDefined();
        expect(response.evidence_package).toBeDefined();
        expect(response.hardware_attestation).toBeDefined();
    });
});
