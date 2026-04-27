import os
import requests
import json
import sys

# OpenRouter API Configuration
API_KEY = "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"
MODELS = [
    "openai/gpt-5.5",
    "openai/o3-pro",
    "deepseek/deepseek-v4",
    "anthropic/claude-4.7"
]

GUARDRAILS = """
[ANTI-HALLUCINATION GUARDRAILS]
1. ONLY report issues that are EXPLICITLY evidenced in the provided source code.
2. DO NOT assume behavior for external dependencies or omitted files (e.g. NonceRegistry, Eip712Verifier) beyond what is visible in their interface calls.
3. PROVIDE EXACT LINE NUMBERS for every finding. If you cannot find a line number, DO NOT report it.
4. DO NOT invent vulnerabilities based on 'best practices' if the code already has a functional equivalent (e.g. don't complain about lack of WAL if a WALEngine is called).
5. RANK findings strictly by impact: P0 (Critical/Runtime), P1 (High/Security), P2 (Medium/Integrity).
"""

FILES_TO_AUDIT = [
    "src/infrastructure/AegisPEP.ts",
    "src/application/PhalaEntrypoint.ts",
    "src/infrastructure/SolanaAnchor.ts",
    "src/infrastructure/AegisLocalStateStore.ts",
    "src/domain/TierEvaluator.ts",
    "src/domain/PolicyValidator.ts"
]

BASE_DIR = "/Users/user1000/gitprojects/aegis12-gateway"

def get_file_content(path):
    full_path = os.path.join(BASE_DIR, path)
    if os.path.exists(full_path):
        with open(full_path, 'r') as f:
            return f.read()
    return f"File {path} not found."

def run_audit(model_id, codebase_context):
    print(f"\n[AUDIT] Running audit with model: {model_id}...")
    prompt = f"""
You are a World-Class Security Researcher and Senior Software Architect. 
Audit the following Aegis-12 TEE Gateway codebase for:
1. Security Vulnerabilities (Replay attacks, JSON bombs, Type confusion, precision loss).
2. Code Quality (Cyclomatic complexity, SOLID violations, Class/Method length).
3. TEE-specific risks (State consistency, Hardware init race conditions).

Codebase Context:
{codebase_context}

{GUARDRAILS}

Provide a ruthless, evidence-backed audit report. provide a prioritized Hardening Backlog.
"""
    
    try:
        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://aegis12.io", # Optional
                "X-Title": "Aegis-12 Security Audit"
            },
            data=json.dumps({
                "model": model_id,
                "messages": [
                    {"role": "user", "content": prompt}
                ]
            }),
            timeout=120
        )
        if response.status_code == 200:
            result = response.json()
            return result['choices'][0]['message']['content']
        else:
            return f"Error {response.status_code}: {response.text}"
    except Exception as e:
        return f"Exception: {str(e)}"

if __name__ == "__main__":
    context = ""
    for f in FILES_TO_AUDIT:
        content = get_file_content(f)
        context += f"\n--- FILE: {f} ---\n{content}\n"

    results = {}
    for model in MODELS:
        report = run_audit(model, context)
        results[model] = report
        
    output_path = os.path.join(BASE_DIR, "scratch/multi_model_audit_report.json")
    with open(output_path, 'w') as f:
        json.dump(results, f, indent=4)
    
    print(f"\n[DONE] Multi-model audit complete. Report saved to {output_path}")
