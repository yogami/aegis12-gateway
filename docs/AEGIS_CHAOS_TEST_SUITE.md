# Aegis-12 Master Chaos & Resilience Suite
_Unified CI/CD Blueprint for High-Performance Architecture (16GB TEE)_

## Overview
This master suite consolidates the adversarial vectors designed by the OpenRouter Frontier Council (GPT-5.5, Opus 4.7, DeepSeek-V4, o3-Pro), Grok, Perplexity, and Google DeepThink. 
With the strict 2GB memory limitation lifted for the 16GB demo environment, these tests focus entirely on unbounded concurrency scaling, asynchronous state collapse, and cryptographic determinism.

---

## 1. CI/CD Deployment Integrity (Automated in Actions)
*   **[ACTIVE] C-001 (Deployment Proxy Phantom):** Cryptographic `$GITHUB_SHA` verification required on the `/health` endpoint before CI proceeds, preventing rolling-update proxy cache races.
*   **[ACTIVE] M-001 (ZK-Prover Bomb):** Baseline 150-concurrent request DDoS injected directly into the CI pipeline during deployment to ensure basic event-loop survival.

---

## 2. Cryptographic File Integrity
*   **D-003 / X-004 (The AEAD Poison Pill / Nonce Reuse):** 
    *   *Test:* Send a SIGKILL to the Node process exactly as `cipher.final()` writes to the `.rzreceipt` file.
    *   *Requirement:* The worker must write to a `.tmp` file and use an atomic `rename()` syscall. Any corrupted AEAD envelope must be deterministically quarantined, and AEAD nonces must strictly strictly increment.

## 3. Asynchronous Worker State Collapse
*   **D-002 (The Zombie Prover Leak):** 
    *   *Test:* Trigger an OS-level kill on the parent Node.js process while 50 ZK-Provers are running in child processes.
    *   *Requirement:* The system must use strict Linux PID namespace management or `prctl(PR_SET_PDEATHSIG, SIGKILL)` to ensure orphaned provers instantly die, preventing hypervisor lockup on a 16GB machine.
*   **X-005 (Misordered ZK Updates):**
    *   *Test:* Delay ZK-Prover completions for 90s, bypassing the 30s Batch Anchor tick.
    *   *Requirement:* Ensure no "ghost proofs" (PROVED but unanchored forever) occur when an asynchronous promise returns out-of-order.

## 4. Solana RPC & Lock Synchronization
*   **D-001 / X-002 (Redis Lock TTL Starvation):** 
    *   *Test:* Pin the Node event loop for 40 seconds via massive JSON canonicalization, forcing the 30s `batch-anchor-lock` TTL to silently expire in the background.
    *   *Requirement:* The BatchAnchorWorker must use a strictly monotonic fencing token or atomic renewal to verify lock ownership immediately before broadcasting to Solana to prevent duplicate anchor collisions.
*   **D-004 / X-003 (Phantom Anchor Divergence):**
    *   *Test:* Drop the TCP ACK from Solana Devnet. The transaction lands on-chain, but Node.js hits a 15s local timeout.
    *   *Requirement:* The system must never rollback the WAL to `RETRY` purely based on a local network timeout. It must query the chain via the transaction signature to confirm actual L1 status.

## 5. Temporal Cryptography
*   **D-005 (TEE Quote Epoch Staleness):** 
    *   *Test:* Throttle the CVM CPU so the ZK-Proof takes 10 minutes, causing the initial TEE Hardware Quote to expire before anchoring.
    *   *Requirement:* The worker must catch the on-chain `StaleQuote` error and trigger a full local quote regeneration rather than infinitely retrying the dead payload.

---

### Appendix A – Canonical JSON Rules (excerpt)

1. Object keys UTF-8, sorted lexicographically.  
2. No duplicate keys (fail 400).  
3. Depth max = 8 192.  
4. `null` and missing field are considered identical in hash pre-image.  
5. No `__proto__`, `constructor`, symbol or BigInt keys (fail 400).

---

End of document.