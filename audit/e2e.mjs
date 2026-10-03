import { chromium } from "playwright";
const B = process.env.BASE_URL ?? "http://localhost:3000";
const shots = new URL("./screenshots", import.meta.url).pathname;
import fs from "fs"; fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, extraHTTPHeaders: { "x-real-ip": `192.0.2.${Math.floor(Math.random() * 250) + 1}` } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => { if (m.type() === "error" && !/CLIENT_FETCH_ERROR/.test(m.text()) /* next-auth session poll cancelled by navigation (benign) */) errors.push(`console: ${m.text()}`); });
const step = async (name, fn) => { try { await fn(); console.log("✓", name); } catch (e) { console.log("✗", name, e.message.split("\n")[0]); } };

await step("home renders + solve from hero", async () => {
  await page.goto(B + "/");
  await page.screenshot({ path: `${shots}/home.png` });
  await page.fill("#solver-input", "2x^2 - 3x - 1 = 0");
  await page.waitForSelector("text=Preview", { timeout: 5000 });
  await page.click("button[type=submit]:has-text('Solve')");
  await page.waitForSelector("text=Step-by-step solution", { timeout: 15000 });
  await page.waitForSelector("text=Verified");
  await page.screenshot({ path: `${shots}/home-solved.png`, fullPage: false });
});
await step("solver page with ?q and graph", async () => {
  await page.goto(B + "/solver?q=" + encodeURIComponent("derivative of x^2 sin(x)"));
  await page.waitForSelector("text=Product rule", { timeout: 15000 });
  await page.waitForSelector("canvas", { timeout: 10000 });
  await page.screenshot({ path: `${shots}/solver-derivative.png`, fullPage: true });
});
await step("math keyboard inserts (fast typing, 5 rounds)", async () => {
  for (let i = 0; i < 5; i++) {
    await page.goto(B + "/solver");
    await page.click("button[aria-label='Show math keyboard']");
    await page.click("button[title='Square root']");
    await page.keyboard.type("16");
    await page.click("button[title='Fraction']");
    await page.keyboard.type("1");
    const v = await page.inputValue("#solver-input");
    if (v !== "sqrt(16(1)/())") throw new Error(`round ${i}: got ${v}`);
  }
});
await step("instant calculator (percentage)", async () => {
  await page.goto(B + "/calculators/percentage-calculator");
  await page.click("button:has-text('Calculate')");
  await page.waitForSelector("text=Results");
});
await step("engine calculator (matrix)", async () => {
  await page.goto(B + "/calculators/matrix-calculator");
  await page.click("button:has-text('Calculate')");
  await page.waitForSelector("text=Step-by-step solution", { timeout: 15000 });
  await page.screenshot({ path: `${shots}/matrix.png`, fullPage: false });
});
await step("scientific calculator", async () => {
  await page.goto(B + "/calculators/scientific-calculator");
  await page.fill("#sci-display", "sin(30)+5!/3!");
  await page.keyboard.press("Enter");
  await page.waitForSelector("text=20.5", { timeout: 5000 });
});
await step("graphing calculator markers", async () => {
  await page.goto(B + "/graphing-calculator");
  await page.waitForSelector("text=(-2, 0)", { timeout: 10000 });
  await page.screenshot({ path: `${shots}/graph.png` });
});
await step("practice flow", async () => {
  await page.goto(B + "/practice?topic=statistics");
  await page.waitForSelector("text=Question 1", { timeout: 10000 });
  await page.fill("input[aria-label='Your answer']", "1");
  await page.click("button:has-text('Check')");
  await page.waitForSelector("text=Full solution", { timeout: 10000 });
});
await step("register → dashboard", async () => {
  await page.goto(B + "/register");
  const email = `e2e${Date.now()}@example.com`;
  await page.fill("#name", "E2E Student");
  await page.fill("#email", email);
  await page.fill("#password", "testpass123");
  await page.fill("#confirm", "testpass123");
  await page.click("button:has-text('Create account')");
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  await page.waitForSelector("text=Recent problems");
  await page.screenshot({ path: `${shots}/dashboard.png` });
});
await step("signed-in solve saved to history", async () => {
  await page.goto(B + "/solver?q=" + encodeURIComponent("x + y = 10; x - y = 2"));
  await page.waitForSelector("text=Step-by-step solution", { timeout: 15000 });
  await page.click("button[aria-label='Save problem']");
  await page.goto(B + "/dashboard/history");
  await page.waitForSelector("text=x + y = 10", { timeout: 10000 });
  await page.goto(B + "/dashboard/saved");
  await page.waitForSelector("text=x + y = 10", { timeout: 10000 });
  await page.goto(B + "/dashboard/progress");
  await page.waitForSelector("text=Learning progress");
});
await step("non-admin blocked from /admin", async () => {
  await page.goto(B + "/admin");
  if (!page.url().includes("/dashboard")) throw new Error("not redirected: " + page.url());
});
await step("admin login + CMS", async () => {
  await ctx.clearCookies();
  await page.goto(B + "/login");
  await page.fill("#email", process.env.ADMIN_EMAIL ?? "admin@example.com");
  await page.fill("#password", process.env.ADMIN_PASSWORD ?? "admin12345");
  await page.click("button:has-text('Log in')");
  await page.waitForURL("**/dashboard", { timeout: 15000 });
  await page.goto(B + "/admin");
  await page.waitForSelector("text=Analytics");
  await page.screenshot({ path: `${shots}/admin.png` });
  await page.goto(B + "/admin/content/posts");
  await page.waitForSelector("text=How to Solve Quadratic Equations", { timeout: 10000 });
  await page.click("button:has-text('New post')");
  await page.fill("#fld-title", "E2E Test Post");
  await page.fill("#fld-excerpt", "An excerpt");
  await page.fill("#fld-body", "Hello $x^2$");
  await page.selectOption("#fld-status", "PUBLISHED");
  await page.click("button:has-text('Save')");
  await page.waitForSelector("text=E2E Test Post", { timeout: 10000 });
  await page.goto(B + "/blog/e2e-test-post");
  await page.waitForSelector("h1:has-text('E2E Test Post')", { timeout: 10000 });
  await page.goto(B + "/admin/users");
  await page.waitForSelector("text=e2e", { timeout: 10000 });
});
await step("mobile layout", async () => {
  const m = await browser.newPage({ viewport: { width: 390, height: 844 }, extraHTTPHeaders: { "x-real-ip": `192.0.2.${Math.floor(Math.random() * 250) + 1}` } });
  await m.goto(B + "/");
  await m.click("button[aria-label='Open menu']");
  await m.waitForSelector("nav[aria-label='Mobile']");
  await m.screenshot({ path: `${shots}/mobile.png` });
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (overflow) throw new Error("horizontal overflow on mobile");
});
console.log("errors:", errors.slice(0, 15));
await browser.close();
