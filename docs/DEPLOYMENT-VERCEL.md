# Deploying to Vercel

1. **Database:** create a managed PostgreSQL (Vercel Postgres/Neon, Supabase, Railway…). Use the *pooled* connection string for `DATABASE_URL` (add `&connection_limit=1&pgbouncer=true` for PgBouncer poolers).
2. **Import the repository** in Vercel. Framework preset: Next.js. Build command: `npm run build` (runs `prisma generate`).
3. **Environment variables:** same as `.env.example`. Set `NEXT_PUBLIC_SITE_URL` and `NEXTAUTH_URL` to your production domain, and **`RATE_LIMIT_STORE=database`** (serverless functions do not share memory).
4. **Migrations:** run once from your machine (or a CI step) against the production DB:
   ```bash
   DATABASE_URL="..." npx prisma migrate deploy
   DATABASE_URL="..." ADMIN_EMAILS="you@domain.com" SEED_ADMIN_PASSWORD="..." npm run db:seed
   ```
5. **Cron:** `vercel.json` schedules `/api/cron/cleanup` daily. Set `CRON_SECRET` in project settings — Vercel sends it automatically as a Bearer token.
6. **Domains:** add your domain in Project → Settings → Domains and follow the DNS instructions. SSL is automatic.
7. **Uploads:** on Vercel, photo uploads are written to the ephemeral `/tmp` directory only for the duration of processing (they are not needed afterwards). For persistent storage, swap `storeUpload()` in `src/lib/uploads.ts` for S3/R2/Vercel Blob.
8. **Function duration:** `/api/solve`, `/api/ocr` and the streaming `/api/tutor` use `maxDuration = 60`, which works on every Vercel plan (including Hobby).
9. **Stripe webhook:** `https://yourdomain.com/api/stripe/webhook`.
10. **Password-reset email:** set `SMTP_URL` and `EMAIL_FROM` (any SMTP provider).
11. **After deploying,** sign in as an admin and open **Admin → Health & security**: it lists anything still misconfigured.

### Minimum variables for a preview

`NEXTAUTH_SECRET` alone is enough to preview the public site (solver, calculators, graphing, formulas, blog, practice). Accounts, history and the admin panel additionally need `DATABASE_URL` (+ migrations); AI features need `ANTHROPIC_API_KEY`. Missing pieces degrade gracefully and are explained on the login page.
