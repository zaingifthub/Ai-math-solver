# Content & scaling guide

## Adding a calculator (one entry)

All calculators live in `src/lib/calculators/registry.ts`. Add an object:

```ts
{
  slug: "midpoint-calculator",
  title: "Midpoint Calculator",
  shortTitle: "Midpoint",
  category: "geometry",
  icon: "Crosshair",                  // any lucide-react icon name
  description: "…meta description…",
  kind: "engine",                     // "engine" → full steps via /api/solve, "instant" → client compute
  fields: [{ name: "a", label: "Point A", type: "text", default: "(1, 2)" }, { name: "b", label: "Point B", type: "text", default: "(5, 8)" }],
  build: (v) => `midpoint of ${v.a} and ${v.b}`,
  intro: "…", howTo: ["…"], examples: [{ problem: "…", answer: "…" }], faqs: [{ q: "…", a: "…" }],
  related: ["slope-calculator"], formulas: ["midpoint-formula"], keywords: ["midpoint calculator"],
}
```

The page `/calculators/midpoint-calculator`, its metadata, schema, breadcrumbs, sitemap entry and internal links are generated automatically. Editors can override the title, intro, FAQs, SEO fields and add long-form content in **Admin → Calculators** without a deploy, or disable a calculator.

For thousands of programmatic tools, generate entries from data (e.g. a JSON list of unit pairs or shapes) and spread them into `CALCULATORS`; `generateStaticParams` + ISR keep builds fast.

## Formulas, blog posts, pages, FAQs

Managed entirely in the admin CMS (Markdown with `$inline$` / `$$display$$` LaTeX, live preview). Publishing revalidates the affected pages instantly; scheduled posts publish at their date. Seed content lives in `src/lib/content/` and is used as a fallback when the database is empty.

## Extending the math engine

1. Add an intent to `classify.ts`.
2. Implement a solver in `src/lib/math/solvers/` returning `SolverOutput` (steps, formulas, verification checks).
3. Dispatch it in `engine.ts`.
4. Add tests in `tests/engine.test.ts`.

## Scaling the infrastructure

- **Horizontal scaling:** set `RATE_LIMIT_STORE=database`; run multiple PM2 instances/servers behind Nginx; sessions are JWT (stateless).
- **Uploads:** move to object storage (S3/R2) if you run several servers.
- **Database:** add a read replica for analytics; usage events can be partitioned by month.
- **AI cost control:** per-plan daily quotas in `src/lib/plans.ts`, credits, and the admin AI-usage dashboard.
