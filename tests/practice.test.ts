import { describe, it, expect } from "vitest";
import { generateProblem, problemFromId, PRACTICE_TOPICS } from "@/lib/math/generator";
import { checkAnswer } from "@/lib/math/answer-check";
import { solve } from "@/lib/math/engine";

describe("practice generator", () => {
  it("is deterministic per seed and recoverable from id", () => {
    const a = generateProblem("linear-equations", 2, 42);
    const b = problemFromId(a.id)!;
    expect(b.prompt).toBe(a.prompt);
    expect(b.answer).toEqual(a.answer);
  });

  for (const t of PRACTICE_TOPICS) {
    for (const d of [1, 2, 3] as const) {
      it(`${t.id} (difficulty ${d}) has an answer that the checker accepts and the engine agrees with`, async () => {
        const p = generateProblem(t.id, d, 1234 + d);
        const answerText = p.answer.kind === "number" || p.answer.kind === "set" || p.answer.kind === "pair" ? p.answer.values!.join(", ") : p.answer.expr!;
        expect(checkAnswer(answerText, p.answer).correct).toBe(true);
        const r = await solve(p.solveInput, { includeSimilar: false });
        expect(r.verification.status).not.toBe("unverified");
      });
    }
  }
});

describe("answer checker", () => {
  it("accepts equivalent numeric forms", () => {
    expect(checkAnswer("1/2", { kind: "number", display: "", values: [0.5] }).correct).toBe(true);
    expect(checkAnswer("0.5", { kind: "number", display: "", values: [0.5] }).correct).toBe(true);
    expect(checkAnswer("x = 3, x = -2", { kind: "set", display: "", values: [-2, 3] }).correct).toBe(true);
    expect(checkAnswer("x = 3", { kind: "set", display: "", values: [-2, 3] }).correct).toBe(false);
  });
  it("accepts equivalent expressions and any antiderivative", () => {
    expect(checkAnswer("2x + 2", { kind: "expression", display: "", expr: "2*(x+1)", variable: "x" }).correct).toBe(true);
    expect(checkAnswer("x^3/3 + 7", { kind: "antiderivative", display: "", expr: "x^3/3", variable: "x" }).correct).toBe(true);
    expect(checkAnswer("x^2", { kind: "expression", display: "", expr: "2*x", variable: "x" }).correct).toBe(false);
  });
});
