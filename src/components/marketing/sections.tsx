import Link from "next/link";
import { Keyboard, Camera, MessageCircle, LineChart, Calculator, Target, ShieldCheck, Layers, Sparkles, ArrowRight, Check, X, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SectionHeading({ eyebrow, title, description, center = true }: { eyebrow?: string; title: string; description?: string; center?: boolean }) {
  return (
    <div className={cn("mb-10 max-w-2xl", center && "mx-auto text-center")}>
      {eyebrow && <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>}
      <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      {description && <p className="mt-3 text-lg text-muted-foreground">{description}</p>}
    </div>
  );
}

const PIPELINE = [
  { title: "Understand", desc: "Your input — text, LaTeX, keyboard or photo — is normalized and classified into one of 20+ problem types.", icon: Layers },
  { title: "Compute", desc: "A symbolic math engine solves it exactly: algebra, calculus, matrices, statistics.", icon: Calculator },
  { title: "Verify", desc: "Independent checks confirm the answer: substitution, numerical differentiation & integration, round-trips.", icon: ShieldCheck },
  { title: "Explain", desc: "AI explains each verified step at your level — and can never change the answer.", icon: Sparkles },
];

export function HowItWorks() {
  return (
    <section className="container-page py-20">
      <SectionHeading eyebrow="Accuracy by design" title="A math engine first. AI second." description="Chatbots guess. We compute, verify, and then explain — so every explanation is about a correct answer." />
      <ol className="grid gap-4 md:grid-cols-4">
        {PIPELINE.map((s, i) => (
          <li key={s.title} className="relative rounded-2xl border bg-card p-6 shadow-sm">
            <span className="absolute right-5 top-5 font-mono text-xs text-muted-foreground">0{i + 1}</span>
            <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><s.icon className="size-5" /></div>
            <h3 className="font-semibold">{s.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{s.desc}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

const FEATURES = [
  { icon: BookOpen, title: "Step-by-step solutions", desc: "Every step, rule and formula — with alternative methods.", href: "/solver" },
  { icon: Camera, title: "Photo math scanner", desc: "Snap homework or paste a screenshot; confirm and solve.", href: "/solver" },
  { icon: MessageCircle, title: "AI math tutor", desc: "Hints, simpler explanations, mistake checking and lessons.", href: "/tutor" },
  { icon: Keyboard, title: "Advanced math keyboard", desc: "Fractions, roots, integrals, matrices, Greek letters — mobile friendly.", href: "/solver" },
  { icon: LineChart, title: "Graphing calculator", desc: "Plot functions, zoom and pan, find roots and intersections.", href: "/graphing-calculator" },
  { icon: Calculator, title: "30+ calculators", desc: "Derivatives, integrals, matrices, statistics, geometry and more.", href: "/calculators" },
  { icon: Target, title: "Practice & quizzes", desc: "Unlimited generated problems with instant answer checking.", href: "/practice" },
  { icon: ShieldCheck, title: "Progress tracking", desc: "Accuracy by topic, weak areas, streaks and saved problems.", href: "/dashboard" },
];

export function FeatureGrid() {
  return (
    <section className="container-page py-20">
      <SectionHeading eyebrow="Everything in one place" title="Solver, tutor, calculators and practice" description="A complete learning system — not just an answer box." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <Link key={f.title} href={f.href} className="group rounded-2xl border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
            <f.icon className="size-6 text-primary" />
            <h3 className="mt-4 font-semibold">{f.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">Open <ArrowRight className="size-3.5" /></span>
          </Link>
        ))}
      </div>
    </section>
  );
}

const COMPARE = [
  { label: "Exact answers from a symbolic math engine", us: true, chat: false, calc: true },
  { label: "Independent verification shown with each answer", us: true, chat: false, calc: false },
  { label: "Step-by-step explanations adapted to your level", us: true, chat: true, calc: false },
  { label: "Follow-up questions with an AI tutor", us: true, chat: true, calc: false },
  { label: "Photo scanning with confidence check", us: true, chat: "partial", calc: false },
  { label: "Graphing, calculators and formula library", us: true, chat: false, calc: "partial" },
  { label: "Practice problems with progress tracking", us: true, chat: false, calc: false },
];

function Mark({ v }: { v: boolean | string }) {
  if (v === true) return <Check className="mx-auto size-5 text-success" aria-label="Yes" />;
  if (v === false) return <X className="mx-auto size-5 text-muted-foreground/50" aria-label="No" />;
  return <span className="text-xs text-muted-foreground">Partial</span>;
}

export function ComparisonTable() {
  return (
    <section className="container-page py-20">
      <SectionHeading eyebrow="Why AI Math Solver" title="The accuracy of a CAS with the patience of a tutor" />
      <Card className="mx-auto max-w-4xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="p-4 text-left font-medium">Capability</th>
                <th className="p-4 text-center font-semibold text-primary">AI Math Solver</th>
                <th className="p-4 text-center font-medium text-muted-foreground">General AI chatbots</th>
                <th className="p-4 text-center font-medium text-muted-foreground">Basic calculators</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((r) => (
                <tr key={r.label} className="border-b last:border-0">
                  <td className="p-4">{r.label}</td>
                  <td className="bg-primary/5 p-4 text-center"><Mark v={r.us} /></td>
                  <td className="p-4 text-center"><Mark v={r.chat} /></td>
                  <td className="p-4 text-center"><Mark v={r.calc} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

const AUDIENCES = [
  { title: "Students", desc: "Get unstuck on homework, understand each step, and practice until it clicks." },
  { title: "Parents", desc: "Help with homework confidently — even if it's been years since algebra class." },
  { title: "Teachers & tutors", desc: "Generate practice sets, show alternative methods, and explain at any level." },
  { title: "Professionals", desc: "Fast, verified calculations for engineering, finance and data work." },
];

export function Audiences() {
  return (
    <section className="container-page py-20">
      <SectionHeading eyebrow="Built for" title="Everyone who does math" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {AUDIENCES.map((a) => (
          <div key={a.title} className="rounded-2xl border bg-gradient-to-b from-card to-muted/30 p-6">
            <h3 className="font-semibold">{a.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{a.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function CtaBanner({ title = "Start solving smarter today", description = "Free forever for everyday homework. Upgrade any time for unlimited AI tutoring." }: { title?: string; description?: string }) {
  return (
    <section className="container-page py-16">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-sky-600 px-6 py-14 text-center text-white shadow-xl sm:px-12">
        <div className="bg-grid absolute inset-0 opacity-10" aria-hidden />
        <h2 className="relative text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
        <p className="relative mx-auto mt-3 max-w-xl text-white/85">{description}</p>
        <div className="relative mt-8 flex flex-wrap justify-center gap-3">
          <Button size="lg" className="bg-white text-indigo-700 hover:bg-white/90" asChild><Link href="/solver">Solve a problem</Link></Button>
          <Button size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white" asChild><Link href="/register">Create free account</Link></Button>
        </div>
      </div>
    </section>
  );
}
