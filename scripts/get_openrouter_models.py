import urllib.request
import json

url = "https://openrouter.ai/api/v1/models"

try:
    with urllib.request.urlopen(url) as response:
        data = json.loads(response.read().decode())
        
        print("Available DeepSeek Models:")
        for m in data['data']:
            if "deepseek" in m['id'].lower():
                print(f" - {m['id']}")
                
        print("\nAvailable Anthropic/Claude Models:")
        for m in data['data']:
            if "claude" in m['id'].lower():
                print(f" - {m['id']}")

        print("\nAvailable OpenAI Models:")
        for m in data['data']:
            if "gpt-5" in m['id'].lower() or "gpt-4" in m['id'].lower():
                print(f" - {m['id']}")

        print("\nAvailable Qwen/GLM Models:")
        for m in data['data']:
            if "qwen" in m['id'].lower() or "glm" in m['id'].lower():
                print(f" - {m['id']}")

except Exception as e:
    print(f"Error fetching models: {e}")
