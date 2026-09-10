import os
import sys
import argparse
import urllib.request
import urllib.parse
import time
from PIL import Image, ImageFilter
import numpy as np
from rembg import remove

# Load .env
env_path = 'api/.env'
openai_key = None
gemini_key = None
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            t = line.strip()
            if t.startswith('OPENAI_API_KEY='):
                openai_key = t.split('=', 1)[1].strip()
            elif t.startswith('GEMINI_API_KEY='):
                gemini_key = t.split('=', 1)[1].strip()

def clean_alpha_artifacts(arr, min_alpha=30):
    arr[arr[:, :, 3] < min_alpha, 3] = 0
    return arr

def format_product_card(img, canvas_size=1024, target_h=860, blur_radius=0.7):
    bbox = img.getbbox()
    if not bbox:
        raise ValueError("Image has no non-transparent content")
    cropped = img.crop(bbox)
    ratio = target_h / float(cropped.size[1])
    target_w = int(cropped.size[0] * ratio)
    if target_w > 920:
        target_w = 920
        target_h = int(cropped.size[1] * (920.0 / float(cropped.size[0])))
        
    resized = cropped.resize((target_w, target_h), Image.Resampling.LANCZOS)
    
    r, g, b, a = resized.split()
    a_smooth = a.filter(ImageFilter.GaussianBlur(radius=blur_radius))
    resized.putalpha(a_smooth)
    
    canvas = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    x_pos = (canvas_size - target_w) // 2
    y_pos = (canvas_size - target_h) // 2
    canvas.paste(resized, (x_pos, y_pos), resized)
    return canvas

def fetch_image_with_fallback(prompt, filename):
    temp_path = f"/tmp/{filename}.raw.jpg"
    
    # 1. Try Pollinations with multiple retries and backoff
    for attempt in range(3):
        try:
            seed = int(time.time() * 1000) % 900000 + 100000
            encoded = urllib.parse.quote(prompt)
            url = f"https://image.pollinations.ai/prompt/{encoded}?width=1024&height=1024&nologo=true&seed={seed}&model=flux"
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'})
            with urllib.request.urlopen(req, timeout=25) as resp:
                data = resp.read()
                if len(data) > 1000:
                    with open(temp_path, 'wb') as out:
                        out.write(data)
                    return temp_path
        except Exception as e:
            print(f"⚠️ Attempt {attempt+1} failed: {e}. Retrying...")
            time.sleep(2)
            
    # 2. Fallback to basic model if flux timed out
    try:
        encoded = urllib.parse.quote(prompt)
        url = f"https://image.pollinations.ai/prompt/{encoded}?width=800&height=800&nologo=true"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = resp.read()
            with open(temp_path, 'wb') as out:
                out.write(data)
            return temp_path
    except Exception as e:
        raise RuntimeError(f"All image generation attempts failed for {filename}: {e}")

def process(prompt, filename, web_dir="web/public/products", enter_dir="enter_/public/products"):
    p1 = os.path.join(web_dir, filename)
    p2 = os.path.join(enter_dir, filename)

    if os.path.exists(p1) and os.path.exists(p2) and os.path.getsize(p1) > 5000:
        print(f"⏩ Already exists: {filename}")
        return

    print(f"🎨 Generating visual for {filename}...")
    temp_path = fetch_image_with_fallback(prompt, filename)
    
    print(f"✂️ Isolating subject background with rembg...")
    raw_img = Image.open(temp_path)
    isolated = remove(raw_img)
    arr = np.array(isolated)
    arr = clean_alpha_artifacts(arr)
    cleaned = Image.fromarray(arr)
    card = format_product_card(cleaned)

    os.makedirs(web_dir, exist_ok=True)
    os.makedirs(enter_dir, exist_ok=True)

    card.save(p1, 'PNG', optimize=True)
    card.save(p2, 'PNG', optimize=True)
    print(f"✅ Saved 1024x1024 transparent RGBA to {p1} and {p2}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--prompt', required=True)
    parser.add_argument('--name', required=True)
    args = parser.parse_args()
    process(args.prompt, args.name)
