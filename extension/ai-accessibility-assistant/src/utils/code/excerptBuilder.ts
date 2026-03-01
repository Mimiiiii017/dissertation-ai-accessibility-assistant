// excerptBuilder.ts — extracts the relevant code lines to send to the model
// Extracts a focused, accessibility-relevant excerpt from the active document
// so only the most relevant lines are sent to the model (keeps analysis fast).
// Used by: commands/analyzeFile.ts

import * as vscode from "vscode";
import { RAG_CONFIG } from "../rag/rag";

// Extract only accessibility-relevant code to send to the model (keeps it fast and focused)
export function buildRelevantExcerpt(doc: vscode.TextDocument, keywords: string[]): string {
  const maxChars = RAG_CONFIG.maxExcerptChars;
  const contextLines = RAG_CONFIG.contextLinesAround;
  const lines = doc.getText().split(/\r?\n/);
  const chosen = new Set<number>();

  // Find lines with accessibility-related keywords and include surrounding context
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].toLowerCase();
    if (keywords.some((k) => l.includes(k.toLowerCase()))) {
      // Include the match plus configurable context lines on each side
      for (let j = Math.max(0, i - contextLines); j <= Math.min(lines.length - 1, i + contextLines); j++) {
        chosen.add(j);
      }
    }
  }

  // If no accessibility-related code found, just send the first chunk
  if (chosen.size === 0) {
    return `// Excerpt (fallback)\n${doc.getText().slice(0, maxChars)}`;
  }

  const indices = Array.from(chosen).sort((a, b) => a - b);

  let out = `// Excerpt (selected lines). Total lines: ${lines.length}\n`;
  for (const idx of indices) {
    out += `${idx + 1}: ${lines[idx]}\n`;
    if (out.length >= maxChars) {
      break;
    }
  }
  return out.slice(0, maxChars);
}
