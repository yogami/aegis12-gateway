import { NextRequest, NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { signature, payload } = await req.json();

    if (!signature || !payload) {
        return NextResponse.json({ status: 400, error: "Missing 'signature' or 'payload' in JSON body." });
    }

    // 1. Recalculate the Expected Hash deterministically from the payload
    // Note: In production, the activeBlockhash and chaffIDs would be provided in the payload trace context. 
    // For this prototype demonstration, we assume the payload provided is the exact stringified object that was signed.
    const expectedHashHex = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");

    // 2. Query the Live Solana Blockchain (Devnet/Mainnet agnostic via public RPC)
    const cluster = process.env.SOLANA_PRIVATE_KEY ? "mainnet-beta" : "devnet";
    const connection = new Connection(`https://api.${cluster}.solana.com`, "confirmed");

    const tx = await connection.getTransaction(signature, { maxSupportedTransactionVersion: 0 });
    
    const message: any = tx.transaction.message;
    const instructions = message.compiledInstructions || message.instructions;

    if (!tx || !instructions) {
        return NextResponse.json({ status: 404, error: "Transaction signature not found on Ledger." });
    }

    // 3. Extract the Memo Program Instruction
    const memoProgramIdStr = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
    const accountKeys = typeof message.getAccountKeys === 'function' ? message.getAccountKeys() : (message.staticAccountKeys || message.accountKeys);
    let foundMemo = null;

    for (const ix of instructions) {
        // Find the index of the programId in the static account keys
        let programId: any = null;
        if (accountKeys && typeof accountKeys.get === 'function') {
            programId = accountKeys.get(ix.programIdIndex);
        } else if (accountKeys && accountKeys.length > ix.programIdIndex) {
            programId = accountKeys[ix.programIdIndex];
        }

        if (programId && programId.toBase58() === memoProgramIdStr) {
            // @ts-ignore - The instruction data is a buffer or UInt8Array, cast it slightly depending on web3.js version
            const dataBuffer = Buffer.from(ix.data);
            foundMemo = dataBuffer.toString('utf-8');
        }
    }

    if (!foundMemo) {
        return NextResponse.json({ status: 400, error: "No Memo instruction found in the provided transaction." });
    }

    // 4. Mathematical Comparison
    const expectedMemoString = `Aegis-12 EU AI Act Anchoring: ${expectedHashHex}`;
    const isValid = foundMemo.trim() === expectedMemoString.trim();

    return NextResponse.json({
        status: 200,
        verification: isValid ? "SUCCESS" : "FAILED",
        details: {
            extracted_ledger_string: foundMemo,
            locally_computed_string: expectedMemoString,
            match: isValid
        }
    });

  } catch (error: any) {
    return NextResponse.json({ status: 500, error: error.message });
  }
}
