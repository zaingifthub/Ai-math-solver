const B = process.env.BASE_URL ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => results.push(`${ok ? "✓" : "✗"} ${name}${ok ? "" : "  → " + detail}`);

class Client {
  cookies = new Map();
  ip = `192.0.2.${Math.floor(Math.random() * 250) + 1}`;
  async req(path, { method = "GET", json, form, headers = {}, origin = true, raw } = {}) {
    const h = { "x-real-ip": this.ip, ...headers, cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ") };
    if (origin) h.origin = B;
    let body;
    if (json !== undefined) { h["content-type"] = "application/json"; body = JSON.stringify(json); }
    if (form) { h["content-type"] = "application/x-www-form-urlencoded"; body = new URLSearchParams(form).toString(); }
    if (raw !== undefined) body = raw;
    const res = await fetch(B + path, { method, headers: h, body, redirect: "manual" });
    for (const c of res.headers.getSetCookie?.() ?? []) { const [kv] = c.split(";"); const i = kv.indexOf("="); this.cookies.set(kv.slice(0, i), kv.slice(i + 1)); }
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data };
  }
  async login(email, password) {
    const { data } = await this.req("/api/auth/csrf");
    return this.req("/api/auth/callback/credentials", { method: "POST", form: { csrfToken: data.csrfToken, email, password, json: "true" } });
  }
}

const stamp = Date.now();
const guest = new Client(), a = new Client(), b = new Client(), admin = new Client();
const emailA = `a${stamp}@example.com`, emailB = `b${stamp}@example.com`;

// ---------- Registration validation ----------
check("register rejects weak password", (await guest.req("/api/auth/register", { method: "POST", json: { name: "x", email: `w${stamp}@example.com`, password: "short" } })).status === 400);
check("register rejects bad email", (await guest.req("/api/auth/register", { method: "POST", json: { name: "x", email: "nope", password: "goodpass123" } })).status === 400);
check("register A", (await a.req("/api/auth/register", { method: "POST", json: { name: "User A", email: emailA, password: "goodpass123" } })).status === 201);
check("register duplicate → 409", (await a.req("/api/auth/register", { method: "POST", json: { name: "User A", email: emailA, password: "goodpass123" } })).status === 409);
await b.req("/api/auth/register", { method: "POST", json: { name: "User B", email: emailB, password: "goodpass123" } });
await a.login(emailA, "goodpass123");
await b.login(emailB, "goodpass123");
await admin.login(process.env.ADMIN_EMAIL ?? "admin@example.com", process.env.ADMIN_PASSWORD ?? "admin12345");
check("session A", (await a.req("/api/auth/session")).data?.user?.email === emailA);
check("session admin role", (await admin.req("/api/auth/session")).data?.user?.role === "ADMIN");
const bad = new Client();
check("wrong password rejected", !(await (async () => { await bad.login(emailA, "wrongpass999"); return (await bad.req("/api/auth/session")).data?.user; })()));

// ---------- Unauthenticated access ----------
for (const [m, p] of [["GET", "/api/history"], ["GET", "/api/bookmarks"], ["GET", "/api/user"], ["GET", "/api/progress"], ["GET", "/api/tutor/conversations"], ["POST", "/api/billing/checkout"], ["POST", "/api/user/password"]]) {
  const r = await guest.req(p, { method: m, json: m === "POST" ? {} : undefined });
  check(`guest ${m} ${p} → 401`, r.status === 401, `got ${r.status}`);
}
for (const p of ["/api/admin/users", "/api/admin/posts", "/api/admin/stats", "/api/admin/audit", "/api/admin/seo"]) {
  check(`guest ${p} → 401`, (await guest.req(p)).status === 401);
  check(`user ${p} → 403`, (await a.req(p)).status === 403);
}
check("admin GET /api/admin/stats", (await admin.req("/api/admin/stats")).status === 200);
check("unknown admin resource → 404", (await admin.req("/api/admin/nope")).status === 404);

// ---------- CSRF ----------
check("POST without Origin blocked", (await a.req("/api/solve", { method: "POST", json: { input: "1+1" }, origin: false })).status === 403);
check("POST with foreign Origin blocked", (await a.req("/api/solve", { method: "POST", json: { input: "1+1" }, headers: { origin: "https://evil.example" }, origin: false })).status === 403);
check("DELETE history cross-site blocked", (await a.req("/api/history", { method: "DELETE", origin: false, headers: { origin: "https://evil.example" } })).status === 403);

// ---------- Solve + validation ----------
const s1 = await a.req("/api/solve", { method: "POST", json: { input: "x^2-5x+6=0" } });
check("solve ok", s1.status === 200 && s1.data.result.answer.text === "x = 2, x = 3", JSON.stringify(s1.data).slice(0, 100));
check("solve empty → 400", (await a.req("/api/solve", { method: "POST", json: { input: "" } })).status === 400);
check("solve too long → 400", (await a.req("/api/solve", { method: "POST", json: { input: "1+".repeat(1500) + "1" } })).status === 400);
check("solve malformed JSON → 400/500 handled", [400, 500].includes((await a.req("/api/solve", { method: "POST", raw: "{bad", headers: { "content-type": "application/json" } })).status));
const gib = await a.req("/api/solve", { method: "POST", json: { input: ")))(((" } });
check("solve garbage → 422 friendly", gib.status === 422, `${gib.status} ${JSON.stringify(gib.data)}`);

// ---------- IDOR ----------
const pid = s1.data.result.id;
check("owner reads own problem", (await a.req(`/api/history/${pid}`)).status === 200);
check("other user cannot read problem", (await b.req(`/api/history/${pid}`)).status === 404);
check("guest cannot read problem", (await guest.req(`/api/history/${pid}`)).status === 404);
check("other user cannot bookmark problem", (await b.req("/api/bookmarks", { method: "POST", json: { problemId: pid } })).status === 404);
check("owner bookmarks", (await a.req("/api/bookmarks", { method: "POST", json: { problemId: pid } })).status === 201);
await b.req(`/api/history/${pid}`, { method: "DELETE" });
check("other user DELETE does not remove", (await a.req(`/api/history/${pid}`)).status === 200);
const t = await a.req("/api/tutor", { method: "POST", json: { message: "solve 2x+5=17" } });
const convId = /"conversationId":"([^"]+)"/.exec(typeof t.data === "string" ? t.data : "")?.[1];
check("tutor stream returns conversation", !!convId, String(t.data).slice(0, 120));
check("other user cannot read conversation", (await b.req(`/api/tutor/conversations/${convId}`)).status === 404);
check("other user cannot continue conversation", (await b.req("/api/tutor", { method: "POST", json: { message: "hi", conversationId: convId } })).status === 404);

// ---------- Practice ----------
const pr = await a.req("/api/practice?topic=linear-equations&difficulty=2");
check("practice issues problem without answer", pr.status === 200 && pr.data.problems[0].answer === undefined && !JSON.stringify(pr.data).includes("solveInput"));
check("practice invalid topic → 400", (await a.req("/api/practice?topic=hacking")).status === 400);
const chk = await a.req("/api/practice", { method: "POST", json: { id: pr.data.problems[0].id, answer: "x = 999" } });
check("practice check works", chk.status === 200 && chk.data.correct === false && chk.data.answer);
check("practice forged id → 400", (await a.req("/api/practice", { method: "POST", json: { id: "../../etc", answer: "1" } })).status === 400);
check("progress reflects attempt", (await a.req("/api/progress")).data.summary.attempts >= 1);

// ---------- User settings ----------
check("profile update", (await a.req("/api/user", { method: "PATCH", json: { name: "User A2", educationLevel: "COLLEGE" } })).data.user?.educationLevel === "COLLEGE");
check("profile rejects role escalation", (await (async () => { await a.req("/api/user", { method: "PATCH", json: { role: "ADMIN" } }); return (await a.req("/api/user")).data.user.role; })()) === "USER");
check("password change requires current", (await a.req("/api/user/password", { method: "POST", json: { current: "wrong", next: "newpass1234" } })).status === 403);

// ---------- Admin CRUD on every resource ----------
const samples = {
  categories: { slug: `audit-cat-${stamp}`, name: "Audit Cat" },
  posts: { slug: `audit-post-${stamp}`, title: "Audit Post", excerpt: "x", body: "Hello <script>alert(1)</script> $x^2$", status: "PUBLISHED", tags: ["a"] },
  pages: { slug: `audit-page-${stamp}`, title: "Audit Page", body: "Body", status: "PUBLISHED", type: "RESOURCE" },
  formulas: { slug: `audit-formula-${stamp}`, name: "Audit F", category: "Algebra", latex: "a=b", summary: "s", explanation: "e", example: "x", variables: [], relatedTopics: [], faqs: [] },
  calculators: { slug: "fraction-calculator", enabled: true, title: "Fraction Calculator Pro" },
  faqs: { scope: "global", question: `Audit Q ${stamp}?`, answer: "A" },
  seo: { path: `/audit-${stamp}`, title: "T" },
  settings: { key: `audit.key.${stamp}`, value: { a: 1 } },
};
for (const [res, body] of Object.entries(samples)) {
  const c = await admin.req(`/api/admin/${res}`, { method: "POST", json: body });
  const id = c.data.item?.[res === "settings" ? "key" : "id"];
  check(`admin create ${res}`, c.status === 201, `${c.status} ${JSON.stringify(c.data).slice(0, 150)}`);
  if (!id) continue;
  const u = await admin.req(`/api/admin/${res}/${encodeURIComponent(id)}`, { method: "PATCH", json: res === "settings" ? { value: { a: 2 } } : res === "faqs" ? { answer: "B" } : res === "seo" ? { title: "T2" } : res === "calculators" ? { intro: "New intro" } : res === "categories" ? { name: "Renamed" } : { title: "Renamed", name: "Renamed" } });
  check(`admin update ${res}`, u.status === 200, `${u.status} ${JSON.stringify(u.data).slice(0, 150)}`);
  if (res === "posts") {
    check("partial PATCH keeps status PUBLISHED", u.data.item?.status === "PUBLISHED", `status=${u.data.item?.status}`);
    check("partial PATCH keeps tags", JSON.stringify(u.data.item?.tags) === '["a"]', `tags=${JSON.stringify(u.data.item?.tags)}`);
    const page = await fetch(`${B}/blog/${body.slug}`).then((r) => r.text());
    check("published post renders", page.includes("Renamed"));
    check("post body script tag sanitized", !page.includes("<script>alert(1)</script>"));
  }
  if (res === "calculators") check("calculator override shows on page", (await fetch(`${B}/calculators/fraction-calculator`).then((r) => r.text())).includes("New intro"));
  check(`editor-only user cannot delete ${res}`, (await a.req(`/api/admin/${res}/${encodeURIComponent(id)}`, { method: "DELETE" })).status === 403);
  check(`admin delete ${res}`, (await admin.req(`/api/admin/${res}/${encodeURIComponent(id)}`, { method: "DELETE" })).status === 200);
}
check("admin create rejects bad slug", (await admin.req("/api/admin/categories", { method: "POST", json: { slug: "Bad Slug!", name: "x" } })).status === 400);
const users = await admin.req(`/api/admin/users?q=${encodeURIComponent(emailB)}`);
const idB = users.data.items?.[0]?.id;
check("admin finds user", !!idB);
check("admin suspends user", (await admin.req(`/api/admin/users/${idB}`, { method: "PATCH", json: { status: "SUSPENDED" } })).status === 200);
const b2 = new Client(); await b2.login(emailB, "goodpass123");
check("suspended user cannot log in", !(await b2.req("/api/auth/session")).data?.user);
const me = (await admin.req("/api/auth/session")).data.user.id;
check("admin cannot demote self", (await admin.req(`/api/admin/users/${me}`, { method: "PATCH", json: { role: "USER" } })).status === 400);
check("audit log records actions", (await admin.req("/api/admin/audit")).data.items?.some((x) => x.action === "admin.user_update"));

// ---------- Ops endpoints ----------
check("cron without secret → 401", (await guest.req("/api/cron/cleanup")).status === 401);
check("cron with secret → 200", (await guest.req("/api/cron/cleanup", { headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? "dev-cron-secret"}` } })).status === 200);
check("stripe webhook unsigned → 400/503", [400, 503].includes((await guest.req("/api/stripe/webhook", { method: "POST", raw: "{}", origin: false })).status));
check("health ok", (await guest.req("/api/health")).data.db === "ok");
const og = await fetch(`${B}/og?title=${encodeURIComponent("<script>")}`);
check("OG image renders png", og.headers.get("content-type")?.includes("image/png"));

// ---------- Rate limit ----------
let limited = false;
const rl = new Client();
for (let i = 0; i < 40 && !limited; i++) if ((await rl.req("/api/solve", { method: "POST", json: { input: `${i}+1` } })).status === 429) limited = true;
check("solve rate limit triggers (guest)", limited);

await extra();
console.log(results.join("\n"));
console.log(`\n${results.filter((r) => r.startsWith("✓")).length}/${results.length} passed`);

async function extra() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const { createHash } = await import("node:crypto");
  // Password reset end-to-end
  const g = new Client();
  const f1 = await g.req("/api/auth/forgot", { method: "POST", json: { email: emailA } });
  const f2 = await g.req("/api/auth/forgot", { method: "POST", json: { email: `nobody${stamp}@example.com` } });
  check("forgot: identical response for existing/non-existing email", f1.status === 200 && JSON.stringify(f1.data) === JSON.stringify(f2.data));
  check("reset: bad token rejected", (await g.req("/api/auth/reset", { method: "POST", json: { email: emailA, token: "a".repeat(64), password: "newpass1234" } })).status === 400);
  const raw = "b".repeat(64);
  const hash = createHash("sha256").update(raw).digest("hex");
  await prisma.verificationToken.updateMany({ where: { identifier: `reset:${emailA}` }, data: { token: hash } });
  await prisma.$disconnect();
  const rs = await g.req("/api/auth/reset", { method: "POST", json: { email: emailA, token: raw, password: "brandnew1234" } });
  check("reset: valid token sets new password", rs.status === 200, `${rs.status} ${JSON.stringify(rs.data)}`);
  check("reset: token is single-use", (await g.req("/api/auth/reset", { method: "POST", json: { email: emailA, token: raw, password: "another1234" } })).status === 400);
  const n1 = new Client(); await n1.login(emailA, "brandnew1234");
  check("login with new password", (await n1.req("/api/auth/session")).data?.user?.email === emailA);
  const n2 = new Client(); await n2.login(emailA, "goodpass123");
  check("old password no longer works", !(await n2.req("/api/auth/session")).data?.user);

  // Body size limit
  check("oversized JSON body → 413", (await g.req("/api/solve", { method: "POST", raw: JSON.stringify({ input: "x".repeat(2_000_000) }), headers: { "content-type": "application/json" } })).status === 413);

  // Spoofed X-Forwarded-For must not bypass rate limits (proxy sets X-Real-IP)
  let limited = false;
  for (let i = 0; i < 40 && !limited; i++) {
    const c = new Client();
    const r = await c.req("/api/solve", { method: "POST", json: { input: `${i}*2` }, headers: { "x-real-ip": `198.51.100.${stamp % 250}`, "x-forwarded-for": `10.0.0.${i}, 198.51.100.${stamp % 250}` } });
    if (r.status === 429) limited = true;
  }
  check("rate limit not bypassed by rotating X-Forwarded-For + new cookies", limited);

  // Clearing cookies must not reset the guest quota (photo scans: 1/day per guest, 5 guests per network)
  const fs = await import("node:fs");
  const png = fs.readFileSync(new URL("./fixtures/blank.png", import.meta.url));
  const ip = `203.0.113.${(stamp % 200) + 20}`;
  const codes = [];
  for (let i = 0; i < 6; i++) {
    const fd = new FormData();
    fd.append("file", new Blob([png], { type: "image/png" }), "p.png");
    codes.push((await fetch(B + "/api/ocr", { method: "POST", body: fd, headers: { origin: B, "x-real-ip": ip } })).status);
  }
  check("guest quota survives cookie clearing (per-IP cap)", codes.slice(0, 5).every((c) => c === 200) && codes[5] === 402, codes.join(","));
  check("garbage input not sent to AI (422)", (await g.req("/api/solve", { method: "POST", json: { input: "((((" }, headers: { "x-real-ip": `198.18.0.${stamp % 250}` } })).status === 422);
  const sys = await admin.req("/admin/system");
  check("admin system page renders", sys.status === 200 && String(sys.data).includes("Configuration checks"));
}
