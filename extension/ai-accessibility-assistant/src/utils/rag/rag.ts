// rag.ts — fetches WCAG knowledge chunks from the knowledge base using a search query
// Handles communication with the RAG (Retrieval-Augmented Generation) service.
// Exposes:
//   RAG_CONFIG  — tuneable settings (topK, cache TTL, excerpt size)
//   ragRetrieve — POST /retrieve to fetch relevant WCAG knowledge chunks
//   formatRagContext — formats chunks into the context block injected into the prompt
// Used by: commands/analyzeFile.ts, utils/excerptBuilder.ts

type RagChunk = { id: string; source: string; text: string };
type RagRetrieveResponse = { chunks: RagChunk[] };

// RAG and code extraction configuration - Centralized settings for testing/tuning
export const RAG_CONFIG = {
  topK: 10,                    // Number of knowledge base chunks to retrieve (top-10 most relevant)
  maxExcerptChars: 20000,      // Max characters to extract from code
  cacheTimeMs: 60000,         // Cache RAG results for 60 seconds
};

// Cache RAG results to avoid redundant API calls within the same session
export const ragCache = new Map<string, { at: number; context: string }>();

// Get relevant context from the RAG knowledge base
export async function ragRetrieve(
  endpoint: string,
  query: string,
  topK: number,
  kbType: "accessibility" | "tlx" = "accessibility"
): Promise<RagRetrieveResponse> {
  const url = `${endpoint.replace(/\/$/, "")}/retrieve`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, top_k: topK, kb_type: kbType }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`RAG retrieve failed (HTTP ${res.status}): ${body || res.statusText}`);
  }

  return (await res.json()) as RagRetrieveResponse;
}

// Format RAG chunks into a readable context block for the AI prompt
export function formatRagContext(chunks: RagChunk[]): string {
  if (!chunks.length) {
    return "(no context)";
  }
  // Truncate each chunk to 2000 chars for richer context
  return chunks.map((c, i) =>
    `[#${i + 1}] ${c.id}\n${c.text.slice(0, 2000)}${c.text.length > 2000 ? "…" : ""}`
  ).join("\n\n");
}
