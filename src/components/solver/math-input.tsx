"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Keyboard } from "lucide-react";
import { MathKeyboard, type KeyDef } from "./math-keyboard";
import { Tex } from "@/components/math/tex";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  rows?: number;
  keyboardDefaultOpen?: boolean;
  showPreview?: boolean;
  id?: string;
  label?: string;
  className?: string;
  autoFocus?: boolean;
}

/** Text input for math with a toggleable on-screen keyboard and a live rendered preview. */
export function MathInput({ value, onChange, onSubmit, placeholder, rows = 2, keyboardDefaultOpen = false, showPreview = true, id, label = "Math problem", className, autoFocus }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [kbOpen, setKbOpen] = useState(keyboardDefaultOpen);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!showPreview) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      if (!value.trim()) return setPreview(null);
      const { previewTex } = await import("@/lib/math/preview");
      if (!cancelled) setPreview(previewTex(value));
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value, showPreview]);

  const insert = (key: KeyDef) => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const selected = value.slice(start, end);
    let text = key.insert;
    const caretBack = key.back ?? 0;
    // Wrap the current selection inside the function/parentheses when possible
    if (selected && caretBack > 0) {
      const pos = text.length - caretBack;
      text = text.slice(0, pos) + selected + text.slice(pos);
    }
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      if (!el) return;
      const caret = start + text.length - (selected ? 0 : caretBack);
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  const backspace = () => {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    if (start === end && start === 0) return;
    const from = start === end ? start - 1 : start;
    onChange(value.slice(0, from) + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(from, from);
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.();
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="relative rounded-xl border border-input bg-card shadow-xs transition-shadow focus-within:ring-2 focus-within:ring-ring">
        <label htmlFor={id} className="sr-only">{label}</label>
        <textarea
          ref={ref}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={rows}
          placeholder={placeholder}
          autoFocus={autoFocus}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          inputMode={kbOpen ? "none" : "text"}
          maxLength={2000}
          className="block w-full resize-none rounded-xl bg-transparent px-4 py-3.5 pr-12 font-mono text-[15px] leading-relaxed outline-none placeholder:font-sans placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onClick={() => setKbOpen((o) => !o)}
          className={cn("absolute right-2 top-2 cursor-pointer rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", kbOpen && "bg-accent text-primary")}
          aria-label={kbOpen ? "Hide math keyboard" : "Show math keyboard"}
          aria-pressed={kbOpen}
        >
          <Keyboard className="size-5" />
        </button>
        {showPreview && preview && (
          <div className="border-t px-4 py-2.5 text-[15px]" aria-live="polite">
            <span className="mr-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview</span>
            <Tex tex={preview} />
          </div>
        )}
      </div>
      {kbOpen && <MathKeyboard onKey={insert} onBackspace={backspace} />}
    </div>
  );
}
