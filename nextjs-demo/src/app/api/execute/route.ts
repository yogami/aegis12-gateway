import { NextRequest, NextResponse } from "next/server";
import { Connection, Keypair, Transaction, TransactionInstruction, PublicKey, sendAndConfirmTransaction } from "@solana/web3.js";
import crypto from "crypto";
import bs58 from "bs58";

async function anchorCompliancePayload(hashHex: string): Promise<{signature: string | null, status: string, explorer_url: string}> {
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

  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const wallet = Keypair.generate();
  const memoProgramId = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

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

    // =============== ACTIVE POLICY GUARDRAIL (Zero-Latency Circuit Breaker) ===============
    if (payload.target_rate && payload.target_rate > 5.0) {
         return NextResponse.json({ 
             status: 403, 
             error: "Aegis-12 Compliance Block: Target rate exceeds risk threshold. Agent execution killed." 
         }, { status: 403 });
    }

    // PRIMARY EXECUTION CONNECTION
    const executionConnection = new Connection("https://api.devnet.solana.com", "confirmed");
    let activeBlockhash = "MOCK_DUE_TO_RPC_FAIL";
    try {
      const { blockhash } = await executionConnection.getLatestBlockhash();
      activeBlockhash = blockhash;
    } catch (e) {}

    let seedInteger = 5;
    if (activeBlockhash !== "MOCK_DUE_TO_RPC_FAIL") {
        const hashSub = activeBlockhash.substring(0, 8);
        seedInteger = hashSub.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    }
    
    // =============== GAP 2: RPC CONNECTION SHARDING ===============
    // Route Chaff through isolated public fallback RPCs to protect the primary execution pool.
    const fallbackRPCs = [
        "https://api.mainnet-beta.solana.com",
        "https://api.devnet.solana.com"
    ];
    const isolatedRpcUrl = fallbackRPCs[seedInteger % fallbackRPCs.length];
    const chaffConnection = new Connection(isolatedRpcUrl, "confirmed");

    // =============== GAP 1: CORRELATED LIQUIDITY CHAFF ===============
    // Querying active Raydium v4 Liquidity Pools & USDC mints rather than dummy SystemPrograms.
    const ACTIVE_CORRELATED_POOLS = [
        new PublicKey("675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"), // Raydium Liquidity Pool v4
        new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), // USDC Mint (Heavy Traffic)
        new PublicKey("srmqPvymZy18hoA37322K93e226kddLksmR1uV1TntF") // Serum V3 DEX
    ];

    const dynamicCallCount = (seedInteger % 10) + 5; 
    let chaffLatency = 0;

    try {
      const chaffT0 = performance.now();
      const promises = Array.from({length: dynamicCallCount}).map((_, i) => {
          return new Promise(res => {
              const jitterMs = (seedInteger * (i + 1)) % 50;
              setTimeout(async () => {
                  try {
                      // Dynamically query Active Liquidity Pools and randomized native chains
                      const methodRand = (seedInteger + i) % 3;
                      if (methodRand === 0) await chaffConnection.getLatestBlockhash();
                      else if (methodRand === 1) await chaffConnection.getSlot();
                      else {
                          const targetPool = ACTIVE_CORRELATED_POOLS[i % ACTIVE_CORRELATED_POOLS.length];
                          await chaffConnection.getAccountInfo(targetPool);
                      }
                  } catch(e) {}
                  res(true);
              }, jitterMs);
          });
      });
      await Promise.all(promises);
      chaffLatency = performance.now() - chaffT0;
    } catch (e) {}

    const chaffMetrics = {
        entropy_seed_blockhash: activeBlockhash,
        calls_executed: dynamicCallCount,
        synthetic_jitter_ms: chaffLatency.toFixed(2),
        rpc_shard: isolatedRpcUrl
    };

    // =============== GAP 3: EXECUTION RECEIPT LEDGERING (The Stranded Log Fix) ===============
    // Connects the off-path intent to the on-chain settlement if the AI worker provided it.
    const verifiedExecutionReceipt = payload.execution_receipt_tx || "INTENT_AWAITING_SETTLEMENT";

    const agentContextPayload = {
      ...payload,
      timestamp: Date.now(),
      network_state: activeBlockhash,
      chaff_metrics: chaffMetrics,
      verified_execution_receipt: verifiedExecutionReceipt
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
