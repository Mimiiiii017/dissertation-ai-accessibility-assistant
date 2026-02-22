// baseline.ts — runs fast regex checks for common issues before the AI analysis starts
// Fast, regex-based accessibility checks that run before the AI analysis.
// Does not require Ollama or the RAG service — results appear instantly.
// Currently checks:
//   HTML — images missing alt text, form inputs missing associated labels
//   CSS  — interactive elements missing :focus styles
// Used by: commands/analyzeFile.ts

import * as vscode from "vscode";

const BASELINE_SOURCE = "AI Accessibility Assistant (baseline)";

// Helper to create a baseline diagnostic without repeating the range/source boilerplate
function makeDiag(
  doc: vscode.TextDocument,
  matchIndex: number,
  matchLength: number,
  message: string,
  severity: vscode.DiagnosticSeverity
): vscode.Diagnostic {
  const range = new vscode.Range(doc.positionAt(matchIndex), doc.positionAt(matchIndex + matchLength));
  const d = new vscode.Diagnostic(range, message, severity);
  d.source = BASELINE_SOURCE;
  return d;
}

// Run appropriate baseline checks based on file type
export function runBaselineChecks(doc: vscode.TextDocument): vscode.Diagnostic[] {
  const diags: vscode.Diagnostic[] = [];
  
  // HTML-specific checks
  if (doc.languageId === "html") {
    diags.push(...findImgMissingAlt(doc));
    diags.push(...findInputsMissingLabel(doc));
  }
  
  // CSS-specific checks
  if (["css", "scss", "sass", "less"].includes(doc.languageId)) {
    diags.push(...findMissingFocusStyles(doc));
  }
  
  return diags;
}

// Escape special regex characters so we can safely use user input in regex
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Check for images without alt text (basic regex-based validation)
export function findImgMissingAlt(doc: vscode.TextDocument): vscode.Diagnostic[] {
  const diags: vscode.Diagnostic[] = [];
  const text = doc.getText();
  const imgTagRegex = /<img\b[^>]*>/gi;

  let match: RegExpExecArray | null;
  while ((match = imgTagRegex.exec(text)) !== null) {
    const tag = match[0];
    const altMatch = tag.match(/\balt\s*=\s*["']([^"']*)["']/i);
    const altValue = altMatch?.[1]?.trim();

    if (!altMatch || !altValue) {
      diags.push(makeDiag(
        doc, match.index, tag.length,
        "Image is missing a meaningful alt attribute (screen readers may not describe it).",
        vscode.DiagnosticSeverity.Warning
      ));
    }
  }

  return diags;
}

// Check for form inputs that don't have associated labels
export function findInputsMissingLabel(doc: vscode.TextDocument): vscode.Diagnostic[] {
  const diags: vscode.Diagnostic[] = [];
  const text = doc.getText();
  const inputRegex = /<input\b[^>]*>/gi;

  let match: RegExpExecArray | null;
  while ((match = inputRegex.exec(text)) !== null) {
    const tag = match[0];

    const typeMatch = tag.match(/\btype\s*=\s*["']([^"']+)["']/i);
    const typeValue = typeMatch?.[1]?.trim().toLowerCase();
    // Skip hidden inputs since they don't need labels
    if (typeValue === "hidden") {
      continue;
    }

    const idMatch = tag.match(/\bid\s*=\s*["']([^"']+)["']/i);
    const idValue = idMatch?.[1]?.trim();

    if (!idValue) {
      diags.push(makeDiag(
        doc, match.index, tag.length,
        'Input is missing an id (needed to associate it with a <label for="...">).',
        vscode.DiagnosticSeverity.Warning
      ));
      continue;
    }

    const labelForRegex = new RegExp(
      `<label\\b[^>]*for\\s*=\\s*["']${escapeRegex(idValue)}["'][^>]*>`,
      "i"
    );

    if (!labelForRegex.test(text)) {
      diags.push(makeDiag(
        doc, match.index, tag.length,
        `Input id="${idValue}" has no matching <label for="${idValue}">.`,
        vscode.DiagnosticSeverity.Warning
      ));
    }
  }

  return diags;
}

// Check for missing focus styles in CSS files
export function findMissingFocusStyles(doc: vscode.TextDocument): vscode.Diagnostic[] {
  const diags: vscode.Diagnostic[] = [];
  const text = doc.getText();
  
  // Check if there are interactive selectors without focus styles
  const interactivePatterns = [
    { selector: /\b(button|input|select|textarea|a)\s*\{/gi, name: "interactive element" },
    { selector: /\.(btn|button|link|input|field)[^{]*\{/gi, name: "button/link class" },
  ];
  
  for (const pattern of interactivePatterns) {
    let match: RegExpExecArray | null;
    const regex = new RegExp(pattern.selector);
    
    while ((match = regex.exec(text)) !== null) {
      const selectorText = match[1] || match[0];
      const focusVariant = selectorText.replace(/\s*\{.*/, ":focus");
      
      // Check if there's a :focus variant nearby (within 500 chars is reasonable for same file)
      const nearbyText = text.slice(Math.max(0, match.index - 500), Math.min(text.length, match.index + 500));
      
      if (!nearbyText.includes(":focus") && !nearbyText.includes("outline")) {
        diags.push(makeDiag(
          doc, match.index, match[0].length,
          `${pattern.name} may be missing :focus styles for keyboard navigation.`,
          vscode.DiagnosticSeverity.Information
        ));
      }
    }
  }
  
  return diags;
}

