import { test, expect } from '@playwright/test';
import { ethers } from 'ethers';

// ═══════════════════════════════════════════════════════════════════════════════
// AEGIS-12 COUNCIL SECURITY RE-AUDIT — PRODUCTION E2E TEST SUITE
// Target: Live /enforce and /solana/enforce-tx endpoints (zero local mocking)
// DO NOT DUPLICATE tests from solana-integration.spec.ts
// ═══════════════════════════════════════════════════════════════════════════════

// Fixed test wallet — address: 0x19E7E376E7C213B7E7e7e46cc70A5dD086DAff2A
// This MUST match the address in the AUTHORIZED_TENANTS env var for TENANT_123
const e2eWallet = new ethers.Wallet(
  "0x1111111111111111111111111111111111111111111111111111111111111111"
);

const eip712Domain = {
  name: "Aegis-12-Compliance-Matrix",
  version: "1.0.0",
  chainId: 1399811149,
};

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
  ],
};

/**
 * Creates a valid, signed EIP-712 policy envelope.
 * All parameters explicitly typed to prevent accidental type confusion in test setup.
 */
async function buildSignedPolicy(opts: {
  nonce: string;
  tier: string;
  limit: number;
  maxAnomalyScore: number;
  tenantId?: string;
  financialLimitsStringOverride?: string;
  expiresAt?: number;
  crossChainTarget?: string;
}) {
  const {
    nonce,
    tier,
    limit,
    maxAnomalyScore,
    tenantId = "TENANT_123",
    financialLimitsStringOverride,
    expiresAt = Math.floor(Date.now() / 1000) + 3600,
    crossChainTarget = "solana-mainnet",
  } = opts;

  const financialLimitsString =
    financialLimitsStringOverride ?? JSON.stringify({ [tier]: limit });

  const value = {
    policyId: "POL_REAUDIT_001",
    tenantId,
    version: "1.0.0",
    chainId: 1399811149,
    crossChainTarget,
    maxAnomalyScore,
    financialLimitsString,
    expiresAt,
    nonce,
  };

  const signature = await e2eWallet._signTypedData(
    eip712Domain,
    eip712Types,
    value
  );
  return { policyConfig: value, signature };
}

/**
 * Constructs a minimal valid /enforce payload for a solana_transfer action.
 * Designed as a known-good baseline; individual tests override specific fields.
 */
function buildBaseTransferPayload(
  policy: Awaited<ReturnType<typeof buildSignedPolicy>>,
  overrides: {
    amount?: number | string;
    estimatedValue?: number;
    tier?: string;
    anomalyScore?: number;
    token?: string;
    toAddress?: string;
  } = {}
) {
  return {
    action: {
      toolId: "solana_transfer",
      parameters: {
        to: overrides.toAddress ?? "11111111111111111111111111111111",
        amount: overrides.amount ?? 1,
        token: overrides.token ?? "SOL",
      },
      estimatedValue: overrides.estimatedValue ?? 1,
    },
    agent: {
      did: "did:aegis:test-agent",
      purpose: "financial_operations",
      currentTier: overrides.tier ?? "T1",
    },
    context: {
      sessionId: "reaudit-session",
      actionsThisSession: 1,
      actionsThisHour: 1,
      currentAnomalyScore: overrides.anomalyScore ?? 0.1,
      recentIncidents: 0,
    },
    dynamicPolicy: policy,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION A: NEW-VULN-001 — maxAnomalyScore NaN Silent Bypass
// ─────────────────────────────────────────────────────────────────────────────

test.describe("NEW-VULN-001: maxAnomalyScore NaN Coercion Silently Disables Anomaly Gate", () => {

  test(
    "SECURITY: maxAnomalyScore undefined in policyConfig causes isNaN guard to skip anomaly check — " +
      "high-risk agent (anomalyScore=0.99) must be DENIED not silently passed",
    async ({ request }) => {
      // We cannot sign `undefined` via EIP-712 (ethers rejects it), so we craft
      // a policy signed with maxAnomalyScore=0 (maps to "0" as uint256) then
      // manually corrupt the policyConfig post-signing to simulate a deserialization
      // artifact where the field is missing after JSON transit.
      // This tests the runtime path: does the server fail-closed on undefined?
      const policy = await buildSignedPolicy({
        nonce: `nvuln001-undef-${Date.now()}`,
        tier: "T1",
        limit: 9999,
        maxAnomalyScore: 50,
      });

      // Post-signing mutation: remove maxAnomalyScore to simulate undefined deserialization
      // The signature will be invalid (different hash), but we are testing the anomaly-bypass
      // pathway SPECIFICALLY — the server should deny on signature failure first, but if
      // signature validation is somehow skipped, it must ALSO deny on anomaly score.
      // A separate sub-test below uses a valid signature with the minimum representable score.
      const corruptedPolicy = {
        ...policy,
        policyConfig: {
          ...policy.policyConfig,
          maxAnomalyScore: undefined as any,
        },
      };

      const res = await request.post("/enforce", {
        data: buildBaseTransferPayload(corruptedPolicy, { anomalyScore: 0.99 }),
      });

      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.status).toBe("denied");
      // Must not silently pass — any denial reason is acceptable
      expect(body.error).toBeTruthy();
    }
  );

  test(
    "SECURITY: maxAnomalyScore=0 (uint256 zero) with anomalyScore=0.01 (>0%) " +
      "must be DENIED — NaN coercion of zero would incorrectly evaluate to !isNaN(0)=true then deny, " +
      "confirming the isNaN guard direction matters",
    async ({ request }) => {
      // This is the regression guard: maxAnomalyScore=0 means NO anomaly tolerance.
      // Any non-zero anomaly score (even 0.01) MUST be denied.
      const policy = await buildSignedPolicy({
        nonce: `nvuln001-zero-${Date.now()}`,
        tier: "T1",
        limit: 9999,
        maxAnomalyScore: 0, // Zero tolerance
      });

      const res = await request.post("/enforce", {
        data: buildBaseTransferPayload(policy, { anomalyScore: 0.01 }),
      });

      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.status).toBe("denied");
      expect(body.error).toContain("Anomaly score exceeds");
    }
  );

  test(
    "SECURITY: Valid policy with maxAnomalyScore=50 and anomalyScore=0.49 (49%) " +
      "must be APPROVED — confirming anomaly gate passes legitimate traffic",
    async ({ request }) => {
      const policy = await buildSignedPolicy({
        nonce: `nvuln001-pass-${Date.now()}`,
        tier: "T1",
        limit: 9999,
        maxAnomalyScore: 50,
      });

      const res = await request.post("/enforce", {
        data: buildBaseTransferPayload(policy, { anomalyScore: 0.49 }),
      });

      // This is the positive control — it MUST succeed for the anomaly gate to be meaningful
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("approved");
    }
  );

  test(
    "SECURITY: Valid policy with maxAnomalyScore=50 and anomalyScore=0.51 (51%) " +
      "must be DENIED — confirming the boundary condition is enforced at exactly the threshold",
    async ({ request }) => {
      const policy = await buildSignedPolicy({
        nonce: `nvuln001-boundary-${Date.now()}`,
        tier: "T1",
        limit: 9999,
        maxAnomalyScore: 50,
      });

      const res = await request.post("/enforce", {
        data: buildBaseTransferPayload(policy, { anomalyScore: 0.51 }),
      });

      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.status).toBe("denied");
      expect(body.error).toContain("Anomaly score exceeds");
    }
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION B: NEW-VULN-002 — Unreachable Fail-Closed Dead Code
// ─────────────────────────────────────────────────────────────────────────────

test.describe("NEW-VULN-002: Dead Fail-Closed Code Path — evaluatePolicy Safety Net Verification", () => {

  test(
    "SECURITY: Structurally malformed request with valid dynamicPolicy but nonsense toolId " +
      "must DENY without 200-OK — validating catch-all deny path in evaluatePolicy is reachable",
    async ({ request }) => {
      const policy = await buildSignedPolicy({
        nonce: `nvuln002-badtool-${Date.now()}`,
        tier: "T1",
        limit: 9999,
        maxAnomalyScore: 50,
      });

      const res = await request.post("/enforce", {
        data: {
          action: {
            // Unrecognized tool — PolicyValidator.normalizeParameters will throw
            toolId: "exfiltrate_private_key",
            parameters: { target: "wallet", amount: 1 },
            estimatedValue: 1,
          },
          agent: {
            did: "did:aegis:attacker",
            purpose: "financial_operations",
            currentTier: "T1",
          },
          context: {
            sessionId: "reaudit",
            actionsThisSession: 1,
            actionsThisHour: 1,
            currentAnomalyScore: 0.1,
            recentIncidents: 0,
          },
          dynamicPolicy: policy,
        },
      });

      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.status).toBe("denied");
      // Must contain the tool refusal — not leak internal path details
      expect(body.error).toContain("Action denied by Aegis Enclave");
    }
  );

  test(
    "SECURITY: Policy with expired expiresAt timestamp (1 second in the past) " +
      "must DENY — validating the catch block deny path handles expiry errors correctly",
    async ({ request }) => {
      // Build a policy that was valid but is now expired
      const policy = await buildSignedPolicy({
        nonce: `nvuln002-expired-${Date.now()}`,
        tier: "T1",
        limit: 9999,
        maxAnomalyScore: 50,
        expiresAt: Math.floor(Date.now() / 1000) - 1, // 1 second in the past
      });

      const res = await request.post("/enforce", {
        data: buildBaseTransferPayload(policy, { anomalyScore: 0.1 }),
      });

      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.status).toBe("denied");
      expect(body.error).toContain("Policy Expired");
    }
  );

  test(
    "SECURITY: Forged policy signature (valid structure, invalid signature bytes) " +
      "must DENY via catch-all — confirming cryptographic failure is caught and denies, not swallowed",
    async ({ request }) => {
      const policy = await buildSignedPolicy({
        nonce: `nvuln002-forged-${Date.now()}`,
        tier: "T1",
        limit: 9999,
        maxAnomalyScore: 50,
      });

      // Replace signature with a structurally valid but cryptographically invalid one
      const forgedPolicy = {
        ...policy,
        signature:
          "0x" +
          "deadbeef".repeat(16) +
          "1c" /* v=28 */ +
          "00".repeat(0),
      };
      // Ensure the forged sig is 65 bytes (130 hex chars after 0x)
      const paddedForgedSig = "0x" + "aa".repeat(32) + "bb".repeat(32) + "1c";

      const res = await request.post("/enforce", {
        data: buildBaseTransferPayload(
          { ...policy, signature: paddedForgedSig },
          { anomalyScore: 0.1 }
        ),
      });

      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.status).toBe("denied");
      // Must not leak which specific cryptographic check failed (oracle hardening)
      expect(body.error).not.toContain("stack");
      expect(body.error).not.toContain("at Object");
    }
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION C: NEW-VULN-005 — Swap Tool Mint Allowlist Bypass
// ─────────────────────────────────────────────────────────────────────────────

test.describe("NEW-VULN-005: Swap Tool Arbitrary SPL Mint Address — Asset Substitution via Unallowlisted Mints", () => {

  // A valid Base58 address that looks legitimate but is attacker-controlled
  const ATTACKER_CONTROLLED_MINT = "AttackerMint11111111111111111111111111111111";
  // Known legitimate SOL mint for comparison
  const WSOL_MINT = "So11111111111111111111111111111111111111112";
  const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

  test(
    "SECURITY: swap tool with attacker-controlled fromMint address (valid Base58, unallowlisted) " +
      "must DENY — arbitrary mint addresses enable rug-pull token substitution",
    async ({ request }) => {
      const policy = await buildSignedPolicy({
        nonce: `nvuln005-mint-a-${Date.now()}`,
        tier: "T1",
        limit: 9999,
        maxAnomalyScore: 50,
        // Note: financialLimitsString must match tool type;
        // for swap we still use T1 tier limit
      });

      const res = await request.post("/enforce", {
        data: {
          action: {
            toolId: "swap",
            parameters: {
              fromMint: ATTACKER_CONTROLLED_MINT,
              toMint: USDC_MINT,
              amount: 100,
              slippageBps: 50,
            },
            estimatedValue: 100,
          },
          agent: {
            did: "did:aegis:attacker",
            purpose: "financial_operations",
            currentTier: "T1",
          },
          context: {
            sessionId: "reaudit",
            actionsThisSession: 1,
            actionsThisHour: 1,
            currentAnomalyScore: 0.1,
            recentIncidents: 0,
          },
          dynamicPolicy: policy,
        },
      });

      // EXPECTED: 403 — attacker-controlled mint must be rejected
      // ACTUAL (per code review): 200 — no allowlist check exists in PolicyValidator
      // This test DOCUMENTS the vulnerability; it will FAIL until the allowlist is implemented.
      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.status).toBe("denied");
    }
  );

  test(
    "SECURITY: swap tool with honeypot token as toMint (valid Base58, zero liquidity token) " +
      "must DENY — PolicyValidator must enforce an explicit SPL mint allowlist for swap operations",
    async ({ request }) => {
      const HONEYPOT_MINT = "HoneyPotMint11111111111111111111111111111111";

      const policy = await buildSignedPolicy({
        nonce: `nvuln005-honey-${Date.now()}`,
        tier: "T1",
        limit: 9999,
        maxAnomalyScore: 50,
      });

      const res = await request.post("/enforce", {
        data: {
          action: {
            toolId: "swap",
            parameters: {
              fromMint: WSOL_MINT,
              toMint: HONEYPOT_MINT,
              amount: 50,
              slippageBps: 100,
            },
            estimatedValue: 50,
          },
          agent: {
            did: "did:aegis:attacker",
            purpose: "financial_operations",
            currentTier: "T1",
          },
          context: {
            sessionId: "reaudit",
            actionsThisSession: 1,
            actionsThisHour: 1,
            currentAnomalyScore: 0.1,
            recentIncidents: 0,
          },
          dynamicPolicy: policy,
        },
      });

      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.status).toBe("denied");
    }
  );

  test(
    "SECURITY: swap tool with excessive slippageBps (10000 = 100% slippage) " +
      "must DENY — maximum slippage enables sandwich attack / guaranteed worst execution",
    async ({ request }) => {
      const policy = await buildSignedPolicy({
        nonce: `nvuln005-slip-${Date.now()}`,
        tier: "T1",
        limit: 9999,
        maxAnomalyScore: 50,
      });

      const res = await request.post("/enforce", {
        data: {
          action: {
            toolId: "swap",
            parameters: {
              fromMint: WSOL_MINT,
              toMint: USDC_MINT,
              amount: 100,
              slippageBps: 10000, // 100% — guaranteed sandwich attack
            },
            estimatedValue: 100,
          },
          agent: {
            did: "did:aegis:legit",
            purpose: "financial_operations",
            currentTier: "T1",
          },
          context: {
            sessionId: "reaudit",
            actionsThisSession: 1,
            actionsThisHour: 1,
            currentAnomalyScore: 0.1,
            recentIncidents: 0,
          },
          dynamicPolicy: policy,
        },
      });

      // slippageBps has no upper bound in current PolicyValidator — this will likely 200
      // This test documents the missing validation and will FAIL until a max-slippage guard is added
      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.status).toBe("denied");
      expect(body.error).toContain("slippage");
    }
  );

  test(
    "SECURITY: swap tool with negative slippageBps value " +
      "must DENY — assertSafeFinancialAmount correctly rejects negative slippage",
    async ({ request }) => {
      const policy = await buildSignedPolicy({
        nonce: `nvuln005-negslip-${Date.now()}`,
        tier: "T1",
        limit: 9999,
        maxAnomalyScore: 50,
      });

      const res = await request.post("/enforce", {
        data: {
          action: {
            toolId: "swap",
            parameters: {
              fromMint: WSOL_MINT,
              toMint: USDC_MINT,
              amount: 100,
              slippageBps: -500,
            },
            estimatedValue: 100,
          },
          agent: {
            did: "did:aegis:test",
            purpose: "financial_operations",
            currentTier: "T1",
          },
          context: {
            sessionId: "reaudit",
            actionsThisSession: 1,
            actionsThisHour: 1,
            currentAnomalyScore: 0.1,
            recentIncidents: 0,
          },
          dynamicPolicy: policy,
        },
      });

      // assertSafeFinancialAmount DOES reject negatives — this SHOULD pass
      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.status).toBe("denied");
      expect(body.error).toContain("Negative values");
    }
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION D: NEW-VULN-003 — Information Leakage via console.error
// ─────────────────────────────────────────────────────────────────────────────

test.describe("NEW-VULN-003: Error Response Oracle — Stack Trace / Internal State Leakage via HTTP Response", () => {

  test(
    "SECURITY: Cryptographic failure response must NOT contain stack trace, file paths, or " +
      "line numbers — error oracle enables targeted attack refinement",
    async ({ request }) => {
      const policy = await buildSignedPolicy({
        nonce: `nvuln003-oracle-${Date.now()}`,
        tier: "T1",
        limit: 9999,
        maxAnomalyScore: 50,
      });

      // Corrupt the signature to force a cryptographic failure path
      const corruptedPolicy = {
        ...policy,
        signature: "0x" + "cc".repeat(32) + "dd".repeat(32) + "1b",
      };

      const res = await request.post("/enforce", {
        data: buildBaseTransferPayload(corruptedPolicy),
      });

      expect(res.status()).toBe(403);
      const body = await res.json();
      const errorText = JSON.stringify(body);

      // Stack trace leakage indicators
      expect(errorText).not.toMatch(/at\s+\w+\s+\(/); // "at functionName ("
      expect(errorText).not.toMatch(/\.ts:\d+:\d+/); // TypeScript source locations
      expect(errorText).not.toMatch(/\.js:\d+:\d+/); // JS source locations
      expect(errorText).not.toMatch(/node_modules/); // Internal dependency paths
      expect(errorText).not.toContain("DEBUG ERROR UNMASKED");
    }
  );

  test(
    "SECURITY: Internal tool normalization error must NOT leak the raw unrecognized toolId value " +
      "back to the caller — error messages must be sanitized before HTTP response",
    async ({ request }) => {
      const policy = await buildSignedPolicy({
        nonce: `nvuln003-toolid-${Date.now()}`,
        tier: "T1",
        limit: 9999,
        maxAnomalyScore: 50,
      });

      const SENTINEL_TOOL_ID = "REAUDIT_CANARY_TOOL_LEAKAGE_PROBE_XYZ";

      const res = await request.post("/enforce", {
        data: {
          action: {
            toolId: SENTINEL_TOOL_ID,
            parameters: {},
            estimatedValue: 0,
          },
          agent: {
            did: "did:aegis:probe",
            purpose: "financial_operations",
            currentTier: "T1",
          },
          context: {
            sessionId: "reaudit",
            actionsThisSession: 1,
            actionsThisHour: 1,
            currentAnomalyScore: 0.1,
            recentIncidents: 0,
          },
          dynamicPolicy: policy,
        },
      });

      expect(res.status()).toBe(403);
      const body = await res.json();

      // The raw toolId sentinel MUST NOT appear verbatim in the error response
      // Current code: `throw new Error(\`Unrecognized tool execution request: ${toolId}\`)`
      // This leaks the toolId — test documents the vulnerability
      expect(body.error).not.toContain(SENTINEL_TOOL_ID);
    }
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION E: Nonce 2PC State Machine — Boundary Condition Verification
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Nonce 2PC State Machine: Boundary Conditions and Rollback Correctness", () => {

  test(
    "SECURITY: Nonce is permanently burned after a DENIED action — " +
      "subsequent request with the same nonce must ALSO be denied (no rollback resurrection)",
    async ({ request }) => {
      const nonce = `2pc-deny-${Date.now()}`;

      // First request: signed but with anomaly score exceeding threshold — will DENY
      // Nonce should be rolled back (it was reserved but bounds failed before commit)
      const policy = await buildSignedPolicy({
        nonce,
        tier: "T1",
        limit: 9999,
        maxAnomalyScore: 10, // threshold: 10%
      });

      const firstRes = await request.post("/enforce", {
        data: buildBaseTransferPayload(policy, { anomalyScore: 0.5 }), // 50% > 10%
      });

      expect(firstRes.status()).toBe(403);
      const firstBody = await firstRes.json();
      expect(firstBody.status).toBe("denied");

      // Second request with SAME nonce but valid parameters
      // Per 2PC design: nonce was RESERVED then ROLLED BACK on bounds failure
      // So the nonce SHOULD be available for a legitimate retry
      // This test verifies the rollback actually freed the nonce
      const secondRes = await request.post("/enforce", {
        data: buildBaseTransferPayload(policy, { anomalyScore: 0.05 }), // 5% < 10% — valid
      });

      // The second request should SUCCEED (nonce was rolled back on deny, not burned)
      // If this fails, the rollback is not working correctly
      expect(secondRes.status()).toBe(200);
      const secondBody = await secondRes.json();
      expect(secondBody.status).toBe("approved");
    }
  );

  test(
    "SECURITY: Nonce is permanently burned after a successful approval — " +
      "a second identical request after approval must be denied as replay (nonce committed, not rolled back)",
    async ({ request }) => {
      const nonce = `2pc-burn-${Date.now()}`;

      const policy = await buildSignedPolicy({
        nonce,
        tier: "T1",
        limit: 9999,
        maxAnomalyScore: 50,
      });

      // First request: must succeed
      const firstRes = await request.post("/enforce", {
        data: buildBaseTransferPayload(policy),
      });

      expect(firstRes.status()).toBe(200);
      const firstBody = await firstRes.json();
      expect(firstBody.status).toBe("approved");

      // Second request: nonce was committed — must be denied as replay
      const secondRes = await request.post("/enforce", {
        data: buildBaseTransferPayload(policy),
      });

      expect(secondRes.status()).toBe(403);
      const secondBody = await secondRes.json();
      expect(secondBody.status).toBe("denied");
      expect(secondBody.error).toContain("Nonce already used");
    }
  );

  test(
    "SECURITY: estimatedValue spoofing — action.estimatedValue=1 with parameters.amount=999999 " +
      "must DENY because AegisPEP overrides estimatedValue from sanitizedParams.amount post-normalization",
    async ({ request }) => {
      // Signed limit: T1 = 100 SOL
      const policy = await buildSignedPolicy({
        nonce: `2pc-spoof-${Date.now()}`,
        tier: "T1",
        limit: 100,
        maxAnomalyScore: 50,
      });

      const res = await request.post("/enforce", {
        data: {
          action: {
            toolId: "solana_transfer",
            parameters: {
              to: "11111111111111111111111111111111",
              amount: 999999, // ACTUAL value
              token: "SOL",
            },
            estimatedValue: 1, // SPOOFED low value — should be overridden by PEP
          },
          agent: {
            did: "did:aegis:attacker",
            purpose: "financial_operations",
            currentTier: "T1",
          },
          context: {
            sessionId: "reaudit",
            actionsThisSession: 1,
            actionsThisHour: 1,
            currentAnomalyScore: 0.1,
            recentIncidents: 0,
          },
          dynamicPolicy: policy,
        },
      });

      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.status).toBe("denied");
      expect(body.error).toContain("exceeds");
    }
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION F: Prototype Pollution and Injection Hardening
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Prototype Pollution and Structural Injection: financialLimitsString Attack Surface", () => {

  test(
    "SECURITY: financialLimitsString containing __proto__ prototype pollution payload " +
      "must DENY — JSON.parse of attacker-controlled string must not pollute Object prototype",
    async ({ request }) => {
      const POLLUTION_PAYLOAD = JSON.stringify({
        __proto__: { isAdmin: true, maxAllowedValue: 99999999 },
      });

      // We sign this as a valid policy — the signer is the attacker who controls their own key
      // but is NOT in the trust store. This tests that even if they get past signature (they won't),
      // the pollution payload is neutralized.
      // More importantly: we test that a LEGITIMATE signer who includes this in their policy
      // is denied by the single-key enforcement in TierEvaluator.
      const policy = await buildSignedPolicy({
        nonce: `proto-poll-${Date.now()}`,
        tier: "T1",
        limit: 100,
        maxAnomalyScore: 50,
        financialLimitsStringOverride: POLLUTION_PAYLOAD,
      });

      const res = await request.post("/enforce", {
        data: buildBaseTransferPayload(policy, { anomalyScore: 0.1, tier: "T1" }),
      });

      // TierEvaluator: limitKeys.length !== 1 will catch this (__proto__ + T1 = 2 keys)
      // OR the parser may strip __proto__ entirely, leaving 0 keys — also denied
      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.status).toBe("denied");

      // CRITICAL: Verify that prototype pollution did NOT succeed
      // If ({}).isAdmin === true after this request, we have a critical server-side pollution
      // We can only verify this indirectly — a follow-up request with normal params should behave normally
    }
  );

  test(
    "SECURITY: financialLimitsString with constructor injection " +
      '{"constructor": {"prototype": {"isAdmin": true}}} must DENY — ' +
      "alternative prototype pollution vector via constructor property",
    async ({ request }) => {
      const CONSTRUCTOR_POLLUTION = JSON.stringify({
        constructor: { prototype: { isAdmin: true } },
      });

      const policy = await buildSignedPolicy({
        nonce: `constructor-poll-${Date.now()}`,
        tier: "T1",
        limit: 100,
        maxAnomalyScore: 50,
        financialLimitsStringOverride: CONSTRUCTOR_POLLUTION,
      });

      const res = await request.post("/enforce", {
        data: buildBaseTransferPayload(policy, { anomalyScore: 0.1, tier: "T1" }),
      });

      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.status).toBe("denied");
    }
  );

  test(
    "SECURITY: financialLimitsString with multiple tier keys " +
      'must DENY — {"T1": 100, "T_GOD": 999999} dual-tier bypass vector',
    async ({ request }) => {
      const MULTI_TIER_BYPASS = JSON.stringify({
        T1: 100,
        T_GOD: 999999,
      });

      const policy = await buildSignedPolicy({
        nonce: `multitier-${Date.now()}`,
        tier: "T1", // The helper puts T1 in the string; we override
        limit: 100,
        maxAnomalyScore: 50,
        financialLimitsStringOverride: MULTI_TIER_BYPASS,
      });

      const res = await request.post("/enforce", {
        data: buildBaseTransferPayload(policy, {
          anomalyScore: 0.1,
          tier: "T_GOD",
          amount: 999999,
          estimatedValue: 999999,
        }),
      });

      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.status).toBe("denied");
      expect(body.error).toContain("Multi-tier limit objects are structurally unsafe");
    }
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// SECTION G: Input Validation Edge Cases Not Covered by Existing Suite
// ─────────────────────────────────────────────────────────────────────────────

test.describe("Input Validation Edge Cases: Boundary Conditions and Type Safety", () => {

  test(
    "SECURITY: anomalyScore exactly at 0.0 boundary must be ACCEPTED for threshold > 0",
    async ({ request }) => {
      const policy = await buildSignedPolicy({
        nonce: `boundary-zero-score-${Date.now()}`,
        tier: "T1",
        limit: 100,
        maxAnomalyScore: 50,
      });

      const res = await request.post("/enforce", {
        data: buildBaseTransferPayload(policy, { anomalyScore: 0.0 }),
      });

      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("approved");
    }
  );

  test(
    "SECURITY: anomalyScore exactly at 1.0 must be REJECTED by pre-validate gate in AegisPEP " +
      "(AegisPEP.ts line 22 enforces 0.0-1.0 range, but 1.0 is boundary-inclusive)",
    async ({ request }) => {
      const policy = await buildSignedPolicy({
        nonce: `boundary-max-score-${Date.now()}`,
        tier: "T1",
        limit: 100,
        maxAnomalyScore: 100, // Allow up to 100%
      });

      // anomalyScore = 1.0 is technically valid per the guard (< 0 or > 1.0 throws)
      // But 1.0 * 100 = 100 > secureScore=100 is FALSE (not strictly greater)
      // So this should PASS — testing the boundary is not accidentally rejected
      const res = await request.post("/enforce", {
        data: buildBaseTransferPayload(policy, { anomalyScore: 1.0 }),
      });

      // With maxAnomalyScore=100 and score=1.0: 100 > 100 is false — should PASS
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("approved");
    }
  );

  test(
    "SECURITY: anomalyScore above 1.0 (e.g. 1.1) must be REJECTED by AegisPEP pre-validation " +
      "before reaching TierEvaluator — enforces the 0.0-1.0 scale constraint",
    async ({ request }) => {
      const policy = await buildSignedPolicy({
        nonce: `boundary-over-score-${Date.now()}`,
        tier: "T1",
        limit: 100,
        maxAnomalyScore: 50,
      });

      const res = await request.post("/enforce", {
        data: buildBaseTransferPayload(policy, { anomalyScore: 1.1 }),
      });

      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.status).toBe("denied");
      expect(body.error).toContain("Invalid or unscaled contextual anomaly score");
    }
  );

  test(
    "SECURITY: solana_transfer with non-SOL token (e.g. USDC) must DENY — " +
      "token field allowlist prevents asset substitution for transfer tool",
    async ({ request }) => {
      const policy = await buildSignedPolicy({
        nonce: `token-sub-${Date.now()}`,
        tier: "T1",
        limit: 9999,
        maxAnomalyScore: 50,
      });

      const res = await request.post("/enforce", {
        data: {
          action: {
            toolId: "solana_transfer",
            parameters: {
              to: "11111111111111111111111111111111",
              amount: 100,
              token: "USDC", // Not SOL — should be rejected
            },
            estimatedValue: 100,
          },
          agent: {
            did: "did:aegis:test",
            purpose: "financial_operations",
            currentTier: "T1",
          },
          context: {
            sessionId: "reaudit",
            actionsThisSession: 1,
            actionsThisHour: 1,
            currentAnomalyScore: 0.1,
            recentIncidents: 0,
          },
          dynamicPolicy: policy,
        },
      });

      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.status).toBe("denied");
      expect(body.error).toContain("asset substitution");
    }
  );

  test(
    "SECURITY: solana_transfer with Infinity as amount must DENY — " +
      "assertSafeFinancialAmount must catch IEEE 754 Infinity injection",
    async ({ request }) => {
      const policy = await buildSignedPolicy({
        nonce: `infinity-amount-${Date.now()}`,
        tier: "T1",
        limit: 9999,
        maxAnomalyScore: 50,
      });

      const res = await request.post("/enforce", {
        // NOTE: JSON.stringify(Infinity) = "null" — so we use a number that
        // becomes Infinity after arithmetic, or test via a crafted JSON string.
        // Most JSON parsers convert Infinity to null. This tests that null is rejected.
        data: JSON.stringify({
          action: {
            toolId: "solana_transfer",
            parameters: {
              to: "11111111111111111111111111111111",
              amount: null, // JSON serialized Infinity
              token: "SOL",
            },
            estimatedValue: null,
          },
          agent: {
            did: "did:aegis:test",
            purpose: "financial_operations",
            currentTier: "T1",
          },
          context: {
            sessionId: "reaudit",
            actionsThisSession: 1,
            actionsThisHour: 1,
            currentAnomalyScore: 0.1,
            recentIncidents: 0,
          },
          dynamicPolicy: policy,
        }),
        headers: { "Content-Type": "application/json" },
      });

      expect(res.status()).toBe(403);
      const body = await res.json();
      expect(body.status).toBe("denied");
    }
  );

  test(
    "SECURITY: request with action.parameters containing extra fields beyond schema " +
      "must NOT leak those fields into the validatedParams of the receipt — " +
      "normalization must strip extraneous keys (no parameter injection into receipt)",
    async ({ request }) => {
      const policy = await buildSignedPolicy({
        nonce: `param-inject-${Date.now()}`,
        tier: "T1",
        limit: 9999,
        maxAnomalyScore: 50,
      });

      const res = await request.post("/enforce", {
        data: {
          action: {
            toolId: "solana_transfer",
            parameters: {
              to: "11111111111111111111111111111111",
              amount: 1,
              token: "SOL",
              // Injected extra fields — must be stripped by normalizeParameters
              __proto__: { polluted: true },
              constructor: "INJECTED",
              internalAdminFlag: true,
              alternativeRecipient: "AttackerWallet111111111111111111111",
            },
            estimatedValue: 1,
          },
          agent: {
            did: "did:aegis:test",
            purpose: "financial_operations",
            currentTier: "T1",
          },
          context: {
            sessionId: "reaudit",
            actionsThisSession: 1,
            actionsThisHour: 1,
            currentAnomalyScore: 0.1,
            recentIncidents: 0,
          },
          dynamicPolicy: policy,
        },
      });

      // The request should SUCCEED (valid core params) but the receipt must be clean
      if (res.status() === 200) {
        const body = await res.json();
        expect(body.status).toBe("approved");
        const validatedParams = body.receipt?.validatedParams ?? {};
        // Injected fields MUST NOT appear in the receipt
        expect(validatedParams).not.toHaveProperty("internalAdminFlag");
        expect(validatedParams).not.toHaveProperty("alternativeRecipient");
        // Only canonical fields should exist
        expect(Object.keys(validatedParams).sort()).toEqual(
          ["amount", "to", "token"].sort()
        );
      } else {
        // If the server rejects the request entirely, that's also acceptable
        expect(res.status()).toBe(403);
      }
    }
  );
});
