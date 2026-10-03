import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SolutionView, type ClientSolveResult } from "@/components/solver/solution-view";
import { formatDate } from "@/lib/utils";

export default async function HistoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const user = (await getCurrentUser())!;
  const { id } = await params;
  const p = await prisma.problem.findFirst({ where: { id, userId: user.id } });
  if (!p) notFound();
  const result = { ...(p.result as unknown as ClientSolveResult), id: p.id };
  return (
    <div>
      <Link href="/dashboard/history" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back to history</Link>
      <p className="mb-4 text-sm text-muted-foreground">Solved {formatDate(p.createdAt, { dateStyle: "medium", timeStyle: "short" } as Intl.DateTimeFormatOptions)}</p>
      <SolutionView result={result} />
    </div>
  );
}
