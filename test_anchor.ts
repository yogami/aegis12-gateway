import { SolanaAnchor } from './src/infrastructure/SolanaAnchor';
import { AegisRegistryClient } from './src/infrastructure/AegisRegistryClient';
import * as anchor from '@coral-xyz/anchor';
import { Keypair } from '@solana/web3.js';

async function main() {
    // Generate a fresh keypair to avoid hitting devnet rate limits?
    const wallet = new anchor.Wallet(Keypair.generate());
    const client = new AegisRegistryClient('https://api.devnet.solana.com', wallet, 'FPVw3tMxjARfaPFqkDRJSp19vPrzGQ1fW4oJwkUgeyxS');
    
    const formattedReceipt = {
        receiptId: `test-${Date.now()}`,
        article12LogHash: "0x1234567890123456789012345678901234567890123456789012345678901234",
        signature: "0x12345678901234567890123456789012345678901234567890123456789012341234567890123456789012345678901234567890123456789012345678901234",
        article14OversightSignature: null,
        timestamp: new Date().toISOString(),
        tenantId: "tenant-001",
        policyId: "pol-123",
        agentId: "agent-1"
    };

    console.log("Input:", formattedReceipt);

    try {
        await client.anchorReceipt(formattedReceipt as any);
    } catch (e: any) {
        console.error("ERROR:", e.stack);
    }
}

main().catch(console.error);
