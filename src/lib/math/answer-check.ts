import { math, evalReal } from "./mathjs";
import { normalizeText, parseExpr, splitRelation } from "./normalize";
import { numDerivative, samplePoints, close } from "./numeric";
import type { PracticeAnswer } from "./generator";

export interface CheckResult {
  correct: boolean;
  feedback: string;
}

function toNumber(s: string): number {
  const t = normalizeText(s).replace(/^[a-z]\s*=\s*/i, "").trim();
  try {
    return evalReal(parseExpr(t));
  } catch {
    return NaN;
  }
}

function splitValues(s: string): string[] {
  return s
    .replace(/\bor\b|\band\b|;/gi, ",")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Check a student's answer against the expected answer, accepting equivalent forms. */
export function checkAnswer(user: string, answer: PracticeAnswer): CheckResult {
  const input = user.trim();
  if (!input) return { correct: false, feedback: "Enter an answer first." };
  try {
    switch (answer.kind) {
      case "number": {
        const v = toNumber(input);
        if (!Number.isFinite(v)) return { correct: false, feedback: "We couldn't read that as a number." };
        const ok = answer.values!.some((x) => close(v, x, 1e-6) || Math.abs(v - x) < 5e-3 * Math.max(1, Math.abs(x)) && /\./.test(input));
        return { correct: ok, feedback: ok ? "Correct!" : "Not quite — check your arithmetic and try again." };
      }
      case "set":
      case "pair": {
        const vals = splitValues(input).map(toNumber);
        if (vals.some((v) => !Number.isFinite(v))) return { correct: false, feedback: "Separate multiple answers with commas, e.g. x = 2, x = -3." };
        const expected = [...answer.values!];
        if (answer.kind === "pair") {
          const ok = vals.length === expected.length && vals.every((v, i) => close(v, expected[i], 1e-6));
          return { correct: ok, feedback: ok ? "Correct!" : "Not quite — substitute your values back into both equations to check." };
        }
        const unique = [...new Set(vals.map((v) => +v.toFixed(9)))];
        const ok = unique.length === expected.length && expected.every((e) => unique.some((v) => close(v, e, 1e-6)));
        const partial = !ok && expected.some((e) => unique.some((v) => close(v, e, 1e-6)));
        return { correct: ok, feedback: ok ? "Correct!" : partial ? "Partly right — there are more (or fewer) solutions." : "Not quite — substitute your answer back into the equation to check." };
      }
      case "expression":
      case "antiderivative": {
        const exp = answer.expr!;
        const rel = splitRelation(normalizeText(exp));
        if (rel && rel[0].op !== "=") {
          const urel = splitRelation(normalizeText(input));
          if (!urel) return { correct: false, feedback: "Write the answer as an inequality, e.g. x > 3." };
          const u = urel[0];
          const e = rel[0];
          const sameOp = u.op === e.op && u.lhs.trim() === e.lhs.trim();
          const ok = sameOp && close(toNumber(u.rhs), toNumber(e.rhs));
          return { correct: ok, feedback: ok ? "Correct!" : "Check the direction of the inequality and the boundary value." };
        }
        const v = answer.variable ?? "x";
        const user = parseExpr(normalizeText(input.replace(/^\s*(?:f'?\(x\)|y'?|dy\/dx)\s*=\s*/i, "").replace(/\+\s*c\s*$/i, "")));
        const target = math.parse(exp);
        const fu = user.compile();
        const ft = target.compile();
        const ev = (f: typeof fu, x: number) => {
          try {
            return Number(f.evaluate({ [v]: x }));
          } catch {
            return NaN;
          }
        };
        let tested = 0;
        let passed = 0;
        const pts = samplePoints(7, 0.2, 2.9);
        if (answer.kind === "antiderivative") {
          // Accept any antiderivative: compare derivatives
          for (const x of pts) {
            const a = numDerivative((t) => ev(fu, t), x);
            const b = numDerivative((t) => ev(ft, t), x);
            if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
            tested++;
            if (close(a, b, 1e-4)) passed++;
          }
        } else {
          for (const x of pts) {
            const a = ev(fu, x);
            const b = ev(ft, x);
            if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
            tested++;
            if (close(a, b, 1e-7)) passed++;
          }
        }
        const ok = tested > 0 && passed === tested;
        const hasC = /\+\s*c\s*$/i.test(input);
        return {
          correct: ok,
          feedback: ok ? (answer.kind === "antiderivative" && !hasC ? "Correct! Remember to add + C for indefinite integrals." : "Correct!") : "Not equivalent to the expected answer — check each term.",
        };
      }
    }
  } catch {
    return { correct: false, feedback: "We couldn't understand that answer. Check the syntax." };
  }
  return { correct: false, feedback: "Unsupported answer type." };
}
