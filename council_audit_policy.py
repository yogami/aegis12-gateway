import os
import sys
import json
import urllib.request

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
        with urllib.request.urlopen(req, timeout=120) as response:
            res = json.loads(response.read().decode("utf-8"))
            return res["choices"][0]["message"]["content"]
    except Exception as e:
        return f"Error querying {model}: {str(e)}"

# Define the Context for the Council
context = """
The Aegis-12 TEE currently relies on highly simplistic, hardcoded TypeScript logic embedded inside the Intel SGX Hardware Enclave.
For example, the DeFi matrix uses:
`if (context.currentAnomalyScore > 0.8) { deny(); }`
`if (agent.purpose === 'financial_operations' && estimatedValue > 100_000) { deny(); }`

The Healthcare matrix uses a hardcoded regex:
`blockedDataPatterns: [/\b\d{3}-\d{2}-\d{4}\b/]`

The user is concerned that these checks are too simplistic to impress hackathon judges and wants an architectural path to EXTRICATE these rules from the TypeScript codebase, allowing clients/users to dynamically configure and inject them in a cryptographically secure way that hackers cannot intercept or modify.
"""

# Debate Roles
proposer_prompt = "You are the Optimistic Architect (Proposer). Given the user's concerns about the simplistic hardcoded policies, draft an impressive, realistic architectural solution that extracts these policies out of the Typescript code. The solution must allow dynamic user configuration while maintaining the cryptographic security guarantee of the hardware TEE (Intel SGX). Provide a strong argument for why this architecture is highly defensible and hackathon-ready."

critic_prompt = "You are Grok, the Vicious Critic. Your role is anti-sycophancy. Ruthlessly tear apart the current hardcoded checks (anomaly > 0.8, regex) as being embarrassingly simplistic. Then, attack the Proposer's newly suggested architecture for extracting these policies. Hunt for edge cases, injection vulnerabilities, and architectural hype where hackers could manipulate the dynamic injection. Do not hold back."

resolver_prompt = "You are the Master Judge (Resolver). You have reviewed the Proposer's architecture and the Critic's brutal teardown. Synthesize a final, hype-free, mathematically sound architectural verdict. Clearly articulate how Aegis-12 will securely extract hardcoded policies into dynamic, user-configurable JSON/OPA configurations without opening an attack vector to hackers. Produce the final technical recommendation for the hackathon judges."

print("💥 [Council] Booting the Anti-Sycophancy Policy Debate...")

print("-> Triggering Proposer (GPT-4o) ...")
proposer_response = query_model("openai/gpt-4o", proposer_prompt, context)

print("-> Triggering Critic (DeepSeek Reasoner) ...")
critic_input = f"{context}\n\nThe Proposer suggested this architecture:\n{proposer_response}\n\nExecute your brutal teardown."
critic_response = query_model("deepseek/deepseek-reasoner", critic_prompt, critic_input)

print("-> Triggering Resolver (Claude-3.5-Sonnet) ...")
resolver_input = f"{context}\n\nPROPOSER'S ARGUMENT:\n{proposer_response}\n\nCRITIC'S ATTACK:\n{critic_response}\n\nDeliver the final verdict."
resolver_response = query_model("anthropic/claude-3.5-sonnet", resolver_prompt, resolver_input)

output_path = "/Users/user1000/.gemini/antigravity/brain/a29ac51c-0434-4fdc-8b70-7dd4b303f37b/aegis12_policy_debate.md"
with open(output_path, "w") as f:
    f.write("# Aegis-12 Anti-Sycophancy Policy Debate\n\n")
    f.write("## 1. The Proposer Architect (GPT-4o)\n")
    f.write(proposer_response + "\n\n---\n\n")
    f.write("## 2. The Vicious Critic (DeepSeek Reasoner)\n")
    f.write(critic_response + "\n\n---\n\n")
    f.write("## 3. The Master Synthesizer (Claude 3.5 Sonnet)\n")
    f.write(resolver_response + "\n\n")

print(f"✅ Output saved to: {output_path}")
