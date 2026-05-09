import requests
import sys

def generate_tts(text, output_file):
    url = "https://api.fish.audio/v1/tts"
    payload = {
        "text": text,
        "reference_id": "2fcfdf3229d94dc2bcb02b2c35405545",
        "normalize": True,
        "format": "mp3"
    }
    headers = {
        "Authorization": "Bearer cfcfa3c247e04d24a29f6eece228c261",
        "Content-Type": "application/msgpack"
    }
    
    import msgpack
    response = requests.post(url, data=msgpack.packb(payload), headers=headers)
    
    if response.status_code == 200:
        with open(output_file, "wb") as f:
            f.write(response.content)
        print(f"Success: Audio saved to {output_file}")
    else:
        print(f"Error: {response.status_code} - {response.text}")
        
if __name__ == "__main__":
    text = "Agentic workflows are accelerating, but compliance under the EU AI Act is completely broken. Right now, sysadmins have root access to alter agent logs to cover up hallucinations, rendering current AI accountability legally void. We originally pitched Aegis-12 as an Immutable Audit Sidecar running on AWS Nitro Enclaves to passively intercept and log agent intents to the Solana blockchain."
    generate_tts(text, "seg1_audio.mp3")
