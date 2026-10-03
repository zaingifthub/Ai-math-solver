/* Seed the CMS with launch content. Idempotent: safe to run multiple times. */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { BLOG_CATEGORIES, SEED_POSTS } from "../src/lib/content/blog";
import { FORMULAS } from "../src/lib/content/formulas";

const prisma = new PrismaClient();

const FAQS = [
  { scope: "global", question: "Is AI Math Solver free?", answer: "Yes. The free plan includes verified step-by-step solutions, all calculators, graphing, formulas and practice every day. Premium removes limits and unlocks unlimited AI explanations and tutoring." },
  { scope: "global", question: "How accurate are the answers?", answer: "Answers come from a deterministic math engine (exact symbolic algebra and calculus), not from AI guesses. Each answer is then independently verified — for example by substituting solutions back or comparing with numerical calculations — and the checks are shown with every solution." },
  { scope: "global", question: "What math topics are supported?", answer: "Arithmetic, fractions, algebra, equations and inequalities, polynomials, functions, exponents and logarithms, trigonometry, geometry, limits, derivatives, integrals, statistics, probability, matrices, vectors and word problems." },
  { scope: "global", question: "Can I take a photo of my homework?", answer: "Yes. Upload a photo or screenshot; the problem is transcribed, shown to you for confirmation, and then solved step by step." },
  { scope: "global", question: "Is it cheating to use a math solver?", answer: "Used well, it is a learning tool: try the problem first, use hints and step explanations to find where you got stuck, then practice similar problems. Our AI tutor has a hint mode that never reveals the final answer." },
  { scope: "pricing", question: "Can I cancel anytime?", answer: "Yes. You can cancel from your billing page and keep Premium until the end of the current billing period." },
  { scope: "pricing", question: "Do you offer discounts for schools?", answer: "Yes — the Education plan is designed for teachers and tutors, and volume licensing is available. Contact us for classroom pricing." },
  { scope: "pricing", question: "What payment methods do you accept?", answer: "All major credit and debit cards through Stripe. We never store your card details." },
];

const PAGES = [
  {
    slug: "about",
    title: "About AI Math Solver",
    description: "Our mission is to help every student understand math, not just get answers.",
    body: `AI Math Solver helps students, parents, teachers and professionals understand mathematics.\n\n## Our approach\n\nMost AI chatbots *predict* answers. We **compute** them: a deterministic math engine solves your problem exactly, an independent verification layer checks the result, and only then does AI explain the reasoning at your level.\n\n## What we believe\n\n- Understanding beats memorizing.\n- Every answer should be checkable.\n- Great math help should be available to everyone, which is why our core tools are free.`,
  },
  {
    slug: "privacy-policy",
    title: "Privacy Policy",
    description: "How AI Math Solver collects, uses and protects your data.",
    body: `**Last updated: 2026-10-01**\n\n## Data we collect\n\n- **Account data:** name, email, and (if you use email sign-in) a securely hashed password.\n- **Usage data:** problems you solve, practice results and tutor conversations, so we can show your history and progress.\n- **Uploads:** images you upload for scanning are stored temporarily and **automatically deleted** after 24 hours.\n- **Payments:** handled by Stripe; we never see or store full card numbers.\n\n## How we use data\n\nTo provide and improve the service, enforce plan limits, prevent abuse and communicate with you about your account. Problem text and images may be processed by our AI provider solely to generate explanations and transcriptions.\n\n## Your rights\n\nYou can export or delete your history at any time, and delete your account from Settings, which permanently removes your data. EU/UK users have rights under the GDPR, including access, rectification and erasure.\n\n## Cookies\n\nWe use essential cookies for sign-in and to apply guest limits. Analytics cookies are only used if enabled by the site operator.\n\n## Contact\n\nprivacy@your-domain.com`,
  },
  {
    slug: "terms-of-service",
    title: "Terms of Service",
    description: "The terms that govern your use of AI Math Solver.",
    body: `**Last updated: 2026-10-01**\n\n## Using the service\n\nYou may use AI Math Solver for personal learning, teaching and professional purposes. Do not abuse the service (automated scraping, attempts to bypass limits, or interfering with security).\n\n## Accounts\n\nYou are responsible for keeping your credentials secure. We may suspend accounts that violate these terms.\n\n## Academic integrity\n\nFollow your school's rules about homework help and exams.\n\n## Subscriptions\n\nPaid plans renew automatically until cancelled. You can cancel at any time; access continues until the end of the paid period.\n\n## Disclaimer\n\nWe verify answers carefully, but the service is provided "as is" without warranty. Always double-check results that matter.\n\n## Contact\n\nsupport@your-domain.com`,
  },
];

async function main() {
  for (const c of BLOG_CATEGORIES) {
    await prisma.blogCategory.upsert({ where: { slug: c.slug }, create: c, update: { name: c.name, description: c.description } });
  }
  const cats = new Map((await prisma.blogCategory.findMany()).map((c) => [c.slug, c.id]));
  for (const p of SEED_POSTS) {
    const data = { title: p.title, excerpt: p.excerpt, body: p.body, tags: p.tags, readingMinutes: p.readingMinutes, status: "PUBLISHED" as const, publishedAt: new Date(p.publishedAt), categoryId: cats.get(p.category) ?? null };
    await prisma.blogPost.upsert({ where: { slug: p.slug }, create: { slug: p.slug, ...data }, update: {} });
  }
  for (const f of FORMULAS) {
    const { slug, ...rest } = f;
    await prisma.formula.upsert({ where: { slug }, create: { slug, ...rest, relatedCalculator: rest.relatedCalculator ?? null, variables: JSON.parse(JSON.stringify(rest.variables)), faqs: JSON.parse(JSON.stringify(rest.faqs)) }, update: {} });
  }
  if ((await prisma.faq.count()) === 0) {
    await prisma.faq.createMany({ data: FAQS.map((f, i) => ({ ...f, order: i })) });
  }
  for (const p of PAGES) {
    await prisma.contentPage.upsert({ where: { slug: p.slug }, create: { ...p, status: "PUBLISHED" }, update: {} });
  }
  const adminEmail = (process.env.ADMIN_EMAILS ?? "").split(",")[0]?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    await prisma.user.upsert({
      where: { email: adminEmail },
      create: { email: adminEmail, name: "Administrator", role: "ADMIN", passwordHash: await bcrypt.hash(adminPassword, 12), emailVerified: new Date() },
      update: { role: "ADMIN" },
    });
    console.log(`Admin user ready: ${adminEmail}`);
  } else {
    console.log("Skipping admin user (set ADMIN_EMAILS and SEED_ADMIN_PASSWORD to create one).");
  }
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
