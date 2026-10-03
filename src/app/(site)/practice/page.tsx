import { PracticeSession } from "@/components/practice/practice-session";
import { buildMetadata } from "@/lib/seo";
import { PRACTICE_TOPICS } from "@/lib/math/generator";

export const metadata = buildMetadata({
  title: "Math Practice Problems & Quizzes with Instant Feedback",
  description: "Unlimited math practice: algebra, calculus, statistics, geometry and more. Get instant answer checking, hints, full solutions and progress tracking.",
  path: "/practice",
});

type Props = { searchParams: Promise<{ topic?: string }> };

export default async function PracticePage({ searchParams }: Props) {
  const { topic } = await searchParams;
  const valid = PRACTICE_TOPICS.some((t) => t.id === topic) ? topic : undefined;
  return (
    <div className="container-page max-w-4xl py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Practice</h1>
      <p className="mt-2 text-muted-foreground">10-question quizzes on {PRACTICE_TOPICS.length} topics. Difficulty adapts as you get answers right, and every problem has a full worked solution.</p>
      <div className="mt-8">
        <PracticeSession initialTopic={valid} />
      </div>
    </div>
  );
}
