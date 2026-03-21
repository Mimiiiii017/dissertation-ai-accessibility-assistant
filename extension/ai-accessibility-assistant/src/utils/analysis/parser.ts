// parser.ts — turns the model's plain-text response into structured AiIssue objects
// Parses the plain-text response streamed back by the Ollama model into
// structured AiIssue objects. Handles "Final Answer:" deduplication and
// de-duplicates repeated issues.
// Used by: commands/analyzeFile.ts

import { type AiIssue } from "../types";

// Parse plain-text "Issue N: ..." blocks returned by the model (returns RAW issues without deduplication)
export function parseTextResponse(text: string): AiIssue[] {
  const issues: AiIssue[] = [];

  // Strip chain-of-thought thinking blocks emitted by reasoning models (Qwen3, kimi, DeepSeek etc.)
  // These appear as <think>...</think> before the actual output and must not be parsed as issues.
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

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
    const lineMatch = block.match(/Line\s*:\s*(\d+(?:\s*,\s*\d+)*)/i);
    if (lineMatch) {
      const lineStr = lineMatch[1];
      const lines = lineStr.split(',').map(l => parseInt(l.trim(), 10)).filter(l => !isNaN(l));
      if (lines.length > 0) {
        issue.lineHints = lines.length > 1 ? lines : undefined;
        issue.lineHint = lines[0];
      }
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

  return issues;
}

// Deduplicate and combine issues with the same problem across multiple lines
export function deduplicateIssues(issues: AiIssue[]): AiIssue[] {
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

  // 2. Group issues by normalised title (same problem = combine across multiple lines)
  const grouped = new Map<string, AiIssue[]>();
  for (const issue of filtered) {
    // Normalise: lowercase, strip location qualifiers and common prefixes, collapse whitespace
    const norm = (issue.title || '')
      .toLowerCase()
      .replace(/missing\s+aria\s+attributes?\s+on\s+/g, '')
      .replace(/\s+in\s+(the\s+)?(footer|header|sidebar|topbar|menu|body|page)/g, '')  // Remove location qualifiers
      .replace(/\s+/g, ' ')
      .trim();
    if (!grouped.has(norm)) {
      grouped.set(norm, []);
    }
    grouped.get(norm)!.push(issue);
  }

  // 3. Combine issues with same problem into single blocks with multiple line numbers
  const combined: AiIssue[] = [];
  for (const issueGroup of grouped.values()) {
    if (issueGroup.length === 1) {
      // Single instance → keep as-is
      combined.push(issueGroup[0]);
    } else {
      // Multiple instances of same problem → combine into one block with all lines
      const first = issueGroup[0];
      
      // Collect all unique line numbers
      const allLines = issueGroup
        .map(i => i.lineHint)
        .filter((line): line is number => line !== undefined)
        .filter((line, idx, arr) => arr.indexOf(line) === idx) // deduplicate
        .sort((a, b) => a - b);

      combined.push({
        title: first.title,
        severity: first.severity,
        explanation: first.explanation,
        fix: first.fix,
        lineHints: allLines.length > 0 ? allLines : undefined,
        evidence: first.evidence,
      });
    }
  }

  return combined;
}
