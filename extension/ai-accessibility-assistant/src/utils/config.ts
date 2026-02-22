// config.ts — reads and centralises all VS Code workspace settings for the extension
// Reads and normalises all VS Code workspace settings for this extension.
// Used by: commands/analyzeFile.ts, commands/selectModel.ts
//
// Centralising config here means default values and URL normalisation only
// need to be changed in one place.

import * as vscode from "vscode";

export interface ExtensionConfig {
  ollamaHost: string;  // Base URL of the local Ollama server
  model: string;       // Currently selected Ollama model name (empty = not set)
  ragEndpoint: string; // Base URL of the RAG retrieval service
}

// Read every setting the extension uses and strip trailing slashes from URLs.
export function getExtensionConfig(): ExtensionConfig {
  const cfg = vscode.workspace.getConfiguration("aiAccessibilityAssistant");
  return {
    ollamaHost:   String(cfg.get("ollamaHost",   "http://localhost:11434")).replace(/\/$/, ""),
    model:        String(cfg.get("model",        "")),
    ragEndpoint:  String(cfg.get("ragEndpoint",  "http://127.0.0.1:8000")).replace(/\/$/, ""),
  };
}
