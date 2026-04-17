import time
import json
import urllib.request
import urllib.error
import sys

# Aegis-12 Gateway Production Endpoint
AEGIS_GATEWAY_URL = "https://aegis12-gateway-production.up.railway.app/enforce"

# ANSI Terminal Colors for the "Killer Pitch" visualization
RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
RESET = "\033[0m"
BOLD = "\033[1m"

def print_banner():
    print(f"\n{CYAN}{BOLD}=== [ AEGIS-12 AUTONOMOUS AGENT WORKER ] ==={RESET}")
    print(f"{CYAN}Solana Network: Mainnet-Beta | Hardware: Phala SGX{RESET}\n")

def simulate_ai_reasoning():
    print(f"{YELLOW}[*] AI Worker Context:{RESET} Arbitrage opportunity detected on Raydium.")
    print(f"{YELLOW}[*] AI Worker Intent:{RESET} Swap 500 USDC for 3.2 SOL.")
    time.sleep(1)

    # The raw, naked payload that an agent normally sends directly to QuickNode/Helius
    raw_payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "sendTransaction",
        "params": [
            "base64_encoded_tx_data_USDC_SOL_SWAP_500",
            {"encoding": "base64"}
        ]
    }
    
    print(f"\n{RED}{BOLD}=== [ THE PROBLEM: STRATEGY LEAKAGE ] ==={RESET}")
    print(f"{RED}If we send this directly to the RPC, MEV Searchers will decode it and front-run us:{RESET}")
    print(f"{RED}{json.dumps(raw_payload, indent=2)}{RESET}\n")
    time.sleep(2)
    
    return raw_payload

def shield_via_aegis(raw_payload):
    print(f"{GREEN}{BOLD}=== [ THE SOLUTION: AEGIS-12 SHIELDING ] ==={RESET}")
    print(f"{GREEN}[+] Routing transaction intent to Aegis-12 Phala TEE Enclave...{RESET}")
    
    aegis_payload = {
        "agentId": "solana_arbitrage_bot_01",
        "payload": raw_payload
    }
    
    start_time = time.time()
    
    try:
        req = urllib.request.Request(
            AEGIS_GATEWAY_URL, 
            json.dumps(aegis_payload).encode('utf-8'), 
            {"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode())
    except urllib.error.URLError as e:
        print(f"{RED}[!] Error reaching Aegis-12 Gateway: {e}{RESET}")
        print("Ensure the production gateway is online or switch to localhost:3000.")
        sys.exit(1)
        
    latency = (time.time() - start_time) * 1000
    
    print(f"{GREEN}[+] TEE Attestation & Execution Complete ({latency:.2f}ms){RESET}")
    
    # Extract the obfuscated anchored receipt
    if result.get("enforcementDecision") == "APPROVED":
        anchor = result.get("anchorDetails", {})
        print(f"\n{CYAN}{BOLD}=== [ ON-CHAIN VERIFICATION ] ==={RESET}")
        print(f"{CYAN}Transaction Signature:{RESET} {anchor.get('txSignature')}")
        print(f"{CYAN}Post-Quantum Receipt Hash (SHA-512):{RESET} {anchor.get('receiptHash')}")
        print(f"{CYAN}Status:{RESET} {anchor.get('attestationState')}")
        print(f"{CYAN}Solana Explorer:{RESET} {anchor.get('explorerUrl')}")
        print(f"\n{GREEN}{BOLD}SUCCESS: Alpha protected. MEV searchers only see an opaque SHA-512 hash on-chain.{RESET}\n")
    else:
        print(f"{RED}[!] Transaction Rejected by Aegis Enclave Policy.{RESET}")

if __name__ == "__main__":
    print_banner()
    payload = simulate_ai_reasoning()
    shield_via_aegis(payload)
