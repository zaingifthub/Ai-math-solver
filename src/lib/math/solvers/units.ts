import { math } from "../mathjs";
import { roundSig } from "../format";
import type { SolverOutput } from "../types";
import { verificationFrom, MathInputError } from "../types";

const ALIASES: Record<string, string> = {
  miles: "mile", mi: "mile", kilometers: "km", kilometres: "km", meters: "m", metres: "m", feet: "ft", foot: "ft", inches: "inch", in: "inch",
  yards: "yd", yard: "yd", pounds: "lb", lbs: "lb", kilograms: "kg", grams: "g", ounces: "oz", liters: "liter", litres: "liter", gallons: "gallon",
  celsius: "degC", c: "degC", "°c": "degC", fahrenheit: "degF", f: "degF", "°f": "degF", kelvin: "K", hours: "hour", hrs: "hour", minutes: "minute", mins: "minute", seconds: "s", secs: "s",
  mph: "mile/hour", kph: "km/hour", "km/h": "km/hour",
};

function unitName(u: string): string {
  const k = u.trim().toLowerCase();
  return ALIASES[k] ?? u.trim();
}

export function solveUnits(value: number, from: string, to: string): SolverOutput {
  const f = unitName(from);
  const t = unitName(to);
  let result: number;
  let factor: number | null = null;
  try {
    const q = math.unit(value, f);
    result = Number(q.toNumber(t));
    if (!/deg[CF]|K$/.test(f)) factor = Number(math.unit(1, f).toNumber(t));
  } catch {
    throw new MathInputError(`Cannot convert from "${from}" to "${to}". Check that both units measure the same quantity.`);
  }
  const back = Number(math.unit(result, t).toNumber(f));
  const steps = [
    { title: "Identify the units", text: `Convert ${value} ${from} to ${to}.` },
    factor !== null
      ? { title: "Multiply by the conversion factor", latex: `${value}\\,\\text{${f}} \\times ${roundSig(factor, 10)}\\,\\frac{\\text{${t}}}{\\text{${f}}} = ${roundSig(result, 10)}\\,\\text{${t}}` }
      : { title: "Apply the temperature formula", latex: f === "degF" && t === "degC" ? `C = \\frac{5}{9}(F - 32) = \\frac{5}{9}(${value} - 32) = ${roundSig(result, 8)}` : f === "degC" && t === "degF" ? `F = \\frac{9}{5}C + 32 = \\frac{9}{5}(${value}) + 32 = ${roundSig(result, 8)}` : `= ${roundSig(result, 8)}` },
  ];
  return {
    interpreted: `${value}\\,\\text{${f}} \\to \\text{${t}}`,
    category: "units",
    topic: "Unit conversion",
    answer: { latex: `${roundSig(result, 10)}\\,\\text{${t}}`, text: `${roundSig(result, 10)} ${to}` },
    steps,
    formulas: factor !== null ? [{ name: "Unit conversion", latex: "\\text{value} \\times \\frac{\\text{new unit}}{\\text{old unit}}" }] : [{ name: "Temperature", latex: "C = \\tfrac{5}{9}(F - 32)" }],
    explanation: "Multiply by a conversion factor equal to 1 so the old units cancel and the new units remain.",
    verification: verificationFrom([{ label: "Dimensional analysis: units are compatible", passed: true }, { label: "Converting back returns the original value", passed: Math.abs(back - value) < 1e-9 * Math.max(1, Math.abs(value)) }]),
  };
}
