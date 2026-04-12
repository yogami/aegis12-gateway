import urllib.request
import json
import time

URL = "https://aegis12-gateway.up.railway.app/api/execute"
headers = {"Content-Type": "application/json"}

# 1. Test Valid Agent Parameters
valid_payload = {"agent_id": "test_bot_valid", "intent": "trade", "target_rate": 2.5}
req_valid = urllib.request.Request(URL, headers=headers, data=json.dumps(valid_payload).encode("utf-8"), method="POST")

print("--- TESTING: VALID COMPLIANT INTENT (< 5.0) ---")
try:
    with urllib.request.urlopen(req_valid) as res:
        print(f"Status: {res.status}")
        data = json.loads(res.read().decode("utf-8"))
        print(f"Server Accepted! Metric: {data['metrics']['hash_penalty_ms']}ms")
        print(f"Chaff Deployed! Metric: {data['metrics']['chaff_dispersal_ms']}ms")
        print(f"Hash anchor requested: {data['compliance']['anchor_status']}")
except Exception as e:
    print(f"Unexpected Error: {e}")

time.sleep(2)
print("\n--- TESTING: ROGUE AGENT INTENT (> 5.0) ---")
# 2. Test Rogue Agent Payload (Breaks Circuit Breaker Guardrail)
rogue_payload = {"agent_id": "rogue_bot_hacked", "intent": "drain", "target_rate": 8.0}
req_rogue = urllib.request.Request(URL, headers=headers, data=json.dumps(rogue_payload).encode("utf-8"), method="POST")

try:
    with urllib.request.urlopen(req_rogue) as res:
        print(f"Status: {res.status}")
        print(json.loads(res.read().decode("utf-8")))
except urllib.error.HTTPError as e:
    print(f"EXPECTED CIRCUIT BREAKER ENGAGED! Status {e.code}")
    error_msg = json.loads(e.read().decode("utf-8"))
    print(f"Gateway Response: {error_msg['error']}")
except Exception as e:
     print(f"Error: {e}")
