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

# Read the architecture to supply
with open('src/infrastructure/AegisPEP.ts', 'r') as f:
    aegis_pep = f.read()

system_prompt = """
You are the Aegis-12 Venture Oracle Council. The development team has implemented your exact suggestions:
1. Replaced raw JSON limits with EIP-712 Typed Data bounds to thwart 'Blind Sign'.
2. Added UNIX expiresAt mathematical barriers to thwart 'Replay Attacks'.
3. Attached a live OpenRouter LLM script outside the enclave to prove it actively blocks un-mocked stochastic tools.

Your objective:
1. Briefly acknowledge and endorse the new architecture logic.
2. Act as an Adversarial QA Engineer and output ONLY raw, valid TypeScript code for a Jest chaos testing suite targeting `AegisPEP.ts`.
Provide minimum 3 highly adversarial test cases (e.g. valid EIP-712 forged slightly, expired Unix timestamps, extreme Anomaly numeric limits, massive integer underflows, etc).
Return ONLY the raw TypeScript code wrapped in ```typescript ```. Do not provide extensive preamble.
"""

# Use the latest top reasoner model available on OpenRouter
model_id = "openai/gpt-4o-2024-11-20" 

print("💥 [Council] Booting the Chaos Test Generation...")
response = query_model(model_id, system_prompt, f"Here is the upgraded AegisPEP.ts file:\n\n{aegis_pep}")

# Extract TS code block
if "```typescript" in response:
    code = response.split("```typescript")[1].split("```")[0].strip()
elif "```ts" in response:
    code = response.split("```ts")[1].split("```")[0].strip()
else:
    code = response

output_path = "tests/chaos.spec.ts"
os.makedirs("tests", exist_ok=True)
with open(output_path, "w") as f:
    f.write(code)

print(f"✅ Chaos Suite successfully generated and saved to {output_path}")
