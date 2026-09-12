# Job Match

Private job-matching tool. It collects recent software jobs, scores the description, skips Interact Global, and emails Waqas Rafique's CV. Daily must-send: 5–10 Lahore full-stack CVs and 20 companies total (Lahore onsite, Lahore remote, worldwide remote).

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
- `LAHORE_DAILY_SEND_MAX` = `10`
