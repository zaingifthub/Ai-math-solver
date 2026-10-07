// Mock of the Gemini REST API (generateContent + streamGenerateContent?alt=sse) for audits.
// Usage: PORT=4011 node audit/mock-gemini.mjs, then run the app with GEMINI_BASE_URL=http://127.0.0.1:4011
import http from "node:http";
import fs from "node:fs";

const PORT = Number(process.env.PORT || 4011);
const LOG = process.env.MOCK_LOG || "audit/gemini-requests.jsonl";

function sample(schema) {
  switch (schema.type) {
    case "OBJECT":
      return Object.fromEntries(Object.entries(schema.properties || {}).map(([k, v]) => [k, sample(v)]));
    case "ARRAY":
      return [sample(schema.items)];
    case "BOOLEAN":
      return true;
    case "NUMBER":
    case "INTEGER":
      return 0.9;
    default:
      return "sample";
  }
}

function structured(body) {
  const sys = body.systemInstruction?.parts?.[0]?.text || "";
  const user = body.contents?.[0]?.parts ?? [];
  const out = sample(body.generationConfig.responseSchema);
  if (sys.includes("OCR")) {
    if (!user.some((p) => p.inlineData?.data)) throw new Error("OCR request without image");
    Object.assign(out, { contains_math: true, issues: "", problems: [{ latex: "2x+5=17", engine_input: "2x+5=17", confidence: 0.97 }] });
  } else if (sys.includes("word problems")) {
    Object.assign(out, { solvable: true, engine_input: "2*x + 3 = 11", setup: "Let $x$ be the price of one pen." });
  } else {
    const answer = JSON.parse(user[0].text.split("<solution>")[1].split("</solution>")[0]).final_answer;
    Object.assign(out, { explanation: "Mock **Gemini** explanation with $x$.", alternative: "", tips: ["Check your work"], common_mistakes: ["Sign errors"], restated_answer: answer });
  }
  return { candidates: [{ content: { role: "model", parts: [{ text: JSON.stringify(out) }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 80, thoughtsTokenCount: 20 }, modelVersion: "gemini-mock-001" };
}

function streamChunks(body) {
  const last = body.contents.at(-1);
  const fr = last.parts.find((p) => p.functionResponse);
  if (fr) {
    // The previous model turn must be echoed back with its thought signature.
    const prev = body.contents.at(-2);
    if (prev.role !== "model" || !prev.parts.some((p) => p.functionCall && p.thoughtSignature === "sig-123")) throw new Error("model turn / thought signature not preserved");
    const result = JSON.parse(fr.functionResponse.response.result);
    return [
      { candidates: [{ content: { role: "model", parts: [{ text: "The engine says " }] } }] },
      { candidates: [{ content: { role: "model", parts: [{ text: `$${result.answer_latex}$.` }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 300, candidatesTokenCount: 40 }, modelVersion: "gemini-mock-001" },
    ];
  }
  const text = last.parts.map((p) => p.text || "").join(" ");
  if (text.includes("blocked")) return [{ candidates: [{ finishReason: "SAFETY" }], usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 0 } }];
  return [
    { candidates: [{ content: { role: "model", parts: [{ text: "Let me check with the engine. ", thought: false }] } }] },
    { candidates: [{ content: { role: "model", parts: [{ text: "internal reasoning", thought: true }, { functionCall: { name: "solve_math", args: { problem: "2x+5=17" } }, thoughtSignature: "sig-123" }] }, finishReason: "STOP" }], usageMetadata: { promptTokenCount: 200, candidatesTokenCount: 30 }, modelVersion: "gemini-mock-001" },
  ];
}

http
  .createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        if (req.headers["x-goog-api-key"] !== "test-gemini-key") {
          res.writeHead(403, { "content-type": "application/json" });
          return res.end(JSON.stringify({ error: { code: 403, message: "API key not valid" } }));
        }
        const body = JSON.parse(raw);
        fs.appendFileSync(LOG, JSON.stringify({ url: req.url, body }) + "\n");
        if (process.env.MOCK_OVERLOADED) {
          res.writeHead(503, { "content-type": "application/json" });
          return res.end(JSON.stringify({ error: { code: 503, message: "The model is overloaded." } }));
        }
        if (req.url.includes(":streamGenerateContent")) {
          res.writeHead(200, { "content-type": "text/event-stream" });
          for (const c of streamChunks(body)) res.write(`data: ${JSON.stringify(c)}\r\n\r\n`);
          return res.end();
        }
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(structured(body)));
      } catch (e) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: { code: 400, message: String(e.message) } }));
      }
    });
  })
  .listen(PORT, "127.0.0.1", () => console.log(`mock gemini on ${PORT}`));
