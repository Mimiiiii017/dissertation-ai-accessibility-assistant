// selectModelPanel.ts — model selection logic for the webview panel
// Exports two helpers:
//   fetchModels  – list available Ollama models and push them to the webview
//   applyModel   – persist the choice, update the badge, and warm up
// Used by: webview/AccessibilityPanel.ts

import * as vscode from "vscode";
import { ollamaListModels, ollamaWarmup } from "../utils/ollama";
import { getExtensionConfig } from "../utils/config";
import type { PanelLogger } from "../webview/panelLogger";

/**
 * Fetch the list of models from Ollama and send them to the webview
 * so the dropdown can be populated.
 */
export async function fetchModelsForPanel(logger: PanelLogger): Promise<void> {
  const { ollamaHost, model: currentModel } = getExtensionConfig();

  try {
    const models = await ollamaListModels(ollamaHost);
    logger.postMessage({
      type: "setModels",
      models,
      current: currentModel || "",
    });
  } catch (e: any) {
    logger.log(`Failed to fetch models: ${String(e?.message ?? e)}`);
    logger.postMessage({ type: "setModels", models: [], current: "" });
  }
}

/**
 * Persist a model choice, update the badge, and warm the model up.
 * Called when the user picks a model from the webview dropdown.
 */
export async function applyModelForPanel(
  logger: PanelLogger,
  model: string
): Promise<void> {
  const { ollamaHost } = getExtensionConfig();

  await vscode.workspace
    .getConfiguration("aiAccessibilityAssistant")
    .update("model", model, vscode.ConfigurationTarget.Global);

  logger.postMessage({ type: "setModel", model });
  logger.log(`Model set to: ${model}`);

  logger.log("Warming up model…");
  await ollamaWarmup(ollamaHost, model).catch(() => {});
  logger.log("Model ready.");
}
