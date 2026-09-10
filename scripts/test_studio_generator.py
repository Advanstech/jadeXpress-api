import os
import re
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

def create_now_product_card(product_name, strength="", count_form=""):
    # Load base reference NOW bottle
    base_ref = Image.open("web/public/products/now-foods-ashwagandha-450mg-90c.png").convert("RGBA")
    
    # We create a clean 1024x1024 RGBA canvas
    card = base_ref.copy()
    draw = ImageDraw.Draw(card)
    
    # Label bounding area on standard NOW 1024x1024 bottle
    # x: 380 to 650, y: 440 to 680 (the text area between top orange band and bottom orange footer)
    
    # Create clean label patch with subtle gradient/texture matching NOW bottle label
    label_box = (382, 450, 648, 660)
    
    # Fill label text area with clean off-white / soft satin label background
    # We sample the label background color from (512, 460)
    bg_color = card.getpixel((512, 460))
    # Fill inner label with slight soft blur overlay
    patch = Image.new('RGBA', (label_box[2] - label_box[0], label_box[3] - label_box[1]), bg_color)
    card.paste(patch, (label_box[0], label_box[1]))
    
    # Try finding system fonts
    font_bold = None
    font_med = None
    font_small = None
    
    font_paths = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Supplemental/Helvetica.ttc",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial Bold.ttf"
    ]
    for fp in font_paths:
        if os.path.exists(fp):
            try:
                font_bold = ImageFont.truetype(fp, 26)
                font_large_bold = ImageFont.truetype(fp, 32)
                font_med = ImageFont.truetype(fp, 20)
                font_small = ImageFont.truetype(fp, 16)
                break
            except:
                pass
    
    if not font_bold:
        font_bold = font_med = font_small = ImageFont.load_default()
        font_large_bold = font_bold

    # Clean product title
    # e.g. "NOW ASTAXANTHIN 4MG 90'S GELS" -> "Astaxanthin", "4 mg", "90 Softgels"
    clean_title = product_name
    clean_title = re.sub(r'^NOW\s+', '', clean_title, flags=re.IGNORECASE)
    clean_title = re.sub(r'\s*\d+\s*(\'S|S)?\s*(CAP|TAB|GEL|SOFTGEL|VCAPS|LOZ|LOZENGE|RAW|PWD|POWDER|SEED|LIQUID).*$', '', clean_title, flags=re.IGNORECASE)
    clean_title = re.sub(r'\s*\d+\s*(MG|MCG|IU|OZ|LB|GM|G)\b.*$', '', clean_title, flags=re.IGNORECASE).strip()
    
    # Draw Product Title (Navy Blue #0c2340 or Dark Slate #1a2b49)
    title_color = (18, 38, 74, 255)
    orange_color = (228, 93, 20, 255)
    dark_gray = (55, 65, 81, 255)
    
    # Split title into lines if long
    words = clean_title.title().split()
    lines = []
    curr = []
    for w in words:
        curr.append(w)
        if len(" ".join(curr)) > 14:
            lines.append(" ".join(curr[:-1]))
            curr = [w]
    if curr:
        lines.append(" ".join(curr))
        
    y_text = 465
    for line in lines[:2]:
        bbox = draw.textbbox((0, 0), line, font=font_large_bold)
        w = bbox[2] - bbox[0]
        x = 515 - (w // 2)
        draw.text((x, y_text), line, fill=title_color, font=font_large_bold)
        y_text += 36
        
    # Draw Strength if available
    if strength:
        bbox = draw.textbbox((0, 0), strength, font=font_bold)
        w = bbox[2] - bbox[0]
        x = 515 - (w // 2)
        draw.text((x, y_text + 4), strength, fill=orange_color, font=font_bold)
        y_text += 32
        
    # Draw Count / Form
    if count_form:
        bbox = draw.textbbox((0, 0), count_form, font=font_med)
        w = bbox[2] - bbox[0]
        x = 515 - (w // 2)
        draw.text((x, y_text + 6), count_form, fill=dark_gray, font=font_med)
        
    # Bottom Benefit tag
    draw.text((450, 625), "• High Potency •", fill=(100, 110, 120, 255), font=font_small)

    return card

if __name__ == '__main__':
    card = create_now_product_card("NOW Astaxanthin", strength="4 mg", count_form="90 Softgels")
    os.makedirs("scratch", exist_ok=True)
    card.save("scratch/test_now_card.png")
    print("✅ Created test card at scratch/test_now_card.png")
