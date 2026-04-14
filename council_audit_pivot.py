import os
import sys
import json
import urllib.request
from dotenv import load_dotenv

load_dotenv()
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

if not OPENROUTER_API_KEY:
    print("❌ [Auth] OPENROUTER_API_KEY missing.")
    sys.exit(1)

def query_model(model, system_prompt, user_prompt):
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://aegis12.com",
        "X-Title": "Aegis-12 Intelligence Council"
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
        with urllib.request.urlopen(req, timeout=180) as response:
            res = json.loads(response.read().decode("utf-8"))
            return res["choices"][0]["message"]["content"]
    except Exception as e:
        return f"Error querying {model}: {str(e)}"

# Read the upgraded Pivot files
try:
    with open('src/infrastructure/AegisPEP.ts', 'r') as f:
        aegis_pep = f.read()
    with open('scripts/live_ai_intercept.ts', 'r') as f:
        ai_intercept = f.read()
except Exception as e:
    print(f"❌ Failed to load source files: {e}")
    sys.exit(1)

system_prompt = """
You are a member of the elite 'Aegis-12 Venture Oracle Council' (a brutal, anti-sycophancy security and GTM auditing board evaluating hackathon candidates).
The development team has just completed a massive structural pivot to address your previous criticisms:
1. They removed RAW JSON policy ingestion and upgraded to EIP-712 Typed Data Cryptographic schemas dynamically evaluating `chainId`, `version`, `expiresAt`, and `nonce`.
2. They removed the mocked LLM payload generation and wrote a script that polls OpenRouter for a LIVE foundation model generating a non-deterministic Tool-Call, which is then thrown into the deterministic TEE layer bounds.

Your objective:
1. Conduct a brutal, hype-free security analysis on this new pivot. 
2. Did they actually close the "Toy Implementation" critique? Is this now an enterprise-grade defense perimeter against unpredictable AI?
3. What is the one remaining micro-vulnerability they must acknowledge in their final Colosseum presentation? Ensure your critique is under 300 words.
"""

models = {
    "Deep-Math Pillar (DeepSeek v3.2)": "deepseek/deepseek-v3.2",
    "OpenAI Pillar (Enterprise Scale)": "openai/gpt-5.4-pro",
    "Anthropic Pillar (Systems Alignment)": "anthropic/claude-sonnet-4.6",
    "Asian Compute Pillar (HFT Reality)": "qwen/qwen3.6-plus"
}

output_path = "/Users/user1000/.gemini/antigravity/brain/a29ac51c-0434-4fdc-8b70-7dd4b303f37b/aegis12_pivot_council_evaluation.md"

with open(output_path, "w") as f:
    f.write("# Aegis-12: The Unmocked Pivot Council Evaluation\n\n")

print("💥 [Council] Booting the Architectural Pivot Evaluation with OpenRouter Models...")

payload = f"Here is the upgraded AegisPEP.ts (The TEE Rule Engine):\n\n```typescript\n{aegis_pep}\n```\n\nHere is the live_ai_intercept.ts (The newly active Unmocked AI generator that tests AegisPEP constraints in real-time):\n\n```typescript\n{ai_intercept}\n```"

for name, model_id in models.items():
    print(f"-> Engaging {name} ({model_id})...")
    response = query_model(model_id, system_prompt, payload)
    
    with open(output_path, "a") as f:
        f.write(f"## {name}\n\n")
        f.write(response + "\n\n---\n\n")

print(f"✅ Council Pivot Analysis Saved to: {output_path}")
