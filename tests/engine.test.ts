import { describe, it, expect } from "vitest";
import { solve } from "@/lib/math/engine";
import { classify } from "@/lib/math/classify";
import { normalizeText } from "@/lib/math/normalize";

async function answer(input: string) {
  const r = await solve(input, { includeSimilar: false });
  return r;
}

describe("normalization", () => {
  it("converts unicode and LaTeX", () => {
    expect(normalizeText("x² − 4 = 0")).toBe("x^(2) - 4 = 0");
    expect(normalizeText("\\frac{1}{2} + \\sqrt{9}")).toContain("((1)/(2))");
    expect(normalizeText("√16")).toBe("sqrt(16)");
    expect(normalizeText("|x-3| = 5")).toBe("abs(x-3) = 5");
    expect(normalizeText("ln(x) + log(x) + log_2(8)")).toBe("log(x) + log10(x) + log(8, 2)");
    expect(normalizeText("sin^2 x")).toBe("(sin(x))^2");
  });
});

describe("classification", () => {
  const cases: [string, string][] = [
    ["2+3*4", "arithmetic"],
    ["2x + 5 = 17", "equation"],
    ["x + y = 10; x - y = 2", "system"],
    ["3x - 7 < 2", "inequality"],
    ["derivative of x^2", "derivative"],
    ["integrate x^2 dx", "integral"],
    ["limit of sin(x)/x as x->0", "limit"],
    ["det [[1,2],[3,4]]", "matrix"],
    ["mean of 1, 2, 3", "statistics"],
    ["5C2", "probability"],
    ["area of a circle with radius 5", "geometry"],
    ["convert 5 km to miles", "units"],
    ["factor x^2 - 5x + 6", "factor"],
    ["solve for y: 2x + 3y = 6", "literal"],
  ];
  it.each(cases)("%s → %s", (input, type) => {
    expect(classify(input).type).toBe(type);
  });
});

describe("arithmetic", () => {
  it("follows order of operations with exact fractions", async () => {
    expect((await answer("2 + 3 * 4 - (6/2)^2")).answer.text).toBe("5");
    expect((await answer("3/4 + 5/6")).answer.text).toBe("19/12");
    expect((await answer("20% of 150")).answer.text).toBe("30");
    expect((await answer("√16 + 3")).answer.text).toBe("7");
  });
});

describe("equations", () => {
  it("solves linear equations", async () => {
    const r = await answer("2x + 5 = 17");
    expect(r.answer.text).toBe("x = 6");
    expect(r.verification.status).toBe("verified");
  });
  it("solves quadratics exactly, including surds and complex roots", async () => {
    expect((await answer("x^2 - 5x + 6 = 0")).answer.text).toBe("x = 2, x = 3");
    expect((await answer("2x^2 - 3x - 1 = 0")).answer.text).toContain("√17");
    expect((await answer("x^2 + 2x + 5 = 0")).answer.text).toContain("2i");
  });
  it("solves cubic via rational root theorem", async () => {
    expect((await answer("x^3 - 6x^2 + 11x - 6 = 0")).answer.text).toBe("x = 1, x = 2, x = 3");
  });
  it("rejects extraneous radical solutions", async () => {
    expect((await answer("sqrt(x+3) = x - 3")).answer.text).toBe("x = 6");
  });
  it("handles exponential, log, trig and absolute value equations", async () => {
    expect((await answer("2^x = 8")).answer.text).toBe("x = 3");
    expect((await answer("|x - 3| = 5")).answer.text).toBe("x = -2, x = 8");
    const trig = await answer("sin(x) = 1/2");
    expect(trig.answer.text).toContain("π/6");
    expect(trig.answer.text).toContain("5π/6");
  });
  it("identifies identities and contradictions", async () => {
    expect((await answer("2x + 2 = 2(x + 1)")).answer.text).toMatch(/All real/);
    expect((await answer("x + 1 = x + 2")).answer.text).toMatch(/No solution/);
  });
});

describe("systems and inequalities", () => {
  it("solves linear systems", async () => {
    expect((await answer("x + y = 10; x - y = 2")).answer.text).toBe("x = 6, y = 4");
    expect((await answer("2x + 3y - z = 5, x - y + 2z = 3, 3x + y + z = 10")).verification.status).toBe("verified");
  });
  it("solves nonlinear systems", async () => {
    const r = await answer("x^2 + y^2 = 25 and x - y = 1");
    expect(r.answer.text).toContain("x = 4");
    expect(r.answer.text).toContain("y = -4");
  });
  it("flips the sign when dividing by a negative", async () => {
    expect((await answer("-2x + 4 >= 10")).answer.text).toContain("x <= -3");
  });
  it("uses sign charts for polynomial and rational inequalities", async () => {
    expect((await answer("x^2 - 4 > 0")).answer.text).toBe("(-∞, -2) ∪ (2, ∞)");
    expect((await answer("(x-1)/(x+2) <= 0")).answer.text).toBe("(-2, 1]");
    expect((await answer("1 < 2x + 3 < 7")).answer.text).toBe("(-1, 2)");
  });
});

describe("calculus", () => {
  it("differentiates with verification", async () => {
    const r = await answer("derivative of x^2 sin(x)");
    expect(r.verification.status).toBe("verified");
    expect(r.formulas.map((f) => f.name)).toContain("Product rule");
    expect((await answer("derivative of sin(x^2)")).answer.text).toBe("2x * cos(x^2)");
  });
  it("integrates and checks by differentiation", async () => {
    const r = await answer("integrate x^2 sin(x) dx");
    expect(r.verification.status).toBe("verified");
    expect((await answer("integrate 2x from 0 to 3")).answer.text).toBe("9");
    expect((await answer("\\int_{0}^{1} x^2 dx")).answer.text).toBe("1/3");
    expect((await answer("integral of 1/(x^2-1) dx")).verification.status).toBe("verified");
  });
  it("evaluates limits including indeterminate forms", async () => {
    expect((await answer("limit of sin(x)/x as x->0")).answer.text).toBe("1");
    expect((await answer("lim x->1 (x^2-1)/(x-1)")).answer.text).toBe("2");
    expect((await answer("limit of (1+1/x)^x as x->infinity")).answer.text).toBe("e");
    expect((await answer("limit of 1/x as x->0")).answer.text).toMatch(/Does not exist/);
  });
});

describe("linear algebra, statistics, probability, geometry, units", () => {
  it("matrices", async () => {
    expect((await answer("det [[1,2],[3,4]]")).answer.text).toBe("-2");
    expect((await answer("inverse [[2,1],[1,3]]")).verification.status).toBe("verified");
    expect((await answer("eigenvalues [[2,0],[0,3]]")).answer.text).toBe("2, 3");
  });
  it("vectors", async () => {
    expect((await answer("dot product of <1,2,3> and <4,5,6>")).answer.text).toBe("32");
    expect((await answer("cross product <1,0,0> and <0,1,0>")).answer.text).toBe("<0, 0, 1>");
  });
  it("statistics", async () => {
    expect((await answer("mean of 2, 4, 4, 4, 5, 5, 7, 9")).answer.text).toBe("5");
    expect((await answer("standard deviation of 2, 4, 4, 4, 5, 5, 7, 9")).answer.text).toContain("population 2");
  });
  it("probability", async () => {
    expect((await answer("5C2")).answer.text).toBe("10");
    expect((await answer("10!")).answer.text).toBe("3,628,800");
    expect((await answer("binomial n=10 p=0.5 k=3")).answer.text).toBe("0.1171875");
  });
  it("geometry and units", async () => {
    expect((await answer("hypotenuse 3 and 4")).answer.text).toBe("5");
    expect((await answer("area of a circle with radius 5")).answer.latex).toContain("25\\pi");
    expect((await answer("convert 5 km to miles")).answer.text).toMatch(/^3\.10685/);
  });
});

describe("word problems", () => {
  it("requires a translator", async () => {
    await expect(solve("A train travels 120 miles in 2 hours. What is its speed?")).rejects.toThrow(/word problem/);
  });
  it("uses the translator when provided", async () => {
    const r = await solve("A number doubled plus five is seventeen. What is the number?", {
      translateWordProblem: async () => ({ input: "2x + 5 = 17", setup: "Let x be the number." }),
    });
    expect(r.category).toBe("word-problem");
    expect(r.answer.text).toBe("x = 6");
  });
});
