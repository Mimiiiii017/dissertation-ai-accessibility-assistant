// parser.ts — turns the model's plain-text response into structured AiIssue objects
// Parses the plain-text response streamed back by the Ollama model into
// structured AiIssue objects. Handles "Final Answer:" deduplication and
// de-duplicates repeated issues.
// Used by: commands/analyzeFile.ts

import { type AiIssue } from "./types";

// Parse plain-text "Issue N: ..." blocks returned by the model
export function parseTextResponse(text: string): AiIssue[] {
  const issues: AiIssue[] = [];

  // Strip duplicate "Final Answer:" sections that some models append
  const finalAnswerIdx = text.search(/\bFinal\s+Answer\s*:/i);
  if (finalAnswerIdx >= 0) {
    text = text.slice(0, finalAnswerIdx);
  }

  // Find every "Issue <number>:" header
  const issuePattern = /Issue\s+\d+\s*:\s*/gi;
  const starts: { matchEnd: number; matchStart: number }[] = [];
  let m: RegExpExecArray | null;

  while ((m = issuePattern.exec(text)) !== null) {
    starts.push({ matchStart: m.index, matchEnd: m.index + m[0].length });
  }

  for (let i = 0; i < starts.length; i++) {
    const blockStart = starts[i].matchStart;
    const blockEnd = i + 1 < starts.length ? starts[i + 1].matchStart : text.length;
    const block = text.slice(blockStart, blockEnd);

    // Title is the remainder of the "Issue N:" line
    const afterColon = text.slice(starts[i].matchEnd, blockEnd);
    const nlPos = afterColon.indexOf('\n');
    const title = (nlPos >= 0 ? afterColon.slice(0, nlPos) : afterColon).trim();

    const issue: AiIssue = {
      title: title || "Accessibility issue",
      severity: "med",
    };

    // Severity
    const sevMatch = block.match(/Severity\s*:\s*(HIGH|MEDIUM|LOW)/i);
    if (sevMatch) {
      const s = sevMatch[1].toUpperCase();
      issue.severity = s === "HIGH" ? "high" : s === "LOW" ? "low" : "med";
    }

    // Line
    const lineMatch = block.match(/Line\s*:\s*(\d+)/i);
    if (lineMatch) {
      issue.lineHint = parseInt(lineMatch[1], 10);
    }

    // Problem → explanation (capture everything until the next labelled field)
    const problemMatch = block.match(/Problem\s*:([\s\S]*?)(?=\n\s*(?:Fix|Solution|WCAG|Severity|Line|Issue)\s*:|$)/i);
    if (problemMatch) {
      issue.explanation = problemMatch[1].trim();
    }

    // Fix (or legacy Solution) → fix (capture everything until next labelled field)
    const fixMatch = block.match(/(?:Fix|Solution)\s*:([\s\S]*?)(?=\n\s*(?:Problem|WCAG|Severity|Line|Issue)\s*:|$)/i);
    if (fixMatch) {
      issue.fix = fixMatch[1].trim();
    }

    issues.push(issue);
  }

  // Post-processing filters

  // 1. Drop issues whose explanation says "not applicable" / "N/A" / speculative / unverifiable
  const NA_PATTERNS = [
    /not\s+applicable/i,
    /\bN\/A\b/,
    /not\s+present\s+in\s+this/i,
    /no\s+.*\s+(?:present|visible|found)/i,
    /if\s+(?:present|any|used|available)/i,
    /cannot\s+(?:verify|confirm|determine)/i,
    /can(?:'t|not)\s+(?:verify|confirm|determine)/i,
    /without\s+seeing/i,
    /(?:exact|actual)\s+.*(?:isn't|is not)\s+specified/i,
    /we\s+cannot\s+verify/i,
    /appears?\s+to\s+be/i,
  ];

  const filtered = issues.filter(issue => {
    const text = `${issue.title || ''} ${issue.explanation || ''}`;
    return !NA_PATTERNS.some(p => p.test(text));
  });

  // 2. Deduplicate by normalised title (ignore line — same problem = same issue)
  const seen = new Set<string>();
  const deduped = filtered.filter(issue => {
    // Normalise: lowercase, strip "missing aria attributes on", collapse whitespace
    const norm = (issue.title || '')
      .toLowerCase()
      .replace(/missing\s+aria\s+attributes?\s+on\s+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (seen.has(norm)) { return false; }
    seen.add(norm);
    return true;
  });

  return deduped;
}
