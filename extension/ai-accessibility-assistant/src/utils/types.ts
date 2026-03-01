// types.ts — defines the shared AiIssue type used across the analysis pipeline
// Shared data types used throughout the extension.
// Used by: parser.ts, diagnostics.ts, commands/analyzeFile.ts

// A single accessibility issue returned by the AI model
export type AiIssue = {
  severity?: "low" | "med" | "high";
  title?: string;
  explanation?: string;
  fix?: string;
  lineHint?: number; // Single line (when combining same issue across multiple lines, use lineHints)
  lineHints?: number[]; // Multiple lines (when same problem appears on multiple lines)
  evidence?: { contextIds?: string[] };
};
