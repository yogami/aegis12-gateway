import { describe, it, expect, beforeAll, vi, afterAll } from 'vitest';
import { 
    Connection, 
    Keypair, 
    Transaction, 
    SystemProgram
} from '@solana/web3.js';
import { withAegis } from '../../src/sdk/index.js';

let connection: Connection;
    let agentKeypair: Keypair;

    beforeAll(() => {
        connection = new Connection('https://api.devnet.solana.com', 'confirmed');
        agentKeypair = Keypair.generate();
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            json: async () => ({ simulatedSlot: 250000000, simulatedBlockhash: '11111111111111111111111111111111' })
        }));
    });

    afterAll(() => {
        vi.unstubAllGlobals();
    });

    it('Should explicitly expose the exact Slot and Blockhash the physical simulation was evaluated against', async () => {
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

        const { receipt } = await withAegis(rawTx, {
            enclaveUrl: "http://localhost:3000/solana/enforce-tx"
        });

        // To prevent false-positive liquidity traps, the Dev must know exactly
        // what Slot timeline the JSON returned from.
        expect(receipt.simulatedSlot).toBeDefined();
        expect(receipt.simulatedSlot).toBeGreaterThan(0);
        
        expect(receipt.simulatedBlockhash).toBeDefined();
        expect(typeof receipt.simulatedBlockhash).toBe('string');
        expect(receipt.simulatedBlockhash.length).toBeGreaterThan(10);
    });
