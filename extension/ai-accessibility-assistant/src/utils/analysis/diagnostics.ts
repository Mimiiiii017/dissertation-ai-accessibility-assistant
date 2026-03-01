// diagnostics.ts — converts structured AiIssue objects into VS Code Problems panel entries
// Converts structured AiIssue objects into VS Code Diagnostic entries so
// they appear in the Problems panel with the correct severity and source.
// Used by: commands/analyzeFile.ts

import * as vscode from "vscode";
import { type AiIssue } from "../types";

// Convert AI issue to VSCode diagnostic(s) (shows up in Problems panel)
// If issue has multiple lines (lineHints), creates one diagnostic per line
// If issue has single line (lineHint), creates one diagnostic
export function aiIssueToDiagnostic(doc: vscode.TextDocument, issue: AiIssue): vscode.Diagnostic[] {
  const severity =
    issue.severity === "high"
      ? vscode.DiagnosticSeverity.Error
      : issue.severity === "med"
        ? vscode.DiagnosticSeverity.Warning
        : vscode.DiagnosticSeverity.Information;

  const evidence = issue.evidence?.contextIds?.length
    ? `Evidence: ${issue.evidence.contextIds.join(", ")}`
    : "Evidence: (none)";

  const title = issue.title || "Accessibility issue";
  const explanation = issue.explanation || "";
  const fix = issue.fix || "No fix provided";

  const parts = [title, explanation, `Fix: ${fix}`, evidence].filter(Boolean);
  const message = parts.join("\n");

  // Determine which lines to create diagnostics for
  const linesToReport = issue.lineHints && issue.lineHints.length > 0
    ? issue.lineHints  // Multiple lines
    : issue.lineHint   // Single line
      ? [issue.lineHint]
      : [1]; // Default to line 1 if no line hint

  return linesToReport.map(lineNum => {
    const range = bestEffortRange(doc, lineNum);
    const d = new vscode.Diagnostic(range, message, severity);
    d.source = "AI Accessibility Assistant (RAG+Ollama)";
    return d;
  });
}

// Try to highlight the right line, or just use line 1 if we don't have a line number
function bestEffortRange(doc: vscode.TextDocument, lineHint?: number): vscode.Range {
  if (lineHint && lineHint > 0 && lineHint <= doc.lineCount) {
    const line = doc.lineAt(lineHint - 1);
    return new vscode.Range(line.range.start, line.range.end);
  }
  const first = doc.lineAt(0);
  return new vscode.Range(first.range.start, first.range.end);
}
