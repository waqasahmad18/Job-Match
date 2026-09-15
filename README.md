# Job Match

Private job-matching tool. It collects recent software jobs, scores the description, skips Interact Global, and emails Waqas Rafique's CV. Daily target stays equal: 25 Lahore (onsite + Lahore remote) and 25 worldwide remote, sent in small waves from 8:00 AM Pakistan time.

## Local

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open http://localhost:3002/login

## Vercel env vars

Set these in the Vercel project before deploy. Do not commit `.env.local`.

- `MONGODB_URI`
- `MONGODB_URI_STANDARD`
- `MONGODB_DB` = `fast_and_slow_pos`
- `SMTP_HOST` = `smtp.gmail.com`
- `SMTP_PORT` = `587`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `EMAIL_FROM`
- `APPLICANT_NAME`
- `APPLICANT_EMAIL`
- `AUTH_SECRET`
- `AUTH_USERNAME_HASH`
- `AUTH_PASSWORD_HASH`
- `CRON_SECRET`
- `WATCH_INTERVAL_MINUTES` = `360`
- `RECENT_JOB_MAX_DAYS` = `14`
- `LAHORE_DAILY_SEND_MAX` = `25`
- `REMOTE_DAILY_SEND_TARGET` = `25`
- `RAPIDAPI_KEY` — **required for Google Jobs** (JSearch). Without it, Lahore full-stack Google postings are skipped. Get a key from RapidAPI → JSearch, then set it in Vercel env.

## Daily automation

Vercel Hobby allows one cron per day. It is set to `0 3 * * *` UTC, which is the **8:00–8:59 AM Pakistan** hour. Vercel may fire anytime inside that hour.

Collect targets:
- Every seeded Lahore software house (careers page email / Contact Us / Greenhouse ATS)
- Google Jobs full-stack Lahore queries via JSearch when `RAPIDAPI_KEY` is set
- Worldwide remote houses + public remote boards

Later waves use GitHub Actions. In the GitHub repo go to **Settings → Secrets and variables → Actions** and add:

- `CRON_SECRET` — same value as the Vercel `CRON_SECRET`
- `APP_URL` — optional, defaults to `https://job-match-tan.vercel.app`
