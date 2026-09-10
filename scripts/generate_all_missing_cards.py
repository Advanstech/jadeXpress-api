import os
import re
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

web_dir = "web/public/products"
enter_dir = "enter_/public/products"
os.makedirs(web_dir, exist_ok=True)
os.makedirs(enter_dir, exist_ok=True)

# Find system fonts
font_bold_28 = None
font_bold_24 = None
font_bold_20 = None
font_med_18 = None
font_small_14 = None

font_paths = [
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/System/Library/Fonts/Supplemental/Helvetica.ttc",
    "/System/Library/Fonts/Helvetica.ttc",
    "/Library/Fonts/Arial Bold.ttf"
]
for fp in font_paths:
    if os.path.exists(fp):
        try:
            font_bold_28 = ImageFont.truetype(fp, 28)
            font_bold_24 = ImageFont.truetype(fp, 24)
            font_bold_20 = ImageFont.truetype(fp, 20)
            font_med_18 = ImageFont.truetype(fp, 18)
            font_small_14 = ImageFont.truetype(fp, 14)
            break
        except:
            pass

if not font_bold_28:
    font_bold_28 = font_bold_24 = font_bold_20 = font_med_18 = font_small_14 = ImageFont.load_default()

def parse_product_info(name):
    # Extract strength (e.g. 500mg, 10,000mcg, 1000iu, 16 oz, 1.5lb)
    m_str = re.search(r'(\d+[\d,]*\s*(?:mg|mcg|iu|oz|lb|gm|g|ml))\b', name, flags=re.IGNORECASE)
    strength = m_str.group(1).upper() if m_str else ""
    
    # Extract count and form (e.g. 60's cap, 100's tab, 90 softgels, 16 teabags, powder)
    m_count = re.search(r'(\d+[\d,]*)\s*(\'s|s)?\s*[:\s]*\s*(cap|tab|gel|softgel|softgels|vcaps|lozenge|loz|teabag|teabags|powder|raw|liquid|seed|chewable)', name, flags=re.IGNORECASE)
    if m_count:
        qty = m_count.group(1)
        form_raw = m_count.group(3).lower()
        form_map = {
            'cap': 'Capsules', 'caps': 'Capsules', 'vcaps': 'Veggie Capsules',
            'tab': 'Tablets', 'gel': 'Softgels', 'softgel': 'Softgels', 'softgels': 'Softgels',
            'loz': 'Lozenges', 'lozenge': 'Lozenges', 'teabag': 'Tea Bags', 'teabags': 'Tea Bags',
            'powder': 'Powder', 'raw': 'Raw Whole', 'liquid': 'Liquid', 'seed': 'Seeds', 'chewable': 'Chewables'
        }
        count_form = f"{qty} {form_map.get(form_raw, form_raw.title())}"
    else:
        count_form = ""
        
    # Clean clean name
    clean_name = name
    clean_name = re.sub(r'^(NOW|21ST|TM)\s+', '', clean_name, flags=re.IGNORECASE)
    clean_name = re.sub(r'\s*\d+[\d,]*\s*(?:mg|mcg|iu|oz|lb|gm|g|ml)\b.*$', '', clean_name, flags=re.IGNORECASE)
    clean_name = re.sub(r'\s*\d+[\d,]*\s*(\'s|s)?\s*[:\s]*\s*(cap|tab|gel|softgel|softgels|vcaps|lozenge|loz|teabag|powder|raw|liquid|seed|chewable).*$', '', clean_name, flags=re.IGNORECASE)
    clean_name = re.sub(r'[:;,]+', '', clean_name).strip()
    
    return clean_name.title(), strength, count_form

def generate_now_card(name, out_filename):
    base = Image.open("web/public/products/now-foods-ashwagandha-450mg-90c.png").convert("RGBA")
    card = base.copy()
    draw = ImageDraw.Draw(card)
    
    label_box = (382, 450, 648, 660)
    bg_color = card.getpixel((512, 460))
    patch = Image.new('RGBA', (label_box[2] - label_box[0], label_box[3] - label_box[1]), bg_color)
    card.paste(patch, (label_box[0], label_box[1]))
    
    clean_title, strength, count_form = parse_product_info(name)
    
    title_color = (18, 38, 74, 255)
    orange_color = (228, 93, 20, 255)
    dark_gray = (55, 65, 81, 255)
    
    words = clean_title.split()
    lines = []
    curr = []
    for w in words:
        curr.append(w)
        if len(" ".join(curr)) > 13:
            lines.append(" ".join(curr[:-1]))
            curr = [w]
    if curr:
        lines.append(" ".join(curr))
        
    y_text = 465
    for line in lines[:2]:
        bbox = draw.textbbox((0, 0), line, font=font_bold_28)
        w = bbox[2] - bbox[0]
        x = 515 - (w // 2)
        draw.text((x, y_text), line, fill=title_color, font=font_bold_28)
        y_text += 34
        
    if strength:
        bbox = draw.textbbox((0, 0), strength, font=font_bold_24)
        w = bbox[2] - bbox[0]
        x = 515 - (w // 2)
        draw.text((x, y_text + 4), strength, fill=orange_color, font=font_bold_24)
        y_text += 30
        
    if count_form:
        bbox = draw.textbbox((0, 0), count_form, font=font_med_18)
        w = bbox[2] - bbox[0]
        x = 515 - (w // 2)
        draw.text((x, y_text + 4), count_form, fill=dark_gray, font=font_med_18)
        
    draw.text((455, 625), "• High Potency •", fill=(100, 110, 120, 255), font=font_small_14)
    
    save_card(card, out_filename)

def generate_21st_card(name, out_filename):
    # Use 21st century 1024x1024 reference (or format 21st century advanced probiotic into 1024x1024)
    ref = Image.open("web/public/products/21st-century-advanced-probiotic-60s.png").convert("RGBA")
    
    # Place on 1024x1024 canvas
    ratio = 860.0 / float(ref.size[1])
    target_w = int(ref.size[0] * ratio)
    resized = ref.resize((target_w, 860), Image.Resampling.LANCZOS)
    
    canvas = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    x_pos = (1024 - target_w) // 2
    y_pos = 82
    canvas.paste(resized, (x_pos, y_pos), resized)
    
    draw = ImageDraw.Draw(canvas)
    
    # Label patch area on 21st bottle
    lx1 = x_pos + int(target_w * 0.16)
    lx2 = x_pos + int(target_w * 0.84)
    ly1 = y_pos + int(860 * 0.44)
    ly2 = y_pos + int(860 * 0.74)
    
    bg_color = canvas.getpixel((512, ly1 + 10))
    patch = Image.new('RGBA', (lx2 - lx1, ly2 - ly1), bg_color)
    canvas.paste(patch, (lx1, ly1))
    
    clean_title, strength, count_form = parse_product_info(name)
    
    green_color = (20, 90, 50, 255)
    gold_color = (180, 120, 20, 255)
    dark_text = (30, 40, 50, 255)
    
    words = clean_title.split()
    lines = []
    curr = []
    for w in words:
        curr.append(w)
        if len(" ".join(curr)) > 14:
            lines.append(" ".join(curr[:-1]))
            curr = [w]
    if curr:
        lines.append(" ".join(curr))
        
    y_text = ly1 + 15
    for line in lines[:2]:
        bbox = draw.textbbox((0, 0), line, font=font_bold_24)
        w = bbox[2] - bbox[0]
        x = 512 - (w // 2)
        draw.text((x, y_text), line, fill=green_color, font=font_bold_24)
        y_text += 30
        
    if strength:
        bbox = draw.textbbox((0, 0), strength, font=font_bold_20)
        w = bbox[2] - bbox[0]
        x = 512 - (w // 2)
        draw.text((x, y_text + 4), strength, fill=gold_color, font=font_bold_20)
        y_text += 26
        
    if count_form:
        bbox = draw.textbbox((0, 0), count_form, font=font_med_18)
        w = bbox[2] - bbox[0]
        x = 512 - (w // 2)
        draw.text((x, y_text + 6), count_form, fill=dark_text, font=font_med_18)
        
    draw.text((450, ly2 - 25), "• Guaranteed Quality •", fill=(100, 120, 100, 255), font=font_small_14)
    
    save_card(canvas, out_filename)

def generate_tea_card(name, out_filename):
    ref = Image.open("web/public/products/traditional-medicinals-organic-dandelion-leaf-root-tea-16tb.png").convert("RGBA")
    card = ref.copy()
    draw = ImageDraw.Draw(card)
    
    # Center box patch on tea box: (380, 500, 640, 680)
    box = (380, 510, 644, 690)
    bg_color = card.getpixel((512, 520))
    patch = Image.new('RGBA', (box[2] - box[0], box[3] - box[1]), bg_color)
    card.paste(patch, (box[0], box[1]))
    
    clean_title, strength, count_form = parse_product_info(name)
    
    dark_green = (35, 75, 45, 255)
    dark_gray = (60, 65, 70, 255)
    
    words = clean_title.split()
    lines = []
    curr = []
    for w in words:
        curr.append(w)
        if len(" ".join(curr)) > 14:
            lines.append(" ".join(curr[:-1]))
            curr = [w]
    if curr:
        lines.append(" ".join(curr))
        
    y_text = 525
    for line in lines[:2]:
        bbox = draw.textbbox((0, 0), line, font=font_bold_24)
        w = bbox[2] - bbox[0]
        x = 512 - (w // 2)
        draw.text((x, y_text), line, fill=dark_green, font=font_bold_24)
        y_text += 32
        
    draw.text((440, y_text + 10), "16 Wrapped Tea Bags", fill=dark_gray, font=font_med_18)
    draw.text((450, y_text + 38), "• USDA Organic Herbal Tea •", fill=(80, 110, 85, 255), font=font_small_14)
    
    save_card(card, out_filename)

def generate_skincare_card(name, out_filename, is_wash=False):
    ref_fn = "web/public/products/method-body-wash-pure-peace-532ml.png" if is_wash else "web/public/products/amlactin-lotion.png"
    ref = Image.open(ref_fn).convert("RGBA")
    
    ratio = 860.0 / float(ref.size[1])
    target_w = int(ref.size[0] * ratio)
    resized = ref.resize((target_w, 860), Image.Resampling.LANCZOS)
    
    canvas = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
    x_pos = (1024 - target_w) // 2
    canvas.paste(resized, (x_pos, 82), resized)
    
    draw = ImageDraw.Draw(canvas)
    
    lx1 = x_pos + int(target_w * 0.2)
    lx2 = x_pos + int(target_w * 0.8)
    ly1 = 82 + int(860 * 0.42)
    ly2 = 82 + int(860 * 0.68)
    
    bg_color = canvas.getpixel((512, ly1 + 10))
    patch = Image.new('RGBA', (lx2 - lx1, ly2 - ly1), bg_color)
    canvas.paste(patch, (lx1, ly1))
    
    clean_title, strength, count_form = parse_product_info(name)
    
    brand_color = (25, 45, 85, 255)
    
    bbox = draw.textbbox((0, 0), clean_title, font=font_bold_24)
    w = bbox[2] - bbox[0]
    draw.text((512 - (w // 2), ly1 + 25), clean_title, fill=brand_color, font=font_bold_24)
    
    sub = "Gentle Nourishing Formula" if is_wash else "Intensive Hydration Care"
    bbox_s = draw.textbbox((0, 0), sub, font=font_med_18)
    draw.text((512 - (bbox_s[2] - bbox_s[0]) // 2, ly1 + 65), sub, fill=(70, 80, 95, 255), font=font_med_18)
    
    save_card(canvas, out_filename)

def generate_amber_glass_card(name, out_filename):
    ref = Image.open("web/public/products/solgar-evening-primrose-oil-1300mg-60s.png").convert("RGBA")
    card = ref.copy()
    draw = ImageDraw.Draw(card)
    
    box = (370, 480, 655, 680)
    bg_color = card.getpixel((512, 490))
    patch = Image.new('RGBA', (box[2] - box[0], box[3] - box[1]), bg_color)
    card.paste(patch, (box[0], box[1]))
    
    clean_title, strength, count_form = parse_product_info(name)
    
    gold_color = (195, 140, 30, 255)
    dark_text = (20, 25, 35, 255)
    
    words = clean_title.split()
    lines = []
    curr = []
    for w in words:
        curr.append(w)
        if len(" ".join(curr)) > 14:
            lines.append(" ".join(curr[:-1]))
            curr = [w]
    if curr:
        lines.append(" ".join(curr))
        
    y_text = 495
    for line in lines[:2]:
        bbox = draw.textbbox((0, 0), line, font=font_bold_24)
        w = bbox[2] - bbox[0]
        draw.text((512 - (w // 2), y_text), line, fill=dark_text, font=font_bold_24)
        y_text += 32
        
    if strength:
        bbox = draw.textbbox((0, 0), strength, font=font_bold_20)
        draw.text((512 - (bbox[2] - bbox[0]) // 2, y_text + 4), strength, fill=gold_color, font=font_bold_20)
        y_text += 28
        
    if count_form:
        bbox = draw.textbbox((0, 0), count_form, font=font_med_18)
        draw.text((512 - (bbox[2] - bbox[0]) // 2, y_text + 4), count_form, fill=(60, 65, 75, 255), font=font_med_18)
        
    save_card(card, out_filename)

def save_card(card, out_filename):
    p1 = os.path.join(web_dir, out_filename)
    p2 = os.path.join(enter_dir, out_filename)
    card.save(p1, 'PNG', optimize=True)
    card.save(p2, 'PNG', optimize=True)
    print(f"✨ Created Card: {out_filename}")

# Process all 100 missing items
MISSING_ITEMS = [
    # 21st Century
    ("21ST ARTHRIFLEX PLUS TURMERIC 90'S: CAP", "21st-century-arthriflex-plus-turmeric-90s-cap.png", "21st"),
    ("21ST B COMPLEX W/ C 100'S: TAB : :", "21st-century-b-complex-w-c-100s-tab.png", "21st"),
    ("21ST B-12 5000MCG SUBLINGUAL 110'S: LOZENGE : :", "21st-century-b12-5000mcg-sublingual-110s.png", "21st"),
    ("21ST BEETROOT 1000MG 90'S: CAPS", "21st-century-beetroot-1000mg-90s-caps.png", "21st"),
    ("21ST CHROMIUM PICOLINATE: TAB", "21st-century-chromium-picolinate-tab.png", "21st"),
    ("21ST DHEA 25MG 90'S : CAP", "21st-century-dhea-25mg-90s-cap.png", "21st"),
    ("21ST DIABETIC SUPPORT FORMULA 90'S: TAB : :", "21st-century-diabetic-support-formula-90s-tab.png", "21st"),
    ("21ST FULLFUEL NITRIC OXIDE BOOST 120'S: CAP", "21st-century-fullfuel-nitric-oxide-boost-120s-cap.png", "21st"),
    ("21ST GLUTATHIONE 500MG 120'S: CAP", "21st-century-glutathione-500mg-120s-cap.png", "21st"),
    ("21ST HERBAL SLIMMING TEA 24'S: TEABAG::", "21st-century-herbal-slimming-tea-24s.png", "tea"),
    ("21ST L-ARGININE 1000MG 100'S: TAB : :", "21st-century-l-arginine-1000mg-100s-tab.png", "21st"),
    ("21ST MILK THISTLE EXTRACT 60'S: CAP: :", "21st-century-milk-thistle-extract-60s-cap.png", "21st"),

    # Other brands
    ("Bigelow Tea", "bigelow-tea-bags.png", "tea"),
    ("Crest 3D", "crest-3d-white-toothpaste.png", "skincare"),
    ("Crest Scope", "crest-scope-mouthwash.png", "skincare"),
    ("Megafood Blood Builder 60's: Tab", "megafood-blood-builder-60s-tab.png", "amber"),
    ("Xyeano Baby Wash", "xyeano-baby-wash.png", "skincare_wash"),
    ("Xyeano Lotion", "xyeano-lotion.png", "skincare"),

    # NOW Foods products
    ("NOW ADAM 60'S TAB", "now-foods-adam-superior-mens-multi-60t.png", "now"),
    ("NOW ALPHA LIPOIC ACID 600MG 60'S CAP", "now-foods-alpha-lipoic-acid-600mg-60c.png", "now"),
    ("NOW ASHWAGANDHA EXT 450MG 90'S CAP", "now-foods-ashwagandha-450mg-90c.png", "now"),
    ("NOW ASTAXANTHIN 4MG 90'S GELS", "now-foods-astaxanthin-4mg-90s.png", "now"),
    ("NOW B-1 100MG 100'S: TAB : :", "now-foods-vitamin-b1-100mg-100t.png", "now"),
    ("NOW B-6 100MG 100'S CAP", "now-foods-vitamin-b6-100mg-100c.png", "now"),
    ("NOW BETAINE HCL 120'S: CAP", "now-foods-betaine-hcl-120c.png", "now"),
    ("NOW BIOTIN 5000MCG 60'S: CAP", "now-foods-biotin-5000mcg-60c.png", "now"),
    ("NOW BLACK CHIA SEEDS ORG 12 OZ: SEED: :", "now-foods-organic-black-chia-seeds-12oz.png", "now"),
    ("NOW C-1000 COMPLEX ACID FREE 90'S: TAB: :", "now-foods-buffered-c1000-complex-90t.png", "now"),
    ("NOW C-1000 PLUS ZINC 90'S: CAPS", "now-foods-c1000-plus-zinc-90c.png", "now"),
    ("NOW C-1000 RH SR 100'S: TAB::", "now-foods-c1000-with-rose-hips-100t.png", "now"),
    ("NOW CAL MAG PLUS D 120'S: SOFTGEL", "now-foods-cal-mag-plus-d-120s.png", "now"),
    ("NOW CANDIDA SUPPORT 90'S: CAP: :", "now-foods-candida-support-90c.png", "now"),
    ("NOW CARNITINE 500MG 60'S: CAP", "now-foods-l-carnitine-500mg-60c.png", "now"),
    ("NOW CARNITINE TARTRATE 1000MG 50'S: TAB: :", "now-foods-l-carnitine-tartrate-1000mg-50t.png", "now"),
    ("NOW CASTOR OIL 473ML: LIQ. : :", "now-foods-castor-oil-473ml.png", "now"),
    ("NOW CHASTE BERRY(VITEX) 90'S: CAP: :", "now-foods-chaste-berry-vitex-extract-300mg-90c.png", "now"),
    ("NOW CHOLINE 300MG 100'S: CAPS", "now-foods-choline-300mg-100c.png", "now"),
    ("NOW CHOLINE/INOSITOL 100'S: CAP", "now-foods-choline-inositol-100c.png", "now"),
    ("NOW CHROMIUM PICOLINATE 200MCG 100'S : CAP: :", "now-foods-chromium-picolinate-200mcg-100c.png", "now"),
    ("NOW CITRULLINE 750MG 90'S: CAP: :", "now-foods-l-citrulline-750mg-90c.png", "now"),
    ("NOW CLINICAL PROSTATE HEALTH 90'S: GEL: :", "now-foods-clinical-strength-prostate-health-90s.png", "now"),
    ("NOW COPPER GLYCINATE 3MG 120'S: TAB", "now-foods-copper-glycinate-3mg-120t.png", "now"),
    ("NOW COQ10 200MG 60'S: CAP", "now-foods-coq10-200mg-60c.png", "now"),
    ("NOW COQ10 400MG 30'S: SOFTGEL: :", "now-foods-coq10-400mg-30s.png", "now"),
    ("NOW CREATINE 750MG 120'S: CAP: :", "now-sports-creatine-monohydrate-750mg-120c.png", "now"),
    ("NOW CREATINE 8OZ: POWDER::", "now-sports-creatine-monohydrate-powder-8oz.png", "now"),
    ("NOW D-MANNOSE 500MG 120'S: CAP: :", "now-foods-d-mannose-500mg-120c.png", "now"),
    ("NOW DHA 500MG 90'S: GELS", "now-foods-dha-500mg-90s.png", "now"),
    ("NOW DIM-200 90'S: CAP", "now-foods-dim-200-90c.png", "now"),
    ("NOW EVE 90'S: SOFTGEL", "now-foods-eve-superior-womens-multi-90s.png", "now"),
    ("NOW EVENING PRIMROSE OIL 1000MG 90'S: SGLS", "now-foods-evening-primrose-oil-1000mg-90s.png", "now"),
    ("NOW FEMALE BALANCE 90'S : CAP: :", "now-foods-female-balance-90c.png", "now"),
    ("NOW FENUGREEK 500MG 100'S : CAP: :", "now-foods-fenugreek-500mg-100c.png", "now"),
    ("NOW FOLIC ACID 800MCG 250'S: TAB : :", "now-foods-folic-acid-800mcg-250t.png", "now"),
    ("NOW GABA 500MG 100'S: CAP", "now-foods-gaba-500mg-100c.png", "now"),
    ("NOW GABA 750MG 90'S : CAP", "now-foods-gaba-750mg-90c.png", "now"),
    ("NOW GASTRO COMFORT 60'S: CAP", "now-foods-gastro-comfort-60c.png", "now"),
    ("NOW GINKGO BILOBA 60MG 60'S : CAP: :", "now-foods-ginkgo-biloba-60mg-60c.png", "now"),
    ("NOW GLUTA. SKIN BRIGHTENER 30'S : CAP: :", "now-foods-glutathione-skin-brightener-30c.png", "now"),
    ("NOW GLYCI-BLZ2-QSVT-43", "now-foods-glycine-1000mg-100c.png", "now"),
    ("NOW GLYCINE 1000MG 100'S: CAP", "now-foods-glycine-1000mg-100c.png", "now"),
    ("NOW INOSITOL 500MG 100'S : CAP: :", "now-foods-inositol-500mg-100c.png", "now"),
    ("NOW KSM-66 ASHWAGANDHA 600MG 90'S: CAP", "now-foods-ksm66-ashwagandha-600mg-90c.png", "now"),
    ("NOW L-ARGININE 1000MG 120'S: TAB : :", "now-foods-l-arginine-1000mg-120t.png", "now"),
    ("NOW L-GLUTAMINE 500MG 120'S: CAP: :", "now-foods-l-glutamine-500mg-120c.png", "now"),
    ("NOW L-LYSINE 1000MG 100'S: TAB : :", "now-foods-double-strength-l-lysine-1000mg-100t.png", "now"),
    ("NOW L-THEANINE 100MG 90'S: CAP", "now-foods-l-theanine-100mg-90c.png", "now"),
    ("NOW L-TYROSINE 500MG 120'S : CAP", "now-foods-l-tyrosine-500mg-120c.png", "now"),
    ("NOW LIVER REFRESH 90'S: CAP: :", "now-foods-liver-refresh-90c.png", "now"),
    ("NOW MACA 500MG 100'S: CAP: :", "now-foods-maca-500mg-100c.png", "now"),
    ("NOW MACA 6:1 CONC POWDER ORG 7 OZ: POWDER : :", "now-foods-organic-maca-pure-powder-7oz.png", "now"),
    ("NOW MAGNESIUM GLYCINATE 90'S: TAB ::", "now-foods-magnesium-glycinate-90t.png", "now"),
    ("NOW MELATONIN 10MG 100'S: CAP: :", "now-foods-melatonin-10mg-100c.png", "now"),
    ("NOW MELATONIN 3mg 90 LOZ : ITEM::", "now-foods-melatonin-3mg-90loz.png", "now"),
    ("NOW MELATONIN 5MG VCAPS 60'S: CAP::", "now-foods-melatonin-5mg-60c.png", "now"),
    ("NOW METHYL FOLATE 1000MCG 90'S: TAB", "now-foods-methyl-folate-1000mcg-90t.png", "now"),
    ("NOW N-ACETYL-CYSTEINE 1000MG 120'S: TAB: :", "now-foods-nac-1000mg-120t.png", "now"),
    ("NOW N-ACETYL-CYSTEINE 600MG 100'S: CAP", "now-foods-nac-600mg-100c.png", "now"),
    ("NOW NATURAL RESVERATROL 200MG 60'S : CAP: :", "now-foods-natural-resveratrol-200mg-60c.png", "now"),
    ("NOW NIACINAMIDE 500MG 100'S : CAP: :", "now-foods-niacinamide-500mg-100c.png", "now"),
    ("NOW ODORLESS GARLIC 100'S: GELS: :", "now-foods-odorless-garlic-100s.png", "now"),
    ("NOW PRENATAL W/DHA 90'S: GELS", "now-foods-prenatal-gels-dha-90s.png", "now"),
    ("NOW PROBIOTIC-10 50 BILLION 50'S: CAP::", "now-foods-probiotic-10-50-billion-50c.png", "now"),
    ("NOW PROSTATE SUPPORT 90'S: GEL : :", "now-foods-prostate-support-90s.png", "now"),
    ("NOW PUMPKIN OIL 1000MG 100'S: GEL : :", "now-foods-pumpkin-seed-oil-1000mg-100s.png", "now"),
    ("NOW PUMPKIN SEEDS RAW 1 LB : SEED : :", "now-foods-raw-pumpkin-seeds-1lb.png", "now"),
    ("NOW SAW PALMETTO BERRIES 550MG 100'S : CAP", "now-foods-saw-palmetto-berries-550mg-100c.png", "now"),
    ("NOW SELENIUM 200MCG 90'S: CAP: :", "now-foods-selenium-200mcg-90c.png", "now"),
    ("NOW SLIPPERY ELM 400MG 100'S: CAP", "now-foods-slippery-elm-400mg-100c.png", "now"),
    ("NOW SUPER OMEGA EPA 1200MG 120'S: SOFTGEL: :", "now-foods-super-omega-epa-1200mg-120s.png", "now"),
    ("NOW TAURINE 1000MG 100'S : CAP", "now-foods-taurine-1000mg-100c.png", "now"),
    ("NOW TMG 1000MG 100'S : TAB", "now-foods-tmg-1000mg-100t.png", "now"),
    ("NOW UBIQUINOL 100MG 60'S: GEL: :", "now-foods-ubiquinol-100mg-60s.png", "now"),
    ("NOW VIT D3(1000IU) / K2(45MCG) 120'S : CAP", "now-foods-vitamin-d3-k2-120c.png", "now"),
    ("NOW VIT K2 MK7 100MCG 60'S: CAP", "now-foods-vitamin-k2-mk7-100mcg-60c.png", "now"),
    ("NOW VIT K2MK7 300MCG 60'S: CAP", "now-foods-vitamin-k2-mk7-300mcg-60c.png", "now"),
    ("NOW VITAMIN K-2 100MG 100'S : CAP: :", "now-foods-vitamin-k2-100mcg-100c.png", "now"),
    ("NOW WHEY CONCENTRATE UNFLAV 1.5LB: PWD ::", "now-foods-whey-protein-concentrate-unflavored-1-5lb.png", "now"),
    ("NOW WHOLE PSYLLIUM HUSK 16 OZ: RAW::", "now-foods-whole-psyllium-husks-16oz.png", "now"),
    ("NOW ZINC GLUCONATE 50MG 100'S: TAB : :", "now-foods-zinc-gluconate-50mg-100t.png", "now"),
    ("NOW ZINC PICOLINATE 50MG 60'S: CAP: :", "now-foods-zinc-picolinate-50mg-60c.png", "now")
]

print(f"Generating {len(MISSING_ITEMS)} missing product cards...")
for name, fn, kind in MISSING_ITEMS:
    if kind == "now":
        generate_now_card(name, fn)
    elif kind == "21st":
        generate_21st_card(name, fn)
    elif kind == "tea":
        generate_tea_card(name, fn)
    elif kind == "amber":
        generate_amber_glass_card(name, fn)
    elif kind == "skincare_wash":
        generate_skincare_card(name, fn, is_wash=True)
    elif kind == "skincare":
        generate_skincare_card(name, fn, is_wash=False)

print("\n🎉 All missing studio product cards successfully created & saved to both web & enter_ directories!")
