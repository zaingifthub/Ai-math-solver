import { chromium } from "playwright";
const B = process.env.BASE_URL ?? "http://localhost:3000";
const xml = await (await fetch(B + "/sitemap.xml")).text();
const fromSitemap = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
const extra = ["/login", "/register", "/forgot-password", "/reset-password", "/blog?page=1", "/resources", "/nonexistent-page", "/blog/nonexistent", "/calculators/nonexistent", "/math-formulas/nonexistent"];
const urls = [...new Set([...fromSitemap, ...extra])];
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const issues = [];
const seen = { titles: new Map(), descs: new Map() };
async function audit(url, viewport, label) {
  const page = await browser.newPage({ viewport, extraHTTPHeaders: { "x-real-ip": `192.0.2.${Math.floor(Math.random() * 250) + 1}` } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/CLIENT_FETCH_ERROR/.test(m.text()) /* next-auth session poll cancelled by navigation (benign) */ && !/Failed to load resource.*404/.test(m.text())) errs.push(m.text().slice(0, 160)); });
  const res = await page.goto(B + url, { waitUntil: "networkidle" }).catch((e) => ({ status: () => "ERR " + e.message }));
  const status = res.status();
  const expect404 = /nonexistent/.test(url);
  if (expect404 ? status !== 404 : status !== 200) issues.push(`[${label}] ${url} status ${status}`);
  if (status === 200) {
    const info = await page.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => { try { JSON.parse(s.textContent); return true; } catch { return false; } });
      return {
        title: document.title,
        desc: q('meta[name="description"]')?.content ?? "",
        canonical: q('link[rel="canonical"]')?.href ?? "",
        og: q('meta[property="og:title"]')?.content ?? "",
        ogImage: q('meta[property="og:image"]')?.content ?? "",
        twitter: q('meta[name="twitter:card"]')?.content ?? "",
        robots: q('meta[name="robots"]')?.content ?? "",
        h1: document.querySelectorAll("h1").length,
        ldBad: ld.filter((x) => !x).length,
        ldCount: ld.length,
        overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        imgsNoAlt: [...document.querySelectorAll("img")].filter((i) => !i.getAttribute("alt")).length,
        lang: document.documentElement.lang,
      };
    });
    if (label === "desktop") {
      const isPrivate = /^\/(login|register)/.test(url);
      if (!info.title || info.title.length < 10) issues.push(`${url} weak title "${info.title}"`);
      if (info.title.length > 70) issues.push(`${url} title too long (${info.title.length}): ${info.title}`);
      if (!info.desc) issues.push(`${url} missing meta description`);
      else if (info.desc.length > 170) issues.push(`${url} description long (${info.desc.length})`);
      if (!info.canonical) issues.push(`${url} missing canonical`);
      else if (!isPrivate && new URL(info.canonical).pathname !== url.split("?")[0] && url !== "/blog?page=1") issues.push(`${url} canonical mismatch → ${info.canonical}`);
      if (!info.og || !info.ogImage) issues.push(`${url} missing og tags`);
      if (!info.twitter) issues.push(`${url} missing twitter card`);
      if (info.h1 !== 1) issues.push(`${url} has ${info.h1} h1`);
      if (info.ldBad) issues.push(`${url} invalid JSON-LD`);
      if (info.imgsNoAlt) issues.push(`${url} ${info.imgsNoAlt} images without alt`);
      if (seen.titles.has(info.title)) issues.push(`duplicate title: ${url} & ${seen.titles.get(info.title)}`);
      else seen.titles.set(info.title, url);
      if (info.desc && seen.descs.has(info.desc)) issues.push(`duplicate description: ${url} & ${seen.descs.get(info.desc)}`);
      else seen.descs.set(info.desc, url);
    }
    if (info.overflow) issues.push(`[${label}] ${url} horizontal overflow`);
  }
  if (errs.length) issues.push(`[${label}] ${url} console: ${errs.slice(0, 2).join(" | ")}`);
  await page.close();
}
let n = 0;
for (const u of urls) {
  await audit(u, { width: 1280, height: 900 }, "desktop");
  await audit(u, { width: 375, height: 740 }, "mobile");
  n++;
}
console.log(`audited ${n} urls (${fromSitemap.length} from sitemap) x 2 viewports`);
console.log(issues.length ? issues.join("\n") : "NO ISSUES");
await browser.close();
