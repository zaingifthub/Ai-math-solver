import { describe, expect, it } from "vitest";
import { isIndexingDisabled } from "../src/lib/indexing";

describe("search indexing switch", () => {
  it("is off on temporary hosting domains", () => {
    expect(isIndexingDisabled("https://powderblue-gaur-164457.hostingersite.com", undefined)).toBe(true);
    expect(isIndexingDisabled("https://ai-math-solver-g9e9.vercel.app", "")).toBe(true);
  });
  it("is on for real domains", () => {
    expect(isIndexingDisabled("https://aimathsolver.com", undefined)).toBe(false);
    expect(isIndexingDisabled("https://www.mathsolver.pk", "")).toBe(false);
  });
  it("respects SITE_NOINDEX overrides", () => {
    expect(isIndexingDisabled("https://aimathsolver.com", "true")).toBe(true);
    expect(isIndexingDisabled("https://x.hostingersite.com", "false")).toBe(false);
  });
});
