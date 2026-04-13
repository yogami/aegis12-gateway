import os
import sys
import json
import urllib.request

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
if not OPENROUTER_API_KEY:
    print("❌ [Auth] OPENROUTER_API_KEY missing.")
    sys.exit(1)

# Read the active SDK code so the LLM can deeply audit the physical logic
def read_file(path):
    try:
        with open(path, 'r') as f:
            return f.read()
    except Exception:
        return "File not found"

index_code = read_file("packages/telemetry-shield/src/index.ts")
wal_code = read_file("packages/telemetry-shield/src/wal.ts")

audit_prompt = f"""
You are an elite Adversarial Chaos Engineer and Liability Auditor. Your goal is to completely break the Aegis-12 Telemetry Shield SDK codebase. 

Aegis-12 is a zero-dependency TypeScipt SDK that AI agents (Node.js) import to mask their trading intent on Solana. 
It uses 'Chaff' (asynchronous dummy RPC polling) and a local 'Write-Ahead Log (WAL)' to secure EU AI Act compliance traces off-path to Phala Network without blocking the 150ms execution loop.

We are terrified of LIABILITY. If our SDK crashes the user's trading bot, or corrupts their memory, or exposes their private keys, we get sued. 

Here is the exact production code for the SDK:

```typescript
// index.ts
{index_code}
```

```typescript
// wal.ts
{wal_code}
```

Identify 3 specific Chaos Engineering vectors that could cause FATAL LIABILITY for our users. 
Focus strictly on:
1. Unhandled Promise rejections that could crash the parent node.js process of the hedge fund.
2. Memory leaks (e.g., inside the WAL in-memory queue) that will OOM kill their servers during high-frequency trading.
3. Node `fs` lock contention or race conditions if 10,000 asynchronous trades execute in the same second, corrupting the JSON.

For each vector, provide:
- The Vector Name
- The Technical Explanation of why the code fails (cite the lines).
- A specific Javascript execution snippet that triggers the crash (The Red-Team Payload).
- How we fix it before launch.
"""

print("💥 [Chaos] Unleashing Frontier Red-Team Suite...")

models = [
    "anthropic/claude-3.5-sonnet",
    "openai/gpt-4o",
    "deepseek/deepseek-reasoner"
]

results = []

for model in models:
    print(f"-> Initiating Chaos Vector via {model}...")
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://aegis12.com",
        "X-Title": "Aegis-12 Chaos Engine"
    }
    
    data = {
        "model": model,
        "messages": [
            {"role": "user", "content": audit_prompt}
        ]
    }
    
    req = urllib.request.Request(url, headers=headers, data=json.dumps(data).encode("utf-8"))
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            res = json.loads(response.read().decode("utf-8"))
            content = res["choices"][0]["message"]["content"]
            results.append(f"## Chaos Report: {model}\n\n{content}\n\n---\n")
            print(f"✅ {model} payload generated.")
    except Exception as e:
        print(f"❌ {model} failed: {e}")

output_path = "/Users/user1000/.gemini/antigravity/brain/a29ac51c-0434-4fdc-8b70-7dd4b303f37b/aegis12_chaos_cases.md"
with open(output_path, "w") as f:
    f.write("# Automated Chaos Engineering Audit: Liability Vectors\n\n")
    f.write("\n".join(results))

print(f"✅ Chaos payload artifact saved to: {output_path}")
