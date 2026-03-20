/**
 * benchmark-prompt.ts  —  Cloud-LLM-Preliminary
 *
 * Benchmark-local override of the extension's SYSTEM_PROMPT.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The extension prompt contains a GROUPING rule that collapses every instance
 * of the "same" problem type into one Issue block.  The preset-benchmark
 * scorer is "first-wins": one grouped block can only ever match ONE expected
 * concept, turning all remaining sibling concepts into FN.
 *
 * Example: five images missing alt → one grouped block → matches ONE of the
 * five ground-truth concepts → four become FN → recall collapses.
 *
 * This prompt replaces the grouping rule with the opposite instruction:
 * write a SEPARATE block for every individual element that has a problem.
 * Everything else (format, severity, rules 2–10) is kept identical.
 *
 * The extension prompt is NOT modified — this file is benchmark-only.
 */

export const BENCHMARK_SYSTEM_PROMPT = `You are a senior WCAG 2.2 accessibility auditor. Scan the ENTIRE code first, then output Issue blocks and nothing else — no prose, no commentary, no markdown, no JSON.

#1 MOST IMPORTANT RULE — ONE ISSUE PER ELEMENT:
Write a SEPARATE Issue block for each individual element that has a problem.
Do NOT group multiple elements into one block.
Example: four images each missing alt text → FOUR separate Issue blocks, one per image, each identifying the specific element (by line number, id, class, src, or surrounding context).
This is required so every distinct violation can be traced back to its specific element.

CORE RULES:
- Read every line before writing any output.
- Only report issues for elements that LITERALLY exist in the code. If an attribute is already present, do NOT report it missing.
- Output issue blocks only. No text before Issue 1, between blocks, or after the last block.`;

// Re-export buildAiPrompt from the extension prompt unchanged —
// only BENCHMARK_SYSTEM_PROMPT is overridden here.
export { buildAiPrompt } from '../../extension/ai-accessibility-assistant/src/utils/prompts/prompt';
