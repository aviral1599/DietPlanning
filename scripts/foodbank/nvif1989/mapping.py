# food-bank ingredient key -> NVIF 1989 serial number (common foods). "~" = approximate match.
MAP = {
 "atta":21,"maida":22,"daliya":20,"suji":24,"vermicelli":25,"rice":12,"rice_brown":11,"rice_parboiled":10,
 "poha":14,"murmura":15,"ragi":8,"jowar":4,"bajra":1,"makki":5,"sweet_corn":6,"barley":2,"little_millet":16,"kodo_millet":18,
 "moong_dal":35,"moong_whole":34,"masoor_dal":38,"masoor_whole":38,"toor_dal":44,"chana_dal":29,"besan":29,"kala_chana":28,
 "urad_dal":31,"urad_whole":31,"rajma":43,"lobia":32,"moth":39,"kulthi":36,"peas_dry":41,"soybean":46,
 "milk_cow":420,"milk_buffalo":419,"paneer":426,"khoa":429,"egg":402,"chicken_breast":405,"chicken":405,"mutton":410,"mutton_lean":406,
 "fish_rohu":377,"fish_catla":347,"fish_pomfret":370,"fish_mackerel":355,"fish_sardine":364,"fish_seer":382,"fish_basa":366,
 "fish_tuna":395,"fish_hilsa":341,"prawns":371,"crab":334,
 "spinach":110,"methi":79,"sarson":97,"bathua":59,"amaranth_leaves":49,"drumstick_leaves":78,"colocasia_leaves":73,"cabbage":66,
 "lettuce":89,"coriander":75,"mint":94,"curry_leaves":77,"cauliflower":144,"bhindi":166,"brinjal":142,"lauki":141,"tinda":184,
 "turai":180,"karela":139,"parwal":173,"pumpkin":178,"ash_gourd":137,"snake_gourd":181,"tindora":164,"capsicum":157,
 "french_beans":155,"cluster_beans":146,"broad_beans":143,"green_peas":40,"tomato":306,"cucumber":149,"drumstick":151,
 "raw_banana":176,"raw_jackfruit":158,"raw_papaya":172,"raw_mango":170,"knol_khol":165,"spring_onion":171,"celery":70,
 "potato":125,"sweet_potato":130,"carrot":118,"beetroot":117,"radish":129,"arbi":119,"yam":134,"onion":122,"tapioca":131,"water_chestnut":187,
 "apple":240,"banana":245,"papaya":287,"guava":261,"orange":283,"mosambi":275,"pomegranate":296,"watermelon":281,"muskmelon":280,
 "pear":291,"mango":278,"grapes":258,"chikoo":303,"pineapple":294,"strawberry":305,"jamun":266,"amla":239,"custard_apple":304,
 "litchi":271,"plum":295,"peach":290,"dates":254,"raisins":300,"apricot_dried":242,"avocado":243,"coconut_water":198,
 "oil":438,"mustard_oil":438,"sunflower_oil":438,"rice_bran_oil":438,"coconut_oil":438,"sesame_oil":438,"ghee":435,
 "almonds":189,"walnuts":212,"cashews":192,"pistachios":208,"peanuts":202,"flaxseed":205,"sesame":201,"sunflower_seeds":211,
 "coconut":195,"coconut_dry":194,"mustard_seeds":206,"jaggery":441,"garlic":224,"ginger":225,"green_chilli":218,"tamarind":236,
 "cumin":222,"fenugreek_seeds":223,"turmeric":237,"black_pepper":232,"roasted_chana":30,"sattu":30,
 "sabudana":446,"bread_brown":26,"bread_white":27,"curd":423,"cheese":428,"butter":434,"watermelon_seeds":213,"chironji":209,
 "sugar":439,"honey":440,"zucchini":186,
}
# Approximate pairings (same food family, different form/variety) — shown, but not used to flag discrepancies.
APPROX = {"daliya","rice_brown","sweet_corn","masoor_dal","besan","chicken_breast","chicken","fish_basa","capsicum","spring_onion",
          "zucchini","sattu","paneer","khoa","cheese","curd","bread_brown","bread_white","radish","makki","mutton","lettuce"}
