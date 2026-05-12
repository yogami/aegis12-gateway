# Aegis-12 | Compliance Receipt Standard (v1.0.0)
**Code**: `ARS-01+` [Aegis Regulatory Synthesis]
**Compliance Grade**: High-Risk Agent Tier (Confidential Computing)

## 1. Executive Summary
The Aegis Compliance Receipt Standard (v1.0.0) provides a hardware-attested, cryptographically-bound proof of autonomous AI agent actions. It is designed specifically to fulfill the requirements of the **EU AI Act Article 12 (Traceability)** and **Article 14 (Human Oversight)** within Trusted Execution Environments (TEEs).

## 2. The Compliance Bridge

### Article 12: Traceable Logging
Every enforcement action generates a unique `article12LogHash`. This is a Keccak-256 seal of:
- **`toolId`**: The specific capability invoked.
- **`sanitizedParameters`**: The strictly parsed input.
- **`behavioralEvidence`**: The state of the agent's lifetime behavioral accumulators.
- **`limitations`**: Explicit declaration of observation boundaries (Veracity Proof).

### Article 14: Human Oversight
The `article14OversightSignature` explicitly binds a human-signed dynamic policy to the hardware execution.
- **Root of Trust**: Execution is denied unless the human's ECDSA/EIP-712 signature matches the provisioned `tenantTrustStore`.
- **Proof of Intent**: Every receipt carries the original human signature, proving that the TEE acted as an extension of human will, not a rogue agent.

## 3. Receipt Structure (Schema)
| Field | Type | Description | Compliance Link |
| :--- | :--- | :--- | :--- |
| `receiptId` | `string` | Time-ordered unique tracer (v1) | Auditability |
| `article12LogHash` | `bytes32` | Immutable seal of execution trace | Art 12 |
| `article14OversightSignature` | `string` | Human signature of the active policy | Art 14 |
| `complianceStandard` | `enum` | "ARS-01+" Level of verification | Certification |
| `signature` | `string` | Hardware-bound TEE Signature (Ed25519) | Authenticity |

## 4. Auditor Validation Logic
To verify a receipt, an auditor must:
1.  Verify the **TEE Signature** (Phala Dstack Attestation).
2.  Retrieve the **Human Policy** via the `policyId` and verify the `article14OversightSignature`.
3.  Re-calculate the `article12LogHash` from the provided execution context to ensure no tampering.

## 5. Limitations (The Honest Sentinel)
Aegis-12 receipts are "Audit-Grade" because they are honest. Every receipt explicitly lists what was **NOT** verified:
- `O_INFERENCE_TRACE`: The TEE did not witness the internal LLM reasoning tokens.
- `O_CONTEXT_INPUT`: The prompt context was not hardware-attested.
- `O_HUMAN_LIVENESS`: The human was not verified to be "live" at the exact millisecond of execution.

---
**Standard Published by Berlin AI Labs | Aegis-12 Sentinel Unit**
