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

# Read the final architected files
try:
    with open('src/infrastructure/AegisPEP.ts', 'r') as f:
        aegis_pep = f.read()
    with open('tests/chaos.spec.ts', 'r') as f:
        chaos_suite = f.read()
except Exception as e:
    print(f"❌ Failed to load source files: {e}")
    sys.exit(1)

base_prompt = """
The development team has just completed the FINAL Zero-Trust cryptographic hardening phase of the Aegis-12 Compliance Gateway.
We implemented an Immutable Root of Trust (tenantTrustStore) directly into the Phala TEE simulator, and we implemented aggressive Payload Sanitization algorithms that mathematically strip all non-deterministic LLM hallucinations before hashing the receipt.

Your objective:
Review the FINAL architecture of AegisPEP.ts and the resulting proof-of-work in chaos.spec.ts. 
Be absolutely brutal. Strip out all sycophancy. Validate if the system is truly Go-To-Market ready for your specific persona.
Keep your response under 300 words.
"""

models = {
    "DeepSeek v3.2 (The Red Team Hacker)": ("deepseek/deepseek-v3.2", f"You are an elite, offensive security Red-Team Cryptographer specializing in TEE vulnerabilities.\n{base_prompt}"),
    "OpenAI GPT-5.4 (The GTM Venture Capitalist)": ("openai/gpt-5.4", f"You are a Tier-1 Silicon Valley Venture Capitalist who aggressively roasts technical moats to find Go-To-Market and Unit Economic flaws.\n{base_prompt}"),
    "Claude Sonnet 4.6 (The Colosseum Judge)": ("anthropic/claude-sonnet-4.6", f"You are a Ph.D. Level Frontier Hackathon Judge evaluating submissions for empirical, mathematical soundness. You hate sycophancy and hype, you only care about real cryptographic implementation.\n{base_prompt}"),
    "Qwen 3.6-plus (The Fortune 500 CISO)": ("qwen/qwen3.6-plus", f"You are the brutally pragmatic CISO of a multi-billion dollar Hedge Fund. You only care about catastrophic liability, compliance moats, and evidence trails.\n{base_prompt}")
}

output_path = "/Users/user1000/.gemini/antigravity/brain/a29ac51c-0434-4fdc-8b70-7dd4b303f37b/aegis12_persona_final_audit.md"

with open(output_path, "w") as f:
    f.write("# Aegis-12: The Final Persona-Based Go-To-Market Audit\n\n")

print("💥 [Council] Booting the Final Persona Audit with OpenRouter Frontline Models...")

payload = f"Here is the finalized AegisPEP.ts (The Secure TEE Engine with Root of Trust):\n\n```typescript\n{aegis_pep}\n```\n\nHere is the Chaos Test Suite proving the defense parameters natively:\n\n```typescript\n{chaos_suite}\n```"

for name, (model_id, sys_prompt) in models.items():
    print(f"-> Engaging {name}...")
    response = query_model(model_id, sys_prompt, payload)
    
    with open(output_path, "a") as f:
        f.write(f"## {name}\n\n")
        f.write(response + "\n\n---\n\n")

print(f"✅ Final Persona Analysis Saved to: {output_path}")
