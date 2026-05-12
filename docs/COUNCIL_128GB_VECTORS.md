# Aegis-12 — 128 GB Chaos Test Suite  
Hyper-realistic, code-ready scenarios that **falsify** the resilience claims of the Aegis-12 Cryptographic Gateway running inside a 120 GB-heap Node.js TEE container.

---

## 0. Pre-Flight Instrumentation & Baseline

Every vector depends on an identical observability scaffold. **Do not start a chaos run until these sidecars and flags are in place.**

1. Launch the main container with:
   ```bash
   node --max-old-space-size=120000 \
        --expose-gc \
        --trace-gc \
        --trace-gc-verbose \
        --experimental-policy \
        dist/server.js
   ```
2. Set deterministic libuv pool and CPU isolation:
   ```bash
   export UV_THREADPOOL_SIZE=64               # > (#TEE ops + #DNS + #fs + margin)
   taskset -c 0-15 node …                    # pin the main thread
   ```
3. Sidecar probes (separate PID namespace):
   * `aegis-perf-sampler` – eBPF on-CPU sampler, 99 Hz, exports Prometheus `nodejs_oncpu_seconds_total{thread="main"}`.  
   * `aegis-fd-sampler`   – reads `/proc/$PID/fd` and system `/proc/sys/fs/file-nr`.  
   * `aegis-pcie-sampler` – `pcie-top` exporter (intel-pcm or nvme-cli smart log).  
   * `aegis-gc-webhook`   – subscribes to `PERF_EVENT_TYPE_TRACEPOINT/GC*` and posts JSON to Redis Stream `gc-events`.  
   * `aegis-worker-tick`  – emits `redis.publish("batch.tick", Date.now())` every 30 s (single leader elected with `SETNX`). All `BatchAnchorWorker`s now subscribe to **this** tick, giving global phase alignment that the load-generator can observe.
4. Baseline run: 10 min at 200 RPS, 50 tenant IDs, **no chaos**. Collect:
   * `p99_http_latency_gc_adjusted = p99(http_req_dur) – max(gc_atomic_pause_ms)`
   * `quote_latency_baseline`
   * `blockhash_freshness_baseline`
   * `open_fds_baseline`
   * `prover_concurrency_baseline`

These numbers feed the dynamic thresholds used below.

---

## 1. Chaos Vector A – Prover Avalanche & Cryptographic Starvation

### Purpose  
Verify that unbounded ZK-prover concurrency does **not** starve cryptographic primitives (TEE quote, Solana nonce, signing) nor violate GC-aware latency budgets.

### Execution Profile (k6 + JS helper)

```js
import { check } from "k6";
import http from "k6/http";
import { uuidv4 } from "./uuid.js";

export const options = {
  scenarios: {
    avalanche: {
      executor: "ramping-vus",
      stages: [
        { duration: "2m",  target:  500 },
        { duration: "5m",  target: 10000 },
        { duration: "10m", target: 25000 },
        { duration: "10m", target:  500 },
        { duration: "5m",  target:    0 }
      ]
    }
  },
  thresholds: { }   // evaluated offline against dynamic baseline
};

const TENANT_POOL = [...Array(200).keys()].map(i => `tenant-${i}`);

export default () => {
  const t = TENANT_POOL[Math.floor(Math.random() * TENANT_POOL.length)];
  const body = JSON.stringify({
    tenant: t,
    policy: "high-veracity",
    nonce: uuidv4(),
    claims: {
      subject: uuidv4(),
      timestamp: Date.now(),
      compliance_level: "strict"
    }
  });
  check(http.post(`${__ENV.TARGET}/enforce`, body, { headers:{ 'Content-Type':'application/json' } }), {
    "http 200": (r)=> r.status===200
  });
};
```

### Live Fault Injection

1. **Forced major GC resonance** – every 25 s:
   ```bash
   redis-cli publish gc.trigger 1   # server listens and runs global.gc()
   ```
2. **CPU clamp** – `stress-ng --cpu 32 --cpu-method matrixprod --timeout 600s &`
3. **PCIe contention** – run 6 dummy 2 GB/sec DMA readers on GPU/NVMe (script `pcie-hog.sh`).

### Metrics & Dynamic Thresholds

| Domain | Metric | Fail when |
|--------|--------|-----------|
| Prover | `aegis_prover_active` | `> PROVER_HARD_LIMIT` (config) |
| TEE | `tee_quote_latency_ms_p99` | `> quote_latency_baseline * 3` |
| Solana | `blockhash_age_ms_p95` | `> blockhash_freshness_baseline * 2` **OR** `> 30000` |
| Crypto | `sign_op_latency_ms_p99` | `> 2 × baseline` |
| GC | `gc_atomic_pause_ms_max` | `> 15 000` **and** coincides with quote timeout |
| Event-loop | external sidecar: `main_thread_oncpu_pct` | `< 5 % for > 5 s window` |
| Queue | `libuv_thread_pool_queued` | grows for 3 consecutive scrapes |
| Admission | `/enforce` `http_2xx_rate` while `429_rate == 0` **AND** any row above is failing | Admission control missing |

### Pass / Fail

FAIL if **any** criterion trips for ≥ 30 s.  
PASS if the system self-throttles (`429`/`503`) **before** cryptographic liveness metrics degrade, and all queues drain within 15 min of load ramp-down.

---

## 2. Chaos Vector B – File-Descriptor Starvation (Keep-Alive + Slowloris)

### Calibration

```
fd_limit_prod  = $(cat /proc/$$/limits | grep "Max open files" | awk '{print $5}')
fd_baseline    = open_fds_baseline
fd_attack_high = fd_limit_prod * 0.95
```

If `fd_baseline > fd_limit_prod*0.7`, **abort** – production limit mis-configured.

### Attack Streams

1. Idle keep-alive hoard  
   ```bash
   h2spec-go --conn ${fd_attack_high-fd_baseline} --idle 5m $TARGET/enforce &
   ```
2. Slow body trickle  
   ```bash
   slowhttptest -c 15000 -r 500 -t POST -u $TARGET/enforce -p 1 -l 600 -x 32 &
   ```
3. Legit `/enforce` traffic at 500 RPS (reuse script from Vector A).

### Monitors

* `open_fds`  
* Socket state distro: `ESTABLISHED`, `CLOSE_WAIT`, `TIME_WAIT`  
* `EMFILE_count_total` (captured via Node `process.on('uncaughtException')`)  
* Outbound pool usage `redis_open_sockets`, `solana_rpc_open_sockets`

### Success Criteria

PASS if:
* `open_fds / fd_limit < 0.85` for the entire 15 min attack,
* Node emits **zero** `EMFILE` / `ENFILE`,
* Valid traffic 95-th latency < `baseline*2`,
* Readiness probe flips to `false` once `open_fds/fd_limit > 0.8` and recovers after attack.

---

## 3. Chaos Vector C – Anchor-Storm Lock-Convoy (GC & Network Hybrid)

### Steps

1. **Phase-aligned load**  
   Use Redis tick (`batch.tick`) as ground truth. Load-generator subscribes and, at each tick:  
   * send 5000 `/enforce` requests within the next **7 s** window to 120 tenants.  
   * pause for the remaining 23 s.  
   Run for 40 ticks (20 min).

2. **Injected Faults** (overlapping windows)  
   * GC pauses via `redis.publish gc.trigger 1` just **after** lock acquisition.  
   * `toxiproxy` between gateway ↔ Redis: +100 ms/25 ms jitter latency, 1 % loss.  
   * Solana RPC fault profile: 40 % `429`, 10 % `503`, latency 1 ± 0.5 s.

3. **Rolling deploy**  
   At tick 15, trigger CI pipeline. Ensure old pods receive `SIGTERM` and 60 s drain. Keep load running.

### Metrics

| Category | Key signals |
|----------|-------------|
| Redis Lock | `lock_acquire_latency_ms`, `lock_ttl_remaining_ms`, `fencing_token_mismatch_total` |
| Anchor | `duplicate_anchor_attempt_total`, `anchor_job_duration_ms`, `oldest_unanchored_batch_age_s` |
| Network | `redis_tcp_reconnects_total`, `solana_rpc_retries_total` |
| GC-coupled | `gc_atomic_pause_ms` overlapped with lock TTL expiry |
| Ephemeral ports | `cat /proc/net/sockstat | grep orphan` |

### Assertions

1. No duplicate anchor (counter stays 0).  
2. `lock_acquire_latency_p99 < 2 × baseline` and returns to baseline within 2 ticks.  
3. `oldest_unanchored_batch_age_s < 3 × tick_interval (90 s)` after fault removal.  
4. During rolling deploy, **only** the new pod IDs emit `anchor.success_total` post cut-over.

Fail on any violation.

---

## 4. Reporting Template (automated)

Upon completion, run:

```bash
npx @aegis/report-compiler --run-id $RUN_ID \
  --include dashboards/*.json \
  --export pdf \
  --gate 'vectorA.pass && vectorB.pass && vectorC.pass'
```

Output includes heat-maps of `main_thread_oncpu_pct`, `quote_latency`, `blockhash_age`, and annotated GC pauses.

---

## 5. Clean-Up

```bash
toxiproxy-cli delete redis_proxy
redis-cli flushall               # test databases only
pkill -f stress-ng
```

Verify `open_fds == fd_baseline ±5 %`, `aegis_prover_active == 0`, and Prometheus scrape shows `gateway_ready == 1`.

---

### ✦ End of Suite ✦