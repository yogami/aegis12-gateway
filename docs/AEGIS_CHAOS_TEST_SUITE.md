# Aegis-12 CHAOS TEST SUITE  
_hard-bound for Phala dStack CVM, RISC Zero, and Solana Devnet_

---

## 0. Golden Rules (Read First)

1. All tests **run inside a real Phala dStack Confidential VM** (not a plain Docker cgroup). Use the staging tenant `cvm-stg-01`.  
2. Metrics are read from cgroup v2 (`/sys/fs/cgroup/memory.current`) and TEE introspection APIs, **never** from `process.memoryUsage()`.  
3. The ZK-Prover exercised in tests is **the real RISC Zero binary** compiled with `--features=prove` and fed with artefacts that reach ≥1.8 GB peak. Toy JS allocators are forbidden.  
4. Any test that would require mutual-exclusive orchestration features not available in vanilla Kubernetes (e.g. simultaneous 120 s warm-up _and_ old-pod SIGTERM) has been removed.  
5. Every artefact written to disk (`*.rzreceipt`, WAL records) is wrapped in an AEAD envelope (`ChaCha20-Poly1305`) so corruption is always detectable.  
6. Proof, batch and decision IDs are SHA-256 commitments over **canonicalised, key-sorted JSON**; this hash is re-verified before anchoring and stored on-chain.  
7. `/version` and `/attest` responses are served with `Cache-Control: no-store, max-age=0`.

---

## 1. Observability & Test Harness

Instrumentation installed once per test run:

* `agent-mem` reads `/sys/fs/cgroup/memory.current` every 250 ms → InfluxDB.  
* `agent-tee` streams quote freshness and MRENCLAVE.  
* `node-eventloop-histogram` records `min/avg/p95/p99` delay.  
* `filewatch-aead` tails the WAL directory and verifies every envelope on write-close.  
* `sol-tap` is a Toxiproxy side-car that can inject latency, 429s, and time-outs.

Harness CLI:

```bash
aegis-chaos run <TEST_ID> [...flags]
```

Exits non-zero on failure; produces JUnit XML.

---

## 2. Memory & TEE Chaos Suite (M*)

### M-001  ―  Baseline Audit  
Run service under CVM 2 GB limit doing 5 RPS `/enforce`.  
Pass if:
* `memory.current < 1.2 GB` steady
* `eventLoop.p99 < 50 ms`
* No AEAD verification failures in WAL

### M-002  ―  Real Prover Spike  
Feed prover with `policies/huge-42.r0cir` (≈1.9 GB peak). Concurrency = 1.  
Pass if:
* No container OOM kill
* API `/enforce` success ≥ 99 %
* AEAD envelope of proof either completes (valid tag) or is **fully deleted** on crash

### M-003  ―  Quote Contention Lag  
Spawn 50 parallel `/enforce` that require TEE quotes (quote generated on main thread).  
Fail if:
* `eventLoop.p99 > 500 ms` OR
* Readiness probe (`/readyz`) drops

### M-004  ―  Deep-JSON / Stack-Overflow Guard  
Send payload depth 12 000 levels.  
Expected: HTTP 400 with body `{ "error": "PAYLOAD_DEPTH_EXCEEDED" }` in ≤ 20 ms.  
Any `RangeError` or crash = fail.

### M-005  ―  Cross-Process Mem Gate  
API, Prover, Anchor workers are separate processes. Increase load until  
`memory.current` hits 1.5 GB.  
Expect:  
```
NewProverJob → EQUEUE_REJECTED
HTTP 503  + Retry-After
```
No further prover launches; API still green.

### M-006  ―  Prover Hard-Kill & Partial-File  
Start a large proof, `kill -9 <prover-pid>` after 1 s.  
On restart the job manager must:  
* Detect AEAD tag failure  
* Delete partial file  
* Re-queue job exactly once

### M-007  ―  Quote During GC  
Trigger `global.gc()` loop while quotes running. No quote attestation mismatch allowed (compare `QE.report_data`).

---

## 3. Integrity & WAL Chaos Suite (I*)

### I-001  ―  WAL Truncation  
Ffill queue to 500 jobs, then issue host OOM (`echo f > /proc/sysrq-trigger`).  
After automatic restart:  
* WAL replays ≤ 500 jobs (none missing, none duplicated)  
* AEAD check rejects any corrupted record

### I-002  ―  Batch ID Determinism  
Submit identical logical payload twice with shuffled key order.  
Pass if both jobs have **identical** `decisionId` and anchor to the **same** batch commitment.

---

## 4. Network & Solana Chaos Suite (N*)

### N-001  ―  429 Storm  
`sol-tap` returns 429 w/ no `Retry-After` for first 30 requests, then 200.  
Worker must back-off using exponential (min 5 s, max 5 min) jittered bucket.  
Fail if query rate > 5 RPS during storm.

### N-002  ―  RPC 45 s Latency  
Inject 45 000 ms latency ± 10 000 ms jitter.  
Anchor tick must **skip** if previous still running (singleflight lock in Redis).  
Fail if two overlapping anchor runs detected.

### N-003  ―  Partial Confirm  
`sendTransaction` → 200 (sig S)  
`confirmTransaction` → timeout  
Retry must first `getTransaction(sig S)`; only if `null` may it resend with new blockhash.  
Exactly one on-chain anchor expected.

### N-004  ―  Devnet Airdrop Denial  
Mock `requestAirdrop` = 429 100 % for 10 min.  
Anchors stay PENDING but API unaffected.  
Pass if no anchor transitions to FAILED_TERMINAL and `/enforce` > 99 % success.

---

## 5. Deployment / CI-CD Chaos Suite (C*)

### C-001  ―  Version & Quote Gate  
CI waits until:  
```
GET /version.gitSha == $CI_COMMIT_SHA
GET /attest.mrenclave == $EXPECTED_MRENCLAVE
stable for 4 consecutive polls 5 s apart
```

### C-002  ―  Old-Pod Drain  
During rolling update send SIGTERM; old pod marks `/readyz` false immediately, finishes in-flight ≤ 30 s, then exits.  
Fail if any `/version.gitSha` ≠ new SHA after readiness switch.

### C-003  ―  Proxy Cache Coherency  
Hit `/version?t=$RANDOM` from 8 geographic regions (Cloudflare workers). No cached old SHA permitted. Headers must be `Cache-Control: no-store`.

### C-004  ―  Dual-Revision Anchor Collision  
Intentionally run two replicas with different SHAs (A, B) for 60 s.  
Anchor worker must acquire Redis lock (`batch-anchor-lock`) with 90 s TTL; only one replica may submit.  
Duplicate on-chain commitment = fail.

---

## 6. Global Invariants (Must Hold For Every Test)

1. **Availability**: `/enforce` ≥ 99 % success unless queue or mem guard intentionally returns 429/503.  
2. **Cryptographic Integrity**: Every proof/anchor AEAD tag verifies; every on-chain transaction’s memo = SHA-256(commitment).  
3. **Idempotency**: `decisionId`, `sealId`, `batchId` = deterministic hashes of canonical JSON.  
4. **Memory Safety**: `memory.current` never exceeds 1.9 GB; crossing 1.7 GB triggers load-shed.  
5. **Quote Freshness**: Quote timestamp ≤ 10 min old for every successful `/enforce`.  

---

## 7. Release Gate (Minimum Required Green)

| ID | Purpose |
|----|---------|
| M-002 | Real prover spike survival |
| M-003 | Quote contention / event loop |
| M-006 | Partial proof file detection |
| I-001 | WAL truncation recovery |
| N-001 | 429 back-off correctness |
| N-002 | Anchor singleflight under latency |
| C-001 | Version + MRENCLAVE gate |
| C-003 | Proxy no-cache verification |

Any OOM kill, AEAD failure, duplicate anchor, or mismatched quote **blocks release**.

---

## 8. Implementation Checklist (chronological)

1. Add AEAD envelope to all persistent artefacts (`libs/secure-fs.ts`).  
2. Implement `/attest` returning quote & MRENCLAVE.  
3. Redis-based singleflight lock for BatchAnchorWorker.  
4. Memory guard reading `memory.current`.  
5. Canonical JSON encoder (UTF-8, sorted keys, depth limit 8 k).  
6. CI script `scripts/wait-new-revision.sh` querying both `/version` and `/attest`.  
7. Integrate `agent-mem`, `agent-tee`, `filewatch-aead` side-cars in Helm chart.  
8. Add `policies/huge-42.r0cir` fixture to test repo.

## 8. Extended Council Vectors (Grok & Perplexity Pro)

These vectors specifically target the intersection of asynchronous boundaries and cryptographic determinism.

### X-001 ― ZK–WAL Atomicity Under Cascading OOM Kills
**Objective:** Prove that no approved decision can end up in a “Schrödinger” state where the TEE has returned HTTP 200/202, but the ZK-Prover child dies mid-proof due to OOM, and the system silently resumes as if evidence were complete.
**Method:** Inflate RISC Zero wrapper memory right after it reads inputs. Send `SIGKILL` at randomized times during proof generation.
**Pass Criteria:** WAL “approved” events are strictly marked `UNPROVED`, `PROVED`, or `FAILED`. No batch anchor claims a receipt without a fully valid `.rzreceipt`.

### X-002 ― Redis Lock TTL vs Event-Loop Starvation
**Objective:** Exploit event-loop blocking during high-concurrency ZK bursts so the Redis `batch-anchor-lock` TTL expires, causing the worker to run twice in the same 30-second window.
**Method:** Set Redis TTL to 5 seconds. Send 25+ concurrent `/enforce` requests. Simultaneously pin the Node event loop for 10 seconds via heavy synthetic JSON serialization.
**Pass Criteria:** Lock implementation must use an atomic renewal or distributed semaphore. No two Solana `txSignatures` contain the same Merkle root or overlapping receipt hashes.

### X-003 ― Solana Confirmation Chaos: Reorg / Timeout / Partial Anchors
**Objective:** Force `sendTxWithFailover` to timeout after the WAL is written but before the transaction is confirmed, leaving the internal stateStore in “committed” while the on-chain memo never lands.
**Method:** Use a Toxiproxy that returns HTTP 200 for `getLatestBlockhash` but hangs indefinitely on `sendAndConfirmTransaction`. Kill the RPC connection mid-flight after the WAL write succeeds.
**Pass Criteria:** System rolls back the WAL record on confirmation timeout and returns a consistent “PENDING_ANCHOR” state. No batch disappears; every batch eventually hits `FINALIZED` or `FAILED`.

### X-004 ― Child Process Exit Race + AEAD Nonce Reuse
**Objective:** Kill the RISC Zero child process after it generates the proof but before the parent updates the state store. 
**Method:** Send a high-memory payload. Use `kill -9` on the child PID the instant the `.rzreceipt` file size stops growing. Immediately send a second identical payload.
**Pass Criteria:** Every child-process write must use a fresh, parent-generated monotonic nonce. The same nonce must never appear in two different AEAD envelopes.

### X-005 ― Cross-Stream Race: Misordered ZK Updates vs Batch Anchors
**Objective:** Delay ZK-Prover completions for 60-90s, while simultaneously delaying state-store updates by injecting latency into the AEAD write path.
**Method:** Run the BatchAnchorWorker every 30s while maintaining a constant stream of `/enforce` calls.
**Pass Criteria:** No "ghost proofs" (PROVED but unanchored forever). No "ghost anchors" (batches that include receipts whose ZK status is still PENDING).

## 9. Master Vectors (Google DeepThink)

DeepThink specifically targeted the 3.3GB aggregate memory requirement running inside a 2GB physical Phala CVM, identifying temporal and OS-level boundary vulnerabilities.

### D-001 ― V8 "Chronos Squeeze" (Event-Loop Starvation vs. Redis TOCTOU)
**Objective:** Trigger a silent Redis lock expiration by deliberately starving the V8 event loop via cryptographic canonicalization, forcing two overlapping BatchAnchorWorker instances to write to the WAL concurrently, destroying the AEAD stream state.
**Method:** Wait for the BatchAnchorWorker to acquire the `batch-anchor-lock` (e.g., 30s TTL). Flood `/enforce` with flat JSONs containing 200,000 keys. The V8 main thread blocks completely for >30s on key-sorting. The lock TTL expires silently in the background.
**Pass Criteria:** The worker cryptographically verifies lock ownership (via a strictly monotonic fencing token) immediately before writing to the WAL or broadcasting to Solana.

### D-002 ― Cgroup Orphan Leak & Hypervisor Panic (The "Zombie Prover")
**Objective:** Escape the Node.js cgroup limit and induce an unrecoverable hardware-level CVM panic by weaponizing the OOM-killer to orphan the ZK-Prover.
**Method:** Inject a localized Node.js memory flood to breach the 1.5GB cgroup cap exactly as the ZK-Prover spikes to 1.8GB. The Linux kernel sends SIGKILL to the parent Node.js process. The ZK-Prover child is orphaned, adopted by init (PID 1), and holds its 1.8GB of RAM. Node.js restarts and spawns a second prover, requesting 3.6GB total.
**Pass Criteria:** Strict Linux PID namespace management or `prctl(PR_SET_PDEATHSIG, SIGKILL)` in the child process bindings guarantees the ZK-Prover dies atomically precisely when the Node.js parent dies.

### D-003 ― The AEAD Poison Pill via Asynchronous OOM-Severance
**Objective:** Create an unrecoverable Head-of-Line (HoL) deadlock in the BatchAnchorWorker by weaponizing an OOM-kill to truncate an AEAD file stream mid-write.
**Method:** Precisely as the parent Node.js process begins streaming the encrypted `.rzreceipt` and updated WAL state to disk using `crypto.createCipheriv`, trigger a memory flood. The OOM-killer triggers mid-write, killing the file stream before `cipher.final()` calculates the MAC tag.
**Pass Criteria:** Cryptographic file generation must write to a temporary `.tmp` file descriptor first and use an atomic `rename()` syscall upon successful MAC finalization.

### D-004 ― Phantom Anchor Divergence (The Ephemeral RPC Blackhole)
**Objective:** Trick the TEE into a state rollback by simulating an RPC timeout, forcing a deterministic batch to replay and violate L1 "once-and-only-once" uniqueness invariants.
**Method:** Using an eBPF chaos proxy, aggressively drop the inbound TCP ACK responses from Solana during the `confirmTransaction` polling phase. The transaction finalizes on-chain, but Node.js hits its 15s local HTTP timeout and assumes failure.
**Pass Criteria:** The worker never blindly retries a state mutation based on a local network timeout. It deterministically derives the Solana transaction signature and queries the chain for its status before retrying.

### D-005 ― TEE Quote Epoch Staleness via Asynchronous CPU Starvation
**Objective:** Weaponize the temporal gap between the synchronous hardware quote generation and the asynchronous RISC Zero proof finality to cause an infinite on-chain rejection loop.
**Method:** Submit an `/enforce` request to pull the hardware TEE Quote. Immediately saturate the CVM CPU quota. The ZK-Prover is massively throttled, extending its execution from seconds to >10 minutes. The worker packages the 10-minute-old quote and broadcasts to Solana.
**Pass Criteria:** The system enforces a local expiration TTL on the hardware quote, or intelligently parses the on-chain `StaleQuote` error to trigger a full regeneration pipeline rather than infinitely retrying a permanently stale payload.

---

### Appendix A – Canonical JSON Rules (excerpt)

1. Object keys UTF-8, sorted lexicographically.  
2. No duplicate keys (fail 400).  
3. Depth max = 8 192.  
4. `null` and missing field are considered identical in hash pre-image.  
5. No `__proto__`, `constructor`, symbol or BigInt keys (fail 400).

---

End of document.