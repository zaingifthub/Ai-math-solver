import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_NAMES, formatDate } from "@/lib/utils";

export default async function SavedPage() {
  const user = (await getCurrentUser())!;
  const items = await prisma.bookmark.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, include: { problem: { select: { id: true, input: true, answer: true, category: true } } } });
  return (
    <div>
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">Saved problems</h1>
      {items.length === 0 ? (
        <p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">Bookmark solutions to build your personal study set.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {items.map((b) => (
            <li key={b.id}>
              <Link href={`/dashboard/history/${b.problem.id}`} className="block rounded-xl border bg-card p-4 transition-colors hover:border-primary/40">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate font-mono text-sm">{b.problem.input}</p>
                  <Badge variant="secondary">{CATEGORY_NAMES[b.problem.category] ?? b.problem.category}</Badge>
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">= {b.problem.answer}</p>
                {b.note && <p className="mt-2 text-sm">{b.note}</p>}
                <p className="mt-2 text-xs text-muted-foreground">Saved {formatDate(b.createdAt)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
