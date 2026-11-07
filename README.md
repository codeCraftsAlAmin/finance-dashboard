# Khata

A personal finance and life dashboard. Track income and expenses, monthly payments (tuition you earn,
bills you pay), money lent and borrowed, books, dates to remember, tools to learn, and an encrypted
vault for account passwords. Every page has charts. Built with Next.js, FastAPI and SQLite (PostgreSQL in production).

| Page | What it does | Charts |
| --- | --- | --- |
| Overview | This month at a glance, upcoming dates, open bills, loans, books, learning | Income vs expenses line, spending donut |
| Money | Income and expense entries with categories, search and month filter | Spending by category, by day, 6-month trend |
| Monthly | Tuition and bills as a month-by-month board: paid, running, overdue | Paid vs open per month |
| Lend & borrow | Who owes whom, repayments, remaining balance | Balance by person |
| Books | To buy (author, name, price), shelf, read, ratings | Books finished per month, library mix |
| Dates | Birthdays, anniversaries, exams with countdowns; yearly repeat | Dates per month |
| Learn | Tools to learn: details, source link, priority, progress | Progress donut |
| Challenges | 30-day skill challenges: daily check-ins, month grids, claim early, achievement box | Progress vs pace line |
| Vault | Logins, encrypted with your master password | none |

Marking a monthly bill paid, or a wish-list book as bought, adds the matching expense to Money automatically.

## Run it locally

```bash
# 1. API (http://127.0.0.1:8000)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
alembic upgrade head
python -m scripts.seed_demo        # optional: demo@example.com / demo-password, vault password: demo-master-pass
uvicorn app.main:app --reload

# 2. Web (http://localhost:3000), in another terminal
cd frontend
cp .env.example .env.local         # API_ORIGIN=http://127.0.0.1:8000
npm install
npm run dev
```

Checks: `pytest` and `ruff check .` in `backend`; `npm run typecheck && npm run lint && npm test` in `frontend`.

## Deploy (free tiers)

SQLite files are wiped on Render's free tier, so use a free PostgreSQL database online.

1. **Database:** create a project on [Neon](https://neon.tech) and copy the connection string.
2. **API on Render** (Web Service, root directory `backend`):
   - Build: `pip install -r requirements.txt`
   - Start: `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Env: `ENVIRONMENT=production`, `SECRET_KEY` (random, 32+ chars), `DATABASE_URL` (Neon string),
     `CORS_ORIGINS` (your Vercel URL).
3. **Web on Vercel** (root directory `frontend`): set `API_ORIGIN` to the Render URL, then deploy.
   Vercel reads it at build time, so redeploy after changing it.
4. Render's free tier sleeps after about 15 minutes. A cron job (for example cron-job.org) calling
   `https://<your-api>/api/health` every 10 minutes keeps it awake.

## How it works

- **Auth:** bcrypt password hashes, a JWT in an HttpOnly SameSite cookie, login rate limiting. The browser only talks to
  its own origin; Next.js proxies `/api/*` to FastAPI, so there is no CORS to configure for the browser.
- **Privacy:** everyone can register and sees only their own data. Other people's records return 404.
- **Money:** stored as integer minor units (paisa), never floats. Months are `YYYY-MM`. "Today" follows your time zone.
- **Vault:** your master password is never stored. A key is derived with scrypt and passwords and notes are encrypted
  with AES-256-GCM. Unlocking returns a ten-minute token kept in memory only, so a refresh or leaving the page locks it.
  The database holds ciphertext only. Forgotten master password: the vault can be reset, which deletes its contents.
- **Charts:** every chart has a table view, tooltips and a legend, and works in light and dark mode.
