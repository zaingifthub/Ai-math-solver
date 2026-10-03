import { ImageResponse } from "next/og";

export const runtime = "nodejs";

/** Dynamic Open Graph image: /og?title=... */
export async function GET(req: Request) {
  const title = (new URL(req.url).searchParams.get("title") ?? "AI Math Solver — Verified step-by-step solutions").slice(0, 120);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 45%, #0c4a6e 100%)", color: "white", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, background: "linear-gradient(135deg,#6366f1,#0ea5e9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, fontWeight: 700 }}>∑</div>
          <div style={{ fontSize: 34, fontWeight: 600, opacity: 0.95 }}>AI Math Solver</div>
        </div>
        <div style={{ fontSize: title.length > 60 ? 58 : 70, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1.5, maxWidth: 1000 }}>{title}</div>
        <div style={{ display: "flex", gap: 28, fontSize: 26, opacity: 0.85 }}>
          <span>✓ Verified answers</span>
          <span>✓ Step-by-step</span>
          <span>✓ AI tutor</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=86400, immutable" } },
  );
}
