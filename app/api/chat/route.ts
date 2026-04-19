export const runtime = "nodejs";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const { messages, model } = (await req.json()) as {
    model?: string;
    messages: ChatMessage[];
  };

  const ollamaRes = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: model ?? "llama3",
      messages,
      stream: true,
    }),
  });

  if (!ollamaRes.ok || !ollamaRes.body) {
    const text = await ollamaRes.text().catch(() => "");
    return new Response(text || "Ollama request failed", { status: 500 });
  }

  // Ollama streams NDJSON; we pass it through as text.
  return new Response(ollamaRes.body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}