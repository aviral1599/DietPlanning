# Deploying NutriPlan for free (Vercel + Neon)

This gives you a permanent public URL (`https://your-app.vercel.app`) that anyone can
open and test from their own computer. Both services used here have free tiers.

The app now uses **PostgreSQL** (Neon) instead of the local SQLite file, because
Vercel can't keep a SQLite file between requests.

Total time: ~15 minutes. You'll need a browser and a terminal.

---

## Step 1 — Create a free database (Neon)

1. Go to **https://neon.tech** and sign up (free, GitHub/Google login works).
2. Click **Create project** → give it a name (e.g. `nutriplan`) → **Create**.
3. On the project dashboard, find the **Connection string** box.
   - Make sure the **"Pooled connection"** toggle is ON.
   - Copy the string. It looks like:
     `postgresql://user:pass@ep-xxxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require`

---

## Step 2 — Point the app at Neon and load the data (one time)

In your terminal:

```bash
cd /Users/aviral/DietPlanning
```

Open the `.env` file and set the two values:

```
DATABASE_URL="<paste your Neon pooled connection string here>"
AUTH_SECRET="<a long random string>"
```

Generate a good `AUTH_SECRET` with:

```bash
openssl rand -base64 32
```

Now create the tables in Neon and load the 183 food-exchange items:

```bash
npm run db:push
npm run db:seed
```

(Optional) test it locally against Neon before deploying:

```bash
npm run dev        # open http://localhost:3000
```

---

## Step 3 — Put the code on GitHub

If you don't already have the repo on GitHub:

```bash
cd /Users/aviral/DietPlanning
git init
git add .
git commit -m "NutriPlan diet planner"
```

Then create an empty repo at **https://github.com/new** (name it `nutriplan`, keep it
Private or Public — your choice, don't add a README), and run the two commands GitHub
shows you, which look like:

```bash
git remote add origin https://github.com/<your-username>/nutriplan.git
git branch -M main
git push -u origin main
```

> Your secrets are safe: `.env` is git-ignored and never uploaded. You'll set the
> secrets directly in Vercel in the next step.

---

## Step 4 — Deploy on Vercel

1. Go to **https://vercel.com** and sign up (use **Continue with GitHub**).
2. Click **Add New… → Project**, then **Import** your `nutriplan` repo.
3. Before clicking Deploy, expand **Environment Variables** and add:
   - `DATABASE_URL` = your Neon pooled connection string (same as `.env`)
   - `AUTH_SECRET` = the same long random string as `.env`
4. Click **Deploy**. Wait ~1–2 minutes.
5. Vercel gives you a URL like `https://nutriplan-xxxx.vercel.app`. Open it.

Done. Share that URL. Each person who opens it clicks **Create account** to get their
own coach login — their clients are private to their account.

---

## Updating the app later

Any time you change the code:

```bash
git add .
git commit -m "describe your change"
git push
```

Vercel auto-deploys every push to `main`. If you ever change the database schema
(`prisma/schema.prisma`), run `npm run db:push` once more (with `.env` pointing at Neon)
to apply it.

---

## Free-tier notes

- **Vercel Hobby** and **Neon Free** are intended for personal / non-commercial use and
  are perfect for testing and demos. For a paid clinic product later, upgrade the plans.
- Neon free databases may **auto-suspend when idle** — the first request after a pause
  can take a few extra seconds to wake, then it's fast again.
- AI analysis stays optional: it only runs if a coach adds an Anthropic API key in
  **Settings**, or if you set `ANTHROPIC_API_KEY` as an env var in Vercel.
