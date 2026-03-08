// config.ts — reads and centralises all VS Code workspace settings for the extension
// Reads and normalises all VS Code workspace settings for this extension.
// Used by: commands/analysePanel.ts, commands/tlxPanel.ts, commands/selectModelPanel.ts
//
// Centralising config here means default values and URL normalisation only
// need to be changed in one place.

import * as vscode from "vscode";

export interface ExtensionConfig {
  ollamaHost: string;     // Base URL of the Ollama server
  analysisPreset: string; // Selected analysis profile preset id
  ragEndpoint: string;    // Base URL of the RAG retrieval service
}

// Read every setting the extension uses and strip trailing slashes from URLs.
export function getExtensionConfig(): ExtensionConfig {
  const cfg = vscode.workspace.getConfiguration("aiAccessibilityAssistant");
  return {
    ollamaHost:      String(cfg.get("ollamaHost", "http://localhost:11434")).replace(/\/$/, ""),
    analysisPreset:  String(cfg.get("analysisPreset", "balanced")),
    ragEndpoint:     String(cfg.get("ragEndpoint", "http://127.0.0.1:8000")).replace(/\/$/, ""),
  };
}
