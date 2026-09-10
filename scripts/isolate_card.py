import os
import sys
import argparse
import urllib.request
import urllib.parse
from PIL import Image, ImageFilter
import numpy as np
from rembg import remove

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

def process(src, filename, web_dir="web/public/products", enter_dir="enter_/public/products"):
    p1 = os.path.join(web_dir, filename)
    p2 = os.path.join(enter_dir, filename)

    if src.startswith("http://") or src.startswith("https://"):
        req = urllib.request.Request(src, headers={'User-Agent': 'Mozilla/5.0'})
        temp_path = f"/tmp/{filename}.raw.jpg"
        with urllib.request.urlopen(req, timeout=30) as resp, open(temp_path, 'wb') as out:
            out.write(resp.read())
        raw_img = Image.open(temp_path)
    else:
        raw_img = Image.open(src)

    isolated = remove(raw_img)
    arr = np.array(isolated)
    arr = clean_alpha_artifacts(arr)
    cleaned = Image.fromarray(arr)
    card = format_product_card(cleaned)

    os.makedirs(web_dir, exist_ok=True)
    os.makedirs(enter_dir, exist_ok=True)

    card.save(p1, 'PNG', optimize=True)
    card.save(p2, 'PNG', optimize=True)
    print(f"✅ Processed & Saved: {filename}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--src', required=True)
    parser.add_argument('--name', required=True)
    args = parser.parse_args()
    process(args.src, args.name)
