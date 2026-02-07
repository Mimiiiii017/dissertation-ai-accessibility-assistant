import * as vscode from "vscode";

/**
 * Ollama API types
 */
type OllamaTagsResponse = {
  models: { name: string }[];
};

type OllamaGenerateResponse = {
  response?: string;
};

/**
 * RAG API types
 */
type RagChunk = {
  id: string;
  source: string;
  text: string;
};

type RagRetrieveResponse = {
  chunks: RagChunk[];
};

/**
 * AI issue schema (what we ask the model to return)
 */
type AiIssue = {
  severity: "low" | "med" | "high";
  title: string;
  explanation: string;
  fix: string;
  lineHint?: number; // 1-based (best effort)
  evidence?: { contextIds?: string[] };
};

export function activate(context: vscode.ExtensionContext) {
  const channel = vscode.window.createOutputChannel("AI Accessibility Assistant");
  const diagnostics = vscode.languages.createDiagnosticCollection(
    "ai-accessibility-assistant"
  );

  channel.appendLine("AI Accessibility Assistant activated.");

  const helloDisposable = vscode.commands.registerCommand(
    "ai-accessibility-assistant.helloWorld",
    () => {
      vscode.window.showInformationMessage(
        "Hello World from AI Accessibility Assistant!"
      );
    }
  );

  /**
   * Select Ollama model
   */
  const selectModelDisposable = vscode.commands.registerCommand(
    "ai-accessibility-assistant.selectModel",
    async () => {
      const cfg = vscode.workspace.getConfiguration("aiAccessibilityAssistant");
      const ollamaHost = String(cfg.get("ollamaHost", "http://localhost:11434")).replace(/\/$/, "");

      channel.show(true);
      channel.appendLine(`Fetching Ollama models from: ${ollamaHost}/api/tags`);

      try {
        const models = await ollamaListModels(ollamaHost);

        if (models.length === 0) {
          vscode.window.showWarningMessage("No Ollama models found on this host.");
          channel.appendLine("No models returned by Ollama.");
          return;
        }

        const currentModel = String(cfg.get("model", ""));
        const picked = await vscode.window.showQuickPick(models, {
          title: "Select Ollama Model",
          placeHolder: currentModel ? `Current: ${currentModel}` : "Choose a model for analysis",
          canPickMany: false,
        });

        if (!picked) return;

        await cfg.update("model", picked, vscode.ConfigurationTarget.Global);

        channel.appendLine(`Model set to: ${picked}`);
        vscode.window.showInformationMessage(`Ollama model set to: ${picked}`);
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        channel.appendLine(`ERROR fetching models: ${msg}`);
        vscode.window.showErrorMessage("Failed to fetch Ollama models. See Output for details.");
      }
    }
  );

  /**
   * Analyse current file: baseline checks + RAG retrieval + Ollama issues
   */
  const analyseDisposable = vscode.commands.registerCommand(
    "ai-accessibility-assistant.analyseFile",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage("Open a file first, then run Analyse.");
        return;
      }

      const doc = editor.document;
      const text = doc.getText();

      const cfg = vscode.workspace.getConfiguration("aiAccessibilityAssistant");
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
          // Clear previous diagnostics
          diagnostics.delete(doc.uri);

          const issues: vscode.Diagnostic[] = [];

          // 1) Baseline checks
          progress.report({ message: "Running baseline checks…" });
          if (doc.languageId === "html") {
            issues.push(...findImgMissingAlt(doc));
            issues.push(...findInputsMissingLabel(doc));
          }

          // 2) RAG retrieve (use fewer chunks for speed)
          if (!model) {
            channel.appendLine("No Ollama model selected. Skipping AI analysis.");
          } else {
            try {
              progress.report({ message: "Retrieving knowledge-base context…" });

              const ragQuery = buildRagQuery(doc.languageId, text);
              channel.appendLine(`RAG query: ${ragQuery}`);

              const rag = await ragRetrieve(ragEndpoint, ragQuery, 3); // was 6
              const contextBlock = formatRagContext(rag.chunks);

              channel.appendLine(`Retrieved ${rag.chunks.length} KB chunk(s).`);
              channel.appendLine("");

              // 3) Ollama call
              progress.report({ message: "Calling Ollama (can take 1–3 minutes)..." });
              channel.appendLine("Calling Ollama /api/generate...");

              const prompt = buildAiPrompt(doc.languageId, text.slice(0, 6000), contextBlock); // shorter code
              const t0 = Date.now();
              const raw = await ollamaGenerate(ollamaHost, model, prompt);
              const ms = Date.now() - t0;

              channel.appendLine(`Ollama completed in ${ms} ms`);

              // 4) Parse + diagnostics
              progress.report({ message: "Parsing AI issues and updating Problems tab…" });

              const jsonText = extractFirstJsonObject(raw);
              const parsed = JSON.parse(jsonText) as { issues?: AiIssue[] };
              const aiIssues = Array.isArray(parsed.issues) ? parsed.issues : [];

              channel.appendLine(`AI issues parsed: ${aiIssues.length}`);
              channel.appendLine("");

              for (const ai of aiIssues) {
                issues.push(aiIssueToDiagnostic(doc, ai));
              }

              // Log readable summary
              channel.appendLine("--- AI Issues (summary) ---");
              for (const ai of aiIssues) {
                channel.appendLine(`- [${ai.severity}] ${ai.title}`);
                channel.appendLine(`  fix: ${ai.fix}`);
                if (ai.evidence?.contextIds?.length) {
                  channel.appendLine(`  evidence: ${ai.evidence.contextIds.join(", ")}`);
                }
              }
              channel.appendLine("");
            } catch (e: any) {
              const msg = String(e?.message ?? e);
              channel.appendLine(`AI/RAG ERROR: ${msg}`);
              channel.appendLine("Continuing with baseline-only results.");
              channel.appendLine("");
            }
          }

          // Publish diagnostics
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
  );

  context.subscriptions.push(
    channel,
    diagnostics,
    helloDisposable,
    selectModelDisposable,
    analyseDisposable
  );
}

export function deactivate() {}

/**
 * Fetch model names from Ollama /api/tags
 */
async function ollamaListModels(host: string): Promise<string[]> {
  const base = host.replace(/\/$/, "");
  const url = `${base}/api/tags`;

  const res = await fetch(url, { method: "GET" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Ollama tags failed (HTTP ${res.status}): ${body || res.statusText}`);
  }

  const data = (await res.json()) as OllamaTagsResponse;
  return (data.models ?? []).map((m) => m.name).filter(Boolean).sort();
}

async function ollamaGenerate(host: string, model: string, prompt: string): Promise<string> {
  const base = host.replace(/\/$/, "");
  const url = `${base}/api/generate`;

  const controller = new AbortController();
  const timeoutMs = 300_000; // 5 minutes (qwen3-coder:30b can take 2–3 min)
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        prompt,
        stream: false
        // Optional if supported: format: "json"
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Ollama generate failed (HTTP ${res.status}): ${body || res.statusText}`);
    }

    const data = (await res.json()) as OllamaGenerateResponse;
    return (data.response ?? "").trim();
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error(`Ollama request timed out after ${timeoutMs}ms.`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * RAG retrieve
 */
async function ragRetrieve(endpoint: string, query: string, topK: number): Promise<RagRetrieveResponse> {
  const base = endpoint.replace(/\/$/, "");
  const url = `${base}/retrieve`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, top_k: topK }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`RAG retrieve failed (HTTP ${res.status}): ${body || res.statusText}`);
  }

  return (await res.json()) as RagRetrieveResponse;
}

function buildRagQuery(languageId: string, code: string): string {
  const lower = code.toLowerCase();
  const hints: string[] = [];

  if (languageId === "html") {
    hints.push("HTML accessibility");
    if (lower.includes("<img")) hints.push("alt text non-text content WCAG 1.1.1");
    if (lower.includes("<form") || lower.includes("<input") || lower.includes("<label"))
      hints.push("forms labels instructions errors WCAG 1.3.1 3.3.x");
    if (lower.includes("aria-")) hints.push("ARIA usage do and dont");
    if (lower.includes("button") || lower.includes("onclick")) hints.push("keyboard navigation focus");
    if (lower.includes("<nav") || lower.includes("menu")) hints.push("navigation landmarks");
  } else {
    hints.push(`${languageId} accessibility best practices`);
  }

  return hints.join(", ");
}

function formatRagContext(chunks: RagChunk[]): string {
  if (!chunks.length) return "(no context retrieved)";

  return chunks
    .map((c, idx) => {
      const trimmed = c.text.length > 500 ? c.text.slice(0, 500) + "…" : c.text;
      return `[#${idx + 1}] id=${c.id}\nsource=${c.source}\n${trimmed}`;
    })
    .join("\n\n");
}

function buildAiPrompt(languageId: string, code: string, contextBlock: string): string {
  return [
    "You are an expert accessibility auditor.",
    "Use the provided CONTEXT (retrieved from my curated knowledge base) as the primary reference.",
    "Identify accessibility issues in the CODE and propose concrete fixes.",
    "",
    "Return ONLY valid JSON (no markdown, no extra text) in this schema:",
    "{",
    '  "issues": [',
    "    {",
    '      "severity": "low|med|high",',
    '      "title": "short title",',
    '      "explanation": "1-2 sentences",',
    '      "fix": "concrete fix",',
    '      "lineHint": 123,',
    '      "evidence": { "contextIds": ["<id from CONTEXT>"] }',
    "    }",
    "  ]",
    "}",
    "",
    `Language: ${languageId}`,
    "",
    "CONTEXT:",
    contextBlock,
    "",
    "CODE:",
    "```",
    code.slice(0, 12000),
    "```",
  ].join("\n");
}

function extractFirstJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return valid JSON.");
  }
  return text.slice(start, end + 1);
}

function aiIssueToDiagnostic(doc: vscode.TextDocument, issue: AiIssue): vscode.Diagnostic {
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

  const message = `${issue.title}\n${issue.explanation}\nFix: ${issue.fix}\n${evidence}`;

  const d = new vscode.Diagnostic(range, message, severity);
  d.source = "AI Accessibility Assistant (RAG+Ollama)";
  return d;
}

function bestEffortRange(doc: vscode.TextDocument, lineHint?: number): vscode.Range {
  if (lineHint && lineHint > 0 && lineHint <= doc.lineCount) {
    const line = doc.lineAt(lineHint - 1);
    return new vscode.Range(line.range.start, line.range.end);
  }
  const first = doc.lineAt(0);
  return new vscode.Range(first.range.start, first.range.end);
}

/**
 * HTML baseline check: <img> without alt
 */
function findImgMissingAlt(doc: vscode.TextDocument): vscode.Diagnostic[] {
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

/**
 * HTML baseline check: <input> missing id OR no matching <label for="...">
 */
function findInputsMissingLabel(doc: vscode.TextDocument): vscode.Diagnostic[] {
  const diags: vscode.Diagnostic[] = [];
  const text = doc.getText();
  const inputRegex = /<input\b[^>]*>/gi;

  let match: RegExpExecArray | null;
  while ((match = inputRegex.exec(text)) !== null) {
    const tag = match[0];

    const typeMatch = tag.match(/\btype\s*=\s*["']([^"']+)["']/i);
    const typeValue = typeMatch?.[1]?.trim().toLowerCase();
    if (typeValue === "hidden") continue;

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

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
