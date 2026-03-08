// selectModelPanel.ts — analysis profile selection logic for the webview panel
// Exports two helpers:
//   fetchPresetsForPanel – list available profile presets and push them to the webview
//   applyPresetForPanel  – persist the choice, update the badge, and warm up
// Used by: webview/AccessibilityPanel.ts

import * as vscode from "vscode";
import {
  FIXED_MODEL,
  getAnalysisPresetSummaries,
  ollamaWarmup,
  resolveAnalysisPreset,
} from "../utils/llm/ollama";
import { getExtensionConfig } from "../utils/config";
import type { PanelLogger } from "../webview/panelLogger";

/**
 * Send the list of analysis profile presets to the webview
 * so the dropdown can be populated.
 */
export async function fetchPresetsForPanel(logger: PanelLogger): Promise<void> {
  const { ollamaHost, analysisPreset } = getExtensionConfig();
  const currentPreset = resolveAnalysisPreset(analysisPreset);
  const presets = getAnalysisPresetSummaries();

  try {
    logger.postMessage({
      type: "setPresets",
      presets,
      current: currentPreset.id,
      fixedModel: FIXED_MODEL,
    });

    logger.log(`Using fixed model: ${FIXED_MODEL}`);
    logger.log(`Active profile preset: ${currentPreset.label}`);

    logger.log("Warming up fixed model…");
    await ollamaWarmup(ollamaHost, FIXED_MODEL).catch(() => {});
    logger.log("Model ready.");
  } catch (e: any) {
    logger.log(`Failed to set profile presets: ${String(e?.message ?? e)}`);
    logger.postMessage({
      type: "setPresets",
      presets: [],
      current: currentPreset.id,
      fixedModel: FIXED_MODEL,
    });
  }
}

/**
 * Persist a preset choice, update the panel, and warm the fixed model.
 * Called when the user picks a profile preset from the webview dropdown.
 */
export async function applyPresetForPanel(
  logger: PanelLogger,
  presetId: string
): Promise<void> {
  const { ollamaHost } = getExtensionConfig();
  const selectedPreset = resolveAnalysisPreset(presetId);

  await vscode.workspace
    .getConfiguration("aiAccessibilityAssistant")
    .update("analysisPreset", selectedPreset.id, vscode.ConfigurationTarget.Global);

  logger.postMessage({
    type: "setPreset",
    preset: selectedPreset.id,
    label: selectedPreset.label,
    fixedModel: FIXED_MODEL,
  });
  logger.log(`Profile preset set to: ${selectedPreset.label}`);
  logger.log(`Using fixed model: ${FIXED_MODEL}`);

  logger.log("Warming up fixed model…");
  await ollamaWarmup(ollamaHost, FIXED_MODEL).catch(() => {});
  logger.log("Model ready.");
}
