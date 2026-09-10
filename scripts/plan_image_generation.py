import os
import re
import json
import psycopg2
from psycopg2.extras import RealDictCursor

# Read .env
env_path = 'api/.env'
db_url = None
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.trim() if hasattr(line, 'trim') else line.strip()
            if line.startswith('DATABASE_URL='):
                db_url = line.split('=', 1)[1].strip()

conn = psycopg2.connect(db_url)
cur = conn.cursor(cursor_factory=RealDictCursor)

cur.execute("""
    SELECT id, name, sku, barcode, brand, generic_name, description, category_id, image_url, dosage_form, strength, selling_price_pesewas
    FROM product
    ORDER BY name ASC
""")
prods = cur.fetchall()

web_dir = "web/public/products"
existing_images = set(os.listdir(web_dir)) if os.path.exists(web_dir) else set()

print(f"Total Products in DB: {len(prods)}")
print(f"Total Images on Disk: {len(existing_images)}")

# Known manual map for non-standard or exact catalog matches
MANUAL_IMAGE_MAP = {
    # 21st Century
    "21ST ADVANCED PROBIOTIC 60'S: CAP": "21st-century-advanced-probiotic-60s.png",
    "21ST CALCIUM MAGNESIUM ZINC 90'S: TAB": "21st-century-calcium-magnesium-zinc-90t.png",
    "21ST CHELATED MAGNESIUM GLYCINATE 90'S: CAP": "21st-century-chelated-magnesium-glycinate-90c.png",
    "21ST CRANBERRY PLUS PROBIOTIC 60'S: TAB": "21st-century-cranberry-plus-probiotic-60t.png",
    "21ST DIGESTIVE ENZYMES 60'S: TAB": "21st-century-digestive-enzymes-60s.png",
    "21ST K2 MK7 110'S : TAB": "21st-century-k2-mk7-110s.png",
    "21ST POTASSIUM GLUCONATE 110'S: TAB": "21st-century-potassium-gluconate-110t.png",
    "21ST PROSTATE HEALTH 60'S: TAB": "21st-century-prostate-health-60s.png",
    "21ST SUPER COLLAGEN + C 180'S: TAB": "21st-century-super-collagen-plus-vitamin-c-180t.png",
    "21ST ASHWAGANDHA EXT 500MG 60'S : CAP": "21st-century-ashwagandha-500mg-60c.png",
    
    # Traditional Medicinals
    "TM ORGANIC CHAMOMILE TEA: TEABAG": "traditional-medicinals-organic-dandelion-leaf-root-tea-16tb.png", # or gen chamomile
    "TM ORGANIC DANDELION TEA: TEABAG": "traditional-medicinals-organic-dandelion-leaf-root-tea-16tb.png",
    "TM ORGANIC RASPBERRY LEAF : TEABAG": "traditional-medicinals-organic-raspberry-leaf-tea-16tb.png",
    "TM ROASTED DANDELION TEA 16'S: TEABAG": "traditional-medicinals-organic-roasted-dandelion-root-tea-16tb.png",
    
    # NOW Foods exact
    "NOW 8 BILLION ACIDOPHILUS 60'S: CAP": "now-foods-8-billion-acidophilus-bifidus-60c.png",
    "NOW ADAM 60'S: TAB": "now-foods-adam-superior-mens-multi-60t.png",
    "NOW APPLE CIDER VINEGAR 180'S : CAP": "now-foods-apple-cider-vinegar-450mg-180c.png",
    "NOW ASHWAGANDHA EXT 450MG 90'S : CAP": "now-foods-ashwagandha-450mg-90c.png",
    "NOW BERBERINE 90'S: SOFTGEL": "now-foods-berberine-glucose-support-90s.png",
    "NOW CALCIUM CITRATE 100'S : TAB": "now-foods-calcium-citrate-100t.png",
    "NOW CALCIUM D-GLUCARATE 90'S: CAP": "now-foods-calcium-d-glucarate-500mg-90c.png",
    "NOW CHASTE BERRY VITEX 90'S : CAP": "now-foods-chaste-berry-vitex-extract-300mg-90c.png",
    "NOW DOUBLE STRENGTH L-LYSINE 100'S : TAB": "now-foods-double-strength-l-lysine-1000mg-100t.png",
    "NOW FOLIC ACID 800MCG 250'S : TAB": "now-foods-folic-acid-800mcg-250t.png",
    "NOW GLUCOSAMIN/CHOND/MSM 90'S: CAP": "now-foods-glucosamine-chondroitin-msm-90c.png",
    "NOW HYALURONIC ACID 60'S : CAP": "now-foods-hyaluronic-acid-50mg-60c.png",
    "NOW L-CARNITINE 1000MG 50'S : TAB": "now-foods-l-carnitine-1000mg-50t.png",
    "NOW LIQ CHLOROPHYLL & MINT 16 OZ: LIQUID: :": "now-foods-liquid-chlorophyll-473ml.png",
    "NOW MAGNESIUM CITRATE 200MG 100'S: TAB : :": "now-foods-magnesium-citrate-200mg-100t.png",
    "NOW MAGNESIUM GLYCINATE 180'S: TAB": "now-foods-magnesium-glycinate-180t.png",
    "NOW METHYL B-12 5000MCG 90'S: CAP": "now-foods-methyl-b-12-5000mcg-90c.png",
    "NOW MILK THISTLE SILYMARIN 300MG 50'S: CAP: :": "now-foods-milk-thistle-extract-300mg-50c.png",
    "NOW OMEGA-3 1000MG 100'S: GEL : :": "now-foods-omega-3-fish-oil-1000mg-100s.png",
    "NOW PANTOTHENIC ACID 500MG 100'S: CAP: :": "now-foods-pantothenic-acid-500mg-100c.png",
    "NOW POTASSIUM CITRATE 180'S : CAP": "now-foods-potassium-citrate-99mg-180c.png",
    "NOW SUPER ENZYME CAPS 90'S: CAP: :": "now-foods-super-enzymes-90c.png",
    "NOW THYROID ENERGY 90'S: CAP: :": "now-foods-thyroid-energy-90c.png",
    "NOW WOMEN'S PROBIOTIC 50'S: CAP": "now-foods-womens-probiotic-20-billion-50c.png",
    "NOW BERRY DOPHILUS CHEWABLE 60'S : CHEWABLE: :": "now-kids-berry-dophilus-chewables-60s.png",
    "NOW DHA CHEWABLE KIDS 60'S: GEL : :": "now-kids-dha-fish-oil-chewables-60s.png",
    "NOW OMEGA 3-6-9 1000MG 100'S: GEL: :": "now-omega-369-1000mg.png",
    "NOW PSYLLIUM HUSK 340GM: POWDER": "now-psyllium-husk-powder-340g.png",
    "NOW CREATINE 750MG 120'S: CAP": "now-sports-creatine-monohydrate-750mg-120c.png",
    "NOW VIT D-3 10,000 IU 120'S: GEL::": "now-foods-high-potency-vitamin-d3-10000iu-120s.png",
}

to_generate = []
already_matched = []

for p in prods:
    # 1. Check manual map
    if p['name'] in MANUAL_IMAGE_MAP:
        img_name = MANUAL_IMAGE_MAP[p['name']]
        if img_name in existing_images:
            already_matched.append((p, img_name))
            continue

    # 2. Check current image_url
    if p['image_url']:
        curr = os.path.basename(p['image_url'])
        if curr in existing_images:
            already_matched.append((p, curr))
            continue

    to_generate.append(p)

print(f"\nAlready matched/existing: {len(already_matched)}")
print(f"To Generate: {len(to_generate)}")

print("\n--- Products to Generate ---")
for idx, p in enumerate(to_generate):
    print(f"{idx+1}. [{p['sku']}] \"{p['name']}\" (Price: {p['selling_price_pesewas']/100} GHS)")

cur.close()
conn.close()
