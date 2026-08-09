# NutriPlan — Clinical Diet Planner

A full-stack web app for health coaches / dietitians (built for **Master Mind Body Global**)
that turns a client's assessment into a complete, exchange-based diet plan and a
downloadable report — following the Indian dietetics case-study format and the
food-exchange system.

## What it does

- **Coach accounts** (register / login) with all client reports stored in one place.
- **Client intake** — name, age, sex, height, weight, activity level, income group,
  food allergies, diet preference (veg/non-veg/egg/vegan), condition/goal, objective.
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
