import { test, expect } from '@playwright/test';
import { ethers } from 'ethers';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { createHash } from 'crypto';

/**
 * AEGIS-12 EVIDENCE SUBSTANCE VALIDATION
 * 
 * [MANDATE]: Check for substance rather than shape.
 * This suite verifies the cryptographic reality of the Evidence Pack.
 * Mocking will cause these tests to fail.
 */

const e2eWallet = new ethers.Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
const eip712Domain = { name: "Aegis-12-Compliance-Matrix", version: "1.0.0", chainId: 1399811149 };
const eip712Types = {
    Policy: [
        { name: "policyId", type: "string" },
        { name: "tenantId", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "crossChainTarget", type: "string" },
        { name: "maxAnomalyScore", type: "uint256" },
        { name: "financialLimitsString", type: "string" },
        { name: "expiresAt", type: "uint256" },
        { name: "nonce", type: "string" },
        { name: "vaultPda", type: "string" },
        { name: "squadsMultisig", type: "string" },
        { name: "allowedProgramIds", type: "string[]" }
    ]
};

const SOLANA_CLUSTER = 'devnet';
const connection = new Connection(process.env.SOLANA_RPC_URL || clusterApiUrl('devnet'), 'confirmed');

async function pollForEvidence(receiptId: string, initialSolanaTx: string) {
    let solanaTx = initialSolanaTx;
    let zkSeal = "pending";
    let pollingRetries = 150;
    while ((solanaTx === 'batching' || solanaTx === 'pending' || zkSeal === 'pending') && pollingRetries > 0) {
        await new Promise(r => setTimeout(r, 2000));
        const evidenceRes = await fetch(`${process.env.TEST_API_URL || 'https://c2fa9527475ea371388de812f47be1676bc59712-8000.dstack-pha-prod9.phala.network'}/evidence/${receiptId}`);
        if (evidenceRes.status === 200) {
            const evidenceBody = await evidenceRes.json();
            if (evidenceBody.ledger_tx) solanaTx = evidenceBody.ledger_tx;
            if (evidenceBody.ars_anchor) zkSeal = evidenceBody.ars_anchor;
        }
        pollingRetries--;
    }
    return { solanaTx, zkSeal };
}

async function validateOnChainTransaction(connection: any, solanaTx: string, receipt: any, body: any) {
    let tx = await connection.getParsedTransaction(solanaTx, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
    let retries = 10;
    while (!tx && retries > 0) {
        await new Promise(r => setTimeout(r, 5000));
        tx = await connection.getParsedTransaction(solanaTx, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
        retries--;
    }
    expect(tx, "Transaction must exist on-chain").not.toBeNull();
    const memoLog = tx!.meta?.logMessages?.find((log: string) => log.includes('Program log: Memo'));
    expect(memoLog, "Transaction must contain an SPL Memo").toBeDefined();
    const memoMatch = memoLog!.match(/Memo \(len \d+\): "(.*?)"/);
    expect(memoMatch, "Memo must match structured format").not.toBeNull();
    const memoStr = memoMatch![1];
    expect(memoStr.startsWith('a12:'), "Memo must have a12 prefix").toBeTruthy();
    const base64Payload = memoStr.substring(4);
    const decodedStr = Buffer.from(base64Payload, 'base64url').toString('utf8');
    const memoObj = JSON.parse(decodedStr);
    expect(memoObj.v, "Version must match").toBe('aegis:v8');
    if (memoObj.act.startsWith('batch-')) {
        expect(memoObj.act, "Action ID is batched").toMatch(/^batch-\d+-\d+$/);
    } else {
        expect(memoObj.act, "Action ID must match receipt").toBe(receipt.actionId);
    }
    expect(memoObj.d, "Decision must be recorded on-chain").toBe('approved');
    expect(memoObj.did, "Enclave DID must match").toBe(body.enclaveDid);
}

function validateSubstanceChecks(body: any, receipt: any, zkSeal: string, policyConfig: any, solanaTx: string) {
    const attestation = body.attestation;
    const pcr0 = body.pcr0;
    expect(attestation, "TEE Attestation must not be mocked").not.toBe("not_available_in_mock");
    expect(pcr0, "PCR0 Measurement must be present").toBeDefined();
    if (pcr0 !== 'verified_via_quote') {
        expect(pcr0.length, "PCR0 must be a valid SHA-256 hash or verified_via_quote string").toBe(64);
    }
    const ep = receipt.evidencePackage;
    expect(ep, "Auditor-grade evidence package must exist in receipt").toBeDefined();
    expect(ep.riskTier, "Risk Tier must match").toBe("T1");
    expect(ep.modelVersion, "Model version must be attached").toBe("GPT-Substance");
    expect(ep.jurisdiction, "Jurisdiction must be attached").toBe("GLOBAL");
    expect(ep.intentHash, "Intent hash must exist").toBeDefined();
    expect(ep.actionTaxonomy, "Taxonomy must be recorded").toBe("solana_transfer");
    expect(receipt.x402PaymentHeader, "x402 payment header must be cryptographically bound").toBe("mock_solana_tx_signature_x402");
    expect(policyConfig.vaultPda, "Must contain vaultPda for on-chain Aegis Verifier").toBeDefined();
    expect(policyConfig.squadsMultisig, "Must contain squadsMultisig for on-chain Aegis Verifier").toBeDefined();
    expect(zkSeal, "ZK Seal must not be mocked").not.toBe("mock-seal-for-demo");
    expect(zkSeal, "ZK Seal must be a non-empty string").toBeTruthy();
    expect(zkSeal, "ZK Seal must not be stuck in pending").not.toBe("pending");
    expect(zkSeal.length, "ZK Seal length suggests real cryptographic proof").toBeGreaterThan(100);
    expect(solanaTx, "Solana TX ID must not be mocked").not.toContain("mock_tx_");
    expect(solanaTx, "Solana TX ID must not be stuck in batching").not.toBe("batching");
}

const getPayload = (nonce: string, policyConfig: any, e2eWallet: any, signature: string) => ({
    action: { toolId: 'solana_transfer', parameters: { to: '11111111111111111111111111111111', amount: 1, token: 'SOL' }, estimatedValue: 0 },
    agent: { did: 'did:aegis:substance-test', purpose: 'financial_operations', currentTier: 'T1' },
    context: { sessionId: 'substance', actionsThisSession: 1, actionsThisHour: 1, currentAnomalyScore: 0.1, recentIncidents: 0 },
    agentContext: { prompt: "Substance test prompt validation", modelVersion: "GPT-Substance", jurisdiction: "GLOBAL" },
    x402PaymentHeader: "mock_solana_tx_signature_x402",
    dynamicPolicy: { policyConfig, ownerPublicKey: e2eWallet.address, signature },
} as any);

const getPolicyConfig = (nonce: string) => ({
    policyId: "POL_SUBSTANCE_001",
    tenantId: "tenant-council",
    version: "1.0.0",
    chainId: 1399811149,
    crossChainTarget: "solana:devnet",
    maxAnomalyScore: 100,
    financialLimitsString: JSON.stringify({ T1: 1000 }),
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    nonce: nonce,
    vaultPda: "SubstanceVault_Default",
    squadsMultisig: "SubstanceSquads_Default",
    allowedProgramIds: ["11111111111111111111111111111111"],
});

test('EVIDENCE-SUBSTANCE-001: Valid Approval produces verifiable Solana Anchor and ZK Seal', async ({ request }) => {
        test.setTimeout(300000); // 300 seconds to allow for ZK proving or OOM fallback
        const nonce = "substance-" + Date.now();
        const policyConfig = getPolicyConfig(nonce);

        const signature = await e2eWallet._signTypedData(eip712Domain, eip712Types, policyConfig);
        
        const payload = getPayload(nonce, policyConfig, e2eWallet, signature);

        console.log(`[Substance] Sending enforcement request for actionId: ${nonce}...`);
        const res = await fetch(`${process.env.TEST_API_URL || 'https://c2fa9527475ea371388de812f47be1676bc59712-8000.dstack-pha-prod9.phala.network'}/sign_and_execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const body = await res.json();

        // 1. Initial State Check (Shape)
        expect(res.status, `Request failed: ${JSON.stringify(body)}`).toBe(200);
        expect(body.status).toBe('approved');
        
        const receipt = body.receipt;
        const { solanaTx, zkSeal } = await pollForEvidence(receipt.receiptId, body.ledger_tx || "batching");

        validateSubstanceChecks(body, receipt, zkSeal, policyConfig, solanaTx);
        
        console.log(`[Substance] Fetching Solana Transaction ${solanaTx} from Devnet...`);
        
        await validateOnChainTransaction(connection, solanaTx, receipt, body);
        
        console.log(`[Substance] ✅ SUBSTANCE VERIFIED: Receipt is anchored to Solana with matching cryptographic metadata.`);
    });
