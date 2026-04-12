import os
import sys
import json
import urllib.request
import time

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
if not OPENROUTER_API_KEY:
    print("❌ [Auth] OPENROUTER_API_KEY environment variable is missing. Terminal execution aborted.")
    sys.exit(1)

GATEWAY_URL = "https://aegis12-gateway.up.railway.app/api/execute"

def think_and_generate_strategy():
    print("🧠 [Agent_Worker] Initializing LangChain-style reasoning loop via OpenRouter...")
    url = "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json"
    }
    
    sys_prompt = "You are a quantitative Solana trading agent. Return EXACTLY a raw JSON object and absolutely nothing else. Format: {\"agent_id\": \"qwen-alpha-2026\", \"intent\": \"arbitrage\", \"target_pool\": \"RAY-USDC\", \"target_rate\": [float]}"
    
    data = {
        "model": "qwen/qwen-max",
        "messages": [
            {"role": "system", "content": sys_prompt},
            {"role": "user", "content": "Analyze current volatility. Output your tactical AMM routing strategy JSON."}
        ],
        "temperature": 0.4
    }
    
    req = urllib.request.Request(url, headers=headers, data=json.dumps(data).encode("utf-8"))
    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode("utf-8"))
            content = result["choices"][0]["message"]["content"]
            content = content.replace("```json", "").replace("```", "").strip()
            print(f"✅ [Agent_Worker] Strategy Locked: {content}")
            return json.loads(content)
    except Exception as e:
        print(f"❌ [Agent_Worker] Strategy Generation Failed: {e}")
        return {"agent_id": "fallback_worker", "intent": "obfuscate"}

def execute_through_aegis_gateway(payload):
    print("🛡️ [Agent_Worker] Routing payload through Aegis-12 Compliance Gateway...")
    headers = {"Content-Type": "application/json"}
    req = urllib.request.Request(GATEWAY_URL, headers=headers, data=json.dumps(payload).encode("utf-8"), method="POST")
    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode("utf-8"))
            print("✅ [Aegis-12 Response] Execution Successful!")
            print(json.dumps(result, indent=2))
            return result
    except Exception as e:
        print(f"❌ [Aegis-12 Response] Gateway Error: {e}")
        return None

if __name__ == "__main__":
    strategy_payload = think_and_generate_strategy()
    
    gateway_response = execute_through_aegis_gateway(strategy_payload)
    
    if gateway_response and gateway_response.get("status") == 200:
        print(f"\n🔐 HASH TRACE: {gateway_response['compliance']['sha256_anchor']}")
        print(f"🔗 EXPLORER LINK: {gateway_response['compliance']['explorer_url']}")
        
        signature = gateway_response["compliance"].get("signature")
        if signature:
            print("\n🔎 Verifying Compliance via public /api/verify endpoint...")
            verify_url = "https://aegis12-gateway.up.railway.app/api/verify"
            verify_data = {
                "signature": signature,
                "payload": strategy_payload
            }
            v_req = urllib.request.Request(verify_url, headers={"Content-Type": "application/json"}, data=json.dumps(verify_data).encode("utf-8"), method="POST")
            try:
                 with urllib.request.urlopen(v_req) as v_res:
                     v_result = json.loads(v_res.read().decode("utf-8"))
                     print("✅ [Verifier] " + json.dumps(v_result, indent=2))
            except Exception as e:
                 print("⚠️ [Verifier] Could not dynamically verify via API. Rate limit or missing signature.")
        else:
            print("\n⚠️ [Verifier] Skipping verification: no valid signature returned (Faucet Rate Limits locked Devnet loop). Inject Mainnet Key to unleash.")
