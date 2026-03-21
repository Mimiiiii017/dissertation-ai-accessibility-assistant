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

/**
 * Additional anti-FP rules injected into every language run.
 *
 * These cover real LLM misconceptions NOT already handled by the extension
 * prompt's Rules 1–10. The extension already handles: redundant ARIA roles
 * (Rule 5), color contrast without both values (Rule 4), aria-hidden on
 * decorative content (Rule 8), lang attribute scope (Rule 9).
 *
 * These rules apply across HTML, TSX, JSX and any language that uses
 * HTML-like syntax or ARIA attributes.
 */
const ANTI_FP_SUPPLEMENT = `
ADDITIONAL ANTI-HALLUCINATION RULES (supplement to the rules above):

[i]  href="#" is a VALID href value. Do NOT flag it as "invalid href", "empty href", or a link-vs-button violation. Only flag an <a> as misused when it has NO href attribute at all.

[ii] target="_blank" is NOT a WCAG 2.2 failure. Do not report it as an accessibility issue.

[iii] autocomplete compound values are VALID per WHATWG spec. The pattern "<contact-type> <field-name>" is explicitly allowed — e.g. "work email", "home tel", "mobile url". Do not flag these as invalid tokens. If you are not certain an autocomplete value is invalid, do NOT report it.

[iv] Only flag a <fieldset> as "missing legend" when there is genuinely NO <legend> element as a direct child. If a <legend> exists inside the fieldset, do NOT report it as missing.

[v]  Do NOT flag missing aria-required on a native <input>, <select>, or <textarea> that already has the HTML required attribute. Assistive technologies map HTML required to aria-required automatically.
`;

/**
 * Mandatory element sweeps for HTML — injected before the RAG context block.
 *
 * Framed as scanning algorithms ("for every X, check if Y") not checklists,
 * so models look for the condition rather than assume it exists.
 * Each sweep only produces an issue if the problematic condition is literally
 * present in the code.
 */
const HTML_MANDATORY_SWEEPS = `
MANDATORY ELEMENT SWEEPS — run these before writing any output:

SWEEP A — Links with no accessible name or non-descriptive text:
  For every <a> element, compute its accessible name in priority order:
  1. aria-label on the <a> → name.
  2. aria-labelledby on the <a> → name from referenced element.
  3. Visible text inside the <a> that is NOT hidden by aria-hidden → name.
  Child elements with aria-hidden="true" are invisible to screen readers and contribute NOTHING to the accessible name. <img alt=""> as the sole content also contributes nothing.
  If steps 1–3 all yield nothing → report "missing accessible name on link" (HIGH).
  If the only visible text is "click here", "here", "read more", "learn more", or "more" → report "non-descriptive link text" (MEDIUM).
  Skip any <a> that has an aria-label, adequate visible text, or aria-labelledby.

SWEEP B — Buttons with no accessible name:
  For every <button>, compute its accessible name:
  1. aria-label on the button → name.
  2. aria-labelledby → name.
  3. Visible text inside (including <span class="sr-only">) → name.
  4. title attribute → name.
  Child elements with aria-hidden="true" or <svg aria-hidden="true"> contribute NOTHING.
  If NONE of 1–4 apply → report "missing accessible name on button" (HIGH).
  Do NOT report buttons that satisfy any of 1–4.

SWEEP C — Table headers without scope:
  For every <th>: if it has no scope attribute → report "table header missing scope" (MEDIUM).
  Only report for <th> elements that literally lack a scope attribute.

SWEEP D — Heading level skips:
  List headings (h1–h6) in document order. A skip is when the level jumps by 2 or more (h2→h4, h2→h5, h3→h5, etc.) with no intermediate level between them.
  For each skip → report "heading level skip" naming both levels (MEDIUM).

SWEEP E — Form inputs without labels:
  For every <input> (excluding type hidden/submit/button/reset/image), <select>, <textarea>:
  A label exists if ANY of: (1) <label for="..."> matching its id, (2) wrapped in <label>, (3) aria-label on the element, (4) aria-labelledby on the element.
  If NONE of 1–4 → report "form control missing accessible label" (HIGH).

SWEEP F — Images missing alt attribute:
  For every <img> anywhere in the document: if the alt attribute is completely absent (not even alt="") → report "image missing alt attribute" (HIGH).
  alt="" is valid for decorative images. Only report when the attribute itself is absent.
`;

import { buildAiPrompt as _buildAiPrompt } from '../../extension/ai-accessibility-assistant/src/utils/prompts/prompt';

// The extension's Rule 1 says GROUPING; the benchmark system prompt says ONE PER ELEMENT.
// Both end up in the same conversation — that contradiction confuses models.
// Replace Rule 1 in the user prompt to match the system prompt instruction.
const GROUPING_RULE_TEXT =
  '1. GROUPING — same problem type on multiple lines = ONE block listing all line numbers. This applies even if the lines are far apart or have different content. Four progress bars missing the same ARIA attributes = ONE issue, not four.';
const ONE_PER_ELEMENT_RULE_TEXT =
  '1. ONE ISSUE PER ELEMENT — write a SEPARATE Issue block for each individual element that has a problem. Do NOT combine elements into one block. Four images each missing alt text → four separate Issue blocks, one per image.';

/**
 * Benchmark wrapper around the extension's buildAiPrompt.
 *
 * Changes from the extension version:
 * - Replaces Rule 1 GROUPING → ONE ISSUE PER ELEMENT (matches BENCHMARK_SYSTEM_PROMPT)
 * - Strips /no_think so reasoning-capable models (Qwen3, kimi, DeepSeek) can use
 *   chain-of-thought for complex ARIA issues. The parser strips <think> tags.
 * - Injects ANTI_FP_SUPPLEMENT (universal spec facts) before the RAG context.
 * - Injects HTML_MANDATORY_SWEEPS additionally for HTML runs.
 *
 * The extension's existing Rules 2–10, WHAT TO CHECK, and lang-specific rules
 * are preserved in full.
 */
export function buildAiPrompt(languageId: string, code: string, contextBlock: string): string {
  const lang = languageId.toLowerCase();

  let base = _buildAiPrompt(languageId, code, contextBlock)
    .replace(GROUPING_RULE_TEXT, ONE_PER_ELEMENT_RULE_TEXT)  // fix Rule 1 contradiction
    .replace(/\n+\/no_think\s*$/, '');                        // allow reasoning models to think

  if (lang === 'html') {
    const injection = `${ANTI_FP_SUPPLEMENT.trim()}\n\n${HTML_MANDATORY_SWEEPS.trim()}`;
    return base.replace('WCAG REFERENCE CONTEXT:', `${injection}\n\nWCAG REFERENCE CONTEXT:`);
  }

  // All other languages: anti-FP supplement only (no HTML element sweeps)
  return base.replace('WCAG REFERENCE CONTEXT:', `${ANTI_FP_SUPPLEMENT.trim()}\n\nWCAG REFERENCE CONTEXT:`);
}