# Aegis-12 Adversarial & Chaos Test Suite
*Synthesized by the OpenRouter Architecture Council (GPT-4o, Claude 3.5 Sonnet, o3-mini) under strict Anti-Sycophancy Guidelines.*

## Overview
This is not a functional test suite. This is a **hostile infrastructure evaluation**. The goal is to mathematically and physically force the Aegis-12 Gateway into undefined states by exploiting the constraints of the Phala dStack CVM (2GB memory), the RISC Zero ZK-Prover (child process CPU/Mem spikes), and the Solana Devnet (aggressive HTTP 429 rate limiting).

---

## Vector 1: The ZK-Collision OOM Bomb (Memory Exhaustion)

### The Premise
The CVM is hard-capped at 2GB, with Node.js capped at 1.5GB. The RISC Zero ZK-Prover spawns a child process that spikes memory. If we flood the Node.js event loop with maximal JSON payloads at the *exact* millisecond the child process requires memory, we can trigger an OS-level OOM Kill.

### The Attack Execution
1. **Trigger Phase:** Send 1 valid `/enforce` request to trigger the background `AegisZKClient`.
2. **Bomb Phase:** Wait exactly 2.5 seconds (the average initialization time of the Rust ZK-Prover). Then, concurrently blast `POST /enforce` with 150 unique requests, each containing a 128KB JSON payload heavily nested to depth 15 (designed to maximize `JsonUtils.stableStringify` heap allocation).
3. **Observation:** Monitor `dstack.sock` for `SIGKILL` or memory eviction events.
4. **Victory Condition:** The gateway must either immediately respond with `HTTP 429 Too Many Requests` or cleanly eject old memory. The original ZK-Seal must successfully complete, and the Node process must not crash.

---

## Vector 2: The Solana Blacklist Trap (HTTP 429 State Retention)

### The Premise
The `BatchAnchorWorker` relies on the Devnet RPC, which actively bans IPs that spam it. A naive worker will crash, drop the `unbatched` receipts, or enter an infinite loop of Airdrop requests.

### The Attack Execution
1. **Mock Environment:** Intercept outbound traffic to `api.devnet.solana.com`.
2. **Phase 1 (The Ban):** Return `HTTP 429 Too Many Requests` consistently for exactly 45 minutes.
3. **Load Generation:** Generate 5 `/enforce` requests every minute for the entire 45-minute duration.
4. **Phase 2 (The Release):** Restore `HTTP 200 OK` on the RPC.
5. **Victory Condition:** The `AegisJournal` (WAL) must have safely stored all ~225 receipts without memory leaking. Upon RPC release, the `BatchAnchorWorker` must successfully construct a massive Merkle Tree, anchor all 225 receipts in a single batch, and update the evidence store. ZERO receipts may be dropped.

---

## Vector 3: The Deployment Phantom (Stale Proxy Race)

### The Premise
Phala Cloud rolling updates take up to 10 minutes to compile Rust images. During this time, the NGINX/Cloudflare proxy may cache `HTTP 200 OK` from the dying container, causing CI pipelines to test the old logic.

### The Attack Execution
1. **Trigger Update:** Trigger an API POST to `https://cloud-api.phala.com/api/v1/cvms/:id/restart`.
2. **Immediate Poll:** Immediately blast `GET /health` every 100ms.
3. **The Trap:** If `GET /health` returns `HTTP 200`, immediately query `/evidence/:receiptId` for a known pending receipt.
4. **Victory Condition:** The CI test script must explicitly validate the `version` or a unique deployment `commit_hash` in the `/health` response. If the response comes from the dying container (matching the old hash), the test MUST ignore it and continue waiting for the `HTTP 502/503` gap before recognizing the new container.

---

> [!CAUTION]
> **Execution Warning**
> Do not run Vector 1 and Vector 2 concurrently in a production environment without a multi-node cluster. An OOM Kill during a forced HTTP 429 state will trigger the worst-case scenario: a cold-boot WAL recovery under active network duress. This is the ultimate benchmark, but it will guarantee downtime if it fails.
