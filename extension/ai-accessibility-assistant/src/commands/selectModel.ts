// selectModel.ts — lets the user pick an Ollama model and saves it to workspace settings
// Implements the "Select Model" command — shows a quick-pick list of all
// Ollama models available on the configured host and saves the user's choice
// to the workspace settings. Also warms up the chosen model so it is ready
// for the first analysis run.
// Used by: extension.ts

import * as vscode from "vscode";
import { ollamaListModels, ollamaWarmup } from "../utils/ollama";
import { getExtensionConfig } from "../utils/config";

// Let user pick which Ollama model to use for analysis
export async function selectModelCommand(channel: vscode.OutputChannel): Promise<void> {
  const { ollamaHost } = getExtensionConfig();

  channel.show(true);
  channel.appendLine(`Fetching Ollama models from: ${ollamaHost}/api/tags`);

  try {
    // Fetch available models from Ollama
    const models = await ollamaListModels(ollamaHost);

    if (models.length === 0) {
      vscode.window.showWarningMessage("No Ollama models found on this host.");
      channel.appendLine("No models returned by Ollama.");
      return;
    }

    // Show model picker with current selection
    const { model: currentModel } = getExtensionConfig();
    const picked = await vscode.window.showQuickPick(models, {
      title: "Select Ollama Model",
      placeHolder: currentModel ? `Current: ${currentModel}` : "Choose a model for analysis",
      canPickMany: false,
    });

    if (picked) {
      // Save selection to workspace config
      await vscode.workspace.getConfiguration("aiAccessibilityAssistant").update("model", picked, vscode.ConfigurationTarget.Global);
      channel.appendLine(`Model set to: ${picked}`);
      vscode.window.showInformationMessage(`Ollama model set to: ${picked}`);
      
      // Preload the model into memory so first analysis is faster
      channel.appendLine("Warming up model...");
      await ollamaWarmup(ollamaHost, picked).catch(() => {
        // Warmup failed, but continue anyway
      });
      channel.appendLine("Model ready.");
    }
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    channel.appendLine(`ERROR fetching models: ${msg}`);
    vscode.window.showErrorMessage("Failed to fetch Ollama models. See Output for details.");
  }
}
