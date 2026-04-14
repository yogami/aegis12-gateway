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

# Read the Master Summary we formulated
summary_path = "/Users/user1000/.gemini/antigravity/brain/a29ac51c-0434-4fdc-8b70-7dd4b303f37b/aegis12_master_summary.md"
try:
    with open(summary_path, 'r') as f:
        master_summary = f.read()
except Exception as e:
    print(f"❌ Failed to load Master Summary: {e}")
    sys.exit(1)

system_prompt = """
You are a member of the elite 'Aegis-12 Venture Oracle Council' (a brutal, anti-sycophancy, hype-free security and GTM auditing board).
Do not cheerlead. Do not congratulate the team. Do not use corporate double-speak.
Analyze the provided Aegis-12 Enterprise Architecture Summary.

Your objective:
1. Hunt for gaping liabilities in the 'Dual-Layer Defense Architecture'. Where is the weak link in the cryptographically signed Layer 2 policy injection?
2. Critique the narrative mapping to the EU AI Act (e.g., does hardware TEE execution practically shield against the 'Black Box' legal argument?).
3. Evaluate the 22.08ms Hot-Path / 1201ms ZK Hybrid Cold-Path metrics. Would an institutional HFT deck actually buy this?
4. Find ONE devastating reason why this will fail to win the hackathon, and clearly state how to patch/pivot the narrative to fix it.
"""

models = {
    "DeepSeek v3.2 (Advanced Chinese Core)": "deepseek/deepseek-v3.2",
    "OpenAI GPT-5.4": "openai/gpt-5.4",
    "Anthropic Claude Opus 4.6": "anthropic/claude-opus-4.6"
}

output_path = "/Users/user1000/.gemini/antigravity/brain/a29ac51c-0434-4fdc-8b70-7dd4b303f37b/aegis12_final_audit.md"

with open(output_path, "w") as f:
    f.write("# Aegis-12 Master Architecture: Anti-Sycophancy Council Audit (Advanced 2026 Models)\n\n")

print("💥 [Council] Booting the Master Architecture Audit with 2026 Frontier Models...")

for name, model_id in models.items():
    print(f"-> Engaging {name} ({model_id})...")
    response = query_model(model_id, system_prompt, f"Here is the Master Architecture Document:\n\n{master_summary}")
    
    with open(output_path, "a") as f:
        f.write(f"## {name}\n\n")
        f.write(response + "\n\n---\n\n")

print(f"✅ Master Audit Saved to: {output_path}")
