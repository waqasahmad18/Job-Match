# Job Match

Private job-matching tool. It collects software jobs, scores the description, skips Interact Global, and emails Waqas Rafique's CV when a job is a strong match.

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
- `WATCH_INTERVAL_MINUTES` = `20`
