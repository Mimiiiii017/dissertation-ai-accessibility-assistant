type RagChunk = { id: string; source: string; text: string };
type RagRetrieveResponse = { chunks: RagChunk[] };

// Get relevant context from the RAG knowledge base
export async function ragRetrieve(endpoint: string, query: string, topK: number): Promise<RagRetrieveResponse> {
  const url = `${endpoint.replace(/\/$/, "")}/retrieve`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, top_k: topK }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`RAG retrieve failed (HTTP ${res.status}): ${body || res.statusText}`);
  }

  return (await res.json()) as RagRetrieveResponse;
}

// Build a smart query based on what's in the code (helps RAG find relevant docs)
export function buildRagQuery(languageId: string, code: string): string {
  const lower = code.toLowerCase();
  const hints: string[] = [];

  // Build context-aware hints based on what HTML elements are present
  if (languageId === "html") {
    hints.push("HTML accessibility WCAG guidelines");
    if (lower.includes("<img")) {
      hints.push("images alt text non-text content WCAG 1.1.1 SVG");
    }
    if (lower.includes("<form") || lower.includes("<input") || lower.includes("<label")) {
      hints.push("forms labels accessible names input purpose autocomplete error messages validation required fields redundant entry accessible authentication");
    }
    if (lower.includes("aria-")) {
      hints.push("ARIA best practices five rules widget patterns live regions status messages");
    }
    if (lower.includes("button") || lower.includes("onclick") || lower.includes("tabindex")) {
      hints.push("keyboard navigation focus tab order focus indicators links versus buttons character key shortcuts");
    }
    if (lower.includes("<nav") || lower.includes("menu") || lower.includes("<header") || lower.includes("<main")) {
      hints.push("navigation landmarks consistent navigation skip links breadcrumbs multiple ways page titles link purpose consistent identification");
    }
    if (lower.includes("<h1") || lower.includes("<h2") || lower.includes("heading")) {
      hints.push("headings logical hierarchy structure");
    }
    if (lower.includes("<table")) {
      hints.push("tables headers scope caption accessibility");
    }
    if (lower.includes("color") || lower.includes("style") || lower.includes("css")) {
      hints.push("visual color contrast text spacing resize reflow dark mode high contrast non-text contrast images of text");
    }
    if (lower.includes("video") || lower.includes("audio")) {
      hints.push("media captions audio descriptions transcripts sign language audio control");
    }
    if (lower.includes("dialog") || lower.includes("modal") || lower.includes("popup")) {
      hints.push("dialogs modal focus management focus trapping escape key dismissible");
    }
    if (lower.includes("drag") || lower.includes("swipe") || lower.includes("gesture")) {
      hints.push("controls pointer gestures dragging movements motion actuation single-pointer alternatives");
    }
    if (lower.includes("touch") || lower.includes("mobile") || lower.includes("viewport")) {
      hints.push("input-modalities touch mobile accessibility target size orientation viewport pointer cancellation");
    }
    if (lower.includes("timer") || lower.includes("timeout") || lower.includes("setinterval") || lower.includes("settimeout")) {
      hints.push("timing adjustable time limits auto-updating content pause stop hide");
    }
    if (lower.includes("animate") || lower.includes("transition") || lower.includes("@keyframes") || lower.includes("flash")) {
      hints.push("visual animation motion seizure prevention reduced motion parallax prefers-reduced-motion");
    }
    if (lower.includes("lang=") || lower.includes("dir=") || lower.includes("rtl") || lower.includes("ltr")) {
      hints.push("structure language of page RTL bidirectional text internationalisation");
    }
    if (lower.includes("display:none") || lower.includes("visibility:hidden") || lower.includes("aria-hidden")) {
      hints.push("visual CSS visibility accessible hiding screen reader only content off-screen techniques");
    }
    if (lower.includes("role=") || lower.includes("region") || lower.includes("landmark")) {
      hints.push("structure landmarks page regions meaningful sequence reading order sensory characteristics");
    }
    if (lower.includes("hover") || lower.includes(":hover") || lower.includes(":focus")) {
      hints.push("visual content on hover or focus dismissible hoverable persistent pointer focus");
    }
    if (lower.includes("pdf") || lower.includes("document")) {
      hints.push("standards accessible documents PDFs tagged PDF document structure");
    }
    if (lower.includes("test") || lower.includes("axe") || lower.includes("validator")) {
      hints.push("testing automated testing manual testing accessibility evaluation tools");
    }
    // Always include general cognitive/screen reader/assistive tech considerations
    hints.push("cognitive load readability predictable behavior assistive technology screen readers braille displays screen magnification voice control switch access");
  } else {
    hints.push(`${languageId} accessibility best practices WCAG keyboard navigation ARIA`);
  }

  return hints.join(", ");
}

// Format RAG chunks into a readable context block for the AI prompt
export function formatRagContext(chunks: RagChunk[]): string {
  if (!chunks.length) {
    return "(no context)";
  }
  // Truncate each chunk to 800 chars to keep prompt manageable
  return chunks.map((c, i) =>
    `[#${i + 1}] ${c.id}\n${c.text.slice(0, 800)}${c.text.length > 800 ? "…" : ""}`
  ).join("\n\n");
}
