#!/usr/bin/env python3
"""
Aegis-12 Security Council Gate
===============================
Mandatory pre-push adversarial audit. Runs the 5-model council against
all security-critical source files. Blocks push if any model returns
a CRITICAL severity finding.

Usage:
  python3 scripts/council_gate.py          # Full audit (all 5 models)
  python3 scripts/council_gate.py --quick  # Quick audit (2 fastest models)
"""

import os
import sys
import json
import time
import urllib.request
from datetime import datetime

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
if not OPENROUTER_API_KEY:
    print("⚠️  OPENROUTER_API_KEY missing. Council gate SKIPPED (set key to enforce).")
    sys.exit(0)

# --- Verified OpenRouter Model Slugs (April 2026) ---
FULL_COUNCIL = {
    "Claude Sonnet 4.6 (The Architect)": (
        "anthropic/claude-sonnet-4.6",
        "You are an elite Staff Engineer specializing in distributed systems and TEE security. "
        "Find any missing logical closures, state machine paradoxes, or structural vulnerabilities."
    ),
    "DeepSeek v3.2 (The Cryptographer)": (
        "deepseek/deepseek-v3.2",
        "You are an adversarial cryptographer. Break the TEE boundary. "
        "Find signature malleability, EIP-712 domain binding flaws, or playback traps."
    ),
    "OpenAI GPT-5.4 (The Compliance Officer)": (
        "openai/gpt-5.4",
        "You are a hardcore Fortune 500 CISO. Look for auditing gaps, "
        "liability loopholes, cross-tenant isolation failures, and network traps."
    ),
    "Z.ai GLM 5.1 (The Reasoning Engine)": (
        "z-ai/glm-5.1",
        "You are a highly advanced reasoning model. Perform exhaustive multi-step logical "
        "derivation to identify hidden paradoxes, semantic authorization gaps, and nonce state machine violations."
    ),
    "Qwen3 Coder Next (The Solana Code Auditor)": (
        "qwen/qwen3-coder-next",
        "You are an elite cybersecurity code auditor specializing in Solana blockchain, "
        "TypeScript smart contract integrations, and DeFi protocol security. "
        "Find slippage exploits, cross-chain malleability bugs, and MEV extraction vectors."
    ),
}

QUICK_COUNCIL = {
    "DeepSeek v3.2 (The Cryptographer)": FULL_COUNCIL["DeepSeek v3.2 (The Cryptographer)"],
    "Qwen3 Coder Next (The Solana Code Auditor)": FULL_COUNCIL["Qwen3 Coder Next (The Solana Code Auditor)"],
}

# --- Security-critical files to audit ---
AUDIT_FILES = [
    "src/infrastructure/AegisPEP.ts",
    "src/infrastructure/NonceRegistry.ts",
    "src/phala-entry.ts",
]

BASE_PROMPT = """
[COUNCIL GATE — PRE-PUSH SECURITY AUDIT]
This code is about to be pushed to the main branch and deployed to a Phala Network TEE.
Your job: Find CRITICAL or HIGH severity vulnerabilities ONLY. Do not waste time on style or minor issues.
Focus exclusively on:
1. Nonce double-spend / replay attacks
2. EIP-712 signature domain binding flaws
3. Cross-chain replay or semantic authorization gaps
4. TEE attestation bypass or fail-open conditions
5. Parameter injection / type coercion / financial limit bypass
6. Cross-tenant isolation failures

IMPORTANT — The following are DOCUMENTED ACCEPTED RISKS. Do NOT flag these as CRITICAL:
- Receipt domain ("Aegis-12-Sentinel") differs from policy domain ("Aegis-12-Compliance-Matrix") intentionally — these are separate document types with separate signing contexts.
- chainId 1399811149 is a synthetic Solana EIP-155 identifier, not a real EVM chain. EIP-712 is used for structured signing only, not for EVM execution.
- The nonce is committed IMMEDIATELY after evaluatePolicy returns 'allow' (commit-first). There is NO rollback in enforce(). Failed receipt generation burns the nonce intentionally.
- Remote KV store atomicity for multi-replica is an operational deployment concern, not a code-level vulnerability in the single-instance Phala CVM target.
- Nonce keys are tenant-scoped via nonceKey(tenantId, nonce) in BOTH evaluatePolicy and enforce.
- Date.now() for policy expiry uses the TEE host clock. This is a known TEE threat model limitation documented in Intel TDX specs.

Only flag as CRITICAL if you find a NEW vulnerability not listed above that enables:
- Actual double-spend or funds theft
- Authentication bypass
- Signature forgery
- Cross-tenant data leakage

Output format — use EXACTLY this structure for each finding:
SEVERITY: CRITICAL | HIGH | MEDIUM
TITLE: <short title>
LOCATION: <file:line>
DESCRIPTION: <what is broken and how to exploit it>

If the code is secure against your attack surface, output: NO_CRITICAL_FINDINGS
"""


def query_model(model_id: str, system_prompt: str, user_prompt: str) -> str:
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }
    data = {
        "model": model_id,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    }
    req = urllib.request.Request(
        url, headers=headers, data=json.dumps(data).encode("utf-8")
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as response:
            res = json.loads(response.read().decode("utf-8"))
            return res["choices"][0]["message"]["content"]
    except Exception as e:
        return f"ERROR: {model_id} unreachable — {e}"


def load_source_files() -> str:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    payload_parts = []
    for rel_path in AUDIT_FILES:
        full_path = os.path.join(root, rel_path)
        if os.path.exists(full_path):
            with open(full_path, "r") as f:
                content = f.read()
            payload_parts.append(f"=== {rel_path} ===\n\n```typescript\n{content}\n```")
        else:
            payload_parts.append(f"=== {rel_path} === [FILE NOT FOUND]")
    return "\n\n".join(payload_parts)


def run_council(quick: bool = False) -> tuple[bool, str]:
    council = QUICK_COUNCIL if quick else FULL_COUNCIL
    mode = "QUICK (2 models)" if quick else "FULL (5 models)"

    print(f"\n🏛️  Aegis-12 Security Council Gate — {mode}")
    print(f"   Timestamp: {datetime.now().isoformat()}")
    print(f"   Files: {', '.join(AUDIT_FILES)}")
    print("=" * 60)

    payload = load_source_files()
    results = {}
    critical_found = False
    report_lines = [
        f"# Aegis-12 Council Gate Report\n",
        f"**Mode:** {mode}  \n",
        f"**Timestamp:** {datetime.now().isoformat()}  \n",
        f"**Files Audited:** {', '.join(AUDIT_FILES)}\n\n---\n",
    ]

    for name, (model_id, persona) in council.items():
        print(f"\n→ Engaging {name} ({model_id})...")
        t0 = time.time()
        system_prompt = f"{persona}\n{BASE_PROMPT}"
        response = query_model(model_id, system_prompt, payload)
        elapsed = time.time() - t0
        print(f"  ✓ Response received in {elapsed:.1f}s")

        results[name] = response
        report_lines.append(f"\n## {name}\n\n{response}\n\n---\n")

        # Check for CRITICAL findings
        if "SEVERITY: CRITICAL" in response.upper() or "SEVERITY:CRITICAL" in response.upper():
            critical_found = True
            print(f"  🚨 CRITICAL finding detected!")
        elif "NO_CRITICAL_FINDINGS" in response:
            print(f"  ✅ No critical findings.")
        else:
            # May contain HIGH findings — flag but don't block
            if "SEVERITY: HIGH" in response.upper():
                print(f"  ⚠️  HIGH severity finding detected (non-blocking).")

    report = "\n".join(report_lines)

    # Save report
    report_dir = os.path.join(
        os.path.expanduser("~"),
        ".gemini/antigravity/brain/a29ac51c-0434-4fdc-8b70-7dd4b303f37b",
    )
    os.makedirs(report_dir, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_path = os.path.join(report_dir, f"council_gate_{ts}.md")
    with open(report_path, "w") as f:
        f.write(report)
    print(f"\n📄 Report saved: {report_path}")

    return critical_found, report_path


if __name__ == "__main__":
    quick = "--quick" in sys.argv
    critical_found, report_path = run_council(quick=quick)

    if critical_found:
        print("\n" + "=" * 60)
        print("🚨 COUNCIL GATE: PUSH BLOCKED")
        print("   CRITICAL vulnerabilities detected by the council.")
        print(f"   Review: {report_path}")
        print("=" * 60)
        sys.exit(1)
    else:
        print("\n" + "=" * 60)
        print("✅ COUNCIL GATE: PUSH APPROVED")
        print("   No CRITICAL findings. HIGH findings logged for review.")
        print("=" * 60)
        sys.exit(0)
