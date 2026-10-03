"use client";
import { useRef, useState } from "react";
import { Camera, ImageUp, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/misc";
import { Tex } from "@/components/math/tex";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface OcrProblem { latex: string; input: string; confidence: number }
interface OcrResponse { problems: OcrProblem[]; confidence: number; needsReview: boolean; issues: string | null }

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** Downscale large photos client-side (also strips EXIF metadata such as GPS location). */
async function prepareImage(file: File): Promise<Blob> {
  if (file.type === "image/gif") return file;
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const max = 2000;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.9));
}

export function PhotoUpload({ onSolve, disabled }: { onSolve: (input: string) => void; disabled?: boolean }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OcrResponse | null>(null);
  const [edits, setEdits] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const handle = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setResult(null);
    if (!ACCEPT.includes(file.type)) return setError("Please choose a PNG, JPEG, WebP or GIF image.");
    if (file.size > 15 * 1024 * 1024) return setError("That image is too large. Please use one under 15 MB.");
    const blob = await prepareImage(file);
    if (blob.size > MAX_BYTES) return setError("That image is too large even after compression. Try cropping it.");
    setPreview(URL.createObjectURL(blob));
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", blob, "problem.jpg");
      const res = await apiFetch<OcrResponse>("/api/ocr", { method: "POST", body: form });
      setResult(res);
      setEdits(res.problems.map((p) => p.input));
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handle(e.dataTransfer.files[0]);
        }}
        onPaste={(e) => {
          const item = [...e.clipboardData.items].find((i) => i.type.startsWith("image/"));
          if (item) void handle(item.getAsFile() ?? undefined);
        }}
        tabIndex={0}
        className={cn("flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-muted/20 px-4 py-8 text-center transition-colors", dragOver && "border-primary bg-primary/5")}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Uploaded problem" className="max-h-48 rounded-lg border object-contain" />
        ) : (
          <ImageUp className="size-10 text-muted-foreground" />
        )}
        <div>
          <p className="font-medium">Upload a photo or screenshot of your problem</p>
          <p className="text-sm text-muted-foreground">Drag & drop, paste (Ctrl+V) or choose a file · PNG, JPG, WebP · max 5 MB</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={loading || disabled}><ImageUp /> Choose image</Button>
          <Button type="button" variant="outline" className="sm:hidden" onClick={() => cameraRef.current?.click()} disabled={loading || disabled}><Camera /> Take photo</Button>
        </div>
        <input ref={fileRef} type="file" accept={ACCEPT.join(",")} className="hidden" onChange={(e) => void handle(e.target.files?.[0])} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void handle(e.target.files?.[0])} />
      </div>

      {loading && (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Reading your problem…</p>
      )}
      {error && <Alert variant="destructive"><AlertTriangle />{error}</Alert>}

      {result && (
        <div className="space-y-3">
          {result.needsReview ? (
            <Alert variant="warning"><AlertTriangle /><span>Please check the transcription before solving{result.issues ? `: ${result.issues}` : "."}</span></Alert>
          ) : (
            <Alert variant="success"><CheckCircle2 />Problem recognized with high confidence. You can still edit it.</Alert>
          )}
          {result.problems.map((p, i) => (
            <div key={i} className="rounded-xl border bg-card p-4">
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>Problem {i + 1}</span>
                <span className={cn(p.confidence < 0.75 && "text-amber-600")}>Confidence {Math.round(p.confidence * 100)}%</span>
              </div>
              <div className="overflow-x-auto"><Tex tex={p.latex} display /></div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input value={edits[i] ?? ""} onChange={(e) => setEdits((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))} className="font-mono" aria-label={`Edit problem ${i + 1}`} />
                <Button onClick={() => onSolve(edits[i] ?? p.input)} disabled={disabled || !(edits[i] ?? "").trim()}>Solve</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
