// ollama.ts — sends prompts to the Ollama server and streams the response back
// All communication with Ollama.
// Both cloud models (kimi-k2.5 + qwen3.5:397b) use think mode with identical
// cloud-safe options: num_predict=32000, temperature=0.6, top_p=0.95
// Exposes:
//   FIXED_MODEL      — primary model (kimi-k2.5:cloud — high recall)
//   SECONDARY_MODEL  — secondary model (qwen3.5:397b-cloud — precision)
//   ollamaListModels — fetches available model names (/api/tags)
//   ollamaWarmup     — pre-loads a model to reduce first-analysis latency
//   ollamaGenerateStream — streams the chat response chunk-by-chunk (/api/chat)
// Used by: commands/analysePanel.ts, commands/tlxPanel.ts, commands/selectModelPanel.ts

type OllamaTagsResponse = { models: { name: string }[] };

// Ollama can respond in different formats depending on the endpoint
type OllamaGenerateResponse = { 
  response?: string;
  message?: { content?: string };
  error?: string;
  done?: boolean;
};

// Cloud-safe model options (only these three fields are accepted by the cloud gateway;
// sending num_ctx / top_k / repeat_penalty etc. causes HTTP 500).
// Both models use think (CoT) mode — recommended settings from Moonshot AI / Alibaba docs.
type CloudOptions = { num_predict: number; temperature: number; top_p: number };

export const FIXED_MODEL = "kimi-k2.5:cloud";      // Stage 1 — high recall
export const SECONDARY_MODEL = "qwen3.5:397b-cloud"; // Stage 2 — precision

// kimi-k2.5 think mode: Moonshot AI recommended temperature=0.6 for CoT reasoning
const KIMI_OPTIONS: CloudOptions    = { num_predict: 32000, temperature: 0.6, top_p: 0.95 };
// qwen3.5:397b think mode: Alibaba recommended temperature=0.6 for CoT reasoning  
const QWEN_OPTIONS: CloudOptions    = { num_predict: 32000, temperature: 0.6, top_p: 0.95 };
const DEFAULT_OPTIONS: CloudOptions = { num_predict: 32000, temperature: 0.6, top_p: 0.95 };

function getModelOptions(model: string): CloudOptions {
  const m = model.toLowerCase();
  if (m.includes('kimi')) return KIMI_OPTIONS;
  if (m.includes('qwen')) return QWEN_OPTIONS;
  return DEFAULT_OPTIONS;
}

// ─── Dead-code tombstone — intentionally removed ──────────────────────────
// ANALYSIS_PRESETS, AnalysisPresetId, DEFAULT_ANALYSIS_PRESET, ANALYSIS_OPTIONS,
// resolveAnalysisPreset, getAnalysisPresetSummaries, isAnalysisPresetId
// These were removed when the extension switched to the fixed kimi+qwen dual-model
// pipeline. There is no user-facing model/preset selection dropdown.





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

  // Derive cloud-safe options from the model name (kimi vs qwen).
  const modelOptions = getModelOptions(model);

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
