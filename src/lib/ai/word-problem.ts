import "server-only";
import { z } from "zod";
import { generateStructured } from "./structured";

const TranslationSchema = z.object({
  solvable: z.boolean().describe("false if this is not a math problem or lacks the information needed"),
  engine_input: z.string().describe("A single problem in the engine syntax that answers the question"),
  setup: z.string().describe("1-3 sentences in Markdown/LaTeX defining the variable(s) and how the equation was built, including units"),
});

const SYSTEM = `You translate math word problems into input for a deterministic math engine. You do NOT solve the problem yourself.

The engine accepts exactly one of these forms (use * for multiplication, ^ for powers, sqrt(), ln(), log_b(x), sin() etc.):
- An arithmetic expression: (120 / 2)
- One equation in one unknown: 2x + 5 = 17
- A linear or nonlinear system separated by semicolons: x + y = 10; x - y = 2
- An inequality: 3x - 7 < 2
- derivative of <expr> / integrate <expr> dx from a to b / limit of <expr> as x -> a
- Statistics: mean of 2, 4, 6 (also median, mode, standard deviation, variance)
- Counting/probability: 10 choose 3, P(10,3), binomial n=10 p=0.5 k=3
- Geometry: area of a circle with radius 5, volume of cylinder radius 3 height 5, hypotenuse 3 and 4
- Unit conversion: convert 5 km to miles

Choose the variable names x, y, z. Keep numbers exactly as given. If the question asks for a quantity that is a direct arithmetic result, give the arithmetic expression.`;

export async function translateWordProblem(text: string): Promise<{ input: string; setup: string; usage: { input: number; output: number; model: string } } | null> {
  const response = await generateStructured({ system: SYSTEM, text: `<word_problem>\n${text}\n</word_problem>`, schema: TranslationSchema, maxTokens: 2000 });
  if (!response?.data.solvable || !response.data.engine_input.trim()) return null;
  return { input: response.data.engine_input.trim(), setup: response.data.setup, usage: response.usage };
}
