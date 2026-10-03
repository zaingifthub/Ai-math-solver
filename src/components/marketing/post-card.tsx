import Link from "next/link";
import type { PostView } from "@/lib/cms";
import { formatDate } from "@/lib/utils";

export function PostCard({ post }: { post: PostView }) {
  return (
    <article className="flex flex-col rounded-2xl border bg-card p-6 transition-shadow hover:shadow-md">
      {post.category && <Link href={`/blog/category/${post.category.slug}`} className="text-xs font-semibold uppercase tracking-wide text-primary hover:underline">{post.category.name}</Link>}
      <h2 className="mt-2 text-lg font-semibold leading-snug"><Link href={`/blog/${post.slug}`} className="hover:text-primary">{post.title}</Link></h2>
      <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">{post.excerpt}</p>
      <p className="mt-4 text-xs text-muted-foreground">{formatDate(post.publishedAt)} · {post.readingMinutes} min read</p>
    </article>
  );
}

export function Pagination({ page, total, perPage, base }: { page: number; total: number; perPage: number; base: string }) {
  const pages = Math.ceil(total / perPage);
  if (pages <= 1) return null;
  return (
    <nav className="mt-10 flex justify-center gap-2" aria-label="Pagination">
      {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
        <Link key={p} href={p === 1 ? base : `${base}?page=${p}`} aria-current={p === page ? "page" : undefined} className={`flex size-9 items-center justify-center rounded-lg border text-sm ${p === page ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
          {p}
        </Link>
      ))}
    </nav>
  );
}
