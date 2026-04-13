import os
import sys
import json
import urllib.request

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
if not OPENROUTER_API_KEY:
    print("❌ [Auth] OPENROUTER_API_KEY missing.")
    sys.exit(1)

with open("/Users/user1000/.gemini/antigravity/brain/a29ac51c-0434-4fdc-8b70-7dd4b303f37b/aegis12_gtm_playbook_debate.md", "r") as f:
    playbook_content = f.read()

audit_prompt = playbook_content + "\n\nProvide your clinical audit."

print("🧠 [Council] Consulting the Elite Reasoning Models...")

models = [
    "anthropic/claude-3-opus",
    "meta-llama/llama-3-70b-instruct"
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

with open("/Users/user1000/.gemini/antigravity/brain/a29ac51c-0434-4fdc-8b70-7dd4b303f37b/aegis12_council_gtm_feedback.md", "w") as f:
    f.write("# LLM Council: 30-Day GTM & Moat Audit\n\n")
    f.write("\n".join(results))

print("✅ Saved to artifacts.")
