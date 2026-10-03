import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { solve } from "@/lib/math/engine";
import { syntaxHint } from "@/lib/math/classify";
import { ipFromHeaders } from "@/lib/ip";

describe("garbage input is rejected locally (never sent to AI)", () => {
  it("does not call the word-problem translator for symbol soup", async () => {
    let called = false;
    const translate = async () => {
      called = true;
      return { input: "2x+5=17" };
    };
    await expect(solve(")))(((", { translateWordProblem: translate })).rejects.toThrow(/couldn't read/);
    await expect(solve("2x + = = 5", { translateWordProblem: translate })).rejects.toThrow();
    expect(called).toBe(false);
  });
  it("still routes genuine word problems to the translator", async () => {
    let called = false;
    const r = await solve("Sam has some apples. After buying five more he has seventeen. How many did he start with?", {
      translateWordProblem: async () => {
        called = true;
        return { input: "x + 5 = 17" };
      },
    });
    expect(called).toBe(true);
    expect(r.answer.text).toBe("x = 12");
  });
  it("gives helpful syntax hints", () => {
    expect(syntaxHint("(x+1")).toMatch(/unclosed/);
    expect(syntaxHint("x+1)")).toMatch(/closing parenthesis/);
    expect(syntaxHint("2x +")).toMatch(/ends with an operator/);
  });
});

describe("client IP extraction", () => {
  const h = (o: Record<string, string>) => (n: string) => o[n];
  it("prefers X-Real-IP set by the proxy", () => expect(ipFromHeaders(h({ "x-real-ip": "1.2.3.4", "x-forwarded-for": "6.6.6.6, 1.2.3.4" }))).toBe("1.2.3.4"));
  it("ignores spoofed left-most X-Forwarded-For entries", () => expect(ipFromHeaders(h({ "x-forwarded-for": "6.6.6.6, 9.9.9.9" }))).toBe("9.9.9.9"));
  it("falls back safely", () => expect(ipFromHeaders(h({}))).toBe("0.0.0.0"));
});

describe("CAS in-process fallback", () => {
  const g = globalThis as unknown as { __casInline?: boolean };
  beforeAll(() => {
    g.__casInline = true;
  });
  afterAll(() => {
    g.__casInline = false;
  });
  it("solves integrals, limits and systems without the worker", async () => {
    expect((await solve("integrate x e^x dx", { includeSimilar: false })).verification.status).toBe("verified");
    expect((await solve("limit of sin(x)/x as x->0", { includeSimilar: false })).answer.text).toBe("1");
    expect((await solve("x^2 + y^2 = 25 and x - y = 1", { includeSimilar: false })).answer.text).toContain("x = 4");
  });
});
