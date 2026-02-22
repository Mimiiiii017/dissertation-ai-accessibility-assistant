// analyzeFile.ts — orchestrates the full accessibility analysis pipeline from start to finish
// Implements the "Analyse Current File" command — the main entry point for
// accessibility analysis. Orchestrates the full pipeline:
//   1. Baseline regex checks  (baseline.ts)
//   2. Code excerpt extraction (excerptBuilder.ts)
//   3. RAG context retrieval   (rag.ts / ragQueryBuilder.ts)
//   4. Ollama AI analysis      (ollama.ts + prompt.ts)
//   5. Result parsing          (parser.ts)
//   6. Diagnostic reporting    (diagnostics.ts)
// Used by: extension.ts

import * as vscode from "vscode";
import { ollamaGenerateStream } from "../utils/ollama";
import { ragRetrieve, formatRagContext, RAG_CONFIG } from "../utils/rag";
import { buildRagQuery } from "../utils/ragQueryBuilder";
import { runBaselineChecks } from "../utils/baseline";
import { SYSTEM_PROMPT, buildAiPrompt } from "../utils/prompt";
import { parseTextResponse } from "../utils/parser";
import { aiIssueToDiagnostic } from "../utils/diagnostics";
import { getFileTypeContext } from "../utils/fileTypeContext";
import { buildRelevantExcerpt, ragCache } from "../utils/excerptBuilder";
import { getExtensionConfig } from "../utils/config";

export async function analyzeFileCommand(
  channel: vscode.OutputChannel,
  diagnostics: vscode.DiagnosticCollection
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("Open a file first, then run Analyse.");
    return;
  }

  const doc = editor.document;
  const text = doc.getText();

  const { ollamaHost, model, ragEndpoint } = getExtensionConfig();

  channel.show(true);
  channel.appendLine("=== Accessibility: Analyse Current File (Baseline + RAG + Ollama) ===");
  channel.appendLine(`File: ${doc.fileName}`);
  channel.appendLine(`Language: ${doc.languageId}`);
  channel.appendLine(`Characters: ${text.length}`);
  channel.appendLine(`Lines: ${doc.lineCount}`);
  channel.appendLine(`Ollama Host: ${ollamaHost}`);
  channel.appendLine(`Selected Model: ${model || "(not set)"}`);
  channel.appendLine(`RAG Endpoint: ${ragEndpoint}`);
  channel.appendLine("");

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "AI Accessibility Assistant: Analysing with RAG + Ollama…",
      cancellable: true,
    },
    async (progress, token) => {
      diagnostics.delete(doc.uri);
      const issues: vscode.Diagnostic[] = [];
      
      // Get file-type specific keywords for code extraction
      const fileTypeContext = getFileTypeContext(doc);
      
      channel.appendLine(`File type: ${doc.languageId}`);
      channel.appendLine("");

      // Run baseline checks first (simple regex-based validation)
      const baselineIssues = runBaselineChecks(doc);
      if (baselineIssues.length > 0) {
        channel.appendLine(`Baseline checks found ${baselineIssues.length} issue(s)`);
        issues.push(...baselineIssues);
      }

      if (!model) {
        channel.appendLine("No Ollama model selected. Skipping AI analysis.");
      } else {
        let fullResponse = "";
        try {
          // Build a focused excerpt of accessibility-related code using file-type specific keywords
          const excerpt = buildRelevantExcerpt(doc, fileTypeContext.keywords);
          const ragQuery = buildRagQuery(doc.languageId, excerpt);
          // Use language, query, and length as cache key since same inputs = same results
          const cacheKey = `${doc.languageId}::${ragQuery}::${excerpt.length}`;

          const cached = ragCache.get(cacheKey);
          let contextBlock: string;

          // Check cache first to avoid redundant RAG calls
          if (cached && Date.now() - cached.at < RAG_CONFIG.cacheTimeMs) {
            contextBlock = cached.context;
            channel.appendLine(`RAG: cache hit (topK=${RAG_CONFIG.topK}).`);
          } else {
            const tRag0 = Date.now();
            const rag = await ragRetrieve(ragEndpoint, ragQuery, RAG_CONFIG.topK);
            contextBlock = formatRagContext(rag.chunks);
            ragCache.set(cacheKey, { at: Date.now(), context: contextBlock });
            channel.appendLine(`RAG: retrieved ${rag.chunks.length} chunk(s) in ${Date.now() - tRag0} ms (topK=${RAG_CONFIG.topK}).`);
          }

          if (!contextBlock || contextBlock === "(no context)") {
            channel.appendLine("WARNING: No knowledge base chunks retrieved. RAG service may not be initialized.");
          }
          channel.appendLine("");

          const prompt = buildAiPrompt(doc.languageId, excerpt, contextBlock);
          const t0 = Date.now();
          let firstTokenMs: number | null = null;
          let issueStreamStarted = false;  // true once we see "Issue N:" in the stream
          let preIssueBuffer = "";         // collects tokens before the first issue
          let stopStreaming = false;       // stop printing after "Final Answer:" etc.
          let streamedText = "";          // tracks what's been streamed to detect repeats
          
          channel.appendLine("--- Analyzing accessibility issues ---");
          
          // Stream response from Ollama — separate thinking from issues
          await ollamaGenerateStream(ollamaHost, model, prompt, (chunk) => {
            fullResponse += chunk;

            // Log timing for the very first token received
            if (firstTokenMs === null) {
              firstTokenMs = Date.now() - t0;
              channel.appendLine(`First token after ${firstTokenMs} ms`);
              channel.appendLine('');
            }

            if (issueStreamStarted) {
              if (stopStreaming) { return; }
              // Check if model is starting to repeat with "Final Answer:" or similar
              streamedText += chunk;
              if (streamedText.match(/\bFinal\s+Answer\s*:/i)) {
                // Strip the "Final Answer:..." text from what's already been appended
                stopStreaming = true;
                return;
              }
              channel.append(chunk);
              return;
            }

            // Buffer everything until we see "Issue <N>:" which marks real output
            preIssueBuffer += chunk;
            const issueIdx = preIssueBuffer.search(/Issue\s+\d+\s*:/i);

            if (issueIdx >= 0) {
              issueStreamStarted = true;
              // Print the issue text that was buffered
              const issueText = preIssueBuffer.slice(issueIdx);
              streamedText = issueText;
              channel.append(issueText);
            }
          }, SYSTEM_PROMPT);

          // Ensure newline after streamed content
          channel.appendLine('');
          channel.appendLine(`Ollama completed in ${Date.now() - t0} ms`);

          // Parse the completed plain-text response to extract issues for diagnostics
          const aiIssues = parseTextResponse(fullResponse);
          
          channel.appendLine(`\nAI issues parsed: ${aiIssues.length}`);
          channel.appendLine("--- Summary ---");

          for (const ai of aiIssues) {
            issues.push(aiIssueToDiagnostic(doc, ai));
          }

          if (aiIssues.length > 0) {
            aiIssues.forEach((ai, index) => {
              channel.appendLine(`${index + 1}. [${ai.severity}] ${ai.title}`);
            });
          } else {
            channel.appendLine("No AI issues found.");
          }
          channel.appendLine("");
        } catch (e: any) {
          const msg = String(e?.message ?? e);
          channel.appendLine(`AI/RAG ERROR: ${msg}`);

          // Unwrap and print the underlying network error cause if present
          if (e?.cause) {
            const cause = e.cause;
            const causeDetail = cause?.code
              ? `${cause.code}: ${cause.message ?? cause}`
              : String(cause?.message ?? cause);
            channel.appendLine(`  Cause: ${causeDetail}`);
          }

          // Suggest likely fixes based on the error message
          if (msg.includes("connection failed") || msg.includes("ECONNREFUSED")) {
            channel.appendLine("  → Is Ollama running? Try: ollama serve");
          } else if (msg.includes("timed out")) {
            channel.appendLine("  → The model took too long. It may have run out of RAM.");
            channel.appendLine("  → Try a smaller model, or increase available memory.");
          } else if (msg.includes("ECONNRESET") || msg.includes("socket hang up")) {
            channel.appendLine("  → Ollama closed the connection mid-stream.");
            channel.appendLine("  → The model may have crashed (out of memory) or restarted.");
            channel.appendLine("  → Run: ollama ps  to check if the model is still loaded.");
          } else if (msg.includes("HTTP 404")) {
            channel.appendLine("  → Model not found. Run 'Accessibility: Select Ollama Model' to pick one.");
          } else if (msg.includes("HTTP 5")) {
            channel.appendLine("  → Ollama returned a server error. Check Ollama logs for details.");
          }

          channel.appendLine("Continuing with baseline-only results.");
          channel.appendLine("");
          
          // Log the partial response if any tokens were received (helps diagnose cut-off issues)
          if (typeof fullResponse === 'string' && fullResponse.length > 0) {
            channel.appendLine(`--- DEBUG: Received ${fullResponse.length} chars before error ---`);
            channel.appendLine("--- First 500 chars ---");
            channel.appendLine(fullResponse.slice(0, 500));
            channel.appendLine("--- Last 500 chars ---");
            channel.appendLine(fullResponse.slice(-500));
            channel.appendLine("");
          }
        }
      }

      diagnostics.set(doc.uri, issues);

      if (issues.length > 0) {
        channel.appendLine(`Total issues: ${issues.length} (see Problems tab).`);
        vscode.window.showWarningMessage(`Accessibility: Found ${issues.length} issue(s). Check Problems tab.`);
      } else {
        channel.appendLine("No issues found (baseline + AI).");
        vscode.window.showInformationMessage("Accessibility: No issues found (baseline + AI).");
      }
    }
  );
}
