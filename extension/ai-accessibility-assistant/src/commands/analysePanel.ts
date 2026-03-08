// analysePanel.ts — analysis pipeline for the webview panel
// Orchestrates baseline + RAG + Ollama analysis and streams results
// to the panel via PanelLogger callbacks.
// Used by: webview/AccessibilityPanel.ts

import * as vscode from "vscode";
import {
  FIXED_MODEL,
  ollamaGenerateStream,
  resolveAnalysisPreset,
} from "../utils/llm/ollama";
import { ragRetrieve, formatRagContext, RAG_CONFIG, ragCache } from "../utils/rag/rag";
import { buildRagQuery } from "../utils/rag/ragQueryBuilder";
import { runBaselineChecks } from "../utils/analysis/baseline";
import { SYSTEM_PROMPT, buildAiPrompt } from "../utils/prompts/prompt";
import { parseTextResponse, deduplicateIssues } from "../utils/analysis/parser";
import { aiIssueToDiagnostic } from "../utils/analysis/diagnostics";
import { buildRelevantExcerpt } from "../utils/code/excerptBuilder";
import { getExtensionConfig } from "../utils/config";
import type { PanelLogger } from "../webview/panelLogger";

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
  const { ollamaHost, analysisPreset, ragEndpoint } = getExtensionConfig();
  const model = FIXED_MODEL;
  const preset = resolveAnalysisPreset(analysisPreset);

  logger.log("═══ Accessibility Analysis ═══");
  logger.log(`File: ${doc.fileName}`);
  logger.log(`Language: ${doc.languageId}  |  Lines: ${doc.lineCount}  |  Chars: ${text.length}`);
  logger.log(`Model: ${model}  |  Profile: ${preset.label} (${preset.id})  |  RAG: ${ragEndpoint}`);
  logger.log("");

  diagnostics.delete(doc.uri);
  const issues: vscode.Diagnostic[] = [];

  // Baseline checks
  const baselineIssues = runBaselineChecks(doc);
  if (baselineIssues.length > 0) {
    logger.log(`Baseline: ${baselineIssues.length} issue(s) found`);
    issues.push(...baselineIssues);
  }

  // AI analysis
  let fullResponse = "";
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
        const rag = await ragRetrieve(ragEndpoint, ragQuery, RAG_CONFIG.topK, "accessibility");
        contextBlock = formatRagContext(rag.chunks);
        ragCache.set(cacheKey, { at: Date.now(), context: contextBlock });
        logger.log(`RAG: ${rag.chunks.length} chunk(s) in ${Date.now() - t0} ms`);
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

      await ollamaGenerateStream(
        ollamaHost,
        model,
        prompt,
        (chunk) => {
          fullResponse += chunk;
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
        SYSTEM_PROMPT,
        preset.id
      );

      logger.postMessage({ type: "streamEnd" });
      logger.log(`\nCompleted in ${Date.now() - t0} ms (first token: ${firstTokenMs} ms)`);

      const rawIssues = parseTextResponse(fullResponse);
      const aiIssues = deduplicateIssues(rawIssues);

      for (const ai of aiIssues) {
        issues.push(...aiIssueToDiagnostic(doc, ai));
      }

      // Structured summary — rendered as a card in the webview
      if (rawIssues.length > 0) {
        logger.postMessage({
          type: "summary",
          aiCount: aiIssues.length,
          totalCount: issues.length,
          issues: rawIssues.map(ai => ({ title: ai.title, severity: ai.severity })),
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

    if (fullResponse.length > 0) {
      logger.log(`  (received ${fullResponse.length} chars before error)`);
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
