import os
import sys
import json
import urllib.request

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
if not OPENROUTER_API_KEY:
    print("❌ [Auth] OPENROUTER_API_KEY missing.")
    sys.exit(1)

with open("/Users/user1000/.gemini/antigravity/brain/a29ac51c-0434-4fdc-8b70-7dd4b303f37b/aegis12_defensibility_moat_strategy.md", "r") as f:
    moat_strategy = f.read()

audit_prompt = """
You are the Venture Oracle Intelligence Council (a panel of tier-1 crypto infrastructure investors, protocol engineers, and legal compliance officers). Your strict directive is ANTI-SYCOPHANCY. 

The user has proposed a 29-day defensibility moat strategy ('The Trojan Horse Protocol Strategy') for their Aegis-12 Off-Path Telemetry Shield ahead of the Colosseum Hackathon. The strategy relies on three pillars:
1. Open-sourcing the core as an NPM package and proposing a Solana Improvement Document (SIMD).
2. Forcing a massive Pull Request integration into the highly popular `solana-agent-kit`.
3. Executing a Threat Advisory marketing pivot exposing the deanonymization vulnerability to judges.

We need a brutally balanced, high-veracity audit of this exact 29-day plan.
1. Identify the fatal gaps, false assumptions, or execution cliffs in this strategy. Why might Jito/Helius STILL crush them despite this plan, or why might the Solana Agent Kit reject the PR?
2. Provide a strict, sequenced list of execution steps (A Product Backlog) the user must take over the next 29 days to patch these gaps and guarantee the defensibility moat.

Do not compliment the user. Do not use marketing fluff. Return only the clinical audit and the actionable product backlog.

Here is the proposed strategy:
""" + moat_strategy

print("🧠 [Council] Consulting the Elite Reasoning Models...")

models = [
    "anthropic/claude-3.5-sonnet",
    "meta-llama/llama-3.1-70b-instruct"
]

results = []

for model in models:
    print(f"-> Querying {model}...")
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://aegis12.com",
        "X-Title": "Aegis-12 Engine"
    }
    
    data = {
        "model": model,
        "messages": [
            {"role": "user", "content": audit_prompt}
        ],
        "temperature": 0.2
    }
    
    req = urllib.request.Request(url, headers=headers, data=json.dumps(data).encode("utf-8"))
    try:
        with urllib.request.urlopen(req) as response:
            res = json.loads(response.read().decode("utf-8"))
            content = res["choices"][0]["message"]["content"]
            results.append(f"### {model} Verdict\n\n{content}\n\n---\n")
            print(f"✅ {model} finished.")
    except Exception as e:
        print(f"❌ {model} failed: {e}")

with open("/Users/user1000/.gemini/antigravity/brain/a29ac51c-0434-4fdc-8b70-7dd4b303f37b/aegis12_council_moat_feedback.md", "w") as f:
    f.write("# LLM Council: Defensibility Moat Audit\n\n")
    f.write("\n".join(results))

print("✅ Saved to artifacts.")
