import * as vscode from "vscode";

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
      const start = doc.positionAt(match.index);
      const end = doc.positionAt(match.index + tag.length);
      const range = new vscode.Range(start, end);

      const d = new vscode.Diagnostic(
        range,
        "Image is missing a meaningful alt attribute (screen readers may not describe it).",
        vscode.DiagnosticSeverity.Warning
      );
      d.source = "AI Accessibility Assistant (baseline)";
      diags.push(d);
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
      const start = doc.positionAt(match.index);
      const end = doc.positionAt(match.index + tag.length);
      const range = new vscode.Range(start, end);

      const d = new vscode.Diagnostic(
        range,
        'Input is missing an id (needed to associate it with a <label for="...">).',
        vscode.DiagnosticSeverity.Warning
      );
      d.source = "AI Accessibility Assistant (baseline)";
      diags.push(d);
      continue;
    }

    const labelForRegex = new RegExp(
      `<label\\b[^>]*for\\s*=\\s*["']${escapeRegex(idValue)}["'][^>]*>`,
      "i"
    );

    if (!labelForRegex.test(text)) {
      const start = doc.positionAt(match.index);
      const end = doc.positionAt(match.index + tag.length);
      const range = new vscode.Range(start, end);

      const d = new vscode.Diagnostic(
        range,
        `Input id="${idValue}" has no matching <label for="${idValue}">.`,
        vscode.DiagnosticSeverity.Warning
      );
      d.source = "AI Accessibility Assistant (baseline)";
      diags.push(d);
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
        const start = doc.positionAt(match.index);
        const end = doc.positionAt(match.index + match[0].length);
        const range = new vscode.Range(start, end);
        
        const d = new vscode.Diagnostic(
          range,
          `${pattern.name} may be missing :focus styles for keyboard navigation.`,
          vscode.DiagnosticSeverity.Information
        );
        d.source = "AI Accessibility Assistant (baseline)";
        diags.push(d);
      }
    }
  }
  
  return diags;
}

