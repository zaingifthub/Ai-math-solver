# Architecture

## 1. Competitor analysis

| Product | Strengths | Gaps we target |
|---|---|---|
| **Photomath** | Best-in-class camera OCR, polished mobile UX, animated steps | Mobile-first (limited web), step explanations gated behind Plus, weak beyond high-school calculus, no open-ended tutoring |
| **Symbolab** | Deep CAS coverage, huge library of solver pages that rank for long-tail SEO, practice | Dense UI, aggressive paywall on steps, explanations are mechanical rather than adaptive to level |
| **Mathway** | Very broad subject coverage (incl. chemistry/physics), simple chat-like UI | Steps paywalled, little pedagogy, dated design |
| **WolframAlpha** | Most powerful computation engine, authoritative results | Steps hidden behind Pro, expert-oriented output, not a learning experience |
| **AskMath / generic AI chat solvers** | Natural-language conversation, friendly explanations | Answers are LLM predictions — arithmetic and algebra slips are common and nothing is verified |

**Positioning:** combine the *accuracy of a CAS* (Wolfram/Symbolab) with the *pedagogy and conversation of an AI tutor* (AskMath), the *capture convenience* of Photomath, and the *SEO surface* of Symbolab — and make verification visible. Differentiators:

1. **Verified answers by construction** — engine-first pipeline with independent numerical/substitution checks shown to the user.
2. **Free step-by-step solutions** (competitors paywall steps) with monetization on AI tutoring volume.
3. **Level-adaptive explanations** (Beginner → College) and a tutor that never guesses arithmetic (it calls the engine).
4. **Learning loop**: solve → understand (tutor) → practice similar → track mastery → revisit weak topics.
5. **SEO architecture** built for thousands of tool, formula and article pages.

## 2. Solve pipeline

```
User input (text · LaTeX · keyboard · photo)
   │
   ├─ photo → /api/ocr → Claude vision → transcription + confidence → user confirms/edits
   ▼
normalize.ts   Unicode/LaTeX/handwriting conventions → canonical syntax (ln/log, |x|, x², √, %, implicit ×)
   ▼
classify.ts    intent detection → 20+ intents (equation, system, inequality, derivative, integral, limit,
               matrix, vector, statistics, probability, geometry, units, function tasks, word problem…)
   ▼
solvers/*      exact engine: mathjs (parsing, derivatives, matrices, units) + nerdamer CAS
               (integration, limits, symbolic solve, factoring) running in a sandboxed worker thread
               with hard timeouts; custom solvers produce pedagogical steps
   ▼
verification   substitution into the original equation, numeric differentiation vs symbolic derivative,
               differentiate-back for antiderivatives, adaptive Simpson for definite integrals,
               two-sided numeric limits, A·A⁻¹ = I, eigenvalue trace check, round-trip unit conversion…
   ▼
AI layer       (optional) Claude explains the verified steps at the student's level; a guard discards
               any AI output that restates a different numeric answer
   ▼
Response       answer · steps · formulas · verification · alternative · similar problem · graph · AI
```

Word problems: the classifier detects prose → Claude translates it to engine syntax (structured output) → the engine solves and verifies.

### Key design decisions

- **Engine is AI-agnostic** (`src/lib/math`) — pure TypeScript, fully unit tested, usable on its own.
- **CAS isolation**: nerdamer runs inside a `worker_threads` worker; runaway computations are killed after a timeout so a pathological input can never block the server.
- **Result cache**: deterministic engine results are cached in-process (LRU, 30 min).
- **Graceful degradation**: missing AI key, Stripe or database never break page rendering (CMS queries fall back to bundled content).

## 3. AI integration (Claude)

- Model: `claude-opus-5-5` (configurable via `AI_MODEL`), via the official `@anthropic-ai/sdk`.
- **Structured outputs** (zod schemas) for explanations, OCR and word-problem translation.
- **Server-side refusal fallback** (`fallbacks: "default"`) so a safety-classifier decline is retried automatically.
- **Tutor** streams Server-Sent Events and runs an agentic loop with a `solve_math` tool backed by the engine (strict schema, inputs re-validated).
- Effort: `low` for transcription/translation/explanations (latency), `medium` for tutoring.
- Every call records tokens and estimated cost in `UsageEvent` → admin AI-usage dashboard and quotas.

## 4. Data model (PostgreSQL / Prisma)

Users & auth (`User`, `Account`, `Session`, `VerificationToken`), billing (`Subscription`), learning (`Problem`, `Bookmark`, `TutorConversation`, `TutorMessage`, `PracticeAttempt`, `TopicProgress`), operations (`Upload`, `UsageEvent`, `RateLimitBucket`, `AuditLog`), CMS (`BlogPost`, `BlogCategory`, `ContentPage`, `Formula`, `CalculatorContent`, `Faq`, `SeoOverride`, `SiteSetting`). Indexes cover all dashboard and admin queries (user+date, guest+date, status+date).

## 5. Security

| Concern | Implementation |
|---|---|
| Authentication | NextAuth (JWT sessions, 30-day max age), bcrypt (cost 12), login rate limit, 5-strike 15-minute lockout, timing-safe unknown-user path, Google OAuth |
| Authorization | Role ranks USER < EDITOR < ADMIN enforced in every API route (authoritative) and in the proxy (UX); self-lockout prevention; suspended users lose sessions |
| CSRF | Origin/Referer same-origin check on all state-changing API routes; NextAuth double-submit token for auth routes; SameSite=Lax cookies |
| Input validation | zod on every API body/query; input length caps; CAS timeouts |
| XSS | React escaping; Markdown sanitized with sanitize-html (server) / DOMPurify (client) **before** KaTeX output (trust disabled) is inserted; JSON-LD `<` escaping; strict CSP |
| Uploads | Size limit, magic-byte type detection (never trusts MIME/extension), random names outside web root with 0600 perms, client-side re-encode strips EXIF, automatic expiry + cleanup cron |
| Abuse | Per-IP/per-user rate limits (memory or Postgres store), per-plan daily quotas, guest limits, Nginx `limit_req` |
| Headers | CSP, HSTS (HTTPS), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, COOP |
| Auditing | Admin actions, registrations, password changes, account deletions, billing events → `AuditLog` |
| Webhooks/cron | Stripe signature verification; cron endpoint requires `CRON_SECRET` (timing-safe compare) |

## 6. Performance

- Static generation + ISR for all SEO pages (calculators, formulas, blog, landing pages) — served from cache.
- Heavy libraries (mathjs for previews/graphs, graph canvas) are **lazy-loaded** only when needed; KaTeX renders server-side for content pages.
- Self-hosted Geist font (no layout shift, no third-party request), AVIF/WebP images, compression, `optimizePackageImports`.
- Canvas graphing (no heavy charting library), debounced root finding.
- DB queries are indexed and paginated; engine results cached.

## 7. SEO

- Topic landing pages + calculator, formula, blog, category and resource pages generated from data → scales to thousands of URLs.
- `buildMetadata()` gives every page a canonical URL, OG/Twitter cards and a dynamic OG image (`/og?title=`).
- Structured data per page type, breadcrumbs with `BreadcrumbList`, XML sitemap (auto-includes CMS content), robots rules that keep private areas out of the index.
- Admin **SEO overrides** per path and per-calculator SEO fields.
