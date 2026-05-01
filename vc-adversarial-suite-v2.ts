// vc-adversarial-suite-v2.ts
// Black-box adversarial tests for Aegis-12 TEE Compliance Gateway
// To execute:  `npx jest vc-adversarial-suite-v2.ts`  (or vitest)
import { describe, it, expect, beforeAll } from 'vitest';

import { AegisPEP } from "./src/infrastructure/AegisPEP";
import { AegisSigner } from "./src/infrastructure/AegisSigner";
import { AegisLocalStateStore } from "./src/infrastructure/AegisLocalStateStore";
import { Eip712Verifier } from "./src/domain/Eip712Verifier";
import { PolicyEvaluationRequest, TrustTier, AgentPurpose } from "./src/types";
import { ethers, Wallet } from "ethers";
import { randomBytes } from "crypto";
import { AegisLocalNonceRegistry } from "./src/infrastructure/NonceRegistry";

process.env.PHALA_SIMULATED_ROOT_SEED = "0x" + randomBytes(32).toString("hex"); // satisfy entropy check
process.env.DATA_DIR = '/tmp'; // Avoid permission errors with default /var/data

// ----- helpers -------------------------------------------------------------

const DOMAIN = {
  name: "Aegis-12-Compliance-Matrix",
  version: "1.0.0",
  chainId: 1399811149,
};

async function buildSignedPolicy(
  wallet: Wallet,
  overrides: Partial<PolicyEvaluationRequest["dynamicPolicy"]["policyConfig"]> = {}
) {
  const policyConfig = {
    policyId: "pol-1",
    tenantId: "tenant-unit-test",
    version: "1",
    chainId: DOMAIN.chainId,
    crossChainTarget: "solana:devnet",
    maxAnomalyScore: 90,
    financialLimitsString: JSON.stringify({ [TrustTier.T4]: 100000 }),
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    nonce: "nonce-" + Math.random().toString(36).slice(2),
    ...overrides,
  };

  const types = {
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
    ],
  };

  const signature = await wallet._signTypedData(DOMAIN, types, policyConfig);

  return {
    policyConfig,
    ownerPublicKey: wallet.address,
    signature,
  };
}

// --------------------------------------------------------------------------

describe("Aegis-12 Compliance Gateway – adversarial suite v2", () => {
  let enclaveSigner: AegisSigner;
  let tenantWallet: Wallet;
  let tenantTrustStore: Record<string, string[]>;
  let pep: AegisPEP;

  beforeAll(async () => {
    enclaveSigner = await AegisSigner.create();
    tenantWallet = Wallet.createRandom();
    tenantTrustStore = {
      "tenant-unit-test": [tenantWallet.address],
    };

    pep = new AegisPEP(
      enclaveSigner,
      tenantTrustStore,
      new AegisLocalNonceRegistry(),
      new AegisLocalStateStore('/tmp')
    );
  });

  const baseAgent = {
    did: "did:web:agent.test",
    purpose: AgentPurpose.FINANCIAL_OPERATIONS,
    currentTier: TrustTier.T4,
  };

  const baseAction = {
    toolId: "swap",
    actionType: "swap",
    parameters: {
      fromMint: "So11111111111111111111111111111111111111112",
      toMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      amount: 1000,
      slippageBps: 50,
    },
    estimatedValue: 1000,
  };

  const baseContext = {
    sessionId: "sess-1",
    actionsThisSession: 1,
    actionsThisHour: 1,
    currentAnomalyScore: 0.1,
    recentIncidents: 0,
  };

  it("allows a correctly signed policy the first time and produces a verifiable receipt", async () => {
    const req: PolicyEvaluationRequest = {
      agent: baseAgent,
      action: baseAction,
      context: baseContext,
      dynamicPolicy: await buildSignedPolicy(tenantWallet),
    };

    const receipt = await pep.enforce(req);
    expect(receipt.signature.length).toBeGreaterThan(0);

    // SUBSTANCE AUDIT: Verify Enclave Signature on Receipt
    const isValid = Eip712Verifier.verifyReceipt(
        receipt, 
        enclaveSigner.getAddress(), 
        "Aegis-12-Compliance-Matrix", 
        "1.0.0", 
        1399811149
    );
    expect(isValid).toBe(true);

    // Validate squadmanifest payload structure
    const squadmanifest = {
        status: receipt.decision === 'approved' ? 'APPROVED' : 'BLOCKED',
        policyViolations: [],
        timestamp: new Date().toISOString(),
        teeAttestationHash: receipt.parametersHash,
        intentHash: receipt.receiptId
    };
    expect(squadmanifest.status).toBe('APPROVED');
    expect(squadmanifest.teeAttestationHash).toBeDefined();
  });

  it("blocks the exact same nonce (replay attack)", async () => {
    const signed = await buildSignedPolicy(tenantWallet);
    const req: PolicyEvaluationRequest = {
      agent: baseAgent,
      action: baseAction,
      context: baseContext,
      dynamicPolicy: signed,
    };
    // first call – should succeed
    await pep.enforce(req);

    // second call – expect terminal refusal
    await expect(pep.enforce(req)).rejects.toThrow(/Nonce already used/i);
  });

  it("rejects an invalid EIP-712 signature", async () => {
    const evilWallet = Wallet.createRandom();
    const badPolicy = await buildSignedPolicy(evilWallet); // wallet not in tenantTrustStore
    const req: PolicyEvaluationRequest = {
      agent: baseAgent,
      action: baseAction,
      context: baseContext,
      dynamicPolicy: badPolicy,
    };

    await expect(pep.enforce(req)).rejects.toThrow(/Signer not found/i);
  });

  it("rejects mismatched crossChainTarget", async () => {
    const wrongTargetPolicy = await buildSignedPolicy(tenantWallet, {
      crossChainTarget: "solana:mainnet-beta",
    });
    const req: PolicyEvaluationRequest = {
      agent: baseAgent,
      action: baseAction,
      context: baseContext,
      dynamicPolicy: wrongTargetPolicy,
    };

    await expect(pep.enforce(req)).rejects.toThrow(/crossChainTarget mismatch/i);
  });
});
