// Minimal mock of POST /v1/messages (JSON + SSE streaming) for integration testing.
import http from "node:http";
import fs from "node:fs";
const LOG = new URL("./requests.jsonl", import.meta.url).pathname;
fs.writeFileSync(LOG, "");
let mode = process.env.MOCK_MODE ?? "ok"; // ok | error | refusal

const usage = { input_tokens: 120, output_tokens: 80 };
const msg = (content, stop_reason = "end_turn") => ({ id: "msg_mock", type: "message", role: "assistant", model: "claude-opus-5-5", content, stop_reason, stop_sequence: null, stop_details: null, usage });

function structured(body) {
  const sys = JSON.stringify(body.system ?? "");
  const user = body.messages[body.messages.length - 1];
  const hasImage = JSON.stringify(user.content).includes('"type":"image"');
  if (hasImage) return { contains_math: true, problems: [{ latex: "2x+5=17", engine_input: "2x + 5 = 17", confidence: 0.93 }], issues: "" };
  if (sys.includes("translate math word problems")) return { solvable: true, engine_input: "2x + 5 = 17", setup: "Let $x$ be the number." };
  const m = /"final_answer": "([^"]*)"/.exec(JSON.stringify(user.content).replace(/\\"/g, '"'));
  return { explanation: "First we **isolate** $x$. Then we divide.\n\n$$x = 6$$", alternative: "Graph both sides.", tips: ["Check by substitution"], common_mistakes: ["Forgetting to divide both sides"], restated_answer: m ? m[1] : "" };
}

function sse(res, message) {
  res.writeHead(200, { "content-type": "text/event-stream" });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify({ type: event, ...data })}\n\n`);
  send("message_start", { message: { ...message, content: [], stop_reason: null, usage: { input_tokens: usage.input_tokens, output_tokens: 1 } } });
  message.content.forEach((block, index) => {
    if (block.type === "text") {
      send("content_block_start", { index, content_block: { type: "text", text: "" } });
      for (const chunk of block.text.match(/.{1,12}/gs)) send("content_block_delta", { index, delta: { type: "text_delta", text: chunk } });
    } else {
      send("content_block_start", { index, content_block: { ...block, input: {} } });
      send("content_block_delta", { index, delta: { type: "input_json_delta", partial_json: JSON.stringify(block.input) } });
    }
    send("content_block_stop", { index });
  });
  send("message_delta", { delta: { stop_reason: message.stop_reason, stop_sequence: null }, usage: { output_tokens: usage.output_tokens } });
  send("message_stop", {});
  res.end();
}

http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = JSON.parse(raw || "{}");
    fs.appendFileSync(LOG, JSON.stringify({ url: req.url, headers: { beta: req.headers["anthropic-beta"], key: req.headers["x-api-key"] }, body: { ...body, messages: body.messages?.length } }) + "\n");
    if (req.url.startsWith("/__mode/")) { mode = req.url.split("/")[2]; res.end("ok"); return; }
    if (mode === "error") { res.writeHead(529, { "content-type": "application/json" }); res.end(JSON.stringify({ type: "error", error: { type: "overloaded_error", message: "Overloaded" } })); return; }
    if (mode === "refusal") {
      const m = { ...msg([], "refusal"), stop_details: { type: "refusal", category: "cyber", explanation: "x" } };
      if (body.stream) return sse(res, m);
      res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(m)); return;
    }
    if (body.stream) {
      const hasToolResult = JSON.stringify(body.messages).includes("tool_result");
      const m = hasToolResult
        ? msg([{ type: "text", text: "The engine confirms $x = 6$. Substituting: $2(6)+5 = 17$ ✓" }])
        : msg([{ type: "text", text: "Let me verify that with the engine. " }, { type: "tool_use", id: "toolu_1", name: "solve_math", input: { problem: "2x+5=17" } }], "tool_use");
      return sse(res, m);
    }
    const out = msg([{ type: "text", text: JSON.stringify(structured(body)) }]);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(out));
  });
}).listen(Number(process.env.MOCK_PORT ?? 4010), () => console.log("mock on 4010"));
