import { describe, it, expect, beforeAll } from 'vitest';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as sqds from '@sqds/multisig';
import { SquadsRouter } from '../../src/infrastructure/SquadsRouter';
import { AegisComplianceReceipt } from '../../src/types';
import * as dotenv from 'dotenv';
import { Buffer } from 'buffer';

dotenv.config();

/** Loads a Keypair from the SOLANA_PAYER_SECRET env var, or null. */
const loadKeypairFromEnv = (): Keypair | null => {
    try {
        const secretBase64 = process.env.SOLANA_PAYER_SECRET;
        if (!secretBase64) return null;
        return Keypair.fromSecretKey(Buffer.from(secretBase64, 'base64'));
    } catch {
        return null;
    }
};

/** Ensures the payer has enough SOL for test transactions. */
async function ensureFunded(connection: Connection, payer: Keypair): Promise<void> {
    const balance = await connection.getBalance(payer.publicKey);
    if (balance < 10000000) {
        console.log("[Test] Balance too low, requesting Devnet Airdrop...");
        try {
            const sig = await connection.requestAirdrop(payer.publicKey, 1000000000);
            await connection.confirmTransaction(sig, 'confirmed');
        } catch {
            console.warn("[Test] Airdrop failed. Ensure SOLANA_PAYER_SECRET is funded.");
        }
    }
}

/** Creates a fresh Squads V4 Multisig on Devnet. */
async function createTestMultisig(
    connection: Connection,
    payer: Keypair
): Promise<PublicKey> {
    const createKey = Keypair.generate();
    const [multisigPda] = sqds.getMultisigPda({ createKey: createKey.publicKey });
    console.log(`[Test] Creating Multisig: ${multisigPda.toBase58()}`);

    const [programConfigPda] = sqds.getProgramConfigPda({ programId: sqds.PROGRAM_ID });
    const programConfig = await sqds.generated.ProgramConfig.fromAccountAddress(connection, programConfigPda);

    const signature = await sqds.rpc.multisigCreateV2({
        connection, createKey, creator: payer, multisigPda,
        configAuthority: null, treasury: programConfig.treasury,
        timeLock: 0,
        members: [{ key: payer.publicKey, permissions: sqds.types.Permissions.all() }],
        threshold: 1, rentCollector: null,
        sendOptions: { skipPreflight: true }
    });

    const res = await connection.confirmTransaction(signature, 'confirmed');
    if (res.value.err) {
        throw new Error(`Multisig creation failed: ${JSON.stringify(res.value.err)}`);
    }
    console.log(`[Test] Multisig created. Waiting for RPC sync...`);
    await new Promise(r => setTimeout(r, 3000));
    return multisigPda;
}

/** Builds a test compliance receipt targeting the given multisig. */
function buildEscalatedReceipt(multisigPda: PublicKey): AegisComplianceReceipt {
    return {
        receiptId: `aegis-esc-${Math.floor(Date.now() / 1000)}`,
        decision: 'escalated',
        envelope: {
            vault_pda: multisigPda.toBase58(),
            state_predicates: { valid_until_slot: 0 },
            instruction_digest: "0xMockDigest",
            tee_signature: "mock_sig"
        },
        authorizationNonce: "nonce",
        actionId: "act1"
    };
}

/** Waits for RPC sync then verifies the proposal account exists. */
async function verifyProposalOnChain(connection: Connection, proposalPda: string): Promise<void> {
    console.log(`[Test] Waiting for RPC to sync proposal account...`);
    await new Promise(r => setTimeout(r, 3000));
    const info = await connection.getAccountInfo(new PublicKey(proposalPda), 'confirmed');
    expect(info).not.toBeNull();
}

describe('SquadsRouter Integration (No Mocks)', () => {
    let connection: Connection;
    let payer: Keypair;
    let multisigPda: PublicKey;

    beforeAll(async () => {
        const rpcUrl = process.env.SOLANA_RPC_URL
            || 'https://devnet.helius-rpc.com/?api-key=e3f686d4-1710-4a8e-a2f4-4f147052af29';
        connection = new Connection(rpcUrl, 'confirmed');
        payer = loadKeypairFromEnv() || Keypair.generate();
        console.log(`[Test] Using Payer: ${payer.publicKey.toBase58()}`);
        await ensureFunded(connection, payer);
        multisigPda = await createTestMultisig(connection, payer);
    }, 60000);

    it('should create an on-chain proposal for an escalated intent', async () => {
        const receipt = buildEscalatedReceipt(multisigPda);
        const result = await SquadsRouter.routeIfEscalated(receipt, connection, payer);

        expect(result).toBeDefined();
        expect(result?.proposalPda).toBeDefined();
        expect(result?.txSignature).toBeDefined();

        await verifyProposalOnChain(connection, result!.proposalPda);
    }, 60000);
});

