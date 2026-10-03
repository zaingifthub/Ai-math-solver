"use client";
import { useState } from "react";
import { Tex } from "@/components/math/tex";
import { cn } from "@/lib/utils";

export interface KeyDef {
  tex: string;
  insert: string;
  /** characters from the end of `insert` to place the cursor */
  back?: number;
  title?: string;
  wide?: boolean;
}

const k = (tex: string, insert: string, back = 0, title?: string): KeyDef => ({ tex, insert, back, title });

const LAYOUTS: Record<string, KeyDef[]> = {
  Basic: [
    k("7", "7"), k("8", "8"), k("9", "9"), k("\\div", " / ", 0, "Divide"), k("(", "("), k(")", ")"),
    k("4", "4"), k("5", "5"), k("6", "6"), k("\\times", " * ", 0, "Multiply"), k("x", "x"), k("y", "y"),
    k("1", "1"), k("2", "2"), k("3", "3"), k("-", " - "), k("x^2", "^2", 0, "Square"), k("x^{\\square}", "^()", 1, "Power"),
    k("0", "0"), k(".", "."), k("=", " = "), k("+", " + "), k("\\frac{\\square}{\\square}", "()/()", 4, "Fraction"), k("\\sqrt{\\square}", "sqrt()", 1, "Square root"),
  ],
  Algebra: [
    k("x", "x"), k("y", "y"), k("z", "z"), k("a", "a"), k("b", "b"), k("n", "n"),
    k("<", " < "), k(">", " > "), k("\\le", " <= "), k("\\ge", " >= "), k("\\ne", " != "), k("|\\square|", "abs()", 1, "Absolute value"),
    k("\\sqrt[3]{\\square}", "cbrt()", 1, "Cube root"), k("\\sqrt[n]{\\square}", "nthRoot(, n)", 4, "nth root"), k("e^{\\square}", "e^()", 1), k("\\log_{\\square}", "log_2()", 1, "Log base"), k("\\ln", "ln()", 1), k("\\log", "log()", 1),
    k("\\pi", "pi"), k("e", "e"), k("i", "i"), k("n!", "!"), k(";", "; ", 0, "Separate equations"), k("\\pm", "+-"),
  ],
  Trig: [
    k("\\sin", "sin()", 1), k("\\cos", "cos()", 1), k("\\tan", "tan()", 1), k("\\csc", "csc()", 1), k("\\sec", "sec()", 1), k("\\cot", "cot()", 1),
    k("\\sin^{-1}", "asin()", 1), k("\\cos^{-1}", "acos()", 1), k("\\tan^{-1}", "atan()", 1), k("\\theta", "theta"), k("\\pi", "pi"), k("^\\circ", " deg"),
    k("\\sinh", "sinh()", 1), k("\\cosh", "cosh()", 1), k("\\tanh", "tanh()", 1), k("\\sin^2", "sin()^2", 3), k("\\cos^2", "cos()^2", 3), k("2\\pi", "2pi"),
  ],
  Calculus: [
    k("\\frac{d}{dx}", "derivative of ", 0, "Derivative"), k("\\frac{d^2}{dx^2}", "second derivative of ", 0), k("\\int", "integrate  dx", 3, "Integral"), k("\\int_a^b", "integrate  dx from 0 to 1", 17, "Definite integral"), k("\\lim", "limit of  as x -> 0", 12, "Limit"), k("\\infty", "inf"),
    k("\\frac{\\partial}{\\partial y}", "partial derivative of  with respect to y", 23), k("\\frac{dy}{dx}", "dy/dx of "), k("\\to", " -> "), k("x \\to 0^+", "0+"), k("e^x", "e^x"), k("\\ln x", "ln(x)"),
  ],
  Greek: [
    k("\\alpha", "alpha"), k("\\beta", "beta"), k("\\gamma", "gamma"), k("\\delta", "delta"), k("\\theta", "theta"), k("\\lambda", "lambda"),
    k("\\mu", "mu"), k("\\sigma", "sigma"), k("\\phi", "phi"), k("\\omega", "omega"), k("\\pi", "pi"), k("\\rho", "rho"),
  ],
  Matrix: [
    k("\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}", "[[1, 2], [3, 4]]", 0, "2×2 matrix"), k("\\begin{bmatrix}\\cdot&\\cdot&\\cdot\\\\\\cdot&\\cdot&\\cdot\\\\\\cdot&\\cdot&\\cdot\\end{bmatrix}", "[[1, 0, 0], [0, 1, 0], [0, 0, 1]]", 0, "3×3 matrix"),
    k("\\det", "det "), k("A^{-1}", "inverse "), k("A^T", "transpose "), k("\\text{rref}", "rref "), k("\\lambda", "eigenvalues "), k("\\vec{v}", "<1, 2, 3>"), k("\\cdot", "dot product of "), k("\\times", "cross product of "), k("\\|\\vec v\\|", "magnitude of "),
  ],
};

export function MathKeyboard({ onKey, onBackspace, className }: { onKey: (key: KeyDef) => void; onBackspace?: () => void; className?: string }) {
  const [tab, setTab] = useState<keyof typeof LAYOUTS>("Basic");
  return (
    <div className={cn("rounded-xl border bg-muted/40 p-2", className)} role="group" aria-label="Math keyboard">
      <div className="mb-2 flex gap-1 overflow-x-auto pb-1" role="tablist">
        {Object.keys(LAYOUTS).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn("shrink-0 cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition-colors", tab === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            {t}
          </button>
        ))}
        {onBackspace && (
          <button type="button" onClick={onBackspace} className="ml-auto shrink-0 cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground" aria-label="Backspace">
            ⌫
          </button>
        )}
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {LAYOUTS[tab].map((key, i) => (
          <button
            key={`${tab}-${i}`}
            type="button"
            title={key.title ?? key.insert.trim()}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onKey(key)}
            className="flex h-11 cursor-pointer items-center justify-center overflow-hidden rounded-lg border bg-card text-sm shadow-xs transition-colors hover:border-primary/40 hover:bg-accent active:scale-95 sm:h-10"
          >
            <span className="pointer-events-none max-w-full scale-90 truncate">
              <Tex tex={key.tex} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
