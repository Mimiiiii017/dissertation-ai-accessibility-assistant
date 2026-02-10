type OllamaTagsResponse = { models: { name: string }[] };

// Ollama can respond in different formats depending on the endpoint
type OllamaGenerateResponse = { 
  response?: string;
  message?: { content?: string };
  error?: string;
  done?: boolean;
};

// Fetch list of available models from Ollama server
export async function ollamaListModels(host: string): Promise<string[]> {
  const base = host.replace(/\/$/, "");
  const url = `${base}/api/tags`;

  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ollama tags failed (HTTP ${res.status}): ${body || res.statusText}`);
  }

  const data = (await res.json()) as OllamaTagsResponse;
  return (data.models ?? []).map((m) => m.name).filter(Boolean).sort();
}

// Send a dummy request to load the model into memory (makes first real analysis faster)
export async function ollamaWarmup(host: string, model: string): Promise<void> {
  const url = `${host.replace(/\/$/, "")}/api/generate`;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: "warm up",
        stream: false,
        options: { num_predict: 1 },
      }),
    });
  } catch {
    // Don't fail if warmup doesn't work, it's just an optimization
  }
}

// Stream response from Ollama and call onChunk for each piece of text
export async function ollamaGenerateStream(
  host: string,
  model: string,
  prompt: string,
  onChunk: (text: string) => void
): Promise<void> {
  const url = `${host.replace(/\/$/, "")}/api/generate`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: true,
      format: "json", // Request JSON but not all models respect this
      options: {
        temperature: 0.1,
        top_p: 0.9,
        num_predict: 1000,
        num_ctx: 4096,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ollama generate failed (HTTP ${res.status}): ${body || res.statusText}`);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("No response body reader available");
  }

  const decoder = new TextDecoder();
  let buffer = ""; // Accumulates partial lines between reads

  // Read the stream line by line and parse each JSON object
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    // Add new data to buffer and split into lines
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    // Keep the last (incomplete) line in the buffer for next iteration
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }
      try {
        const data = JSON.parse(line) as OllamaGenerateResponse;
        
        // Ollama streams errors in-band, check for them
        if (data.error) {
          throw new Error(`Ollama error: ${data.error}`);
        }
        
        // Handle both /api/generate (response) and /api/chat (message.content) formats
        const content = data.response || data.message?.content;
        if (content) {
          onChunk(content);
        }
      } catch (parseError: any) {
        // If it's our thrown error, re-throw it
        if (parseError.message?.startsWith('Ollama error:')) {
          throw parseError;
        }
        // Otherwise skip invalid JSON lines
      }
    }
  }
}
