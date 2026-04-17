import os
import json
import urllib.request
import urllib.error

OPENROUTER_API_KEY = "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"

def get_codebase():
    allowed_exts = {'.ts'}
    
    codebase = []
    
    for root, dirs, files in os.walk('./src'):
        for file in files:
            ext = os.path.splitext(file)[1]
            if ext in allowed_exts:
                path = os.path.join(root, file)
                
                try:
                    with open(path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        codebase.append(f"--- {path} ---\n{content}\n")
                except Exception:
                    pass
    
    return "\n".join(codebase)

def query_openrouter(model_id, prompt):
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://berlinai.studio",
        "X-Title": "Aegis Security Audit"
    }
    
    data = {
        "model": model_id,
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ]
    }
    
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=headers, method='POST')
    
    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            return result['choices'][0]['message']['content']
    except urllib.error.HTTPError as e:
        return f"HTTP Error: {e.code} - {e.read().decode('utf-8')}"
    except Exception as e:
        return f"Error: {str(e)}"

if __name__ == "__main__":
    print("Bundling codebase (src/ only)...")
    codebase = get_codebase()
    
    prompt = f"""
You are an elite Security and Code Quality Architect for the Berlin AI Studio.
Conduct a "Multi-Model Security Council Gate" audit of the following Aegis-12 TEE Compliance Gateway codebase.
Focus on:
1. Architectural Integrity & Potential Security Vulnerabilities
2. Code Craftsmanship (Complexity, SOLID principles)
3. Cryptographic/TEE enforcement verification (EIP-712, WAL, etc.)

**CRITICAL INSTRUCTION FOR FINAL REVIEW:**
If the core cryptographic claims (EIP-712 binding, WAL atomic locks, TEE entropy checks, ZK seal hashing, Fastify payload validation, X402 replay protection) are correctly implemented, you MUST issue a final `GREENLIGHT`. Do not fall into an endless loop of nitpicking minor code craftsmanship issues if the fundamental threat model is secure.

You must also generate a revised `vc-adversarial-suite-v2.ts` in your response. This test suite must provide black-box guarantees that whatever the VCs expect to see and whatever we promise is validated on production. That test suite should ensure that any false claims we would make would be exposed in future when the tests fail. Provide this test suite as a typescript code block in your response.

Provide a strict, professional analysis. Output should be formatted in Markdown.

Codebase:
{codebase}
    """
    
    print(f"Codebase size: {len(prompt)} characters. Sending to OpenRouter...")
    
    print("Running Claude Opus 4.7 audit...")
    claude_result = query_openrouter("anthropic/claude-opus-4.7", prompt)
    with open("claude_audit.md", "w") as f:
        f.write(claude_result)
    print("Claude audit saved to claude_audit.md")
    
    print("Running O3 Pro audit...")
    o3_result = query_openrouter("openai/o3-pro", prompt)
    with open("o3_audit.md", "w") as f:
        f.write(o3_result)
    print("O3 audit saved to o3_audit.md")
    
    print("Audit process completed.")
