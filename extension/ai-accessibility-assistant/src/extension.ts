import * as vscode from "vscode";
import { selectModelCommand } from "./commands/selectModel";
import { analyzeFileCommand } from "./commands/analyzeFile";

export function activate(context: vscode.ExtensionContext) {
  const channel = vscode.window.createOutputChannel("AI Accessibility Assistant");
  const diagnostics = vscode.languages.createDiagnosticCollection("ai-accessibility-assistant");

  channel.appendLine("AI Accessibility Assistant activated.");

  const selectModelDisposable = vscode.commands.registerCommand(
    "ai-accessibility-assistant.selectModel",
    () => selectModelCommand(channel)
  );

  const analyseDisposable = vscode.commands.registerCommand(
    "ai-accessibility-assistant.analyseFile",
    () => analyzeFileCommand(channel, diagnostics)
  );

  context.subscriptions.push(channel, diagnostics, selectModelDisposable, analyseDisposable);
}

export function deactivate() {}
