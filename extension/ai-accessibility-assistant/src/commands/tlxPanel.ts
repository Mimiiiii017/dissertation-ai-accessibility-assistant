// tlxPanel.ts — NASA TLX cognitive workload analysis pipeline
// Orchestrates RAG + Ollama TLX analysis and streams results to the panel
// Similar structure to analysePanel but focused on NASA-TLX assessment
// Used by: webview/AccessibilityPanel.ts

import * as vscode from "vscode";
import { ollamaGenerateStream } from "../utils/llm/ollama";
import { ragRetrieve, formatRagContext, RAG_CONFIG, ragCache } from "../utils/rag/rag";
import { buildTlxRagQuery } from "../utils/rag/ragQueryBuilder";
import { TLX_SYSTEM_PROMPT, buildTlxPrompt } from "../utils/prompts/tlxPrompt";
import { buildRelevantExcerpt } from "../utils/code/excerptBuilder";
import { getExtensionConfig } from "../utils/config";
import type { PanelLogger } from "../webview/panelLogger";

export async function analyseFileForTlx(
  logger: PanelLogger
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("Open a file first, then run TLX Analysis.");
    return;
  }

  const doc = editor.document;
  const text = doc.getText();
  const { ollamaHost, model, ragEndpoint } = getExtensionConfig();

  logger.log("═══ NASA TLX Cognitive Workload Analysis ═══");
  logger.log(`File: ${doc.fileName}`);
  logger.log(`Language: ${doc.languageId}  |  Lines: ${doc.lineCount}  |  Chars: ${text.length}`);
  logger.log(`Model: ${model || "(not set)"}  |  RAG: ${ragEndpoint}`);
  logger.log("");

  // AI analysis
  if (!model) {
    logger.log("No model selected — cannot run TLX analysis.");
    vscode.window.showErrorMessage("Select a model first to run TLX analysis.");
    return;
  }

  let fullResponse = "";
  try {
    const excerpt = buildRelevantExcerpt(doc);
    const ragQuery = buildTlxRagQuery(doc.languageId, excerpt);
    const cacheKey = `tlx::${doc.languageId}::${ragQuery}::${excerpt.length}`;

    const cached = ragCache.get(cacheKey);
    let contextBlock: string;

    if (cached && Date.now() - cached.at < RAG_CONFIG.cacheTimeMs) {
      contextBlock = cached.context;
      logger.log("RAG: cache hit (TLX knowledge)");
    } else {
      const t0 = Date.now();
      const rag = await ragRetrieve(ragEndpoint, ragQuery, RAG_CONFIG.topK, "tlx");
      contextBlock = formatRagContext(rag.chunks);
      ragCache.set(cacheKey, { at: Date.now(), context: contextBlock });
      logger.log(`RAG: ${rag.chunks.length} chunk(s) in ${Date.now() - t0} ms`);
    }

    if (!contextBlock || contextBlock === "(no context)") {
      logger.log("⚠ No NASA-TLX knowledge chunks retrieved.");
    }

    const prompt = buildTlxPrompt(doc.languageId, excerpt, contextBlock);
    const t0 = Date.now();
    let firstTokenMs: number | null = null;
    let dimensionStreamStarted = false;
    let preDimensionBuffer = "";
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

        if (dimensionStreamStarted) {
          if (stopStreaming) { return; }
          streamedText += chunk;
          // Stop after reasoning for last dimension
          if (streamedText.match(/Dimension:\s+Frustration[\s\S]*?Reasoning:/i)) {
            // Continue streaming until we see a natural end
            if (streamedText.match(/\n\n/)) {
              stopStreaming = true;
              return;
            }
          }
          logger.streamChunk(chunk);
          return;
        }

        preDimensionBuffer += chunk;
        const dimensionIdx = preDimensionBuffer.search(/Dimension:/i);
        if (dimensionIdx >= 0) {
          dimensionStreamStarted = true;
          const tlxText = preDimensionBuffer.slice(dimensionIdx);
          streamedText = tlxText;
          logger.streamChunk(tlxText);
        }
      },
      TLX_SYSTEM_PROMPT
    );

    logger.postMessage({ type: "streamEnd" });
    logger.log(`\nCompleted in ${Date.now() - t0} ms (first token: ${firstTokenMs} ms)`);

    // Parse TLX response and send as structured summary card
    const dimensions = extractTlxDimensions(fullResponse);

    if (dimensions.length > 0) {
      const avgRating = dimensions.reduce((sum, d) => sum + d.rating, 0) / dimensions.length;
      logger.postMessage({
        type: "tlxSummary",
        dimensions,
        overall: parseFloat(avgRating.toFixed(1)),
      });
    } else {
      logger.log("  (Could not parse TLX dimensions from response)");
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
      logger.log("  → Model too slow — try a smaller one.");
    } else if (msg.includes("ECONNRESET") || msg.includes("socket hang up")) {
      logger.log("  → Ollama closed the connection (likely OOM).");
    } else if (msg.includes("HTTP 404")) {
      logger.log("  → Model not found. Select one first.");
    } else if (msg.includes("HTTP 5")) {
      logger.log("  → Ollama server error. Check Ollama logs.");
    }

    logger.log("Failed to complete TLX analysis.");
    if (fullResponse.length > 0) {
      logger.log(`  (received ${fullResponse.length} chars before error)`);
    }
  }
}

// Helper: extract TLX dimension ratings from response text
function extractTlxDimensions(text: string): Array<{ name: string; rating: number; confidence: number }> {
  const dimensions: Array<{ name: string; rating: number; confidence: number }> = [];
  
  const dimensionNames = [
    "Mental Demand",
    "Physical Demand",
    "Temporal Demand",
    "Performance",
    "Effort",
    "Frustration",
  ];

  for (const name of dimensionNames) {
    const regex = new RegExp(
      `Dimension:\\s*${name}\\s+Rating:\\s*(\\d+)\\s+Confidence:\\s*(\\d+)`,
      "i"
    );
    const match = text.match(regex);
    if (match) {
      dimensions.push({
        name,
        rating: parseInt(match[1], 10),
        confidence: parseInt(match[2], 10),
      });
    }
  }

  return dimensions;
}
