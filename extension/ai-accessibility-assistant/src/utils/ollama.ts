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
        options: { num_predict: 10 }, //Warmup doesn't need a long response, just enough to load the model into memory
      }),
    });
  } catch {
    // Don't fail if warmup doesn't work, it's just an optimization
  }
}

// Analysis options - Changing these parameters will tune model behavior
export const ANALYSIS_OPTIONS: OllamaOptions = {
  num_predict: 10000,         // Max response length
  num_ctx: 8192,              // Context window
  temperature: 0.1,           // Low = focused/consistent
  top_p: 0.9,                 // Nucleus sampling
  top_k: 40,                  // Top-k sampling
  repeat_penalty: 1.1,        // Discourage repetition
  repeat_last_n: 64,          // Repetition lookback window
  frequency_penalty: 0.0,     // Penalize frequent tokens (0 = disabled)
  presence_penalty: 0.0,      // Penalize any repeated tokens (0 = disabled)
  seed: undefined,            // Set a number for reproducible results
  mirostat: 0,                // 0 = disabled (use temperature/top_p)
};

// RAG and code extraction configuration - Centralized settings for testing/tuning
export const RAG_CONFIG = {
  topK: 5,                    // Number of knowledge base chunks to retrieve
  maxExcerptChars: 6000,      // Max characters to extract from code
  cacheTimeMs: 60000,         // Cache RAG results for 60 seconds
  contextLinesAround: 2,      // Lines of context around keyword matches
};

// Stream response from Ollama
export async function ollamaGenerateStream(
  host: string,
  model: string,
  prompt: string,
  onChunk: (text: string) => void
): Promise<void> {
  const url = `${host.replace(/\/$/, "")}/api/generate`;
  
  // Use the parameters defined at the top of this file
  const modelOptions = ANALYSIS_OPTIONS;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      prompt,
      stream: true,
      format: "json", // Request JSON but not all models respect this
      options: modelOptions,
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
