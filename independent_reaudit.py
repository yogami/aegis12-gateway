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
    with open('src/phala-entry.ts', 'r') as f:
        phala = f.read()
    with open('e2e/solana-integration.spec.ts', 'r') as f:
        e2e = f.read()
except Exception as e:
    print(f"❌ Failed to load source files: {e}")
    sys.exit(1)

base_prompt = """
[THE BRUTAL REALITY CHECK]
The architecture team claims they have perfectly secured the Aegis-12 TEE Hardware Gateway against all enterprise vectors.
Recent 'fixes' include:
1. Two-Phase Commit Nonce Registry to prevent distributed double-spend load balancer race conditions.
2. EIP-712 Network Bound execution (`crossChainTarget: 'solana-mainnet'`) to prevent Ethereum/Arbitrum side-chain payload playback.
3. Sentinel Receipt wrapping with Keccak hashes to prevent execution daylight MEV substitution.

Your objective:
Viciously audit `AegisPEP.ts`, `phala-entry.ts`, and the Playwright `solana-integration.spec.ts` payload constructions. 
Are there STILL unhandled enterprise vulnerabilities, asynchronous traps, physical execution side-channels, or logical paradoxes in the code?
DO NOT SYCOPHANT. If it's flawed, destroy their claims. If it's secure, clearly validate it. Give EXACT lines of code if you find a flaw.
"""

# Let's map real models capable of deep architectural auditing.
models = {
    "Claude Sonnet 4.6 (The Architect)": ("anthropic/claude-sonnet-4.6", f"You are an elite Staff Engineer. Find any missing logical closures or structural vulnerabilities.\n{base_prompt}"),
    "DeepSeek v3.2 (The Cryptographer)": ("deepseek/deepseek-v3.2", f"You are an adversarial cryptographer. Break the TEE boundary. Find signature malleability or playback traps.\n{base_prompt}"),
    "OpenAI GPT-5.4 (The Compliance Officer)": ("openai/gpt-5.4", f"You are a hardcore Fortune 500 CISO. Look for auditing gaps, liability loopholes, and network traps.\n{base_prompt}")
}

output_path = "/Users/user1000/.gemini/antigravity/brain/a29ac51c-0434-4fdc-8b70-7dd4b303f37b/aegis12_independent_reaudit.md"

with open(output_path, "w") as f:
    f.write("# Aegis-12: The Autonomous Independent Re-Audit\n\n")

print("💥 Booting the Independent Multi-Model Re-Audit...")

payload = f"=== AegisPEP.ts ===\n\n```typescript\n{aegis_pep}\n```\n\n=== phala-entry.ts ===\n\n```typescript\n{phala}\n```\n\n=== solana-integration.spec.ts ===\n\n```typescript\n{e2e}\n```"

for name, (model_id, sys_prompt) in models.items():
    print(f"-> Engaging {name} ({model_id})...")
    response = query_model(model_id, sys_prompt, payload)
    
    with open(output_path, "a") as f:
        f.write(f"## {name}\n\n")
        f.write(response + "\n\n---\n\n")

print(f"✅ Independent Audit Saved to: {output_path}")
