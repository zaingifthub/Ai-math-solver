# Production audit — 2026-10-03

Black-box audit of a production build (`next build` → standalone server, PostgreSQL 16), using the suite in [`audit/`](../audit/README.md). AI features were exercised against a local mock of the Claude Messages API (same wire format, including SSE streaming and tool use), because no API key was available in the audit environment.

## Results

| Area | Result |
|---|---|
| Public pages | 107 URLs (97 from the sitemap + auth pages + 404 probes) × desktop/mobile: correct status codes, **0 console errors, 0 horizontal overflow** |
| Private pages | 7 dashboard + 13 admin pages × desktop/mobile: all 200, no overflow, one H1, all `noindex`, no console errors |
| APIs | **111/111** checks: auth, 401/403 role enforcement, IDOR, CSRF, validation, rate limits, quotas, admin CRUD on 8 CMS resources, password reset, cron/webhook protection |
| Database | Connected; migrations applied; `/api/health` reports DB/auth/AI/billing/email state and returns 503 when the DB is down |
| Authentication | Register, login, wrong password, lockout, suspension (blocks login), password change, **password reset**, role escalation attempts rejected |
| AI responses | Explanations (structured output), word-problem translation, tutor streaming with a real tool round-trip to the math engine, conversation persistence; refusals and API outages degrade gracefully |
| OCR | Upload → magic-byte validation → vision transcription → confidence → solve; fake images rejected; per-guest and per-network quotas enforced |
| Admin | Analytics, users, subscriptions, AI usage, audit log, new **Health & security** page, CMS create/update/delete on every resource |
| SEO | Titles ≤ 70 chars, descriptions ≤ 160, unique titles/descriptions, canonical on every page, OG + Twitter cards, valid JSON-LD, single H1, sitemap + robots |
| Mobile | No horizontal overflow at 375 px on any page; mobile nav verified |
| Browser E2E | 13/13 flows |
| Unit tests | 100/100 |
| Dependencies | `npm audit --omit=dev`: **0 vulnerabilities** |
| Builds | Succeeds with a database and with **no environment at all** (128 static pages) |

## Issues found and fixed

| # | Severity | Issue | Fix |
|---|---|---|---|
| 1 | High | Admin partial updates silently reset unspecified fields to defaults (e.g. a published post became a draft, tags were wiped) | PATCH now applies only the fields actually sent |
| 2 | High | Rate limits and logs trusted the client-controlled left-most `X-Forwarded-For` entry → limits bypassable by spoofing | Use proxy-set `X-Real-IP` (Nginx/Vercel) or the right-most hop |
| 3 | High | Guest quotas reset by clearing cookies | Added salted IP-hash quota (5 guests per network — classrooms keep working) + migration |
| 4 | High | Account pre-hijacking: someone registers a victim's email with a password before the owner signs in with Google | On Google link, an unverified password is removed and the email marked verified |
| 5 | Medium | Unparseable symbol input (e.g. `)))(((`) was sent to the AI as a "word problem", which could invent an equation | Only text containing words goes to the translator; others get a precise syntax hint (unbalanced parentheses, trailing operator…) |
| 6 | Medium | No "forgot password" flow | Email password reset: hashed single-use tokens (1 h), no account enumeration, rate limited, sessions revoked, SMTP optional |
| 7 | Medium | No request-size limit on JSON APIs (memory exhaustion) | 1 MB default, 6 MB for uploads (413) |
| 8 | Medium | Missing `NEXTAUTH_SECRET` (fresh Vercel preview) made `/api/auth/session` return 500 on every page | Auth route answers "signed out"; login/register explain what's missing; proxy never crashes |
| 9 | Medium | Database outage returned generic 500s | 503 `DB_UNAVAILABLE` with a clear message |
| 10 | Medium | CAS worker relied on `cwd` module resolution (fragile on serverless) | Absolute module paths passed to the worker + in-process fallback (tested) |
| 11 | Medium | `nodemailer` advisories / `deepmerge-ts` advisory | nodemailer 10.0.13, deepmerge-ts 8.0.2 via overrides |
| 12 | Medium | 8 pages overflowed horizontally on phones (wide formulas inside grid cards) | Grid children may shrink; formulas scroll inside their card |
| 13 | Low | Math keyboard: typing immediately after tapping a key could land characters in the wrong place | Caret set synchronously in a layout effect; E2E test with 5 rapid rounds |
| 14 | Low | 25 titles > 70 chars, 5 descriptions > 160 chars | Brand suffix dropped automatically when too long; descriptions clamped at word boundaries |
| 15 | Low | Refused AI explanation showed nothing; failed first tutor message left an empty conversation | Clear message; empty conversation removed |
| 16 | Low | Tutor `maxDuration = 300` exceeds Vercel Hobby limits | 60 s (responses stream) |
| 17 | Low | Guests could not try the tutor at all | 3 tutor messages/day for guests |

## Not verifiable in the audit environment

- **Real Claude responses**: integration verified against a protocol-accurate mock; answer quality depends on the live model. Configure `ANTHROPIC_API_KEY` and use **Admin → Health & security** plus a few manual tests.
- **Google OAuth, Stripe checkout/webhooks, SMTP delivery**: need real credentials; code paths are covered by types, unit logic and signature/secret checks.
- **Docker image build** (Docker unavailable) and **PageSpeed score** (measure on the live domain).

## Re-running the audit

See [`audit/README.md`](../audit/README.md).
