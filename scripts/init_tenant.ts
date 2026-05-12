import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, clusterApiUrl } from "@solana/web3.js";
import fs from "fs";

async function main() {
    console.log("[Aegis-12] Initializing Tenant-001 PDA...");

    // Setup connection
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

    // Load Wallet
    let payer: Keypair;
    const b64Secret = process.env.SOLANA_PAYER_SECRET;
    if (b64Secret) {
        payer = Keypair.fromSecretKey(Buffer.from(b64Secret, 'base64'));
    } else {
        // Look for local deployer.json
        if (fs.existsSync('deployer.json')) {
            const secret = JSON.parse(fs.readFileSync('deployer.json', 'utf8'));
            payer = Keypair.fromSecretKey(Uint8Array.from(secret));
        } else {
            console.error("Missing SOLANA_PAYER_SECRET or deployer.json");
            process.exit(1);
        }
    }

    const wallet = new anchor.Wallet(payer);
    const provider = new anchor.AnchorProvider(connection, wallet, { preflightCommitment: "confirmed" });
    anchor.setProvider(provider);

    // Program ID
    const programId = new anchor.web3.PublicKey("FPVw3tMxjARfaPFqkDRJSp19vPrzGQ1fW4oJwkUgeyxS");

    // Load IDL statically
    const idl = require('../src/infrastructure/idl/aegis_onchain.json');
    const program = new anchor.Program(idl as any, provider);

    const tenantId = "tenant-001";
    
    // Calculate PDA
    const [noncePda, _bump] = anchor.web3.PublicKey.findProgramAddressSync(
        [
            Buffer.from("aegis_compliance_v1"),
            Buffer.from(tenantId),
            Buffer.from("nonce")
        ],
        programId
    );

    console.log(`[Aegis-12] Tenant PDA: ${noncePda.toBase58()}`);

    try {
        const tx = await program.methods.checkpointNonce(tenantId, new anchor.BN(0))
            .accounts({
                nonceCheckpoint: noncePda,
                authority: payer.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId
            })
            .rpc();

        console.log(`[Aegis-12] Tenant-001 PDA Initialized Successfully! Tx: ${tx}`);
    } catch (e: any) {
        console.error(`[Aegis-12] Failed to initialize PDA: ${e.message}`);
        // If it fails because it's already initialized, that's fine.
    }
}

main().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
});
