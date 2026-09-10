import os
import json
import urllib.request

env_path = 'api/.env'
openai_key = None
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            t = line.strip()
            if t.startswith('OPENAI_API_KEY='):
                openai_key = t.split('=', 1)[1].strip()

print("Key available:", bool(openai_key))

req_data = json.dumps({
    "model": "dall-e-3",
    "prompt": "Commercial studio product packaging shot of 21st Century Biotin 10,000 mcg 120 Tablets supplement bottle on white background, sharp focus",
    "n": 1,
    "size": "1024x1024"
}).encode('utf-8')

req = urllib.request.Request(
    "https://api.openai.com/v1/images/generations",
    data=req_data,
    headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {openai_key}"
    }
)

try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        print("Generated URL:", res['data'][0]['url'])
except Exception as e:
    print("Error:", e)
