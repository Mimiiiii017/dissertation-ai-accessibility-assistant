import * as vscode from "vscode";
import { ollamaGenerateStream, RAG_CONFIG } from "../utils/ollama";
import { ragRetrieve, buildRagQuery, formatRagContext } from "../utils/rag";
import { runBaselineChecks } from "../utils/baseline";
import { buildAiPrompt, safeJsonParse , parseTextResponse, aiIssueToDiagnostic, type AiIssue } from "../utils/analysis";
import { getFileTypeContext } from "../utils/fileTypeContext";

// Map model responses to my standard format since different models use different field names
function normalizeAiIssue(raw: any): AiIssue {
  return {
    severity: raw.severity || "med",
    title: raw.title || raw.description || "Accessibility issue",
    explanation: raw.explanation || raw.description || "",
    fix: raw.fix || raw.solution || "No fix provided",
    lineHint: raw.lineHint || raw.line_hint,
    evidence: raw.evidence,
  };
}

// Make sure we only show valid issues - filters out incomplete JSON fragments and malformed responses
function isValidIssue(issue: AiIssue): boolean {
  // Filter out incomplete or malformed issues
  const hasValidTitle = !!(issue.title && issue.title.length > 3 && !issue.title.match(/^[{\[\"}\]\s]+$/));
  const hasContent = !!((issue.explanation && issue.explanation.length > 0) || (issue.fix && issue.fix !== "No fix provided"));
  return hasValidTitle && hasContent;
}

// Generate unique ID for each issue to prevent duplicates during streaming
function getIssueSignature(issue: AiIssue): string {
  // Create a unique signature for each issue to prevent duplicates during streaming
  return `${issue.severity}::${issue.title}::${issue.lineHint || 0}`;
}

// Extract only accessibility-relevant code to send to the model (keeps it fast and focused)
function buildRelevantExcerpt(doc: vscode.TextDocument, keywords: string[]): string {
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

// Cache RAG results to avoid redundant API calls
const ragCache = new Map<string, { at: number; context: string }>();

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

  const cfg = vscode.workspace.getConfiguration("aiAccessibilityAssistant");
  // Strip trailing slashes to avoid double-slash issues in URLs
  const ollamaHost = String(cfg.get("ollamaHost", "http://localhost:11434")).replace(/\/$/, "");
  const model = String(cfg.get("model", ""));
  const ragEndpoint = String(cfg.get("ragEndpoint", "http://127.0.0.1:8000")).replace(/\/$/, "");

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
          // Track which issues we've already shown to prevent duplicates
          const displayedIssues = new Set<string>();
          
          channel.appendLine("--- Analyzing accessibility issues ---");
          
          // Stream response from Ollama and parse issues incrementally
          await ollamaGenerateStream(ollamaHost, model, prompt, (chunk) => {
            fullResponse += chunk;

            // Log timing for the very first token received
            if (firstTokenMs === null) {
              firstTokenMs = Date.now() - t0;
              channel.appendLine(`First token after ${firstTokenMs} ms\n`);
            }
            
            let aiIssues: AiIssue[] = [];
            
            // Try parsing as JSON first, fall back to text parsing if that fails
            try {
              const parsed = safeJsonParse(fullResponse) as { issues?: any[] };
              const rawIssues = Array.isArray(parsed.issues) ? parsed.issues : [];
              aiIssues = rawIssues.map(normalizeAiIssue).filter(isValidIssue);
            } catch {
              // Fallback to text parsing for non-JSON models
              try {
                aiIssues = parseTextResponse(fullResponse).filter(isValidIssue);
              } catch {
                // Can't parse yet, just keep collecting more chunks
                return;
              }
            }

            // Only display issues we haven't shown yet (avoids duplicates during streaming)
            aiIssues.forEach((issue, index) => {
              const sig = getIssueSignature(issue);
              if (!displayedIssues.has(sig)) {
                displayedIssues.add(sig);
                channel.appendLine(`Issue ${index + 1}: ${issue.title || 'Unknown issue'}`);
                channel.appendLine(`  Severity: ${issue.severity?.toUpperCase() || 'N/A'}`);
                if (issue.lineHint) {
                  channel.appendLine(`  Line: ${issue.lineHint}`);
                }
                channel.appendLine(`  Problem: ${issue.explanation || 'No description provided'}`);
                channel.appendLine(`  Solution: ${issue.fix || 'No solution provided'}`);
                channel.appendLine('');
              }
            });

            // Update diagnostics panel in real-time as issues are found
            const currentIssues = [...issues];
            for (const ai of aiIssues) {
              currentIssues.push(aiIssueToDiagnostic(doc, ai));
            }
            diagnostics.set(doc.uri, currentIssues);
          });

          // Streaming complete
          channel.appendLine(`Ollama completed in ${Date.now() - t0} ms`);

          // Do a final parse to make sure we got everything (sometimes streaming misses the last bit)
          let aiIssues: AiIssue[] = [];
          
          try {
            const parsed = safeJsonParse(fullResponse) as { issues?: any[] };
            const rawIssues = Array.isArray(parsed.issues) ? parsed.issues : [];
            aiIssues = rawIssues.map(normalizeAiIssue).filter(isValidIssue);
          } catch {
            // Fallback to text parsing
            try {
              aiIssues = parseTextResponse(fullResponse).filter(isValidIssue);
            } catch (finalError: any) {
              channel.appendLine(`\nWARNING: Could not parse final response (${fullResponse.length} chars received)`);
              if (fullResponse.length === 0) {
                channel.appendLine("Empty response from model - check if model is loaded correctly.");
              } else if (fullResponse.length > 0) {
                channel.appendLine("--- DEBUG: Model response preview ---");
                channel.appendLine(fullResponse.slice(0, 500));
                if (fullResponse.length > 500) {
                  channel.appendLine("...\n(response truncated for display)");
                }
              }
              throw new Error(`Both JSON and text parsing failed. Check model output above.`);
            }
          }
          
          if (fullResponse.length > 0 && aiIssues.length === 0) {
            channel.appendLine(`\nWARNING: Model returned ${fullResponse.length} chars but 0 valid issues were extracted.`);
            channel.appendLine("--- DEBUG: Model response preview ---");
            channel.appendLine(fullResponse.slice(0, 500));
            if (fullResponse.length > 500) {
              channel.appendLine("...\n(response truncated for display)");
            }
          }
          
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
          channel.appendLine("Continuing with baseline-only results.");
          channel.appendLine("");
          
          // Log debug info if response was received
          if (typeof fullResponse === 'string' && fullResponse.length > 0) {
            channel.appendLine("--- DEBUG: First 500 chars of Ollama response ---");
            channel.appendLine(fullResponse.slice(0, 500));
            channel.appendLine("--- DEBUG: Last 500 chars of Ollama response ---");
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
