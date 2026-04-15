import os
import sys
import json
import urllib.request
from dotenv import load_dotenv

load_dotenv()
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

if not OPENROUTER_API_KEY:
    print("❌ OPENROUTER_API_KEY missing.")
    sys.exit(1)

def query_model(model, system_prompt, user_prompt):
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }
    data = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
    }
    req = urllib.request.Request(url, headers=headers, data=json.dumps(data).encode("utf-8"))
    try:
        with urllib.request.urlopen(req, timeout=300) as response:
            res = json.loads(response.read().decode("utf-8"))
            return res["choices"][0]["message"]["content"]
    except Exception as e:
        return f"Error querying {model}: {str(e)}"

# Read the final architected files
try:
    with open('src/infrastructure/AegisPEP.ts', 'r') as f:
        aegis_pep = f.read()
    with open('src/application/PhalaEntrypoint.ts', 'r') as f:
        phala = f.read()
    with open('src/domain/PolicyValidator.ts', 'r') as f:
        domain_policy = f.read()
    with open('src/domain/Eip712Verifier.ts', 'r') as f:
        eip712 = f.read()
    with open('src/domain/TierEvaluator.ts', 'r') as f:
        tier_eval = f.read()
    with open('e2e/council-security-verification.spec.ts', 'r') as f:
        e2e = f.read()
except Exception as e:
    print(f"❌ Failed to load source files: {e}")
    sys.exit(1)

base_prompt = """
[THE BRUTAL REALITY CHECK AND QUALITY AUDIT]
The architecture team has completed a Hexagonal Architecture refactor of the Aegis-12 TEE Gateway codebase.
We need you to evaluate if this codebase successfully mitigates the 9 critical vulnerabilities previously identified.

**Your Objective:**
1. **Security Vulnerability Assessment**: Aggressively re-audit the provided files (AegisPEP, PolicyValidator, PhalaEntrypoint). Confirm if the 9 vulnerabilities have been fully eradicated. Determine if any new vulnerabilities were introduced.
2. **Code Quality Audit**: Evaluate adherence to SOLID principles, TDD artifacts, exception handling ("Fail-Closed"), and infrastructure-to-domain decoupling.
3. **E2E Test Generation**: You MUST output a comprehensive Playwright Test Suite (`tests/e2e/council-security-reaudit.spec.ts`). 
   - These tests MUST target a production environment (no internal mocking/stubbing of the local classes, pure HTTP requests against the `/enforce` and `/solana/enforce-tx` endpoints). 
   - The test names MUST reflect the exact security vulnerability being verified.
   - Do NOT duplicate tests that already exist in `solana-integration.spec.ts`.
   - Output the Playwright test code in a standard ```typescript block.

DO NOT SYCOPHANT. If it's flawed, destroy their claims. Provide exact line numbers.
"""

models = {
    "Claude Opus 4.6 (The Hostile Architect)": ("anthropic/claude-opus-4.6", f"You are a world-class security researcher and red-team lead. Your goal is to bypass the TEE gateway. Find every subtle race condition, state-machine flaw, or logic error in the provided files. Generate a Playwright test suite that actively attempts to BREAK the production endpoint.\n{base_prompt}"),
    "OpenAI o3 Pro (The Math Auditor)": ("openai/o3-mini-high", f"You are a terrifyingly precise, deep-logic security auditor using unbounded compute. Trace the actual execution paths down to the base58 arrays and math verifications. Tear the logic apart if there is ANY edge case. No hallucinations, only programmatic proof of hack.\n{base_prompt}")
}

output_path = "/Users/user1000/.gemini/antigravity/brain/a29ac51c-0434-4fdc-8b70-7dd4b303f37b/aegis12_flagship_pentest.md"

with open(output_path, "w") as f:
    f.write("# Aegis-12: The Autonomous Independent Re-Audit & E2E Generation\n\n")

print("💥 Booting the Independent Multi-Model Re-Audit...")

payload = f"=== src/infrastructure/AegisPEP.ts ===\n\n```typescript\n{aegis_pep}\n```\n\n=== src/domain/PolicyValidator.ts ===\n\n```typescript\n{domain_policy}\n```\n\n=== src/domain/Eip712Verifier.ts ===\n\n```typescript\n{eip712}\n```\n\n=== src/domain/TierEvaluator.ts ===\n\n```typescript\n{tier_eval}\n```\n\n=== src/application/PhalaEntrypoint.ts ===\n\n```typescript\n{phala}\n```\n\n=== Existing E2E Suite (DO NOT DUPLICATE) ===\n\n```typescript\n{e2e}\n```"

for name, (model_id, sys_prompt) in models.items():
    print(f"-> Engaging {name} ({model_id})...")
    response = query_model(model_id, sys_prompt, payload)
    
    with open(output_path, "a") as f:
        f.write(f"## {name}\n\n")
        f.write(response + "\n\n---\n\n")

print(f"✅ Independent Audit Saved to: {output_path}")
