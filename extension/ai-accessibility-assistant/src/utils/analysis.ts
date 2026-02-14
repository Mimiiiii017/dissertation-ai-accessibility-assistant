import * as vscode from "vscode";

// Standard issue format that all parsers convert to
export type AiIssue = {
  severity?: "low" | "med" | "high";
  title?: string;
  explanation?: string;
  fix?: string;
  lineHint?: number;
  evidence?: { contextIds?: string[] };
};

// Build the prompt that tells the AI what to analyze and how to respond
export function buildAiPrompt(languageId: string, code: string, contextBlock: string, fileTypeInstructions?: string): string {
  return `You are an expert accessibility auditor performing a COMPREHENSIVE, EXHAUSTIVE analysis. Your goal is to find EVERY accessibility issue in the code.

ANALYSIS REQUIREMENTS:
- Review ALL context documents thoroughly before identifying issues
- Analyze EVERY line of code systematically - do not skip any sections
- Each issue MUST cite specific contextIds from the knowledge base as evidence
- Apply WCAG guidelines and best practices from the provided context
- Find ALL issues: obvious ones AND subtle ones
- Only report issues that are RELEVANT to what is ACTUALLY PRESENT in this code
- If something is not in the code (e.g., no colors = no color contrast issues, no forms = no form issues), don't report issues about it
- There is NO LIMIT to the number of issues - report everything you find
- Check every element, attribute, style, handler, and interaction
- Even if you find many issues, keep analyzing until you've reviewed everything
- Be intelligent: analyze what's there, ignore what's not there

CRITICAL - JSON FORMAT:
Return ONLY valid, well-formed JSON. No markdown, no comments, no additional text.
- Use double quotes for all strings
- No trailing commas
- Properly escape quotes inside strings
- Close all brackets and braces
- Use lowercase true/false for booleans

Required JSON structure:
{"issues": [{"severity": "low|med|high", "title": "...", "explanation": "...", "fix": "...", "lineHint": 123, "evidence": {"contextIds": ["#1", "#2"]}}]}

Language: ${languageId}

CONTEXT (from knowledge base):
${contextBlock}

CODE TO ANALYZE:
\`\`\`
${code}
\`\`\`

Return ONLY the JSON object with ALL issues found and how to improve, nothing else:`;
}

// Extract JSON from text (handles markdown wrappers and other junk)
export function extractFirstJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return valid JSON.");
  }
  
  let jsonText = text.slice(start, end + 1);
  
  // Clean up common formatting issues before parsing
  jsonText = repairJson(jsonText);
  
  return jsonText;
}

// Fix common JSON issues that models make (trailing commas, wrong case booleans, etc)
function repairJson(jsonText: string): string {
  // Strip markdown code fences that models sometimes add
  jsonText = jsonText.replace(/```json\s*/g, "").replace(/```\s*/g, "");
  
  // Remove trailing commas before closing braces/brackets
  jsonText = jsonText.replace(/,\s*([}\]])/g, "$1");
  
  // Fix unescaped quotes in strings (basic attempt)
  // This is a simplified approach - won't catch all cases
  jsonText = jsonText.replace(/([^\\])"([^":,}\]]*?)"([^:,}\]])/g, '$1\\"$2\\"$3');
  
  // Ensure boolean values are lowercase
  jsonText = jsonText.replace(/:\s*True/g, ": true").replace(/:\s*False/g, ": false");
  
  // Count opening/closing brackets to detect incomplete JSON
  const openBraces = (jsonText.match(/{/g) || []).length;
  const closeBraces = (jsonText.match(/}/g) || []).length;
  const openBrackets = (jsonText.match(/\[/g) || []).length;
  const closeBrackets = (jsonText.match(/\]/g) || []).length;
  
  // Add missing closing brackets
  if (closeBrackets < openBrackets) {
    jsonText += "]".repeat(openBrackets - closeBrackets);
  }
  
  // Add missing closing braces
  if (closeBraces < openBraces) {
    jsonText += "}".repeat(openBraces - closeBraces);
  }
  
  return jsonText;
}

// Try multiple parsing strategies since models sometimes return broken JSON
export function safeJsonParse(text: string): any {
  // Strategy 1: Try parsing as-is
  try {
    return JSON.parse(text);
  } catch (firstError: any) {
    // Strategy 2: Extract JSON object and try parsing
    try {
      const extracted = extractFirstJsonObject(text);
      return JSON.parse(extracted);
    } catch (secondError: any) {      
      // Strategy 3: Extract + aggressive repair, then parse
      try {
        const repaired = repairJson(extractFirstJsonObject(text));
        return JSON.parse(repaired);
      } catch (thirdError: any) {
        // Throw the most informative error
        throw new Error(
          `JSON parse failed after multiple repair attempts. ` +
          `Original error: ${firstError.message}. ` +
          `Last 200 chars of text: ${text.slice(-200)}`
        );
      }
    }
  }
}

// Fallback parser for models that don't return JSON (parses plain text with patterns)
export function parseTextResponse(text: string): AiIssue[] {
  const issues: AiIssue[] = [];
  
  // Look for patterns like "Issue 1:", "Problem:", "1.", etc
  const issueBlocks = text.split(/(?:^|\n)(?:Issue|Problem|\d+\.)\s*(?:\d+)?[:\-\)]\s*/i).filter(Boolean);
  
  for (const block of issueBlocks) {
    const issue: AiIssue = {
      severity: "med", // Default to medium if not specified
    };
    
    // Extract severity
    const sevMatch = block.match(/severity\s*[:\-]\s*(low|med|medium|high)/i);
    if (sevMatch) {
      const sev = sevMatch[1].toLowerCase();
      issue.severity = sev === "medium" ? "med" : (sev as "low" | "med" | "high");
    }
    
    // Extract title/description
    const titleMatch = block.match(/(?:title|description|issue)\s*[:\-]\s*([^\n]+)/i);
    if (titleMatch) {
      issue.title = titleMatch[1].trim();
    } else {
      // Fallback: use first line as title if no explicit "Title:" was found
      const firstLine = block.split('\n')[0].trim();
      if (firstLine && firstLine.length < 150) {
        issue.title = firstLine;
      }
    }
    
    // Extract explanation/problem
    const explanationMatch = block.match(/(?:explanation|problem|description)\s*[:\-]\s*([^\n]+(?:\n(?!(?:severity|title|solution|fix|line|evidence)[:\-])[^\n]+)*)/i);
    if (explanationMatch) {
      issue.explanation = explanationMatch[1].trim();
    }
    
    // Extract solution/fix
    const fixMatch = block.match(/(?:solution|fix|recommendation)\s*[:\-]\s*([^\n]+(?:\n(?!(?:severity|title|problem|line|evidence)[:\-])[^\n]+)*)/i);
    if (fixMatch) {
      issue.fix = fixMatch[1].trim();
    }
    
    // Extract line number
    const lineMatch = block.match(/line\s*[:\-]?\s*(\d+)/i);
    if (lineMatch) {
      issue.lineHint = parseInt(lineMatch[1], 10);
    }
    
    // Extract evidence/context IDs
    const evidenceMatch = block.match(/evidence\s*[:\-]\s*([^\n]+)/i);
    if (evidenceMatch) {
      const ids = evidenceMatch[1].match(/#\d+/g) || [];
      if (ids.length > 0) {
        issue.evidence = { contextIds: ids };
      }
    }
    
    // Only add if we got at least a title or explanation
    if (issue.title || issue.explanation) {
      issues.push(issue);
    }
  }
  
  return issues;
}

// Convert AI issue to VSCode diagnostic (shows up in Problems panel)
export function aiIssueToDiagnostic(doc: vscode.TextDocument, issue: AiIssue): vscode.Diagnostic {
  const range = bestEffortRange(doc, issue.lineHint);

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

  const message = `${title}\n${explanation}\nFix: ${fix}\n${evidence}`;

  const d = new vscode.Diagnostic(range, message, severity);
  d.source = "AI Accessibility Assistant (RAG+Ollama)";
  return d;
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
