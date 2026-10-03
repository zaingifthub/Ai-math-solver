# Production audit suite

Black-box checks that run against a running instance of the app (local, staging or production).

| Script | What it verifies |
|---|---|
| `api-audit.mjs` | 111 API checks: registration & login, 401/403 role enforcement, cross-user access (IDOR), CSRF, validation, practice answer secrecy, admin CRUD on every CMS resource (incl. partial updates and XSS sanitizing), suspension, audit log, cron/webhook protection, rate limits (incl. spoofed `X-Forwarded-For`), per-network guest quotas, password reset, body-size limits |
| `crawl-pages.mjs` | Every sitemap URL + auth pages on desktop and mobile: status codes, title/description length & uniqueness, canonical, Open Graph/Twitter, single H1, valid JSON-LD, image alt text, console errors, horizontal overflow |
| `crawl-private.mjs` | Every dashboard and admin page as an admin, desktop + mobile: status, overflow, H1, `noindex`, console errors |
| `e2e.mjs` | 13 browser flows: solve, math keyboard, calculators, graphing, practice, register → dashboard, history & bookmarks, admin CMS publishing, mobile menu |
| `mock-anthropic.mjs` | Local mock of the Claude Messages API (JSON + SSE streaming + tool use) so AI explanations, word problems, photo OCR and the tutor can be tested without an API key. Switch modes with `GET /__mode/ok|refusal|error`. |

```bash
cd audit && npm install && npx playwright install chromium
# Optional: run the app against the mock AI
#   ANTHROPIC_API_KEY=test ANTHROPIC_BASE_URL=http://127.0.0.1:4010 npm start   (and `npm run mock-ai` here)
BASE_URL=http://localhost:3000 ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=... CRON_SECRET=... npm run all
```

`api-audit.mjs` creates throwaway users and needs `DATABASE_URL` (it uses the app's Prisma client for the password-reset step), so run it from the repository with the app's `.env` loaded, against a non-production database.
