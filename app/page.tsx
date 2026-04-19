"use client";
import { useMemo, useState } from "react";
type Msg = { role: "user" | "assistant"; content: string };
export default function Page() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const canSend = useMemo(() => input.trim().length > 0 && !busy, [input, busy]);
  async function send() {
    if (!canSend) return;
    const nextMessages: Msg[] = [...messages, { role: "user", content: input.trim() }];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);
    // add placeholder assistant message we’ll stream into
    setMessages((m) => [...m, { role: "assistant", content: "" }]);
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "llama3", messages: nextMessages }),
    });
    if (!res.ok || !res.body) {
      setBusy(false);
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: "Error calling model." };
        return copy;
      });
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // NDJSON parsing (one JSON object per line)
      let idx;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line) continue;
        try {
          const evt = JSON.parse(line) as any;
          const token: string | undefined = evt?.message?.content;
          if (token) {
            setMessages((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              copy[copy.length - 1] = { ...last, content: last.content + token };
              return copy;
            });
          }
        } catch {
          // ignore malformed partial lines
        }
      }
    }
    setBusy(false);
  }
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
      <h2 style={{ marginBottom: 16 }}>Local Llama Chat</h2>
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 16,
          height: "65vh",
          overflow: "auto",
          background: "#fff",
        }}
      >
        {messages.length === 0 ? (
          <div style={{ color: "#666" }}>Say hi to your local model.</div>
        ) : (
          messages.map((m, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                {m.role === "user" ? "You" : "Assistant"}
              </div>
              <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
            </div>
          ))
        )}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Type a message…"
          style={{
            flex: 1,
            border: "1px solid #ddd",
            borderRadius: 10,
            padding: "10px 12px",
          }}
          disabled={busy}
        />
        <button
          onClick={send}
          disabled={!canSend}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ddd",
            background: canSend ? "#111" : "#999",
            color: "white",
            cursor: canSend ? "pointer" : "not-allowed",
          }}
        >
          Send
        </button>
      </div>
    </main>
  );
}