"""Generate src/lib/foodbank/ingredients.ts from IFCT 2017 + documented extras.

usage:
  python3 -I scripts/foodbank/gen_ingredients.py <ifct compositions csv> src/lib/foodbank/ingredients.ts

Getting the IFCT 2017 data (ICMR-NIN Indian Food Composition Tables):
  A machine-readable copy is published in the `ifct2017` npm package. Download
  the tarball into a separate folder and use its CSV as data only (do not add
  the package to this project - it is AGPL-licensed):
    mkdir -p /tmp/ifct && cd /tmp/ifct
    curl -sSLo ifct.tgz https://registry.npmjs.org/ifct2017/-/ifct2017-2.1.2.tgz && tar xzf ifct.tgz
    # CSV: /tmp/ifct/package/compositions/index.csv  (minerals are stored in grams)

To add an ingredient: append a row to IFCT (with its food code) or EXTRA (with
its source), re-run this script, then `npm run foodbank:check`.

Every IFCT-backed ingredient pulls its numbers by food code, so nothing is
hand-transcribed. Items IFCT 2017 does not cover are listed in EXTRA with the
source recorded on each row.
"""
import csv
import json
import sys

# key, display name, IFCT code, exchange group, flags
# flags: a=allergens, an=animal source, root=underground (Jain), cost 1..3,
#        cat=grocery category override, piece=(grams, singular, plural)
IFCT = [
    # ---- Grains & millets
    ("atta", "Whole wheat flour (atta)", "A019", "CEREALS", {"a": ["gluten"]}),
    ("maida", "Refined wheat flour (maida)", "A018", "CEREALS", {"a": ["gluten"]}),
    ("daliya", "Broken wheat (daliya)", "A020", "CEREALS", {"a": ["gluten"]}),
    ("suji", "Semolina (suji/rava)", "A022", "CEREALS", {"a": ["gluten"]}),
    ("vermicelli", "Vermicelli, roasted (semiya)", "A024", "CEREALS", {"a": ["gluten"]}),
    ("rice", "Rice, white raw (milled)", "A015", "CEREALS", {}),
    ("rice_brown", "Rice, brown", "A013", "CEREALS", {"cost": 2}),
    ("rice_parboiled", "Rice, parboiled (idli rice)", "A014", "CEREALS", {}),
    ("poha", "Rice flakes (poha)", "A011", "CEREALS", {}),
    ("murmura", "Puffed rice (murmura)", "A012", "CEREALS", {}),
    ("ragi", "Ragi / finger millet flour", "A010", "CEREALS", {}),
    ("jowar", "Jowar / sorghum flour", "A005", "CEREALS", {}),
    ("bajra", "Bajra / pearl millet flour", "A003", "CEREALS", {}),
    ("makki", "Maize flour (makki atta)", "A006", "CEREALS", {}),
    ("sweet_corn", "Sweet corn kernels", "A008", "CEREALS", {"cat": "Vegetables"}),
    ("quinoa", "Quinoa", "A009", "CEREALS", {"cost": 3}),
    ("barley", "Barley (jau)", "A004", "CEREALS", {"a": ["gluten"]}),
    ("little_millet", "Little millet (samai / kutki)", "A016", "CEREALS", {"cost": 2}),
    ("kodo_millet", "Kodo millet (varagu)", "A017", "CEREALS", {"cost": 2}),
    ("rajgira", "Amaranth seed (rajgira)", "A002", "CEREALS", {"cost": 2}),
    # ---- Pulses & legumes
    ("moong_dal", "Moong dal (green gram, split)", "B010", "PULSES", {}),
    ("moong_whole", "Whole moong / sprouts (dry wt)", "B011", "PULSES", {}),
    ("masoor_dal", "Masoor dal (red lentil)", "B013", "PULSES", {}),
    ("masoor_whole", "Whole masoor (brown lentil)", "B014", "PULSES", {}),
    ("toor_dal", "Toor / arhar dal", "B021", "PULSES", {}),
    ("chana_dal", "Chana dal", "B001", "PULSES", {}),
    ("besan", "Besan (gram flour)", "B001", "PULSES", {}),
    ("kala_chana", "Kala chana (black chickpea)", "B002", "PULSES", {}),
    ("urad_dal", "Urad dal (black gram, split)", "B003", "PULSES", {}),
    ("urad_whole", "Whole urad (sabut urad)", "B004", "PULSES", {}),
    ("rajma", "Rajma (red kidney beans)", "B020", "PULSES", {}),
    ("lobia", "Lobia (black-eyed beans)", "B006", "PULSES", {}),
    ("moth", "Moth beans (matki)", "B016", "PULSES", {}),
    ("kulthi", "Horse gram (kulthi)", "B012", "PULSES", {}),
    ("peas_dry", "Dried white peas (safed matar)", "B017", "PULSES", {}),
    ("soybean", "Soybean, whole", "B024", "PULSES", {"a": ["soy"]}),
    # ---- Dairy
    ("milk_cow", "Cow milk, whole", "L002", "MILK", {"an": "dairy", "a": ["dairy"]}),
    ("milk_buffalo", "Buffalo milk, whole", "L001", "MILK", {"an": "dairy", "a": ["dairy"]}),
    ("paneer", "Paneer", "L003", "MILK", {"an": "dairy", "a": ["dairy"], "cost": 2}),
    ("khoa", "Khoa (mawa)", "L004", "MILK", {"an": "dairy", "a": ["dairy"], "cost": 2}),
    # ---- Eggs, meat, fish
    ("egg", "Egg, whole", "M001", "MEAT", {"an": "egg", "a": ["egg"], "piece": [50, "egg", "eggs"]}),
    ("egg_white", "Egg white", "M002", "MEAT", {"an": "egg", "a": ["egg"], "piece": [33, "egg white", "egg whites"]}),
    ("chicken_breast", "Chicken breast, skinless", "N003", "MEAT", {"an": "meat", "cost": 2}),
    ("chicken", "Chicken curry cut (leg), skinless", "N001", "MEAT", {"an": "meat", "cost": 2}),
    ("chicken_liver", "Chicken liver", "N005", "MEAT", {"an": "meat", "cost": 2}),
    ("mutton", "Mutton (goat, shoulder)", "O001", "MEAT", {"an": "meat", "cost": 3}),
    ("mutton_lean", "Mutton, lean (goat leg)", "O003", "MEAT", {"an": "meat", "cost": 3}),
    ("fish_rohu", "Rohu fish", "S006", "MEAT", {"an": "fish", "a": ["fish"], "cost": 2}),
    ("fish_catla", "Catla fish", "S002", "MEAT", {"an": "fish", "a": ["fish"], "cost": 2}),
    ("fish_pomfret", "Pomfret, white", "P057", "MEAT", {"an": "fish", "a": ["fish"], "cost": 3}),
    ("fish_mackerel", "Mackerel (bangda)", "P034", "MEAT", {"an": "fish", "a": ["fish"], "cost": 2}),
    ("fish_sardine", "Sardine (mathi)", "P071", "MEAT", {"an": "fish", "a": ["fish"]}),
    ("fish_seer", "Seer fish (surmai / vanjaram)", "P087", "MEAT", {"an": "fish", "a": ["fish"], "cost": 3}),
    ("fish_basa", "Basa / pangas fillet", "S005", "MEAT", {"an": "fish", "a": ["fish"], "cost": 2}),
    ("fish_salmon", "Salmon", "P068", "MEAT", {"an": "fish", "a": ["fish"], "cost": 3}),
    ("fish_tuna", "Tuna", "P084", "MEAT", {"an": "fish", "a": ["fish"], "cost": 3}),
    ("fish_hilsa", "Hilsa (ilish)", "P017", "MEAT", {"an": "fish", "a": ["fish"], "cost": 3}),
    ("prawns", "Prawns", "S008", "MEAT", {"an": "fish", "a": ["shellfish"], "cost": 3}),
    ("crab", "Crab", "Q001", "MEAT", {"an": "fish", "a": ["shellfish"], "cost": 3}),
    # ---- Green leafy vegetables
    ("spinach", "Spinach (palak)", "C033", "VEG_A", {}),
    ("methi", "Fenugreek leaves (methi)", "C020", "VEG_A", {}),
    ("sarson", "Mustard leaves (sarson)", "C026", "VEG_A", {}),
    ("bathua", "Bathua leaves", "C008", "VEG_A", {}),
    ("amaranth_leaves", "Amaranth leaves (chaulai)", "C002", "VEG_A", {}),
    ("drumstick_leaves", "Drumstick leaves (moringa)", "C019", "VEG_A", {}),
    ("colocasia_leaves", "Colocasia leaves (arbi patta)", "C018", "VEG_A", {}),
    ("cabbage", "Cabbage", "C015", "VEG_A", {}),
    ("lettuce", "Lettuce", "C025", "VEG_A", {"cost": 2}),
    ("coriander", "Coriander leaves", "G009", "VEG_A", {}),
    ("mint", "Mint leaves (pudina)", "G016", "VEG_A", {}),
    ("curry_leaves", "Curry leaves", "G010", "VEG_A", {"cat": "Spices & Condiments"}),
    # ---- Other vegetables
    ("cauliflower", "Cauliflower", "D036", "VEG_B", {}),
    ("bhindi", "Ladies finger (bhindi)", "D056", "VEG_B", {}),
    ("brinjal", "Brinjal (baingan)", "D031", "VEG_B", {}),
    ("lauki", "Bottle gourd (lauki)", "D007", "VEG_B", {}),
    ("tinda", "Tinda", "D073", "VEG_B", {}),
    ("turai", "Ridge gourd (turai)", "D068", "VEG_B", {}),
    ("karela", "Bitter gourd (karela)", "D004", "VEG_B", {}),
    ("parwal", "Pointed gourd (parwal)", "D060", "VEG_B", {}),
    ("pumpkin", "Pumpkin, red (kaddu)", "D066", "VEG_B", {}),
    ("ash_gourd", "Ash gourd (petha)", "D001", "VEG_B", {}),
    ("snake_gourd", "Snake gourd", "D070", "VEG_B", {}),
    ("tindora", "Ivy gourd (tindora / kovai)", "D055", "VEG_B", {}),
    ("capsicum", "Capsicum, green", "D033", "VEG_B", {}),
    ("bell_pepper", "Bell pepper, red/yellow", "D034", "VEG_B", {"cost": 2}),
    ("french_beans", "French beans", "D050", "VEG_B", {}),
    ("cluster_beans", "Cluster beans (gawar)", "D039", "VEG_B", {}),
    ("broad_beans", "Broad beans (sem / papdi)", "D032", "VEG_B", {}),
    ("green_peas", "Green peas, fresh", "D061", "VEG_B", {}),
    ("tomato", "Tomato", "D076", "VEG_B", {}),
    ("cucumber", "Cucumber", "D043", "VEG_B", {}),
    ("mushroom", "Button mushroom", "J001", "VEG_B", {"cost": 2}),
    ("baby_corn", "Baby corn", "D042", "VEG_B", {"cost": 2}),
    ("drumstick", "Drumstick (moringa pods)", "D046", "VEG_B", {}),
    ("raw_banana", "Raw banana (kacha kela)", "D063", "VEG_B", {}),
    ("raw_jackfruit", "Raw jackfruit (kathal)", "D051", "VEG_B", {}),
    ("raw_papaya", "Raw papaya", "D059", "VEG_B", {}),
    ("raw_mango", "Raw mango (kairi)", "D057", "VEG_B", {}),
    ("zucchini", "Zucchini", "D077", "VEG_B", {"cost": 2}),
    ("knol_khol", "Knol-khol (kohlrabi)", "D053", "VEG_B", {}),
    ("spring_onion", "Spring onion greens", "D058", "VEG_B", {}),
    ("celery", "Celery", "D037", "VEG_B", {"cost": 2}),
    # ---- Roots & tubers
    ("potato", "Potato", "F006", "VEG_C", {"root": True}),
    ("sweet_potato", "Sweet potato (shakarkandi)", "F014", "VEG_C", {"root": True}),
    ("carrot", "Carrot", "F002", "VEG_C", {"root": True}),
    ("beetroot", "Beetroot", "F001", "VEG_C", {"root": True}),
    ("radish", "Radish (mooli)", "F010", "VEG_C", {"root": True}),
    ("arbi", "Colocasia root (arbi)", "F004", "VEG_C", {"root": True}),
    ("yam", "Elephant yam (suran)", "F017", "VEG_C", {"root": True}),
    ("onion", "Onion", "G017", "VEG_C", {"root": True}),
    ("lotus_root", "Lotus stem (kamal kakdi)", "F005", "VEG_C", {"root": True, "cost": 2}),
    ("tapioca", "Tapioca (kappa)", "F015", "VEG_C", {"root": True}),
    ("water_chestnut", "Water chestnut (singhara)", "F016", "VEG_C", {}),
    # ---- Fruits
    ("apple", "Apple", "E001", "FRUITS", {"cost": 2}),
    ("banana", "Banana", "E012", "FRUITS", {"piece": [100, "banana", "bananas"]}),
    ("papaya", "Papaya, ripe", "E049", "FRUITS", {}),
    ("guava", "Guava", "E028", "FRUITS", {}),
    ("orange", "Orange", "E047", "FRUITS", {}),
    ("mosambi", "Sweet lime (mosambi)", "E034", "FRUITS", {}),
    ("pomegranate", "Pomegranate", "E055", "FRUITS", {"cost": 2}),
    ("watermelon", "Watermelon", "E066", "FRUITS", {}),
    ("muskmelon", "Muskmelon", "E045", "FRUITS", {}),
    ("pear", "Pear", "E051", "FRUITS", {"cost": 2}),
    ("mango", "Mango, ripe", "E039", "FRUITS", {"cost": 2}),
    ("grapes", "Grapes, green seedless", "E026", "FRUITS", {"cost": 2}),
    ("chikoo", "Sapota (chikoo)", "E060", "FRUITS", {}),
    ("pineapple", "Pineapple", "E053", "FRUITS", {}),
    ("strawberry", "Strawberry", "E063", "FRUITS", {"cost": 3}),
    ("jamun", "Jamun", "E031", "FRUITS", {}),
    ("amla", "Amla (Indian gooseberry)", "E021", "FRUITS", {}),
    ("custard_apple", "Custard apple (sitaphal)", "E016", "FRUITS", {"cost": 2}),
    ("litchi", "Litchi", "E035", "FRUITS", {"cost": 2}),
    ("plum", "Plum", "E054", "FRUITS", {"cost": 2}),
    ("peach", "Peach", "E050", "FRUITS", {"cost": 2}),
    ("dates", "Dates, dry (khajur)", "E018", "FRUITS", {"cost": 2}),
    ("raisins", "Raisins (kishmish)", "E058", "FRUITS", {"cost": 2}),
    ("apricot_dried", "Apricot, dried (khubani)", "E005", "FRUITS", {"cost": 3}),
    ("avocado", "Avocado", "E007", "FATS", {"cost": 3, "cat": "Fruits"}),
    ("coconut_water", "Coconut water", "K002", "FRUITS", {"cat": "Beverages"}),
    # ---- Oils & fats
    ("oil", "Cooking oil (refined vegetable)", "T005", "FATS", {}),
    ("mustard_oil", "Mustard oil", "T006", "FATS", {}),
    ("sunflower_oil", "Sunflower oil", "T012", "FATS", {}),
    ("rice_bran_oil", "Rice bran oil", "T008", "FATS", {}),
    ("coconut_oil", "Coconut oil", "T001", "FATS", {}),
    ("sesame_oil", "Sesame (gingelly) oil", "T004", "FATS", {"a": ["sesame"]}),
    ("ghee", "Ghee", "T013", "FATS", {"an": "dairy", "a": ["dairy"], "cost": 2}),
    # ---- Nuts & seeds
    ("almonds", "Almonds", "H001", "NUTS", {"a": ["tree-nuts"], "cost": 3}),
    ("walnuts", "Walnuts", "H021", "NUTS", {"a": ["tree-nuts"], "cost": 3}),
    ("cashews", "Cashew nuts", "H005", "NUTS", {"a": ["tree-nuts"], "cost": 3}),
    ("pistachios", "Pistachios", "H018", "NUTS", {"a": ["tree-nuts"], "cost": 3}),
    ("peanuts", "Peanuts (groundnut)", "H012", "NUTS", {"a": ["peanut"]}),
    ("flaxseed", "Flaxseed (alsi)", "H014", "NUTS", {}),
    ("sesame", "Sesame seeds (til)", "H011", "NUTS", {"a": ["sesame"]}),
    ("sunflower_seeds", "Sunflower seeds", "H020", "NUTS", {"cost": 2}),
    ("coconut", "Coconut, fresh (grated)", "H007", "NUTS", {}),
    ("coconut_dry", "Coconut, dry (copra)", "H006", "NUTS", {}),
    ("mustard_seeds", "Mustard seeds (rai)", "H013", "OTHER", {"cat": "Spices & Condiments"}),
    # ---- Sweeteners
    ("jaggery", "Jaggery (gur)", "I001", "SUGARS", {}),
    # ---- Condiments
    ("garlic", "Garlic", "G011", "OTHER", {"root": True, "cat": "Vegetables"}),
    ("ginger", "Ginger", "G014", "OTHER", {"root": True, "cat": "Vegetables"}),
    ("green_chilli", "Green chilli", "G008", "OTHER", {"cat": "Vegetables"}),
    ("lemon", "Lemon juice", "E033", "OTHER", {"cat": "Fruits"}),
    ("tamarind", "Tamarind pulp", "E064", "OTHER", {"cat": "Spices & Condiments"}),
    ("cumin", "Cumin seeds (jeera)", "G025", "OTHER", {"cat": "Spices & Condiments"}),
    ("fenugreek_seeds", "Fenugreek seeds (methi dana)", "G026", "OTHER", {"cat": "Spices & Condiments"}),
    ("turmeric", "Turmeric powder (haldi)", "G033", "OTHER", {"cat": "Spices & Condiments"}),
    ("black_pepper", "Black pepper", "G031", "OTHER", {"cat": "Spices & Condiments"}),
]

# Ingredients IFCT 2017 does not include. Values per 100 g (ml for liquids).
# fields: kcal, p, f, c (available CHO, i.e. excl. fibre), fib, ca, fe, na, k, vitc, fol
EXTRA = [
    ("oats", "Rolled oats", "CEREALS", "USDA FDC 173904",
     dict(kcal=379, p=13.2, f=6.5, c=57.6, fib=10.1, ca=52, fe=4.3, na=6, k=362, vitc=0, fol=32), {"a": ["gluten"], "cost": 2}),
    ("sabudana", "Sago pearls (sabudana)", "CEREALS", "USDA FDC 169717",
     dict(kcal=358, p=0.2, f=0.0, c=87.8, fib=0.9, ca=20, fe=1.6, na=1, k=11, vitc=0, fol=4), {}),
    ("makhana", "Fox nuts (makhana)", "CEREALS", "NIN / literature",
     dict(kcal=347, p=9.7, f=0.1, c=62.4, fib=14.5, ca=60, fe=1.4, na=1, k=0, vitc=0, fol=0), {"cost": 2}),
    ("bread_brown", "Whole wheat bread", "CEREALS", "USDA FDC 172816",
     dict(kcal=252, p=12.4, f=3.5, c=36.7, fib=6.0, ca=125, fe=2.5, na=455, k=254, vitc=0, fol=42),
     {"a": ["gluten"], "piece": [28, "slice", "slices"]}),
    ("bread_white", "White bread", "CEREALS", "USDA FDC 172686",
     dict(kcal=266, p=8.9, f=3.3, c=46.5, fib=2.7, ca=60, fe=1.5, na=490, k=115, vitc=0, fol=28),
     {"a": ["gluten"], "piece": [25, "slice", "slices"]}),
    ("pasta_ww", "Whole wheat pasta (dry)", "CEREALS", "USDA FDC 168909",
     dict(kcal=348, p=14.6, f=1.4, c=66.7, fib=8.3, ca=40, fe=3.6, na=6, k=215, vitc=0, fol=40), {"a": ["gluten"], "cost": 2}),
    ("kabuli_chana", "Kabuli chana (white chickpea)", "PULSES", "USDA FDC 173756",
     dict(kcal=378, p=20.5, f=6.0, c=50.7, fib=12.2, ca=57, fe=4.3, na=24, k=718, vitc=4, fol=557), {}),
    ("soya_chunks", "Soya chunks (nuggets)", "PULSES", "Nutrela label / USDA soy flour",
     dict(kcal=345, p=52.0, f=0.5, c=20.0, fib=13.0, ca=350, fe=10.0, na=20, k=2000, vitc=0, fol=0), {"a": ["soy"]}),
    ("tofu", "Tofu, firm", "PULSES", "USDA FDC 172475",
     dict(kcal=144, p=17.3, f=8.7, c=0.5, fib=2.3, ca=683, fe=2.7, na=14, k=237, vitc=0, fol=29), {"a": ["soy"], "cost": 2}),
    ("milk_toned", "Toned milk (3% fat)", "MILK", "Amul Taaza label",
     dict(kcal=58, p=3.0, f=3.0, c=4.8, fib=0, ca=110, fe=0.1, na=44, k=140, vitc=1, fol=5), {"an": "dairy", "a": ["dairy"], "liquid": True}),
    ("milk_dt", "Double toned milk (1.5% fat)", "MILK", "FSSAI std. composition",
     dict(kcal=46, p=3.2, f=1.5, c=4.9, fib=0, ca=115, fe=0.1, na=45, k=150, vitc=1, fol=5), {"an": "dairy", "a": ["dairy"], "liquid": True}),
    ("milk_full", "Full cream milk (6% fat)", "MILK", "Amul Gold label",
     dict(kcal=86, p=3.2, f=6.0, c=4.8, fib=0, ca=120, fe=0.1, na=44, k=140, vitc=1, fol=5), {"an": "dairy", "a": ["dairy"], "liquid": True}),
    ("curd", "Curd / dahi", "MILK", "Amul Masti Dahi label",
     dict(kcal=62, p=3.5, f=3.1, c=4.4, fib=0, ca=120, fe=0.1, na=46, k=155, vitc=1, fol=7), {"an": "dairy", "a": ["dairy"]}),
    ("greek_yogurt", "Greek yogurt, plain low-fat", "MILK", "USDA FDC 170903",
     dict(kcal=59, p=10.2, f=0.4, c=3.6, fib=0, ca=110, fe=0.1, na=36, k=141, vitc=0, fol=7), {"an": "dairy", "a": ["dairy"], "cost": 3}),
    ("hung_curd", "Hung curd (strained dahi)", "MILK", "USDA whole-milk Greek yogurt",
     dict(kcal=97, p=9.0, f=5.0, c=4.0, fib=0, ca=100, fe=0.1, na=35, k=141, vitc=0, fol=7), {"an": "dairy", "a": ["dairy"], "cost": 2}),
    ("cheese", "Cheese, processed", "MILK", "Amul processed cheese label (approx.)",
     dict(kcal=313, p=20.0, f=25.0, c=2.0, fib=0, ca=600, fe=0.3, na=1100, k=100, vitc=0, fol=10), {"an": "dairy", "a": ["dairy"], "cost": 2}),
    ("soy_milk", "Soy milk, unsweetened", "MILK", "USDA FDC 175215",
     dict(kcal=33, p=2.9, f=1.6, c=1.3, fib=0.4, ca=123, fe=0.5, na=37, k=122, vitc=0, fol=9), {"a": ["soy"], "liquid": True, "cost": 2}),
    ("almond_milk", "Almond milk, unsweetened", "OTHER", "USDA FDC 174832",
     dict(kcal=15, p=0.6, f=1.1, c=0.3, fib=0.3, ca=173, fe=0.3, na=72, k=67, vitc=0, fol=0), {"a": ["tree-nuts"], "liquid": True, "cost": 3, "cat": "Dairy & Alternatives"}),
    ("butter", "Butter (salted)", "FATS", "USDA FDC 173410",
     dict(kcal=717, p=0.9, f=81.1, c=0.1, fib=0, ca=24, fe=0.0, na=643, k=24, vitc=0, fol=3), {"an": "dairy", "a": ["dairy"], "cost": 2}),
    ("olive_oil", "Olive oil", "FATS", "USDA FDC 171413",
     dict(kcal=884, p=0, f=100.0, c=0, fib=0, ca=1, fe=0.6, na=2, k=1, vitc=0, fol=0), {"cost": 3}),
    ("coconut_milk", "Coconut milk", "FATS", "USDA FDC 170173",
     dict(kcal=197, p=2.0, f=21.3, c=2.8, fib=0, ca=18, fe=3.3, na=13, k=220, vitc=1, fol=14), {"liquid": True}),
    ("chia", "Chia seeds", "NUTS", "USDA FDC 170554",
     dict(kcal=486, p=16.5, f=30.7, c=7.7, fib=34.4, ca=631, fe=7.7, na=16, k=407, vitc=2, fol=49), {"cost": 3}),
    ("pumpkin_seeds", "Pumpkin seeds", "NUTS", "USDA FDC 170556",
     dict(kcal=559, p=30.2, f=49.1, c=4.7, fib=6.0, ca=46, fe=8.8, na=7, k=809, vitc=2, fol=58), {"cost": 3}),
    # Selenium ≈ 1917 µg/100 g (≈ 95 µg per 5 g nut; adult UL 400 µg/day) — keep to 1 nut a day.
    ("brazil_nut", "Brazil nuts", "NUTS", "USDA FDC 170569",
     dict(kcal=659, p=14.32, f=67.1, c=11.74, fib=7.5, ca=160, fe=2.43, na=3, k=659, vitc=0.7, fol=22),
     {"a": ["tree-nuts"], "cost": 3, "piece": (5, "nut", "nuts")}),
    ("peanut_butter", "Peanut butter (unsweetened)", "NUTS", "USDA FDC 172470",
     dict(kcal=588, p=25.1, f=50.4, c=13.9, fib=6.0, ca=43, fe=1.9, na=400, k=649, vitc=0, fol=87), {"a": ["peanut"], "cost": 2}),
    ("broccoli", "Broccoli", "VEG_B", "USDA FDC 170379",
     dict(kcal=34, p=2.8, f=0.4, c=4.0, fib=2.6, ca=47, fe=0.7, na=33, k=316, vitc=89, fol=63), {"cost": 2}),
    ("kiwi", "Kiwi", "FRUITS", "USDA FDC 168153",
     dict(kcal=61, p=1.1, f=0.5, c=11.7, fib=3.0, ca=34, fe=0.3, na=3, k=312, vitc=93, fol=25), {"cost": 3}),
    ("blueberries", "Blueberries", "FRUITS", "USDA FDC 171711",
     dict(kcal=57, p=0.7, f=0.3, c=12.1, fib=2.4, ca=6, fe=0.3, na=1, k=77, vitc=10, fol=6), {"cost": 3}),
    ("fig_dried", "Figs, dried (anjeer)", "FRUITS", "USDA FDC 168161",
     dict(kcal=249, p=3.3, f=0.9, c=54.1, fib=9.8, ca=162, fe=2.0, na=10, k=680, vitc=1, fol=9), {"cost": 3}),
    ("sugar", "Sugar", "SUGARS", "Exchange list (5 g = 20 kcal)",
     dict(kcal=400, p=0, f=0, c=99.9, fib=0, ca=1, fe=0.1, na=1, k=2, vitc=0, fol=0), {}),
    ("honey", "Honey", "SUGARS", "USDA FDC 169640",
     dict(kcal=304, p=0.3, f=0, c=82.2, fib=0.2, ca=6, fe=0.4, na=4, k=52, vitc=1, fol=2), {"an": "honey"}),
    ("salt", "Salt (iodised)", "OTHER", "NaCl: 38.76 g Na per 100 g",
     dict(kcal=0, p=0, f=0, c=0, fib=0, ca=24, fe=0.3, na=38758, k=8, vitc=0, fol=0), {"cat": "Spices & Condiments"}),
    ("tea_leaves", "Tea leaves", "OTHER", "negligible",
     dict(kcal=0, p=0, f=0, c=0, fib=0, ca=0, fe=0, na=0, k=0, vitc=0, fol=0), {"cat": "Beverages"}),
    ("coffee", "Coffee powder", "OTHER", "negligible",
     dict(kcal=0, p=0, f=0, c=0, fib=0, ca=0, fe=0, na=0, k=0, vitc=0, fol=0), {"cat": "Beverages"}),
    ("water", "Water", "OTHER", "-",
     dict(kcal=0, p=0, f=0, c=0, fib=0, ca=0, fe=0, na=0, k=0, vitc=0, fol=0), {"cat": "Others", "liquid": True}),
]

# Derived from IFCT entries.
DERIVED = [
    # Roasted chana / sattu: chana dal on a 5 % moisture basis.
    ("roasted_chana", "Roasted chana (bhuna chana)", "B001", "PULSES", {"moist": 5.0}, "IFCT 2017 B001, moisture-adjusted to 5%"),
    ("sattu", "Sattu (roasted gram flour)", "B001", "PULSES", {"moist": 5.0}, "IFCT 2017 B001, moisture-adjusted to 5%"),
]
SPICE_MIX = ("spices", "Mixed spices (masala)", ["G025", "G024", "G033", "G022"],
             "IFCT 2017 mean of cumin, coriander seed, turmeric, red chilli")

GROCERY_CAT = {
    "CEREALS": "Grains & Millets", "PULSES": "Pulses & Legumes", "MILK": "Dairy & Alternatives",
    "MEAT": "Eggs, Meat & Fish", "VEG_A": "Leafy Greens", "VEG_B": "Vegetables", "VEG_C": "Vegetables",
    "FRUITS": "Fruits", "SUGARS": "Sweeteners", "FATS": "Oils & Fats", "NUTS": "Nuts & Seeds",
    "OTHER": "Spices & Condiments",
}


def fnum(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def from_row(r, scale=1.0):
    return dict(
        kcal=round(fnum(r["enerc"]) / 4.184 * scale, 1),
        p=round(fnum(r["protcnt"]) * scale, 2),
        f=round(fnum(r["fatce"]) * scale, 2),
        c=round(fnum(r["choavldf"]) * scale, 2),
        fib=round(fnum(r["fibtg"]) * scale, 2),
        ca=round(fnum(r["ca"]) * 1000 * scale, 1),
        fe=round(fnum(r["fe"]) * 1000 * scale, 2),
        na=round(fnum(r["na"]) * 1000 * scale, 1),
        k=round(fnum(r["k"]) * 1000 * scale, 1),
        vitc=round(fnum(r["vitc"]) * 1000 * scale, 1),
        fol=round(fnum(r["folsum"]) * 1e6 * scale, 1),
    )


def entry(key, name, group, source, n, flags):
    e = {
        "key": key, "name": name, "group": group, "source": source,
        "per100": {"kcal": n["kcal"], "protein": n["p"], "fat": n["f"], "carbs": n["c"], "fibre": n["fib"],
                   "calcium": n["ca"], "iron": n["fe"], "sodium": n["na"], "potassium": n["k"],
                   "vitaminC": n["vitc"], "folate": n["fol"]},
        "category": flags.get("cat", GROCERY_CAT[group]),
        "cost": flags.get("cost", 1),
    }
    if flags.get("a"): e["allergens"] = flags["a"]
    if flags.get("an"): e["animal"] = flags["an"]
    if flags.get("root"): e["root"] = True
    if flags.get("liquid"): e["liquid"] = True
    if flags.get("piece"):
        g, s, pl = flags["piece"]
        e["piece"] = {"grams": g, "singular": s, "plural": pl}
    return e


def main():
    src, out = sys.argv[1], sys.argv[2]
    rows = {r["code"]: r for r in csv.DictReader(open(src, encoding="utf-8"))}
    items = []
    for key, name, code, group, flags in IFCT:
        r = rows[code]
        items.append(entry(key, name, group, f"IFCT 2017 {code}", from_row(r), flags))
    for key, name, code, group, flags, source in DERIVED:
        r = rows[code]
        scale = (100 - flags["moist"]) / (100 - fnum(r["water"]))
        items.append(entry(key, name, group, source, from_row(r, scale), flags))
    key, name, codes, source = SPICE_MIX
    parts = [from_row(rows[c]) for c in codes]
    mean = {k: round(sum(p[k] for p in parts) / len(parts), 2) for k in parts[0]}
    items.append(entry(key, name, "OTHER", source, mean, {"cat": "Spices & Condiments"}))
    for key, name, group, source, n, flags in EXTRA:
        items.append(entry(key, name, group, source, n, flags))

    keys = [i["key"] for i in items]
    dupes = {k for k in keys if keys.count(k) > 1}
    assert not dupes, dupes

    # Known data errors: energy recomputed from the item's own macros.
    ENERGY_FROM_MACROS = {
        "chicken": "IFCT 2017 N001 (energy recomputed: published 384 kcal is inconsistent with its own P/F)",
    }
    for i in items:
        if i["key"] in ENERGY_FROM_MACROS:
            p = i["per100"]
            p["kcal"] = round(4 * p["protein"] + 9 * p["fat"] + 4 * p["carbs"], 1)
            i["source"] = ENERGY_FROM_MACROS[i["key"]]

    # Energy fallback + consistency check (IFCT energy = 17P + 37F + 17C + 8Fib kJ).
    print("--- energy checks ---")
    for i in items:
        p = i["per100"]
        atw = 4 * p["protein"] + 9 * p["fat"] + 4 * p["carbs"] + 2 * p["fibre"]
        if p["kcal"] == 0 and atw > 0:
            p["kcal"] = round(atw, 1)
            print(f"  filled  {i['key']:16} kcal={p['kcal']} (was missing)")
        elif atw > 0 and abs(p["kcal"] - atw) / max(atw, 1) > 0.12:
            print(f"  MISMATCH {i['key']:15} stated={p['kcal']} atwater={round(atw,1)}  [{i['source']}]")

    body = json.dumps(items, indent=1, ensure_ascii=False)
    ts = (
        "// AUTO-GENERATED from IFCT 2017 (ICMR-NIN, Indian Food Composition Tables)\n"
        "// plus documented label/USDA sources for foods IFCT does not cover.\n"
        "// Values are per 100 g edible portion (per 100 ml for liquids).\n"
        "// Regenerate with scratch tool gen_ingredients.py; do not hand-edit numbers.\n\n"
        "import type { Ingredient } from \"./types\";\n\n"
        f"export const INGREDIENTS: Ingredient[] = {body} as Ingredient[];\n"
    )
    open(out, "w", encoding="utf-8").write(ts)
    print(f"wrote {len(items)} ingredients -> {out}")
    # sanity print of a few
    for i in items:
        if i["key"] in ("atta", "rice", "moong_dal", "paneer", "egg", "chicken_breast", "fish_rohu", "oil", "ghee",
                        "roasted_chana", "spices", "spinach", "onion", "banana", "sweet_corn", "green_peas", "coconut_water"):
            p = i["per100"]
            print(f"  {i['key']:15} {p['kcal']:6} kcal P{p['protein']:5} F{p['fat']:5} C{p['carbs']:5} Fib{p['fibre']:5} "
                  f"Ca{p['calcium']:6} Fe{p['iron']:5} Na{p['sodium']:6} K{p['potassium']:6} C{p['vitaminC']:5}  [{i['source']}]")


if __name__ == "__main__":
    main()
