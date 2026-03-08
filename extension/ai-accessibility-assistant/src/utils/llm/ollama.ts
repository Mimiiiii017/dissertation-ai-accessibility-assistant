// ollama.ts — sends prompts to the local Ollama server and streams the response back
// All communication with the local Ollama server.
// Exposes:
//   ollamaListModels     — fetches available model names (/api/tags)
//   ollamaWarmup         — pre-loads a model to reduce first-analysis latency
//   ollamaGenerateStream — streams the chat response chunk-by-chunk (/api/chat)
//   ANALYSIS_OPTIONS     — tuneable generation parameters (temperature, tokens, etc.)
// Used by: commands/analyzeFile.ts, commands/selectModel.ts

type OllamaTagsResponse = { models: { name: string }[] };

// Ollama can respond in different formats depending on the endpoint
type OllamaGenerateResponse = { 
  response?: string;
  message?: { content?: string };
  error?: string;
  done?: boolean;
};

// Ollama model parameters for fine-tuning generation behavior
export interface OllamaOptions {
  num_predict?: number; // Max tokens to generate (higher = more complete but slower). Range: 100-50000
  num_ctx?: number; // Context window size (higher = better memory but more RAM). Range: 512-32768
  temperature?: number; // Randomness (0.0=deterministic, 2.0=creative). Lower for consistency. Range: 0.0-2.0
  top_p?: number; // Nucleus sampling (considers top% probability). Range: 0.0-1.0
  top_k?: number; // Sample from top K tokens. Range: 1-100
  repeat_penalty?: number; // Penalize repeated tokens (higher = less repetition). Range: 0.0-2.0
  repeat_last_n?: number; // How far back to check for repetition. Range: 0-2048
  frequency_penalty?: number; // Penalize based on token frequency. Range: 0.0-2.0
  presence_penalty?: number; // Penalize if token appeared before. Range: 0.0-2.0
  seed?: number; // Random seed for reproducible results (useful for testing)
  mirostat?: number; // 0=disabled, 1=Mirostat v1, 2=Mirostat v2 (alternative sampling, usually leave at 0)
}

// Strip trailing slashes so URL construction never produces double-slashes
function normalizeHost(host: string): string {
  return host.replace(/\/$/, "");
}

// Read the response body and throw a descriptive error if the request failed
async function throwIfNotOk(res: Response, context: string): Promise<void> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${context} (HTTP ${res.status}): ${body || res.statusText}`);
  }
}

// Fetch list of available models from Ollama server
export async function ollamaListModels(host: string): Promise<string[]> {
  const url = `${normalizeHost(host)}/api/tags`;

  const res = await fetch(url, { method: "GET" });
  await throwIfNotOk(res, "Ollama tags failed");

  const data = (await res.json()) as OllamaTagsResponse;
  return (data.models ?? []).map((m) => m.name).filter(Boolean).sort();
}

// Send a dummy request to load the model into memory (makes first real analysis faster)
export async function ollamaWarmup(host: string, model: string): Promise<void> {
  const url = `${normalizeHost(host)}/api/generate`;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: "warm up",
        stream: false,
        options: { num_predict: 10 }, //Warmup doesn't need a long response, just enough to load the model into memory
      }),
    });
  } catch {
    // Don't fail if warmup doesn't work, it's just an optimization
  }
}

// Analysis options - Changing these parameters will tune model behavior
export const ANALYSIS_OPTIONS: OllamaOptions = {
  num_predict: 20000,          // Max response length (includes /think tokens — leave headroom)
  num_ctx: 32768,              // Must be large enough for RAG context + full file + instructions (~56k tokens total)
  temperature: 0.15,           // Lower = more deterministic/consistent
  top_p: 0.85,                 // Tighter nucleus sampling
  top_k: 30,                   // Narrower token candidate pool
  repeat_penalty: 1.1,         // Slightly lower — avoids penalising the repeated Issue block format
  repeat_last_n: 128,          // Repetition lookback window
  frequency_penalty: 0.0,     // Penalize frequent tokens (0 = disabled)
  presence_penalty: 0.0,      // Penalize any repeated tokens (0 = disabled)
  seed: 42,                    // Set a number for reproducible results
  mirostat: 0,                // 0 = disabled (use temperature/top_p)
};

/** How long to wait for the full generation before giving up (ms). */
const GENERATE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// Unwrap the cause chain from a fetch network error into a readable string
function describeFetchError(e: any): string {
  const cause = e?.cause;
  if (!cause) { return String(e?.message ?? e); }
  // cause may itself be a chain (e.g. AggregateError wrapping ECONNREFUSED)
  const causeMsg = cause?.code
    ? `${cause.code}: ${cause.message ?? cause}`
    : String(cause?.message ?? cause);
  return `${e.message} — ${causeMsg}`;
}

// Stream response from Ollama using the chat API with system + user messages
export async function ollamaGenerateStream(
  host: string,
  model: string,
  prompt: string,
  onChunk: (text: string) => void,
  systemPrompt?: string
): Promise<void> {
  const url = `${normalizeHost(host)}/api/chat`;
  
  // Use the parameters defined at the top of this file
  const modelOptions = ANALYSIS_OPTIONS;

  const messages: { role: string; content: string }[] = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: prompt });

  // Abort the request if Ollama takes longer than GENERATE_TIMEOUT_MS
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        options: modelOptions,
      }),
      signal: controller.signal,
    });
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e?.name === "AbortError") {
      throw new Error(`Ollama request timed out after ${GENERATE_TIMEOUT_MS / 1000}s. The model may be too slow or out of memory.`);
    }
    throw new Error(`Ollama connection failed — ${describeFetchError(e)}`);
  }

  clearTimeout(timeoutId);
  await throwIfNotOk(res, "Ollama generate failed");

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
