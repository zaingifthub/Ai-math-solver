import { numTex, roundSig } from "../format";
import type { SolverOutput, Formula } from "../types";
import { verificationFrom, MathInputError } from "../types";

export type Shape =
  | "circle-area" | "circle-circumference" | "rectangle-area" | "rectangle-perimeter" | "square-area" | "square-perimeter"
  | "triangle-area" | "triangle-heron" | "trapezoid-area" | "parallelogram-area" | "sphere-volume" | "sphere-surface"
  | "cylinder-volume" | "cylinder-surface" | "cone-volume" | "cube-volume" | "cube-surface" | "box-volume" | "pyramid-volume"
  | "hypotenuse" | "leg" | "distance" | "midpoint" | "slope";

interface ShapeDef {
  title: string;
  formula: Formula;
  params: string[];
  compute: (p: Record<string, number>) => number;
  substitute: (p: Record<string, number>) => string;
  unit: "area" | "length" | "volume" | "none";
}

const n = (x: number) => numTex(x);

export const SHAPES: Record<Exclude<Shape, "midpoint">, ShapeDef> = {
  "circle-area": { title: "Area of a circle", formula: { name: "Circle area", latex: "A = \\pi r^2" }, params: ["r"], compute: ({ r }) => Math.PI * r * r, substitute: ({ r }) => `A = \\pi (${n(r)})^2 = ${n(r * r)}\\pi`, unit: "area" },
  "circle-circumference": { title: "Circumference of a circle", formula: { name: "Circumference", latex: "C = 2\\pi r" }, params: ["r"], compute: ({ r }) => 2 * Math.PI * r, substitute: ({ r }) => `C = 2\\pi(${n(r)}) = ${n(2 * r)}\\pi`, unit: "length" },
  "rectangle-area": { title: "Area of a rectangle", formula: { name: "Rectangle area", latex: "A = l \\times w" }, params: ["l", "w"], compute: ({ l, w }) => l * w, substitute: ({ l, w }) => `A = ${n(l)} \\times ${n(w)}`, unit: "area" },
  "rectangle-perimeter": { title: "Perimeter of a rectangle", formula: { name: "Rectangle perimeter", latex: "P = 2(l + w)" }, params: ["l", "w"], compute: ({ l, w }) => 2 * (l + w), substitute: ({ l, w }) => `P = 2(${n(l)} + ${n(w)})`, unit: "length" },
  "square-area": { title: "Area of a square", formula: { name: "Square area", latex: "A = s^2" }, params: ["s"], compute: ({ s }) => s * s, substitute: ({ s }) => `A = (${n(s)})^2`, unit: "area" },
  "square-perimeter": { title: "Perimeter of a square", formula: { name: "Square perimeter", latex: "P = 4s" }, params: ["s"], compute: ({ s }) => 4 * s, substitute: ({ s }) => `P = 4(${n(s)})`, unit: "length" },
  "triangle-area": { title: "Area of a triangle", formula: { name: "Triangle area", latex: "A = \\tfrac{1}{2} b h" }, params: ["b", "h"], compute: ({ b, h }) => 0.5 * b * h, substitute: ({ b, h }) => `A = \\tfrac{1}{2}(${n(b)})(${n(h)})`, unit: "area" },
  "triangle-heron": {
    title: "Area of a triangle (Heron's formula)",
    formula: { name: "Heron's formula", latex: "A = \\sqrt{s(s-a)(s-b)(s-c)},\; s = \\tfrac{a+b+c}{2}" },
    params: ["a", "b", "c"],
    compute: ({ a, b, c }) => {
      const s = (a + b + c) / 2;
      const q = s * (s - a) * (s - b) * (s - c);
      if (q < 0) throw new MathInputError("These side lengths cannot form a triangle (triangle inequality fails).");
      return Math.sqrt(q);
    },
    substitute: ({ a, b, c }) => { const s = (a + b + c) / 2; return `s = ${n(s)},\\quad A = \\sqrt{${n(s)}(${n(s - a)})(${n(s - b)})(${n(s - c)})}`; },
    unit: "area",
  },
  "trapezoid-area": { title: "Area of a trapezoid", formula: { name: "Trapezoid area", latex: "A = \\tfrac{1}{2}(a + b)h" }, params: ["a", "b", "h"], compute: ({ a, b, h }) => 0.5 * (a + b) * h, substitute: ({ a, b, h }) => `A = \\tfrac{1}{2}(${n(a)} + ${n(b)})(${n(h)})`, unit: "area" },
  "parallelogram-area": { title: "Area of a parallelogram", formula: { name: "Parallelogram area", latex: "A = b h" }, params: ["b", "h"], compute: ({ b, h }) => b * h, substitute: ({ b, h }) => `A = (${n(b)})(${n(h)})`, unit: "area" },
  "sphere-volume": { title: "Volume of a sphere", formula: { name: "Sphere volume", latex: "V = \\tfrac{4}{3}\\pi r^3" }, params: ["r"], compute: ({ r }) => (4 / 3) * Math.PI * r ** 3, substitute: ({ r }) => `V = \\tfrac{4}{3}\\pi(${n(r)})^3 = ${n((4 / 3) * r ** 3)}\\pi`, unit: "volume" },
  "sphere-surface": { title: "Surface area of a sphere", formula: { name: "Sphere surface area", latex: "S = 4\\pi r^2" }, params: ["r"], compute: ({ r }) => 4 * Math.PI * r * r, substitute: ({ r }) => `S = 4\\pi(${n(r)})^2 = ${n(4 * r * r)}\\pi`, unit: "area" },
  "cylinder-volume": { title: "Volume of a cylinder", formula: { name: "Cylinder volume", latex: "V = \\pi r^2 h" }, params: ["r", "h"], compute: ({ r, h }) => Math.PI * r * r * h, substitute: ({ r, h }) => `V = \\pi(${n(r)})^2(${n(h)}) = ${n(r * r * h)}\\pi`, unit: "volume" },
  "cylinder-surface": { title: "Surface area of a cylinder", formula: { name: "Cylinder surface area", latex: "S = 2\\pi r^2 + 2\\pi r h" }, params: ["r", "h"], compute: ({ r, h }) => 2 * Math.PI * r * (r + h), substitute: ({ r, h }) => `S = 2\\pi(${n(r)})^2 + 2\\pi(${n(r)})(${n(h)}) = ${n(2 * r * (r + h))}\\pi`, unit: "area" },
  "cone-volume": { title: "Volume of a cone", formula: { name: "Cone volume", latex: "V = \\tfrac{1}{3}\\pi r^2 h" }, params: ["r", "h"], compute: ({ r, h }) => (Math.PI * r * r * h) / 3, substitute: ({ r, h }) => `V = \\tfrac{1}{3}\\pi(${n(r)})^2(${n(h)}) = ${n((r * r * h) / 3)}\\pi`, unit: "volume" },
  "cube-volume": { title: "Volume of a cube", formula: { name: "Cube volume", latex: "V = s^3" }, params: ["s"], compute: ({ s }) => s ** 3, substitute: ({ s }) => `V = (${n(s)})^3`, unit: "volume" },
  "cube-surface": { title: "Surface area of a cube", formula: { name: "Cube surface area", latex: "S = 6s^2" }, params: ["s"], compute: ({ s }) => 6 * s * s, substitute: ({ s }) => `S = 6(${n(s)})^2`, unit: "area" },
  "box-volume": { title: "Volume of a rectangular prism", formula: { name: "Prism volume", latex: "V = l w h" }, params: ["l", "w", "h"], compute: ({ l, w, h }) => l * w * h, substitute: ({ l, w, h }) => `V = (${n(l)})(${n(w)})(${n(h)})`, unit: "volume" },
  "pyramid-volume": { title: "Volume of a pyramid", formula: { name: "Pyramid volume", latex: "V = \\tfrac{1}{3} B h" }, params: ["B", "h"], compute: ({ B, h }) => (B * h) / 3, substitute: ({ B, h }) => `V = \\tfrac{1}{3}(${n(B)})(${n(h)})`, unit: "volume" },
  hypotenuse: { title: "Hypotenuse (Pythagorean theorem)", formula: { name: "Pythagorean theorem", latex: "c = \\sqrt{a^2 + b^2}" }, params: ["a", "b"], compute: ({ a, b }) => Math.hypot(a, b), substitute: ({ a, b }) => `c = \\sqrt{(${n(a)})^2 + (${n(b)})^2} = \\sqrt{${n(a * a + b * b)}}`, unit: "length" },
  leg: { title: "Missing leg (Pythagorean theorem)", formula: { name: "Pythagorean theorem", latex: "b = \\sqrt{c^2 - a^2}" }, params: ["c", "a"], compute: ({ c, a }) => { if (c <= a) throw new MathInputError("The hypotenuse must be the longest side."); return Math.sqrt(c * c - a * a); }, substitute: ({ c, a }) => `b = \\sqrt{(${n(c)})^2 - (${n(a)})^2} = \\sqrt{${n(c * c - a * a)}}`, unit: "length" },
  distance: { title: "Distance between two points", formula: { name: "Distance formula", latex: "d = \\sqrt{(x_2 - x_1)^2 + (y_2 - y_1)^2}" }, params: ["x1", "y1", "x2", "y2"], compute: ({ x1, y1, x2, y2 }) => Math.hypot(x2 - x1, y2 - y1), substitute: ({ x1, y1, x2, y2 }) => `d = \\sqrt{(${n(x2)} - ${n(x1)})^2 + (${n(y2)} - ${n(y1)})^2} = \\sqrt{${n((x2 - x1) ** 2 + (y2 - y1) ** 2)}}`, unit: "length" },
  slope: { title: "Slope between two points", formula: { name: "Slope formula", latex: "m = \\frac{y_2 - y_1}{x_2 - x_1}" }, params: ["x1", "y1", "x2", "y2"], compute: ({ x1, y1, x2, y2 }) => { if (x2 === x1) throw new MathInputError("The slope of a vertical line is undefined."); return (y2 - y1) / (x2 - x1); }, substitute: ({ x1, y1, x2, y2 }) => `m = \\frac{${n(y2)} - ${n(y1)}}{${n(x2)} - ${n(x1)}} = \\frac{${n(y2 - y1)}}{${n(x2 - x1)}}`, unit: "none" },
};

export function solveGeometry(shape: Shape, params: Record<string, number>, unit?: string): SolverOutput {
  if (shape === "midpoint") {
    const { x1, y1, x2, y2 } = params;
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    return {
      interpreted: `\\text{Midpoint of } (${n(x1)}, ${n(y1)}) \\text{ and } (${n(x2)}, ${n(y2)})`,
      category: "geometry",
      topic: "Midpoint",
      answer: { latex: `(${n(mx)}, ${n(my)})`, text: `(${mx}, ${my})` },
      steps: [{ title: "Average the coordinates", latex: `M = \\left(\\frac{${n(x1)} + ${n(x2)}}{2}, \\frac{${n(y1)} + ${n(y2)}}{2}\\right) = (${n(mx)}, ${n(my)})` }],
      formulas: [{ name: "Midpoint formula", latex: "M = \\left(\\frac{x_1 + x_2}{2}, \\frac{y_1 + y_2}{2}\\right)" }],
      explanation: "The midpoint averages the x-coordinates and the y-coordinates.",
      verification: verificationFrom([{ label: "Equidistant from both endpoints", passed: Math.abs(Math.hypot(mx - x1, my - y1) - Math.hypot(mx - x2, my - y2)) < 1e-9 }]),
      graph: { expressions: [], points: [{ x: x1, y: y1, label: "A" }, { x: x2, y: y2, label: "B" }, { x: mx, y: my, label: "M" }] },
    };
  }
  const def = SHAPES[shape];
  for (const p of def.params) {
    if (!Number.isFinite(params[p])) throw new MathInputError(`Missing value for ${p}.`);
    if (!["x1", "y1", "x2", "y2"].includes(p) && params[p] <= 0) throw new MathInputError("Lengths must be positive.");
  }
  const value = def.compute(params);
  const suffix = unit ? (def.unit === "area" ? ` \\text{ ${unit}}^2` : def.unit === "volume" ? ` \\text{ ${unit}}^3` : def.unit === "length" ? ` \\text{ ${unit}}` : "") : def.unit === "area" ? "\\text{ square units}" : def.unit === "volume" ? "\\text{ cubic units}" : "";
  const exact = numTex(value);
  const checks = [{ label: "Recomputed from the formula", passed: Math.abs(def.compute(params) - value) < 1e-12 }];
  if (shape === "hypotenuse") checks.push({ label: "a² + b² = c²", passed: Math.abs(params.a ** 2 + params.b ** 2 - value ** 2) < 1e-9 * value ** 2 });
  return {
    interpreted: `\\text{${def.title}: } ${def.params.map((p) => `${p.replace(/(\d)/, "_$1")} = ${n(params[p])}`).join(",\; ")}`,
    category: "geometry",
    topic: def.title,
    answer: { latex: `${exact}${suffix}`, text: `${roundSig(value, 10)}${unit ? ` ${unit}${def.unit === "area" ? "²" : def.unit === "volume" ? "³" : ""}` : ""}`, decimal: roundSig(value, 10) },
    steps: [
      { title: "Write the formula", latex: def.formula.latex },
      { title: "Substitute the values", latex: def.substitute(params) },
      { title: "Compute", latex: `= ${exact}${/pi|sqrt/.test(exact) ? ` \\approx ${roundSig(value, 8)}` : ""}${suffix}` },
    ],
    formulas: [def.formula],
    explanation: `Use the ${def.formula.name.toLowerCase()} formula and substitute the given measurements.`,
    verification: verificationFrom(checks),
  };
}
