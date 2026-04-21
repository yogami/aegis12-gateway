# Aegis-12: Clinical Audit Consolidation (Post-Quantum Upgrade)
**Version:** 1.0
**Status:** 🚩 CRITICAL VULNERABILITIES IDENTIFIED

## 1. Executive Summary: The Complexity Trap
The recent upgrade implementing NIST ML-DSA-65 (Post-Quantum) signatures via a tiered "Hot Path / Audit Path" architecture has been audited by multiple independent models (Perplexity Pro, Deep Research). The consensus is that while the cryptographic primitives are valid, the **asynchronous implementation** introduces catastrophic structural risks that undermine the "Deterministic Floor" mandate.

## 2. Critical Failure Modes (Audit Findings)

### 🛡️ A. The Packet Size Paradox & Evidence Fragmentation
- **Finding:** Separating Ed25519 (Execution) from ML-DSA-65 (Evidence) creates a "Quantum Gap."
- **Risk:** An attacker only needs to break the Ed25519 hot-path signature to spoof the kill switch. The PQ proof arrives too late (async) to prevent execution.
- **Divergence:** Any crash or backlog in the PQ signer leads to trades being live on Solana with no corresponding PQ evidence, violating Article 12 "automatic recording" guarantees.

### 🛡️ B. Async State Integrity (Race Conditions)
- **Finding:** `AegisLocalStateStore.ts` lacks idempotent, durable queuing for async signatures.
- **Risk:** If the enclave crashes after the "ALLOW" decision but before the PQ signature is committed, the PQ evidence is lost forever. The Solana anchor remains non-PQ, creating a "black hole" for auditors.
- **Concurrency:** Burst loads can overwhelm the background worker queue, leading to probabilistic rather than deterministic audit trails.

### 🛡️ C. Performance Regression & Resource Starvation
- **Finding:** ML-DSA-65 signing is 10-50x more expensive than Ed25519.
- **Risk:** CPU starvation inside the TEE during burst concurrency. The background signer can starve the hot-path execution loop, turning the "Kill Switch" into a self-DDoS tool.
- **Side-Channels:** Probabilistic aborts in ML-DSA-65 (Fiat-Shamir) may leak timing patterns if metrics are exposed.

## 3. Regulatory & "Hype" Audit
- **"FIPS 204 Readiness":** The audit flags this as "Consultant/Salesman" framing. Implementing the algorithm is not the same as operating a certified FIPS 204 module.
- **Recommendation:** Rephrase to "Uses FIPS-204 ML-DSA-65 for quantum-safe audit signatures" to maintain clinical authority.

## 4. Concrete Failure Patterns
1. **Evidence Gaps:** Hot path approvals outpace async evidence generation.
2. **Inconsistent Binding:** Canonical message formats drift between Ed25519 and ML-DSA paths.
3. **Replica Desync:** Multiple enclaves emitting conflicting PQ receipts for the same logical event due to state races.

---
## 5. Perplexity Pro Clinical Verdict
"Right now, this is closer to a complexity trap than a deterministic floor. You’ve added a heavyweight PQ scheme... without fully specifying the invariants that ensure every approved action gets exactly one PQ receipt. To turn it into a real 'deterministic floor,' you must define strict event IDs, idempotent signing, and WAL-backed recovery."

---
**Audit Log | Berlin AI Labs**
*Timestamp: 2026-04-21T18:12:00Z*
