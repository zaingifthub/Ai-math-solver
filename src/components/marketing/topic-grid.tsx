import Link from "next/link";

const TOPICS = [
  { name: "Arithmetic", q: "2 + 3 * 4 - (6/2)^2" }, { name: "Fractions", q: "3/4 + 5/6" }, { name: "Linear equations", q: "5x - 7 = 3x + 9" },
  { name: "Quadratics", q: "x^2 - 3x - 10 = 0" }, { name: "Inequalities", q: "x^2 - 4 > 0" }, { name: "Polynomials", q: "factor x^3 - 2x^2 - 9x + 18" },
  { name: "Systems", q: "2x + 3y = 12; x - y = 1" }, { name: "Exponents", q: "2^(x+1) = 32" }, { name: "Logarithms", q: "log_2(64)" },
  { name: "Trigonometry", q: "sin(x) = 1/2" }, { name: "Functions", q: "inverse of f(x) = 2x + 3" }, { name: "Geometry", q: "volume of cone radius 3 height 4" },
  { name: "Limits", q: "limit of (x^2-1)/(x-1) as x->1" }, { name: "Derivatives", q: "derivative of e^(2x) cos(x)" }, { name: "Integrals", q: "integrate x^2 sin(x) dx" },
  { name: "Statistics", q: "standard deviation of 2, 4, 4, 4, 5, 5, 7, 9" }, { name: "Probability", q: "binomial n=10 p=0.5 k=3" }, { name: "Matrices", q: "inverse [[2,1],[1,3]]" },
  { name: "Vectors", q: "cross product <1,2,3> and <4,5,6>" }, { name: "Units", q: "convert 5 km to miles" },
];

export function TopicGrid() {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {TOPICS.map((t) => (
        <Link key={t.name} href={`/solver?q=${encodeURIComponent(t.q)}`} className="rounded-full border bg-card px-4 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-accent hover:text-accent-foreground">
          {t.name}
        </Link>
      ))}
    </div>
  );
}
