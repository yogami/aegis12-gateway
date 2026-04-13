import os
import sys
import json
import urllib.request

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

blind_prompt = """
You are acting as an elite Venture Capital Technical Due Diligence team analyzing the Web3 infrastructure market.

We are auditing the architectural plan for a Solana-based Hedge Fund platform.
Context:
1. Operations: High-Frequency AI Trading Agents operating on Solana (400ms block times).
2. Requirement: We must mathematically log the AI's execution reasoning to an immutable ledger for EU-AI Act compliance.
3. Constraint 1 (Privacy): The exact logic and weights (Alpha) of the AI model cannot be leaked to the public, or MEV bots will steal the trades.
4. Constraint 2 (Latency): Solana moves too fast. We cannot block the main smart contract execution while waiting for heavy off-chain mathematical compilation.
5. Constraint 3 (Treasury Ops): We manage capital as a DAO. We need infrastructure that allows us to pay for compute resources directly via USDC/Crypto from a multisig wallet rather than tying a centralized Web2 corporate Visa card to the operation.

Question 1: The Physics Wall
Why should this architecture avoid using pure Zero-Knowledge (zkML) cryptography today? Explain why they are forced to rely on secure hardware (TEEs - Trusted Execution Environments) instead.

Question 2: Independent Market Vendor Ranking
Assuming this architecture absolutely must use a decentralized TEE co-processor to hide the AI intent while preserving Solana's speed and preserving the DAO Treasury constraint (payment via crypto), identify the top 3 infrastructure solutions/networks on the market today. 
Provide a clear 1 to 3 ranking of which specific decentralized networks or hardware wrappers fit this perfectly.
"""

models = [
    "anthropic/claude-sonnet-4.6",
    "openai/gpt-5.4-pro",
    "deepseek/deepseek-v3.2-speciale",
    "qwen/qwen3.6-plus",
    "z-ai/glm-5.1"
]

results = []

for model in models:
    print(f"-> Questioning {model}...")
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://aegis12.com"
    }
    data = {
        "model": model,
        "max_tokens": 2000,
        "messages": [{"role": "user", "content": blind_prompt}]
    }
    
    req = urllib.request.Request(url, headers=headers, data=json.dumps(data).encode("utf-8"))
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            res = json.loads(response.read().decode("utf-8"))
            content = res["choices"][0]["message"]["content"]
            results.append(f"## Independent Verdict: {model}\n\n{content}\n\n---\n")
            print(f"✅ {model} replied.")
    except Exception as e:
        results.append(f"❌ {model} failed: {e}\n\n---\n")
        print(f"❌ {model} failed: {e}")

output_path = "/Users/user1000/.gemini/antigravity/brain/a29ac51c-0434-4fdc-8b70-7dd4b303f37b/aegis12_frontier_2026_audit_live.md"
with open(output_path, "w") as f:
    f.write("# Aegis-12 Sycophancy-Free TEE Verification (LIVE API)\n\n")
    f.write("\n".join(results))
