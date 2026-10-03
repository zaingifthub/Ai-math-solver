/** SEO landing pages for the solver (each embeds the full solver with tailored examples and content). */
export interface Landing {
  slug: string;
  title: string;
  h1: string;
  description: string;
  keywords: string[];
  eyebrow: string;
  intro: string;
  examples: string[];
  topics: { name: string; example: string; desc: string }[];
  sections: { heading: string; body: string }[];
  faqs: { q: string; a: string }[];
  calculators: string[];
}

export const LANDINGS: Landing[] = [
  {
    slug: "ai-math-solver",
    title: "AI Math Solver — Free Step-by-Step Answers You Can Trust",
    h1: "AI Math Solver",
    eyebrow: "Verified answers · Step-by-step · AI tutor",
    description: "Free AI math solver with verified step-by-step solutions for algebra, calculus, geometry and statistics. Type, paste or snap a photo of any problem.",
    keywords: ["ai math solver", "math ai", "ai math problem solver", "math solver with steps"],
    intro: "Type, paste or photograph any math problem. A real math engine computes the exact answer, an independent verification layer checks it, and AI explains every step at your level — so you understand the solution, not just copy it.",
    examples: ["2x^2 - 3x - 1 = 0", "derivative of x^2 sin(x)", "integrate x e^x dx", "x + y = 10; x - y = 2", "limit of (x^2-1)/(x-1) as x->1", "area of a circle with radius 5"],
    topics: [
      { name: "Algebra", example: "3(x − 2) + 4 = 2x + 7", desc: "Linear, quadratic, polynomial, rational and radical equations." },
      { name: "Calculus", example: "∫ x² sin x dx", desc: "Limits, derivatives and integrals with named rules." },
      { name: "Geometry", example: "volume of a cone", desc: "Area, volume, triangles and coordinate geometry." },
      { name: "Statistics", example: "standard deviation of data", desc: "Descriptive statistics and probability." },
      { name: "Linear algebra", example: "inverse of a 3×3 matrix", desc: "Determinants, inverses, RREF and eigenvalues." },
      { name: "Word problems", example: "trains, mixtures, ages", desc: "Translated into equations, then solved and verified." },
    ],
    sections: [
      { heading: "Why an AI math solver needs a math engine", body: "Language models are excellent at explaining but can slip on arithmetic. AI Math Solver never lets AI decide the answer: the result comes from exact symbolic computation, and every solution is independently verified — solutions are substituted back into equations, derivatives are compared with numerical differentiation, and integrals are differentiated back to the integrand. You see which checks passed." },
      { heading: "Explanations that match your level", body: "Choose Beginner, Middle school, High school or College. The AI explanation adapts its vocabulary and depth, adds study tips and highlights the most common mistakes for that type of problem." },
      { heading: "From answer to understanding", body: "Every solution links to the AI tutor so you can ask “why?” about any step, request a hint, or see another method. Then practice similar problems and track your progress by topic." },
    ],
    faqs: [
      { q: "Is the AI math solver free?", a: "Yes. The free plan includes verified step-by-step solutions every day, plus all calculators, graphing and formulas. Premium removes limits." },
      { q: "How is this different from a chatbot?", a: "A chatbot predicts text. Our engine computes the answer exactly and verifies it before AI explains it, so explanations are always about a correct solution." },
      { q: "Can it read handwriting?", a: "Yes. Upload a photo; we transcribe it, show our confidence and let you correct anything before solving." },
      { q: "Which grade levels are supported?", a: "Everything from arithmetic and pre-algebra through calculus, linear algebra and statistics at college level." },
    ],
    calculators: ["algebra-calculator", "derivative-calculator", "integral-calculator", "quadratic-formula-calculator"],
  },
  {
    slug: "math-solver",
    title: "Math Solver — Solve Any Math Problem Step by Step (Free)",
    h1: "Math Solver",
    eyebrow: "Free · Step-by-step · Instant",
    description: "Free online math solver that shows every step. Solve equations, simplify expressions, factor polynomials, compute derivatives and integrals, and check homework instantly.",
    keywords: ["math solver", "math problem solver", "solve math problems", "math homework help"],
    intro: "One box for all of your math. Enter an equation, expression or question in plain English and get a complete worked solution with the formulas used and an independent check of the answer.",
    examples: ["3/4 + 5/6", "x^2 - 5x + 6 = 0", "simplify (x^2 - 9)/(x - 3)", "20% of 150", "sqrt(x + 3) = x - 3", "mean of 4, 8, 15, 16, 23, 42"],
    topics: [
      { name: "Arithmetic", example: "2 + 3 × 4 − (6 ÷ 2)²", desc: "Order of operations shown one step at a time." },
      { name: "Fractions & percents", example: "3/4 + 5/6", desc: "Exact fractions, mixed numbers and percentages." },
      { name: "Equations", example: "2x + 5 = 17", desc: "Every solution checked in the original equation." },
      { name: "Inequalities", example: "x² − 4 > 0", desc: "Sign charts and interval notation." },
      { name: "Functions", example: "domain of 1/(x − 2)", desc: "Domain, inverse, vertex and intercepts." },
      { name: "Calculus", example: "lim x→0 sin x / x", desc: "Limits, derivatives and integrals." },
    ],
    sections: [
      { heading: "How to use the math solver", body: "1. Type your problem (use ^ for powers, / for fractions, or the math keyboard). 2. Press Solve. 3. Read the answer, the step-by-step working and the verification. 4. Turn on AI explanation for a friendly walkthrough." },
      { heading: "Natural language works too", body: "Write problems the way your teacher says them: “derivative of sin(x²)”, “factor x² − 5x + 6”, “solve for y: 2x + 3y = 6”, “convert 5 km to miles”." },
    ],
    faqs: [
      { q: "What notation does the math solver accept?", a: "Plain text (x^2, sqrt(x), ln(x)), Unicode (x², √, π), LaTeX (\\frac{1}{2}) and natural language commands." },
      { q: "Does it show all steps?", a: "Yes — every solution includes numbered steps, the formulas used and an explanation of the method." },
    ],
    calculators: ["equation-solver", "fraction-calculator", "percentage-calculator", "simplify-calculator"],
  },
  {
    slug: "algebra-solver",
    title: "Algebra Solver — Step-by-Step Algebra Help (Free)",
    h1: "Algebra Solver",
    eyebrow: "Equations · Inequalities · Factoring",
    description: "Solve algebra problems step by step: linear and quadratic equations, systems, inequalities, polynomials, factoring, exponents and logarithms — every answer verified.",
    keywords: ["algebra solver", "algebra calculator", "solve algebra problems", "algebra help"],
    intro: "From one-step equations to polynomial systems, the algebra solver shows the inverse operations, factoring strategy or formula behind every answer — and rejects extraneous solutions automatically.",
    examples: ["3(x - 2) + 4 = 2x + 7", "2x^2 + 7x + 3 = 0", "x^3 - 6x^2 + 11x - 6 = 0", "factor 4x^2 - 25", "1/x + 1/(x-1) = 1", "-2x + 4 >= 10"],
    topics: [
      { name: "Linear equations", example: "5x − 7 = 3x + 9", desc: "Collect like terms and isolate the variable." },
      { name: "Quadratics", example: "x² − 3x − 10 = 0", desc: "Discriminant, quadratic formula and factoring." },
      { name: "Polynomials", example: "x³ − 2x² − 9x + 18", desc: "Rational Root Theorem and synthetic division." },
      { name: "Systems", example: "2x + 3y = 12, x − y = 1", desc: "Elimination with row operations and Cramer's rule." },
      { name: "Rational & radical", example: "√(x + 3) = x − 3", desc: "Restrictions and extraneous solutions explained." },
      { name: "Exponents & logs", example: "2^(x+1) = 32", desc: "Log rules and exponential equations." },
    ],
    sections: [
      { heading: "Algebra the way teachers grade it", body: "Solutions follow the steps you'd write on paper: simplify each side, collect variable terms, divide by the coefficient. For quadratics we show the discriminant before the formula, and for rational equations we state the domain restrictions first." },
    ],
    faqs: [
      { q: "Can the algebra solver handle systems of three equations?", a: "Yes. Enter equations separated by semicolons or commas, e.g. “x + y + z = 6; 2x − y + z = 3; x + 2y − z = 2”." },
      { q: "Does it simplify radicals?", a: "Yes — answers like (3 ± √17)/4 are given in exact simplified form along with decimals." },
    ],
    calculators: ["algebra-calculator", "quadratic-formula-calculator", "factoring-calculator", "system-of-equations-calculator", "inequality-calculator"],
  },
  {
    slug: "calculus-solver",
    title: "Calculus Solver — Limits, Derivatives & Integrals Step by Step",
    h1: "Calculus Solver",
    eyebrow: "Limits · Derivatives · Integrals",
    description: "Free calculus solver with steps: derivatives (product, quotient, chain rule), integrals, limits and L'Hôpital's rule — every answer verified.",
    keywords: ["calculus solver", "calculus calculator", "derivative solver", "integral solver"],
    intro: "Every calculus answer names the rule it uses and is checked numerically: derivatives against finite differences, antiderivatives by differentiating back, definite integrals against adaptive numerical integration.",
    examples: ["derivative of x^2 sin(x)", "derivative of sin(x^2)", "integrate x^2 sin(x) dx", "integrate 1/(1+x^2) dx from 0 to 1", "limit of sin(x)/x as x->0", "dy/dx of x^2 + y^2 = 25"],
    topics: [
      { name: "Derivatives", example: "d/dx [x² sin x]", desc: "Power, product, quotient and chain rules." },
      { name: "Higher-order & partial", example: "∂/∂y [x² y]", desc: "Second derivatives and partial derivatives." },
      { name: "Implicit differentiation", example: "x² + y² = 25", desc: "dy/dx from relations in x and y." },
      { name: "Indefinite integrals", example: "∫ x eˣ dx", desc: "Substitution, parts and partial fractions." },
      { name: "Definite & improper", example: "∫₀^∞ e^(−x) dx", desc: "Fundamental theorem plus numerical check." },
      { name: "Limits", example: "lim (1 + 1/x)^x", desc: "Direct substitution, factoring, L'Hôpital." },
    ],
    sections: [
      { heading: "Rules, not magic", body: "The derivative solver tells you which rule applies at each stage — sum rule, product rule, chain rule — and shows the intermediate derivatives. The integral solver identifies the technique (u-substitution, integration by parts with LIATE, partial fractions)." },
    ],
    faqs: [
      { q: "Can it evaluate improper integrals?", a: "Yes. Use inf for infinity, e.g. “integrate e^(-x^2) from -inf to inf”." },
      { q: "What if an integral has no elementary antiderivative?", a: "For definite integrals you still get an accurate numerical value; for indefinite ones we tell you it has no elementary form." },
    ],
    calculators: ["derivative-calculator", "integral-calculator", "limit-calculator", "graphing-calculator"],
  },
  {
    slug: "geometry-solver",
    title: "Geometry Solver — Area, Volume, Triangles & More",
    h1: "Geometry Solver",
    eyebrow: "Shapes · Triangles · Coordinates",
    description: "Solve geometry problems step by step: area and perimeter, volume and surface area, the Pythagorean theorem, triangles, distance, midpoint and slope.",
    keywords: ["geometry solver", "geometry calculator", "geometry help", "area and volume calculator"],
    intro: "Describe the shape and its measurements in plain English — “volume of a cylinder radius 3 height 5” — and get the formula, the substitution and an exact answer in terms of π.",
    examples: ["area of a circle with radius 5", "volume of cylinder radius 3 height 5", "hypotenuse 5 and 12", "distance between (1,2) and (4,6)", "area of triangle base 6 height 4", "triangle with sides 7, 8, 9 area"],
    topics: [
      { name: "Area & perimeter", example: "trapezoid with bases 6 and 10", desc: "Rectangles, circles, triangles, trapezoids." },
      { name: "Volume & surface area", example: "sphere radius 3", desc: "Cubes, prisms, cylinders, cones, spheres." },
      { name: "Right triangles", example: "legs 8 and 15", desc: "Pythagorean theorem with verification." },
      { name: "Any triangle", example: "sides 7, 8, 9", desc: "Heron's formula, laws of sines and cosines." },
      { name: "Coordinate geometry", example: "slope through (1, 2), (4, 8)", desc: "Slope, distance and midpoint." },
      { name: "Trigonometry", example: "sin(π/6)", desc: "Exact values and trig equations." },
    ],
    sections: [{ heading: "Exact answers in terms of π", body: "Geometry answers are kept exact where possible (25π) with a decimal approximation, and the units you type are carried into the answer (cm², ft³)." }],
    faqs: [{ q: "Can it solve triangles with angles?", a: "Use the Triangle Calculator for SAS and ASA cases; it applies the laws of sines and cosines." }],
    calculators: ["area-calculator", "volume-calculator", "triangle-calculator", "pythagorean-theorem-calculator", "slope-calculator"],
  },
  {
    slug: "statistics-solver",
    title: "Statistics Solver — Mean, Standard Deviation, Probability Step by Step",
    h1: "Statistics Solver",
    eyebrow: "Descriptive stats · Probability · Counting",
    description: "Statistics and probability solver with steps: mean, median, mode, variance, standard deviation, quartiles, combinations, permutations and binomial probability.",
    keywords: ["statistics solver", "statistics calculator", "probability solver", "standard deviation solver"],
    intro: "Paste a data set or describe a probability question. Get every statistic with the formula, the intermediate sums and an explanation of sample vs population measures.",
    examples: ["mean of 4, 8, 15, 16, 23, 42", "standard deviation of 2, 4, 4, 4, 5, 5, 7, 9", "quartiles of 1, 3, 5, 7, 9, 11, 13", "10 choose 3", "P(10,3)", "binomial n=10 p=0.5 k=3"],
    topics: [
      { name: "Center", example: "mean, median, mode", desc: "Which average to use and why." },
      { name: "Spread", example: "variance & standard deviation", desc: "Sample (n − 1) and population (n)." },
      { name: "Position", example: "quartiles & IQR", desc: "Five-number summary." },
      { name: "Counting", example: "nCr, nPr, n!", desc: "Combinations and permutations." },
      { name: "Probability", example: "binomial probability", desc: "Exactly, at most and at least k successes." },
      { name: "Events", example: "P(A ∪ B)", desc: "Addition, multiplication and complement rules." },
    ],
    sections: [{ heading: "Sample or population?", body: "We report both. Use the sample standard deviation (divide by n − 1) when your data is a sample of a bigger group, and the population version (divide by n) when you have every value." }],
    faqs: [{ q: "How do I enter data?", a: "Separate numbers with commas or spaces, e.g. “mean of 3, 7, 7, 19”." }],
    calculators: ["statistics-calculator", "standard-deviation-calculator", "probability-calculator", "combination-calculator"],
  },
];

export const landingMap = new Map(LANDINGS.map((l) => [l.slug, l]));
