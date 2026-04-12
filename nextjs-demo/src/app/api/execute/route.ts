import { NextRequest, NextResponse } from "next/server";
import { Connection, Keypair, Transaction, TransactionInstruction, PublicKey, sendAndConfirmTransaction } from "@solana/web3.js";
import crypto from "crypto";
import bs58 from "bs58";

async function anchorCompliancePayload(hashHex: string): Promise<{signature: string | null, status: string, explorer_url: string}> {
  // Use Mainnet if a private key is supplied
  if (process.env.SOLANA_PRIVATE_KEY) {
      try {
          const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
          const wallet = Keypair.fromSecretKey(bs58.decode(process.env.SOLANA_PRIVATE_KEY));
          
          const memoProgramId = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
          const memoInstruction = new TransactionInstruction({
              keys: [{ pubkey: wallet.publicKey, isSigner: true, isWritable: true }],
              programId: memoProgramId,
              data: Buffer.from(`Aegis-12 EU AI Act Anchoring: ${hashHex}`, 'utf-8'),
          });

          const transaction = new Transaction().add(memoInstruction);
          const signature = await sendAndConfirmTransaction(connection, transaction, [wallet]);
          return { signature, status: "success_mainnet", explorer_url: `https://explorer.solana.com/tx/${signature}` };
      } catch (e: any) {
          console.error("Mainnet anchoring failed:", e.message);
          return { signature: null, status: "failed_mainnet", explorer_url: "Mainnet Error" };
      }
  }

  // Fallback to Hyper-Resilient Devnet Engine
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const wallet = Keypair.generate();
  const memoProgramId = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

  // Attempt Airdrop with retries to circumvent rate limits (Gap 1 Mitigation)
  let airdropSuccess = false;
  for (let i = 0; i < 3; i++) {
        try {
            const airdropSignature = await connection.requestAirdrop(wallet.publicKey, 1e9);
            await connection.confirmTransaction(airdropSignature, "confirmed");
            airdropSuccess = true;
            break;
        } catch (e) {
            console.warn(`Devnet Airdrop attempt ${i+1} failed. Retrying...`);
            await new Promise(res => setTimeout(res, 1000));
        }
  }

  if (!airdropSuccess) {
      return { signature: null, status: "graceful_fallback (devnet rate limit exhaustion)", explorer_url: "Requires Faucet Funding" };
  }

  try {
        const memoInstruction = new TransactionInstruction({
            keys: [{ pubkey: wallet.publicKey, isSigner: true, isWritable: true }],
            programId: memoProgramId,
            data: Buffer.from(`Aegis-12 EU AI Act Anchoring: ${hashHex}`, 'utf-8'),
        });
        const transaction = new Transaction().add(memoInstruction);
        const signature = await sendAndConfirmTransaction(connection, transaction, [wallet]);
        return { signature, status: "success_devnet", explorer_url: `https://explorer.solana.com/tx/${signature}?cluster=devnet` };
  } catch (e: any) {
        return { signature: null, status: "tx_execution_failed", explorer_url: "Error processing ledger payload" };
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    const connection = new Connection("https://api.devnet.solana.com", "confirmed");
    let activeBlockhash = "MOCK_DUE_TO_RPC_FAIL";
    try {
      const { blockhash } = await connection.getLatestBlockhash();
      activeBlockhash = blockhash;
    } catch (e) {}

    const chaffTargets = [
      new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
      new PublicKey("11111111111111111111111111111111"),     
      new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
      new PublicKey("SysvarC1ock11111111111111111111111111111111"),
      new PublicKey("SysvarRent111111111111111111111111111111111") 
    ];
    let chaffLatency = 0;
    try {
      const chaffT0 = performance.now();
      await Promise.all(chaffTargets.map(target => connection.getAccountInfo(target)));
      chaffLatency = performance.now() - chaffT0;
    } catch (e) {}

    const agentContextPayload = {
      ...payload,
      timestamp: Date.now(),
      network_state: activeBlockhash,
      chaff_signals: Array.from({length: 50}, (_, i) => `FAKE_SIGNAL_${i}`)
    };

    const t0 = performance.now();
    const stringifiedPayload = JSON.stringify(agentContextPayload);
    const hashHex = crypto.createHash("sha256").update(stringifiedPayload).digest("hex");
    const t1 = performance.now();
    const computeLatency = (t1 - t0).toFixed(4);

    const anchorResponse = await anchorCompliancePayload(hashHex);

    return NextResponse.json({
      status: 200,
      protocol: "Aegis-12 Enterprise Gateway",
      metrics: {
        hash_penalty_ms: computeLatency,
        chaff_dispersal_ms: chaffLatency.toFixed(4)
      },
      compliance: {
        sha256_anchor: hashHex,
        anchor_status: anchorResponse.status,
        explorer_url: anchorResponse.explorer_url,
        signature: anchorResponse.signature
      }
    });

  } catch (error: any) {
    return NextResponse.json({ status: 500, error: error.message });
  }
}
