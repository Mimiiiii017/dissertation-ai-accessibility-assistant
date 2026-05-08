// analysePanel.ts — analysis pipeline for the webview panel
// Orchestrates baseline + RAG + Ollama analysis and streams results
// to the panel via PanelLogger callbacks.
// Used by: webview/AccessibilityPanel.ts

import * as vscode from "vscode";
import {
  FIXED_MODEL,
  SECONDARY_MODEL,
  ollamaGenerateStream,
} from "../utils/llm/ollama";
import { ragRetrieve, formatRagContext, RAG_CONFIG, ragCache } from "../utils/rag/rag";
import { buildRagQuery } from "../utils/rag/ragQueryBuilder";

// Per-sweep targeted queries for HTML — one per sweep group.
// A single generic query cannot simultaneously surface guidance for link names,
// toggle buttons, autocomplete, image alt, and ARIA id references all at once.
// Running five focused queries and deduplicating gives the model relevant, specific
// context for whichever issues are actually present in the developer's file.
const HTML_SWEEP_QUERIES = [
  'link accessible name aria-label non-descriptive text nav landmark multiple label ARIA11',
  'button accessible name aria-expanded toggle disclosure accordion hamburger menu show hide',
  'form input label accessible name autocomplete personal data given-name email tel address SC 1.3.5',
  'image alt attribute missing non-text content table header scope heading level skip hierarchy WCAG 1.1.1 1.3.1',
  'aria-labelledby aria-describedby aria-controls broken reference id does not exist SC 4.1.2',
];
const HTML_RAG_MAX_CHUNKS = 8;
const HTML_RAG_DISTANCE_THRESHOLD = 0.5;

async function retrieveHtmlRag(
  ragEndpoint: string
): Promise<{ id: string; source: string; text: string }[]> {
  const seen = new Set<string>();
  const all: { id: string; source: string; text: string }[] = [];
  for (const q of HTML_SWEEP_QUERIES) {
    if (all.length >= HTML_RAG_MAX_CHUNKS) { break; }
    try {
      const res = await ragRetrieve(ragEndpoint, q, 2, 'accessibility', HTML_RAG_DISTANCE_THRESHOLD);
      for (const chunk of res.chunks) {
        if (all.length >= HTML_RAG_MAX_CHUNKS) { break; }
        if (!seen.has(chunk.id)) { seen.add(chunk.id); all.push(chunk); }
      }
    } catch { /* individual query failed — continue */ }
  }
  return all;
}
import { runBaselineChecks } from "../utils/analysis/baseline";
import { SYSTEM_PROMPT, buildAiPrompt } from "../utils/prompts/prompt";
import { parseTextResponse, deduplicateIssues } from "../utils/analysis/parser";
import { aiIssueToDiagnostic } from "../utils/analysis/diagnostics";
import { buildRelevantExcerpt } from "../utils/code/excerptBuilder";
import { getExtensionConfig } from "../utils/config";
import type { PanelLogger } from "../webview/panelLogger";
import type { AiIssue } from "../utils/types";

// ─── Multi-stage voting helpers ─────────────────────────────────────────────

function normalizeIssueTitle(title: string): Set<string> {
  const stop = new Set(['a','an','the','is','are','was','were','has','have','had','be','been',
    'with','for','on','at','by','from','in','of','to','and','or','not','no','this','that','it','its']);
  return new Set(
    title.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stop.has(w))
  );
}

function issueTitlesMatch(a: AiIssue, b: AiIssue): boolean {
  if (!a.title || !b.title) { return false; }
  const wa = normalizeIssueTitle(a.title);
  const wb = normalizeIssueTitle(b.title);
  if (wa.size === 0 || wb.size === 0) { return false; }
  const overlap = [...wa].filter(w => wb.has(w)).length;
  const union = new Set([...wa, ...wb]).size;
  return (overlap / union) >= 0.3;
}

/**
 * Multi-stage voting merge:
 *   Stage 1 — issues found by BOTH kimi and qwen → "verified" (high confidence)
 *   Stage 2 — issues found by only ONE model      → "review-recommended"
 */
function mergeMultiStageIssues(
  kimiIssues: AiIssue[],
  qwenIssues: AiIssue[],
): { verified: AiIssue[]; reviewRecommended: AiIssue[] } {
  const verified: AiIssue[] = [];
  const reviewRecommended: AiIssue[] = [];
  const usedQwen = new Set<number>();

  for (const ki of kimiIssues) {
    let matched = false;
    for (let qi = 0; qi < qwenIssues.length; qi++) {
      if (usedQwen.has(qi)) { continue; }
      if (issueTitlesMatch(ki, qwenIssues[qi])) {
        verified.push(ki);
        usedQwen.add(qi);
        matched = true;
        break;
      }
    }
    if (!matched) { reviewRecommended.push(ki); }
  }

  // Unmatched qwen issues are also review-recommended
  for (let qi = 0; qi < qwenIssues.length; qi++) {
    if (!usedQwen.has(qi)) { reviewRecommended.push(qwenIssues[qi]); }
  }

  return { verified, reviewRecommended };
}

export async function analyseFileForPanel(
  logger: PanelLogger,
  diagnostics: vscode.DiagnosticCollection
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("Open a file first, then run Analyse.");
    return;
  }

  const doc = editor.document;
  const text = doc.getText();
  const { ollamaHost, ragEndpoint } = getExtensionConfig();
  const model = FIXED_MODEL;
  const qwenModel = SECONDARY_MODEL;

  logger.log("═══ Accessibility Analysis ═══");
  logger.log(`File: ${doc.fileName}`);
  logger.log(`Language: ${doc.languageId}  |  Lines: ${doc.lineCount}  |  Chars: ${text.length}`);
  logger.log(`Models: ${model} + ${qwenModel}  |  RAG: ${ragEndpoint}`);
  logger.log("");

  diagnostics.delete(doc.uri);
  const issues: vscode.Diagnostic[] = [];

  // Baseline checks
  const baselineIssues = runBaselineChecks(doc);
  if (baselineIssues.length > 0) {
    logger.log(`Baseline: ${baselineIssues.length} issue(s) found`);
    issues.push(...baselineIssues);
  }

  // AI analysis — multi-stage voting: kimi (recall) + qwen (precision)
  let kimiResponse = "";
  let qwenResponse = "";
  try {
      const excerpt = buildRelevantExcerpt(doc);
      const ragQuery = buildRagQuery(doc.languageId, excerpt);
      const cacheKey = `${doc.languageId}::${ragQuery}::${excerpt.length}`;

      const cached = ragCache.get(cacheKey);
      let contextBlock: string;

      if (cached && Date.now() - cached.at < RAG_CONFIG.cacheTimeMs) {
        contextBlock = cached.context;
        logger.log("RAG: cache hit");
      } else {
        const t0 = Date.now();
        let chunks: { id: string; source: string; text: string }[];
        if (doc.languageId === 'html') {
          // HTML: five sweep-targeted queries, deduped, stricter threshold.
          // Gives the model specific guidance per category rather than generic WCAG chunks.
          chunks = await retrieveHtmlRag(ragEndpoint);
        } else {
          const rag = await ragRetrieve(ragEndpoint, ragQuery, 3, "accessibility");
          chunks = rag.chunks;
        }
        contextBlock = formatRagContext(chunks);
        ragCache.set(cacheKey, { at: Date.now(), context: contextBlock });
        logger.log(`RAG: ${chunks.length} chunk(s) in ${Date.now() - t0} ms`);
      }

      if (!contextBlock || contextBlock === "(no context)") {
        logger.log("⚠ No knowledge-base chunks retrieved.");
      }

      const prompt = buildAiPrompt(doc.languageId, excerpt, contextBlock);
      const t0 = Date.now();
      let firstTokenMs: number | null = null;
      let issueStreamStarted = false;
      let preIssueBuffer = "";
      let stopStreaming = false;
      let streamedText = "";

      logger.postMessage({ type: "streamStart" });
      logger.log(`Stage 1: ${model} (recall) + ${qwenModel} (precision) running in parallel…`);

      // Run qwen silently in the background while kimi streams to the panel
      const qwenPromise = ollamaGenerateStream(
        ollamaHost,
        qwenModel,
        prompt,
        (chunk) => { qwenResponse += chunk; },
        SYSTEM_PROMPT
      ).catch((err: Error) => {
        logger.log(`  ⚠ ${qwenModel} error: ${err?.message ?? err}`);
      });

      await ollamaGenerateStream(
        ollamaHost,
        model,
        prompt,
        (chunk) => {
          kimiResponse += chunk;
          if (firstTokenMs === null) {
            firstTokenMs = Date.now() - t0;
          }

          if (issueStreamStarted) {
            if (stopStreaming) { return; }
            streamedText += chunk;
            if (streamedText.match(/\bFinal\s+Answer\s*:/i)) {
              stopStreaming = true;
              return;
            }
            logger.streamChunk(chunk);
            return;
          }

          preIssueBuffer += chunk;
          const issueIdx = preIssueBuffer.search(/Issue\s+\d+\s*:/i);
          if (issueIdx >= 0) {
            issueStreamStarted = true;
            const issueText = preIssueBuffer.slice(issueIdx);
            streamedText = issueText;
            logger.streamChunk(issueText);
          }
        },
        SYSTEM_PROMPT
      );

      // Wait for qwen to finish (may still be running after kimi)
      await qwenPromise;

      logger.postMessage({ type: "streamEnd" });
      logger.log(`\nCompleted in ${Date.now() - t0} ms (first token: ${firstTokenMs} ms)`);

      // Parse both model responses
      const kimiIssues = deduplicateIssues(parseTextResponse(kimiResponse));
      const qwenIssues = deduplicateIssues(parseTextResponse(qwenResponse));
      logger.log(`${model}: ${kimiIssues.length} issue(s)  |  ${qwenModel}: ${qwenIssues.length} issue(s)`);

      // Multi-stage voting: merge by title-similarity
      const { verified, reviewRecommended } = mergeMultiStageIssues(kimiIssues, qwenIssues);
      logger.log(`Verified (both agree): ${verified.length}  |  Review-recommended (one model): ${reviewRecommended.length}`);

      const allAiIssues = [...verified, ...reviewRecommended];

      for (const ai of allAiIssues) {
        issues.push(...aiIssueToDiagnostic(doc, ai));
      }

      // Structured summary — rendered as a card in the webview
      if (allAiIssues.length > 0) {
        logger.postMessage({
          type: "summary",
          aiCount: allAiIssues.length,
          totalCount: issues.length,
          issues: [
            ...verified.map(ai => ({ title: ai.title, severity: ai.severity, confidence: 'verified' as const })),
            ...reviewRecommended.map(ai => ({ title: ai.title, severity: ai.severity, confidence: 'review' as const })),
          ],
        });
      }
  } catch (e: any) {
      const msg = String(e?.message ?? e);
      logger.log(`\nERROR: ${msg}`);

      if (e?.cause) {
        const cause = e.cause;
        const detail = cause?.code
          ? `${cause.code}: ${cause.message ?? cause}`
          : String(cause?.message ?? cause);
        logger.log(`  Cause: ${detail}`);
      }

      if (msg.includes("connection failed") || msg.includes("ECONNREFUSED")) {
        logger.log("  → Is Ollama running? Try: ollama serve");
      } else if (msg.includes("timed out")) {
        logger.log("  → Model too slow — try the Quick profile preset.");
      } else if (msg.includes("ECONNRESET") || msg.includes("socket hang up")) {
        logger.log("  → Ollama closed the connection (likely OOM).");
      } else if (msg.includes("HTTP 404")) {
        logger.log(`  → Fixed model not found: ${model}`);
      } else if (msg.includes("HTTP 5")) {
        logger.log("  → Ollama server error. Check Ollama logs.");
      }

      logger.log("Continuing with baseline-only results.");

    if (kimiResponse.length > 0 || qwenResponse.length > 0) {
      logger.log(`  (received kimi=${kimiResponse.length} chars, qwen=${qwenResponse.length} chars before error)`);
    }
  }

  diagnostics.set(doc.uri, issues);

  if (issues.length > 0) {
    vscode.window.showWarningMessage(
      `Accessibility: ${issues.length} issue(s). Check Problems tab.`
    );
  } else {
    logger.log("\n✓ No issues found.");
    vscode.window.showInformationMessage("Accessibility: No issues found.");
  }
}
