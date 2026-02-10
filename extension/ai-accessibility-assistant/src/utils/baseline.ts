import * as vscode from "vscode";

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
