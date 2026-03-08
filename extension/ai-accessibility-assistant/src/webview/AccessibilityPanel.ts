// AccessibilityPanel.ts — sidebar webview panel that hosts the extension's UI
// Thin shell that wires the webview to the command handlers.
// All analysis logic lives in commands/analysePanel.ts.
// All profile-selection logic lives in commands/selectModelPanel.ts.
// Used by: extension.ts

import * as vscode from "vscode";
import { analyseFileForPanel } from "../commands/analysePanel";
import { analyseFileForTlx } from "../commands/tlxPanel";
import { fetchPresetsForPanel, applyPresetForPanel } from "../commands/selectModelPanel";
import { FIXED_MODEL } from "../utils/llm/ollama";
import type { PanelLogger } from "./panelLogger";

export const VIEW_ID = "aiAccessibilityAssistant.panel";

export class AccessibilityPanelProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _diagnostics: vscode.DiagnosticCollection;
  private _isAnalysing = false;
  private _isTlxAnalysing = false;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    diagnostics: vscode.DiagnosticCollection
  ) {
    this._diagnostics = diagnostics;
  }

  // WebviewViewProvider

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtml();

    // Populate the profile preset dropdown as soon as the panel is ready
    this._sendPresets();

    webviewView.webview.onDidReceiveMessage(async (msg) => {
      switch (msg.type) {
        case "analyseFile":   await this._runAnalysis(); break;
        case "tlxFile":       await this._runTlxAnalysis(); break;
        case "selectPreset":  await this._applyPreset(msg.preset); break;
        case "refreshPresets": await this._sendPresets(); break;
        case "clear":         break; // handled client-side
      }
    });
  }

  // Public API (command palette)

  public async analyseFromCommand(): Promise<void> {
    this._view?.show?.(true);
    await this._runAnalysis();
  }

  public async tlxFromCommand(): Promise<void> {
    this._view?.show?.(true);
    await this._runTlxAnalysis();
  }

  public async selectProfileFromCommand(): Promise<void> {
    this._view?.show?.(true);
    await this._sendPresets();
  }

  // Private wrappers

  private async _runAnalysis(): Promise<void> {
    if (this._isAnalysing) {
      vscode.window.showWarningMessage("Analysis already in progress.");
      return;
    }
    this._isAnalysing = true;
    this._postMessage({ type: "analysisStart" });
    try {
      await analyseFileForPanel(this._logger(), this._diagnostics);
    } finally {
      this._isAnalysing = false;
      this._postMessage({ type: "analysisEnd" });
    }
  }

  private async _runTlxAnalysis(): Promise<void> {
    if (this._isTlxAnalysing) {
      vscode.window.showWarningMessage("TLX analysis already in progress.");
      return;
    }
    this._isTlxAnalysing = true;
    this._postMessage({ type: "tlxStart" });
    try {
      await analyseFileForTlx(this._logger());
    } finally {
      this._isTlxAnalysing = false;
      this._postMessage({ type: "tlxEnd" });
    }
  }

  private async _sendPresets(): Promise<void> {
    await fetchPresetsForPanel(this._logger());
  }

  private async _applyPreset(preset: string): Promise<void> {
    if (!preset) { return; }
    await applyPresetForPanel(this._logger(), preset);
  }

  // Logger factory

  private _logger(): PanelLogger {
    return {
      log: (text) => this._postMessage({ type: "log", text }),
      streamChunk: (text) => this._postMessage({ type: "stream", text }),
      postMessage: (msg) => this._postMessage(msg),
    };
  }

  private _postMessage(msg: Record<string, unknown>): void {
    this._view?.webview.postMessage(msg);
  }

  // Webview HTML

  private _getHtml(): string {
    const webview = this._view!.webview;
    const mediaUri = vscode.Uri.joinPath(this._extensionUri, "media");

    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, "panel.css"));
    const jsUri  = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, "panel.js"));
    const nonce  = getNonce();

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
                 style-src ${webview.cspSource} https://fonts.googleapis.com;
                 font-src https://fonts.gstatic.com;
                 script-src 'nonce-${nonce}';" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="${cssUri}" />
</head>
<body>
  <div class="header">
    <div class="model-row">
      <select id="modelSelect" title="Select the analysis profile preset to use">
        <option value="" disabled selected>Loading presets…</option>
      </select>
      <span class="model-badge">
        <span class="dot"></span>
        <span id="modelName">${FIXED_MODEL}</span>
      </span>
    </div>
  </div>

  <div class="actions">
    <button id="btnAnalyse" title="Analyse the currently open file for accessibility issues">
      ▶  Analyse File
    </button>
    <button id="btnTlx" title="Analyze the file for NASA TLX cognitive workload">
      ▶  TLX Analysis
    </button>
  </div>

  <div class="toolbar">
    <button id="btnClear" title="Clear output">✕ Clear</button>
  </div>

  <div class="output-area" id="output">
  </div>

  <div class="status-bar">
    <span class="spinner" id="spinner"></span>
    <span id="statusText">Idle</span>
  </div>

  <script nonce="${nonce}" src="${jsUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}
