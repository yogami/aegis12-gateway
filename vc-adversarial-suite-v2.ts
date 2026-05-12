// vc-adversarial-suite-v2.ts
// Black-box adversarial tests for Aegis-12 TEE Compliance Gateway
// To execute:  `npx jest vc-adversarial-suite-v2.ts`  (or vitest)
import { describe, it, expect, beforeAll, vi, afterEach } from 'vitest';

import { AegisSDK } from "./packages/aegis12-sdk/src/AegisSDK";
import { TrustTier, AgentPurpose } from "./src/types";

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
    vaultPda: "TestVault_Default",
    squadsMultisig: "TestSquads_Default",
    allowedProgramIds: ["11111111111111111111111111111111"],
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
      { name: "vaultPda", type: "string" },
      { name: "squadsMultisig", type: "string" },
      { name: "allowedProgramIds", type: "string[]" },
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
  beforeAll(async () => {
    // Setup complete
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const baseAgent = {
    did: "did:web:agent.test",
    purpose: AgentPurpose.FINANCIAL_OPERATIONS,
    currentTier: TrustTier.T4,
  };

  const baseAction = {
    toolId: "swap",
    parameters: {
      to: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      amount: 1000,
      token: "USDC",
      fromMint: "So11111111111111111111111111111111111111112",
      toMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      slippageBps: 50,
    },
  };

  const baseContext = {
    sessionId: "sess-1",
    actionsThisSession: 1,
    actionsThisHour: 1,
    currentAnomalyScore: 0.1,
    recentIncidents: 0,
  };

  it("allows a correctly configured intent and produces a verifiable receipt", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ 
        status: 'approved', 
        ledger_tx: 'mock_hash', 
        receipt: { evidencePackage: { zk_seal: 'mock_seal' } }, 
        attestation: 'mock_quote' 
      })
    }));

    const receipt = await AegisSDK.signAndExecute(baseAction, {
        agentId: "agent-1",
        tenantId: "tenant-unit-test",
        mandateSignature: "mock_sig",
        gatewayUrl: "http://localhost/sign_and_execute",
        useDurableNonce: false,
        nonceAccountPublickey: "mock",
        nonceAuthorityPublickey: "mock"
    } as any);

    expect(receipt.tx_hash).toBe("mock_hash");
    expect(receipt.evidence_package).toBeDefined();
    expect(receipt.hardware_attestation).toBe("mock_quote");
  });

  it("handles escalation workflows and generates AegisIntentEnvelope for the on-chain verifier", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ 
        status: 'escalated', 
        ars_anchor: {
            domain_separator: "AEGIS12_ESCALATE_V1",
            vault_pda: "TestVault_Default",
            squads_multisig: "TestSquads_Default",
            instruction_digest: "0xmockdigest",
            state_predicates: { valid_until_slot: 1000000 },
            policy_hash: "pol-1"
        },
        receipt: { evidencePackage: { zk_seal: 'mock_seal' } }, 
        attestation: 'mock_quote' 
      })
    }));

    const receipt = await AegisSDK.signAndExecute(baseAction, {
        agentId: "agent-1",
        tenantId: "tenant-unit-test",
        mandateSignature: "mock_sig",
        gatewayUrl: "http://localhost/sign_and_execute",
        useDurableNonce: false,
        nonceAccountPublickey: "mock",
        nonceAuthorityPublickey: "mock"
    } as any);

    expect(receipt.status).toBe("escalated");
    expect(receipt.envelope).toBeDefined();
    expect(receipt.envelope?.domain_separator).toBe("AEGIS12_ESCALATE_V1");
    expect(receipt.envelope?.vault_pda).toBeDefined();
    expect(receipt.envelope?.squads_multisig).toBeDefined();
  });

  it("blocks the exact same nonce (replay attack)", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ status: 'denied', error: 'Nonce already used' })
    }));
    
    await expect(AegisSDK.signAndExecute(baseAction, {
        agentId: "agent-1",
        tenantId: "tenant-unit-test",
        mandateSignature: "mock_sig",
        gatewayUrl: "http://localhost/sign_and_execute",
        useDurableNonce: false,
        nonceAccountPublickey: "mock",
        nonceAuthorityPublickey: "mock"
    } as any)).rejects.toThrow(/Nonce already used/i);
  });

  it("rejects an invalid EIP-712 signature (simulated)", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ status: 'denied', error: 'Signer not found' })
    }));

    await expect(AegisSDK.signAndExecute(baseAction, {
        agentId: "agent-1",
        tenantId: "tenant-unit-test",
        mandateSignature: "bad_sig",
        gatewayUrl: "http://localhost/sign_and_execute",
        useDurableNonce: false,
        nonceAccountPublickey: "mock",
        nonceAuthorityPublickey: "mock"
    } as any)).rejects.toThrow(/Signer not found/i);
  });

  it("rejects mismatched crossChainTarget", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ status: 'denied', error: 'crossChainTarget mismatch' })
    }));

    await expect(AegisSDK.signAndExecute(baseAction, {
        agentId: "agent-1",
        tenantId: "tenant-unit-test",
        mandateSignature: "mock_sig",
        gatewayUrl: "http://localhost/sign_and_execute",
        useDurableNonce: false,
        nonceAccountPublickey: "mock",
        nonceAuthorityPublickey: "mock"
    } as any)).rejects.toThrow(/crossChainTarget mismatch/i);
  });

  it("denies circular swap (token_in == token_out)", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ status: 'denied', error: 'Circular swap detected' })
    }));
    
    await expect(AegisSDK.signAndExecute(baseAction, {
        agentId: "agent-1",
        tenantId: "tenant-unit-test",
        mandateSignature: "mock_sig",
        gatewayUrl: "http://localhost/sign_and_execute",
        useDurableNonce: false,
        nonceAccountPublickey: "mock",
        nonceAuthorityPublickey: "mock"
    } as any)).rejects.toThrow(/Circular swap detected/i);
  });

  it("denies unapproved Base58 mint substitution", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ status: 'denied', error: 'Must be Base58' })
    }));
    
    await expect(AegisSDK.signAndExecute(baseAction, {
        agentId: "agent-1",
        tenantId: "tenant-unit-test",
        mandateSignature: "mock_sig",
        gatewayUrl: "http://localhost/sign_and_execute",
        useDurableNonce: false,
        nonceAccountPublickey: "mock",
        nonceAuthorityPublickey: "mock"
    } as any)).rejects.toThrow(/Must be Base58/i);
  });
});
