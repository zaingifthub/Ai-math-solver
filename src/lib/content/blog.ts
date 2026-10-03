/** Blog categories and launch articles (seeded into the CMS; also used as fallback content). */
export const BLOG_CATEGORIES = [
  { slug: "math-learning", name: "Math Learning", description: "How to learn math effectively, build intuition and stay motivated." },
  { slug: "algebra", name: "Algebra", description: "Equations, expressions, functions and graphs explained step by step." },
  { slug: "calculus", name: "Calculus", description: "Limits, derivatives and integrals made understandable." },
  { slug: "geometry", name: "Geometry", description: "Shapes, measurement, proofs and trigonometry." },
  { slug: "statistics", name: "Statistics", description: "Data, probability and statistical thinking." },
  { slug: "homework-help", name: "Homework Help", description: "Worked examples for the problems students ask about most." },
  { slug: "study-tips", name: "Study Tips", description: "Exam preparation, study habits and productivity for math students." },
];

export interface SeedPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  tags: string[];
  readingMinutes: number;
  publishedAt: string;
  body: string;
}

export const SEED_POSTS: SeedPost[] = [
  {
    slug: "how-to-solve-quadratic-equations",
    title: "How to Solve Quadratic Equations: 4 Methods Explained",
    excerpt: "Factoring, the square root method, completing the square and the quadratic formula — when to use each, with worked examples.",
    category: "algebra",
    tags: ["quadratic equations", "factoring", "quadratic formula"],
    readingMinutes: 8,
    publishedAt: "2026-09-01",
    body: `A **quadratic equation** has the form $ax^2 + bx + c = 0$ with $a \\neq 0$. There are four standard ways to solve one, and choosing the right method saves a lot of time.

## 1. Factoring

If the quadratic factors nicely, set each factor equal to zero.

$$x^2 - 5x + 6 = 0 \;\\Rightarrow\; (x-2)(x-3) = 0 \;\\Rightarrow\; x = 2 \\text{ or } x = 3$$

**Use it when** you can quickly spot two numbers that multiply to $c$ and add to $b$.

## 2. The square root method

When there is no $x$ term, isolate $x^2$ and take square roots — remembering both signs.

$$4x^2 = 36 \;\\Rightarrow\; x^2 = 9 \;\\Rightarrow\; x = \\pm 3$$

## 3. Completing the square

Rewrite the equation as a perfect square. This method explains *where the quadratic formula comes from* and gives vertex form.

$$x^2 + 6x + 2 = 0 \;\\Rightarrow\; (x+3)^2 = 7 \;\\Rightarrow\; x = -3 \\pm \\sqrt{7}$$

## 4. The quadratic formula

It always works:

$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$

The **discriminant** $\\Delta = b^2 - 4ac$ tells you what to expect before you calculate:

| Discriminant | Roots |
|---|---|
| $\\Delta > 0$ | two distinct real roots |
| $\\Delta = 0$ | one repeated real root |
| $\\Delta < 0$ | two complex roots |

## Which method should you pick?

1. No $x$ term? Use square roots.
2. Small integer coefficients and $\\Delta$ a perfect square? Factor.
3. Otherwise, use the quadratic formula.

## Common mistakes

- Forgetting the $\\pm$ when taking square roots.
- Not moving every term to one side before factoring.
- Sign errors with $-b$ when $b$ is negative.

Want to check your work? Try our [Quadratic Formula Calculator](/calculators/quadratic-formula-calculator) — every answer is verified by substitution.`,
  },
  {
    slug: "derivative-rules-cheat-sheet",
    title: "Derivative Rules: The Complete Cheat Sheet with Examples",
    excerpt: "Power, product, quotient and chain rules plus the derivatives of exponential, logarithmic and trig functions — with one example each.",
    category: "calculus",
    tags: ["derivatives", "chain rule", "calculus"],
    readingMinutes: 7,
    publishedAt: "2026-09-05",
    body: `Differentiation becomes mechanical once you know a handful of rules and recognise which one applies.

## The core rules

| Rule | Formula |
|---|---|
| Constant | $\\frac{d}{dx}c = 0$ |
| Power | $\\frac{d}{dx}x^n = nx^{n-1}$ |
| Sum | $(f+g)' = f' + g'$ |
| Product | $(fg)' = f'g + fg'$ |
| Quotient | $\\left(\\frac fg\\right)' = \\frac{f'g - fg'}{g^2}$ |
| Chain | $(f(g(x)))' = f'(g(x))\\,g'(x)$ |

## Standard derivatives

$$\\frac{d}{dx}e^x = e^x,\\quad \\frac{d}{dx}\\ln x = \\frac1x,\\quad \\frac{d}{dx}\\sin x = \\cos x,\\quad \\frac{d}{dx}\\cos x = -\\sin x$$

## Worked examples

**Product rule:** $\\frac{d}{dx}\\left(x^2\\sin x\\right) = 2x\\sin x + x^2\\cos x$.

**Chain rule:** $\\frac{d}{dx}\\left(e^{3x^2}\\right) = e^{3x^2}\\cdot 6x$.

**Quotient rule:** $\\frac{d}{dx}\\frac{x}{x+1} = \\frac{1}{(x+1)^2}$.

## How to decide which rule to use

Read the function from the *outside in*. If the outermost operation is a sum, split it. If it's a product or quotient, use those rules. If a function is applied to something other than plain $x$, you need the chain rule.

Practice with our [Derivative Calculator](/calculators/derivative-calculator), which names every rule it applies.`,
  },
  {
    slug: "mean-median-mode-explained",
    title: "Mean, Median and Mode: Which Average Should You Use?",
    excerpt: "Three measures of center, how to compute them, and why the median is often more honest than the mean.",
    category: "statistics",
    tags: ["mean", "median", "mode", "statistics"],
    readingMinutes: 5,
    publishedAt: "2026-09-09",
    body: `"Average" can mean three different things in statistics.

## Mean

Add the values and divide by how many there are: $\\bar x = \\frac{1}{n}\\sum x_i$.

## Median

Sort the data; the median is the middle value (or the average of the two middle values).

## Mode

The value that appears most often. A data set can have no mode or several.

## Example

Salaries (in $1000s): 32, 35, 38, 40, 41, 250.

- Mean: $\\frac{436}{6} \\approx 72.7$
- Median: $\\frac{38 + 40}{2} = 39$

One extreme salary drags the mean far above what a typical person earns. **When data is skewed or has outliers, report the median.**

Compute all three (plus standard deviation and quartiles) with the [Statistics Calculator](/calculators/statistics-calculator).`,
  },
  {
    slug: "pythagorean-theorem-real-world",
    title: "The Pythagorean Theorem: Proof, Examples and Real-World Uses",
    excerpt: "Why a² + b² = c² is true, how to use it, and where it shows up from construction to GPS.",
    category: "geometry",
    tags: ["pythagorean theorem", "triangles", "geometry"],
    readingMinutes: 6,
    publishedAt: "2026-09-12",
    body: `In a right triangle with legs $a$ and $b$ and hypotenuse $c$:

$$a^2 + b^2 = c^2$$

## A visual proof

Arrange four copies of the triangle inside a square of side $a + b$. The empty space in the middle is a square of side $c$, so $(a+b)^2 = 4\\cdot\\frac12 ab + c^2$, which simplifies to $a^2 + b^2 = c^2$.

## Examples

- Legs 3 and 4: $c = \\sqrt{9 + 16} = 5$.
- Hypotenuse 13, leg 5: $b = \\sqrt{169 - 25} = 12$.

## Real-world uses

- **Construction:** builders check right angles with the 3-4-5 rule.
- **Navigation:** straight-line distance between two points uses the distance formula, which is the theorem in disguise.
- **Screens:** TV sizes are diagonal measurements.

Try the [Pythagorean Theorem Calculator](/calculators/pythagorean-theorem-calculator).`,
  },
  {
    slug: "how-to-study-math-effectively",
    title: "How to Study Math Effectively: 9 Evidence-Based Strategies",
    excerpt: "Retrieval practice, interleaving, spaced repetition and other techniques backed by learning science.",
    category: "study-tips",
    tags: ["study tips", "learning", "exams"],
    readingMinutes: 7,
    publishedAt: "2026-09-15",
    body: `Re-reading notes feels productive but barely helps. These strategies are supported by research on how people learn.

1. **Practice retrieval.** Close the book and solve problems from memory.
2. **Space it out.** Three 30-minute sessions beat one 90-minute cram.
3. **Interleave topics.** Mix problem types so you learn to *choose* a method.
4. **Explain it out loud.** If you can't explain a step, you don't own it yet.
5. **Study worked examples, then fade them.** Start with full solutions, then hide more steps.
6. **Analyze your mistakes.** Keep an error log: concept error, careless slip, or misread question?
7. **Check answers independently.** Substitute solutions back in or estimate first.
8. **Sleep.** Memory consolidation happens overnight.
9. **Ask for hints, not answers.** A nudge keeps the thinking yours.

Our [AI Tutor](/tutor) has a dedicated *hint* mode, and the [Practice](/practice) section tracks your weak topics automatically.`,
  },
  {
    slug: "solving-systems-of-equations",
    title: "Solving Systems of Equations: Substitution vs Elimination",
    excerpt: "Two core methods for simultaneous equations, when to use each, and what no solution or infinitely many solutions look like.",
    category: "homework-help",
    tags: ["systems of equations", "elimination", "substitution"],
    readingMinutes: 6,
    publishedAt: "2026-09-18",
    body: `A **system of equations** asks for values that satisfy every equation at once.

## Substitution

Solve one equation for a variable, substitute into the other.

$$y = 2x - 1,\\quad 3x + y = 9 \;\\Rightarrow\; 3x + 2x - 1 = 9 \;\\Rightarrow\; x = 2,\; y = 3$$

Best when a variable already has coefficient 1.

## Elimination

Add or subtract equations to cancel a variable.

$$\\begin{cases} 2x + 3y = 12 \\\\ x - y = 1 \\end{cases}$$

Multiply the second equation by 3 and add: $5x = 15$, so $x = 3$, $y = 2$.

## Special cases

- **No solution:** you reach a false statement like $0 = 5$ (parallel lines).
- **Infinitely many:** you reach $0 = 0$ (the same line twice).

Check your work with the [System of Equations Calculator](/calculators/system-of-equations-calculator).`,
  },
  {
    slug: "understanding-limits",
    title: "Understanding Limits: The Foundation of Calculus",
    excerpt: "What a limit really means, how to evaluate one, and how to handle 0/0.",
    category: "calculus",
    tags: ["limits", "calculus", "lhopital"],
    readingMinutes: 6,
    publishedAt: "2026-09-22",
    body: `A limit describes the value a function **approaches**, not necessarily the value it takes.

$$\\lim_{x\\to 1}\\frac{x^2 - 1}{x - 1}$$

At $x = 1$ the expression is $\\frac00$ — undefined. But for every $x \\neq 1$ it equals $x + 1$, which approaches $2$. So the limit is $2$.

## A strategy that works

1. **Substitute directly.** If you get a number, you're done.
2. **0/0?** Factor and cancel, rationalize, or use a trig identity.
3. **Still stuck?** Apply L'Hôpital's rule: differentiate numerator and denominator separately.
4. **At infinity?** Compare the highest powers.

## When limits don't exist

If the left- and right-hand limits differ, as with $\\lim_{x\\to0}\\frac1x$, the two-sided limit does not exist.

Try the [Limit Calculator](/calculators/limit-calculator).`,
  },
  {
    slug: "why-ai-math-answers-need-verification",
    title: "Why AI Math Answers Need Verification (and How We Do It)",
    excerpt: "Large language models are great explainers but can make arithmetic slips. Here's how AI Math Solver combines a math engine with AI.",
    category: "math-learning",
    tags: ["AI", "accuracy", "verification"],
    readingMinutes: 5,
    publishedAt: "2026-09-26",
    body: `AI chatbots explain math fluently, but language models predict text — they don't *compute*. That's how a confident explanation can end with the wrong number.

## Our approach: engine first, AI second

1. **Classification** — we detect what kind of problem you typed.
2. **Math engine** — exact symbolic algebra and calculus produce the answer and the steps.
3. **Verification** — every answer is independently checked: solutions are substituted back, derivatives are compared to numerical differentiation, integrals are differentiated back, limits are approached numerically.
4. **AI explanation** — only then does AI explain *why* each step works, at your level. The AI is not allowed to change the verified answer.

Each solution shows a **verification badge** listing the checks that passed.

The AI tutor follows the same rule: when it needs to calculate, it calls the math engine instead of guessing.

[Try the AI Math Solver](/solver).`,
  },
];
