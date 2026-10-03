import { chromium } from "playwright";
const B = process.env.BASE_URL ?? "http://localhost:3000";
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const issues = [];
for (const vp of [{ width: 1280, height: 900 }, { width: 375, height: 740 }]) {
  const ctx = await b.newContext({ viewport: vp, extraHTTPHeaders: { "x-real-ip": `192.0.2.${Math.floor(Math.random() * 250) + 1}` } });
  const p = await ctx.newPage();
  await p.goto(B + "/login");
  await p.fill("#email", process.env.ADMIN_EMAIL ?? "admin@example.com");
  await p.fill("#password", process.env.ADMIN_PASSWORD ?? "admin12345");
  await p.click("button:has-text('Log in')");
  await p.waitForURL("**/dashboard");
  const pages = ["/dashboard", "/dashboard/history", "/dashboard/saved", "/dashboard/progress", "/dashboard/settings", "/dashboard/billing", "/tutor", "/admin", "/admin/system", "/admin/users", "/admin/subscriptions", "/admin/ai-usage", "/admin/audit",
    ...["posts", "categories", "pages", "formulas", "calculators", "faqs", "seo", "settings"].map((r) => `/admin/content/${r}`)];
  for (const u of pages) {
    const errs = [];
    const onC = (m) => m.type() === "error" && !/CLIENT_FETCH_ERROR/.test(m.text()) /* next-auth session poll cancelled by navigation (benign) */ && errs.push(m.text().slice(0, 140));
    p.on("console", onC);
    const r = await p.goto(B + u, { waitUntil: "networkidle" });
    const st = r.status();
    const info = await p.evaluate(() => ({ overflow: document.documentElement.scrollWidth > window.innerWidth + 1, h1: document.querySelectorAll("h1").length, robots: document.querySelector('meta[name="robots"]')?.content ?? "" }));
    if (st !== 200) issues.push(`${vp.width} ${u} status ${st}`);
    if (info.overflow) issues.push(`${vp.width} ${u} overflow`);
    if (info.h1 !== 1) issues.push(`${vp.width} ${u} h1=${info.h1}`);
    if (vp.width > 400 && !/noindex/.test(info.robots) && u !== "/tutor") issues.push(`${u} private page is indexable`);
    if (errs.length) issues.push(`${vp.width} ${u} console: ${errs[0]}`);
    p.off("console", onC);
  }
  await ctx.close();
}
console.log(issues.length ? issues.join("\n") : "AUTH AREA: NO ISSUES");
await b.close();
