# AI Math Solver

A production-ready AI math learning platform: **verified step-by-step solver + AI tutor + calculator library + graphing + practice system + math knowledge base**, built with Next.js 16, TypeScript, Tailwind CSS, PostgreSQL/Prisma, NextAuth and Claude.

> Answers are **computed by a deterministic math engine and independently verified** before AI is ever involved. AI explains verified solutions, translates word problems, reads photos and powers the tutor — it never decides the final answer.

## Features

| Area | What's included |
|---|---|
| **Solver** | 20+ problem types: arithmetic (order-of-operations steps, exact fractions), linear/quadratic/polynomial/rational/radical/exponential/log/trig/absolute-value equations, linear & nonlinear systems, inequalities (sign charts), simplify/expand/factor, functions (domain, inverse, vertex, intercepts), derivatives (named rules, higher-order, partial, implicit), integrals (substitution, parts, partial fractions, definite & improper), limits (L'Hôpital, one-sided, ∞), matrices (det, inverse, RREF, rank, eigenvalues), vectors, statistics, probability, geometry, unit conversion, word problems (AI translation → engine) |
| **Every solution** | Final answer (exact + decimal), numbered steps, formulas used, explanation, **verification badge with the checks that passed**, alternative method, similar practice problem, interactive graph, optional AI explanation with tips & common mistakes |
| **Input** | Plain text, Unicode (x², √, π), LaTeX (`\frac`, `\int_0^1`, matrices), natural language ("derivative of…"), **advanced math keyboard** (6 layouts), **photo/screenshot upload & mobile camera** with OCR confidence review |
| **AI tutor** | Streaming chat with modes: explain step, explain simply, hint (no spoilers), another method, examples, practice questions, check my work, teach concept; 4 education levels; the tutor calls the math engine as a tool so its arithmetic is verified |
| **Calculators** | 30 calculators from one scalable registry (engine-backed with full steps, or instant client-side), scientific & graphing calculators; each page has SEO copy, examples, FAQ, schema and internal links; admin can override content/disable tools |
| **Graphing** | Canvas plotter: multiple functions, pan/zoom/pinch, grid & axes, automatic roots and intersections, custom points |
| **Practice** | 18 topics × 3 difficulties, generated problems with server-side answer checking (accepts equivalent forms), hints, adaptive difficulty, full worked solutions; tracks accuracy, attempts, mastery, weak topics and streaks |
| **Users** | Email/password + Google login, password reset by email, guest mode with limits, dashboard, history (search/filter), bookmarks, progress analytics, settings, account deletion |
| **Admin** | Analytics, system health & security checks, users (role/plan/status/credits), subscriptions, AI usage & cost, audit log, CMS for blog posts, categories, pages/resources, formulas, calculator content, FAQs, SEO overrides, site settings — with role permissions (USER / EDITOR / ADMIN) |
| **Monetization** | Free / Premium / Education plans, daily usage limits, credits, Stripe Checkout + Billing Portal + webhooks |
| **SEO** | Landing pages (`/ai-math-solver`, `/math-solver`, `/algebra-solver`, `/calculus-solver`, `/geometry-solver`, `/statistics-solver`), `/math-tools`, `/calculators`, `/math-formulas`, `/blog`; dynamic metadata, canonical URLs, Open Graph & Twitter cards, dynamic OG images, JSON-LD (Organization, WebSite+SearchAction, SoftwareApplication, WebApplication, HowTo, FAQPage, Article, BreadcrumbList, ItemList, LearningResource, Product), XML sitemap, robots.txt, breadcrumbs, clean URLs |
| **Security** | CSRF origin checks, NextAuth CSRF, rate limiting (memory or Postgres), per-plan quotas, zod validation everywhere, XSS-safe Markdown/KaTeX rendering, strict CSP & security headers, login lockout, bcrypt, magic-byte upload validation, upload expiry cleanup, CAS sandboxed in a worker with timeouts, audit logging |

## Quick start (local)

Requirements: Node.js ≥ 20.9 (22 recommended), PostgreSQL 14+.

```bash
cp .env.example .env            # then edit DATABASE_URL, NEXTAUTH_SECRET, etc.
npm install
npx prisma migrate deploy       # create tables
SEED_ADMIN_PASSWORD='choose-a-strong-password' npm run db:seed   # content + admin from ADMIN_EMAILS
npm run dev                     # http://localhost:3000
```

AI runs on Anthropic Claude (`ANTHROPIC_API_KEY`) or, if that is empty, Google Gemini (`GEMINI_API_KEY`). Without either key the solver, calculators, graphing and practice work fully; AI explanations, the tutor, photo OCR and word problems are disabled gracefully.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm test` | Math-engine and practice test suite (Vitest) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run db:migrate` | Create a new migration (development) |
| `npm run db:deploy` | Apply migrations (production) |
| `npm run db:seed` | Seed categories, articles, formulas, FAQs, legal pages, admin |
| `npm run cleanup:uploads` | Trigger the cleanup cron endpoint |

## Documentation

- [Architecture & competitor analysis](docs/ARCHITECTURE.md)
- [Deploying to a Hostinger VPS](docs/DEPLOYMENT-HOSTINGER.md)
- [Deploying to Vercel](docs/DEPLOYMENT-VERCEL.md)
- [Adding calculators, formulas & content at scale](docs/CONTENT-AND-SCALING.md)

## Project structure

```
prisma/                 schema, migrations, seed
src/app/(site)/         public pages, landing pages, calculators, blog, dashboard
src/app/(auth)/         login & register
src/app/admin/          admin panel
src/app/api/            REST API (solve, ocr, tutor, practice, history, billing, admin, cron…)
src/lib/math/           math engine: normalize → classify → solvers → verification
src/lib/ai/             Claude integration: explanations, tutor, OCR, word problems
src/lib/calculators/    calculator registry (one entry per tool)
src/lib/content/        seed content: formulas, blog, landing pages
src/components/         UI (shadcn-style), solver, graph, calculators, tutor, admin
tests/                  Vitest suites
deploy/                 nginx, PM2 deploy & backup scripts
```
