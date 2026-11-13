# NutriPlan — Clinical Diet Planner

A full-stack web app for health coaches / dietitians (built for **Master Mind Body Global**)
that turns a client's assessment into a complete, exchange-based diet plan and a
downloadable report — following the Indian dietetics case-study format and the
food-exchange system.

## What it does

- **Coach accounts** (register / login) with all client reports stored in one place.
- **Client intake** — name, age, sex, height, weight, activity level, income group,
  food allergies, diet preference (veg / non-veg / egg / vegan / Jain), condition/goal, objective.
- **Insulin resistance / prediabetes** — flag a client as insulin resistant or prediabetic on top of
  any condition (e.g. PCOS + insulin resistance), or pick it as the main condition. Optional labs
  (HbA1c, fasting & 2-h glucose, fasting insulin) are interpreted live, HOMA-IR is calculated, and
  the app suggests the matching status (or warns when values are in the diabetes range).
- **Automatic calculations** — IBW, BMI (Asian-Indian cut-offs), BMR, Energy = BMR + PA + SDA,
  weight status, protein/fat/CHO (grams + kcal + %), and an ICMR **RDA vs MRDA** comparison.
  Formula methods (BMR, IBW, activity factor, protein g/kg, fat %) are all adjustable.
- **Exchange-based menu planner** — a 183-item food-exchange database (from the exchange list)
  drives three menus: **Comprehensive** (exchanges per food group), **Distributive**
  (exchanges across 7 meal times), and **Descriptive** (editable recipes). Live totals
  reconcile against targets.
- **Analysis engine** — condition-aware dietary goals, do's & don'ts, and foods to
  include/exclude (PCOS, diabetes, thyroid, hypertension, renal, pregnancy, weight
  loss/gain, high-protein, general). Allergies are auto-excluded. Fully editable.
- **AI (optional)** — add an Anthropic API key in Settings to enrich the analysis with a
  Claude-generated clinical narrative and personalised recommendations. Works fully
  without a key using the built-in engine.
- **Charts** — macro split pie, RDA-vs-planned bars, energy-by-meal bars.
- **Exports** — branded **PDF** report (mirrors the format doc), **Excel** workbook
  (5 sheets), and **CSV**.

### Food Bank (`/dashboard/food-bank`)

- **312 standardised dishes** — traditional and modern, from every region (North, South,
  West, East), millets, plus continental / fusion / Indo-Chinese options — and **204 raw
  ingredients**.
- Nutrition is **computed, not typed in**: each dish lists raw ingredient weights per unit
  (1 roti, 1 katori, 1 idli…) including oil and salt, and its 11 nutrients (energy, protein,
  fat, carbs, fibre, Ca, Fe, Na, K, vitamin C, folate) are summed from ingredient data.
- Ingredient values come from **IFCT 2017 (ICMR-NIN)** by food code wherever available;
  the few items IFCT lacks (toned milk, curd, oats, soya chunks, tofu, bread…) cite their
  label / USDA source. Every source is visible in the app.
- Diet suitability (veg / egg / vegan / Jain), allergens, food-group exchanges and tags such
  as high-protein, iron-rich or low-calorie are **derived automatically** from ingredients.
- Every dish shows an **estimated glycaemic load** per portion. **Low GI** and **Insulin-friendly**
  tags are derived from GI, carbohydrate load, fibre, protein and added sugar; 27 dishes were
  added specifically for insulin resistance (barley, jowar, bajra and kodo dishes, protein-first
  breakfasts, methi–cinnamon water, carb + protein snacks).
- Coaches can browse with chip filters, open any dish's full profile, and **create or
  duplicate custom dishes** (recipe builder with live nutrition, or manual values).

### Diet Charts (report → *Diet Chart* tab)

- Generates **weekly, 2-week or monthly (28-day)** day-by-day plans of real dishes, sized to
  the client's energy and protein targets and the meal split from the distributive menu.
- Meals are assembled like Indian meals (anchor dal/protein/one-pot → matching staple →
  sabzi → salad → curd); breakfasts bring their sides (idli → sambar + chutney).
- **Rotation rules** keep variety high (staples daily, most dishes ≥ 3 days apart, rich
  dishes at most weekly) — a typical month uses 140–180 different dishes.
- Always respects diet preference, allergies, condition contraindications, non-veg days,
  excluded ingredients/dishes, cuisine and focus preferences.
- **Pill/chip editor**: click any meal to change portions, lock a dish, get smart swaps
  (energy-matched, labelled *more protein* / *lighter*), or add from the food bank.
- Live daily and weekly meters for energy, protein, carbs, fat, fibre and sodium.
- Grocery list per week, **PDF** (week grid + grocery list) and **Excel** export.

### Client Portal (`/portal`)

- The coach creates a login for the client from the report's *Client Portal* tab (a
  secure password is generated and shown once, with a ready-to-send message).
- Mobile-first portal: **Today** (timed meals, recipes, portions), the full **Plan**,
  **Grocery** list, **Profile** (assessment, goals, do's & don'ts) and **Requests**.
- Clients can **request** a swap, portion change, removal or addition (this day or every
  occurrence). Nothing changes until the nutritionist approves it in **Requests** (with the
  nutritional impact shown); the client is notified when their plan is updated.
- Separate client sessions; coaches can pause access instantly.

## Tech stack

Next.js 15 (App Router, TypeScript) · Tailwind CSS · Prisma + PostgreSQL · JWT auth
(jose + bcryptjs) · Recharts · @react-pdf/renderer · exceljs · Anthropic SDK.

## Getting started

The app uses PostgreSQL. The quickest free database is **Neon** (neon.tech) — create a
project and copy its pooled connection string.

```bash
npm install
# put your Postgres URL + a random AUTH_SECRET in .env (see .env.example)
npm run setup      # creates the tables and seeds the food-exchange data
npm run dev        # http://localhost:3000
```

Then open http://localhost:3000, create a coach account, and click **New Diet Plan**.

### Environment

Copy `.env.example` to `.env` and set:
- `DATABASE_URL` — your Postgres connection string (Neon pooled string recommended).
- `AUTH_SECRET` — a long random string (`openssl rand -base64 32`).
- `ANTHROPIC_API_KEY` — optional global fallback for AI (coaches can also add their own key in Settings).

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run setup` | `prisma db push` + seed exchange data |
| `npm run db:seed` | Re-seed the food-exchange database |
| `npm run db:studio` | Open Prisma Studio to inspect the DB |
| `npm run foodbank:check` | Validate the food bank and stress-test the chart generator on 8 client profiles |

## Deploying to the cloud (free)

See **[DEPLOY.md](DEPLOY.md)** for a click-by-click guide to hosting on **Vercel + Neon**
for free — you get a permanent public URL others can test from their own computers.

## Calculation notes

- **IBW**: Broca (default), Devine, or BMI-22 target.
- **BMR**: Harris–Benedict revised (default), Mifflin–St Jeor, or ICMR/FAO-WHO.
- **Energy**: `BMR + PA + SDA`, where PA = activity-factor × BMR and SDA = 10% of (BMR+PA);
  a goal adjustment (deficit/surplus) is applied for weight-loss/gain/PCOS.
- **Macros**: protein from g/kg of ideal (or actual) weight; fat as % of energy;
  carbohydrate as the remainder — `CHO = [Energy − (P×4 + F×9)] ÷ 4`.
- Exchange units use Atwater factors (4/9/4) so the whole plan reconciles internally.

_This tool supports qualified practitioners; it does not replace individualised clinical judgement._
