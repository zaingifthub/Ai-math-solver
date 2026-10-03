"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Send, Square, Plus, Trash2, Lightbulb, Baby, Shuffle, ListChecks, GraduationCap, SearchCheck, BookOpen, MessageSquare, Calculator, Loader2 } from "lucide-react";
import { MarkdownMath } from "@/components/math/markdown-math";
import { Button } from "@/components/ui/button";
import { Textarea, NativeSelect } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { apiFetch } from "@/lib/api-client";
import { LEVELS, cn } from "@/lib/utils";

type Mode = "chat" | "explain-step" | "simplify" | "hint" | "another-method" | "examples" | "practice" | "check-work" | "teach";
interface Msg {
  role: "user" | "assistant";
  content: string;
  tools?: { problem: string; answer?: string; error?: string }[];
}

const MODES: { id: Mode; label: string; icon: React.ElementType; prompt: string }[] = [
  { id: "explain-step", label: "Explain this step", icon: MessageSquare, prompt: "Can you explain step " },
  { id: "simplify", label: "Explain simply", icon: Baby, prompt: "Explain this more simply, please." },
  { id: "hint", label: "Give me a hint", icon: Lightbulb, prompt: "Give me a hint for: " },
  { id: "another-method", label: "Another method", icon: Shuffle, prompt: "Show me another way to solve this." },
  { id: "examples", label: "Examples", icon: BookOpen, prompt: "Give me worked examples of this type of problem." },
  { id: "practice", label: "Practice questions", icon: ListChecks, prompt: "Create practice questions on " },
  { id: "check-work", label: "Check my work", icon: SearchCheck, prompt: "Here is my work, where did I go wrong?\n" },
  { id: "teach", label: "Teach me the concept", icon: GraduationCap, prompt: "Teach me " },
];

const STARTERS = ["Why does the quadratic formula work?", "Help me understand the chain rule", "What's the difference between mean and median?", "Give me a hint for 3x - 7 = 2x + 5"];

export function TutorChat() {
  const { data: session } = useSession();
  const params = useSearchParams();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("chat");
  const [levelChoice, setLevel] = useState<string | null>(null);
  const level = levelChoice ?? session?.user?.level ?? "HIGH_SCHOOL";
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<{ message: string; upgrade?: boolean } | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [context, setContext] = useState<string | undefined>();
  const [conversations, setConversations] = useState<{ id: string; title: string }[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const loadConversations = useCallback(async () => {
    if (!session) return;
    try {
      const { conversations } = await apiFetch<{ conversations: { id: string; title: string }[] }>("/api/tutor/conversations");
      setConversations(conversations);
    } catch {
      /* ignore */
    }
  }, [session]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads saved conversations from the API
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (params.get("from") !== "solution") return;
    try {
      const raw = sessionStorage.getItem("tutor-context");
      if (raw) {
        const { context, problem } = JSON.parse(raw) as { context: string; problem: string };
        // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is browser-only, read after hydration
        setContext(context);
        setInput(`I just solved "${problem}". Can you explain the key idea behind the solution?`);
      }
    } catch {
      /* ignore */
    }
  }, [params]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const openConversation = async (id: string) => {
    try {
      const { conversation } = await apiFetch<{ conversation: { id: string; messages: Msg[] } }>(`/api/tutor/conversations/${id}`);
      setConversationId(id);
      setMessages(conversation.messages);
      setContext(undefined);
    } catch (e) {
      setError({ message: (e as Error).message });
    }
  };

  const deleteConversation = async (id: string) => {
    await apiFetch(`/api/tutor/conversations/${id}`, { method: "DELETE" }).catch(() => undefined);
    if (id === conversationId) newChat();
    void loadConversations();
  };

  const newChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setConversationId(null);
    setContext(undefined);
    setError(null);
  };

  const send = async (text?: string) => {
    const message = (text ?? input).trim();
    if (!message || streaming) return;
    setError(null);
    setInput("");
    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: "user", content: message }, { role: "assistant", content: "", tools: [] }]);
    setStreaming(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, mode, level, context, conversationId: conversationId ?? undefined, history: session ? undefined : history }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
        throw Object.assign(new Error(data.error ?? "The tutor is unavailable right now."), { code: data.code });
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const raw of events) {
          const ev = /^event: (\w+)/m.exec(raw)?.[1];
          const dataLine = /^data: (.*)$/m.exec(raw)?.[1];
          if (!ev || !dataLine) continue;
          const data = JSON.parse(dataLine) as Record<string, unknown>;
          if (ev === "meta" && data.conversationId) setConversationId(String(data.conversationId));
          else if (ev === "text") setMessages((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, content: x.content + String(data.text) } : x)));
          else if (ev === "tool") setMessages((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, tools: [...(x.tools ?? []), data as { problem: string; answer?: string }] } : x)));
          else if (ev === "error") throw new Error(String(data.error));
        }
      }
      if (session && !conversationId) void loadConversations();
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError({ message: (e as Error).message, upgrade: (e as { code?: string }).code === "QUOTA_EXCEEDED" });
        setMessages((m) => (m[m.length - 1]?.content ? m : m.slice(0, -1)));
      }
    } finally {
      setStreaming(false);
      setMode("chat");
      abortRef.current = null;
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="hidden space-y-3 lg:block">
        <Button className="w-full" variant="outline" onClick={newChat}><Plus /> New conversation</Button>
        {session ? (
          <ul className="space-y-1">
            {conversations.map((c) => (
              <li key={c.id} className={cn("group flex items-center rounded-lg text-sm hover:bg-muted", c.id === conversationId && "bg-muted")}>
                <button type="button" onClick={() => void openConversation(c.id)} className="min-w-0 flex-1 cursor-pointer truncate px-3 py-2 text-left">{c.title}</button>
                <button type="button" onClick={() => void deleteConversation(c.id)} aria-label="Delete conversation" className="mr-1 cursor-pointer rounded p-1 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"><Trash2 className="size-3.5" /></button>
              </li>
            ))}
            {conversations.length === 0 && <li className="px-3 text-sm text-muted-foreground">No saved conversations yet.</li>}
          </ul>
        ) : (
          <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground"><Link href="/register" className="font-medium text-primary">Create a free account</Link> to save conversations and get more tutor messages.</p>
        )}
      </aside>

      <div className="flex min-h-[70vh] flex-col rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium"><span className="size-2 rounded-full bg-success" /> AI Math Tutor {context && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">with solution context</span>}</div>
          <div className="flex items-center gap-2">
            <NativeSelect value={level} onChange={(e) => setLevel(e.target.value)} className="h-8 w-auto py-0 text-xs" aria-label="Education level">
              {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </NativeSelect>
            <Button variant="ghost" size="sm" className="lg:hidden" onClick={newChat}><Plus /> New</Button>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6" aria-live="polite">
          {messages.length === 0 && (
            <div className="mx-auto max-w-lg py-10 text-center">
              <h2 className="text-2xl font-semibold tracking-tight">What would you like to learn?</h2>
              <p className="mt-2 text-sm text-muted-foreground">Ask any math question. The tutor checks every calculation with our verified math engine.</p>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                {STARTERS.map((s) => (
                  <button key={s} type="button" onClick={() => void send(s)} className="cursor-pointer rounded-xl border bg-muted/30 p-3 text-left text-sm transition-colors hover:border-primary/40">{s}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[92%] rounded-2xl px-4 py-3 sm:max-w-[85%]", m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/40")}>
                {m.role === "user" ? (
                  <p className="whitespace-pre-wrap text-[15px]">{m.content}</p>
                ) : (
                  <>
                    {m.tools && m.tools.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-1.5">
                        {m.tools.map((t, j) => (
                          <span key={j} className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 font-mono text-[11px] text-muted-foreground" title={t.error ?? t.answer}>
                            <Calculator className="size-3 text-primary" /> verified: {t.problem.slice(0, 40)}{t.answer ? ` → ${t.answer.slice(0, 30)}` : ""}
                          </span>
                        ))}
                      </div>
                    )}
                    {m.content ? <MarkdownMath source={m.content} /> : <span className="inline-flex gap-1" aria-label="Tutor is typing"><span className="size-2 animate-pulse-dot rounded-full bg-muted-foreground" /><span className="size-2 animate-pulse-dot rounded-full bg-muted-foreground [animation-delay:0.2s]" /><span className="size-2 animate-pulse-dot rounded-full bg-muted-foreground [animation-delay:0.4s]" /></span>}
                  </>
                )}
              </div>
            </div>
          ))}
          {error && (
            <Alert variant="destructive" className="items-center">
              <span className="flex-1">{error.message}</span>
              {error.upgrade && <Button size="sm" asChild><Link href={session ? "/pricing" : "/register"}>{session ? "Upgrade" : "Sign up free"}</Link></Button>}
            </Alert>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t p-3 sm:p-4">
          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setMode(m.id);
                  if (!input.trim()) setInput(m.prompt);
                  inputRef.current?.focus();
                }}
                className={cn("inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors", mode === m.id ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}
              >
                <m.icon className="size-3.5" /> {m.label}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex items-end gap-2"
          >
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Ask a question, paste your work, or describe where you're stuck…"
              rows={2}
              maxLength={4000}
              className="min-h-12 resize-none"
              aria-label="Message the tutor"
            />
            {streaming ? (
              <Button type="button" variant="outline" size="icon" onClick={() => abortRef.current?.abort()} aria-label="Stop generating"><Square /></Button>
            ) : (
              <Button type="submit" size="icon" disabled={!input.trim()} aria-label="Send">{streaming ? <Loader2 className="animate-spin" /> : <Send />}</Button>
            )}
          </form>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">The tutor verifies calculations with the math engine. Always check important work.</p>
        </div>
      </div>
    </div>
  );
}
