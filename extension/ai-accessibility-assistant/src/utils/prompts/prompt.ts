// prompt.ts — builds the instruction text that tells the model what to look for and how to respond
// Builds the prompts sent to the Ollama model.
// SYSTEM_PROMPT defines the model's role and strict output format.
// buildAiPrompt assembles the full user message with the code excerpt and
// retrieved RAG context.
// Used by: commands/analyzeFile.ts

// System message that locks the model into the accessibility auditor role
export const SYSTEM_PROMPT = `You are a senior WCAG 2.2 accessibility auditor. Scan the ENTIRE code first, then output Issue blocks and nothing else — no prose, no commentary, no markdown, no JSON.

#1 MOST IMPORTANT RULE — GROUPING:
If the SAME type of problem appears on multiple lines, you MUST write ONE single Issue block listing all affected line numbers. NEVER write a separate Issue block for each line. Example: four progress bars all missing role="progressbar" → ONE Issue block with "Line: 85, 101, 111, 121", not four separate blocks.

CORE RULES:
- Read every line before writing any output.
- Only report issues for elements that LITERALLY exist in the code. If an attribute is already present, do NOT report it missing.
- Output issue blocks only. No text before Issue 1, between blocks, or after the last block.`;

// Returns language-specific rules to append to the main rule set.
// Keeps the HTML prompt lean while giving proper coverage to every other language.
function getLangSpecificRules(languageId: string): string {
  const lang = languageId.toLowerCase();

  if (lang === "css" || lang === "scss" || lang === "sass" || lang === "less") {
    return `
CSS-SPECIFIC RULES:
11. If outline: none or outline: 0 appears on a selector, flag it as removing focus indicators UNLESS a visible :focus-visible alternative is defined in the same file.
12. Report missing prefers-reduced-motion if @keyframes or transition with a non-zero duration appear without a @media (prefers-reduced-motion: reduce) override that disables or slows the animation.
13. Do NOT report color contrast unless both foreground AND background color values are literally present on the same CSS selector.
14. If font-size is set below 16px (1rem) for body text, flag it as a readability concern.`;
  }

  if (lang === "javascript" || lang === "typescript") {
    return `
JS/TS-SPECIFIC RULES:
11. addEventListener("click") or onclick on a non-<button>/<a> DOM element must also have a keydown/keyup handler for Enter and Space — report if the keyboard handler is missing.
12. Content injected via innerHTML or insertAdjacentHTML that changes visible page state must update an ARIA live region (role="status" or aria-live) to announce the change — report if none exists nearby.
13. setTimeout/setInterval that auto-changes visible content without a user-controllable pause/stop mechanism = WCAG 2.2.1 timing issue.
14. Programmatic focus() on modal/dialog open is required; focus must return to the trigger element on close — report if either is missing.`;
  }

  if (lang === "javascriptreact" || lang === "typescriptreact") {
    return `
REACT/JSX-SPECIFIC RULES:
11. onClick on a <div>, <span>, or other non-interactive JSX element must be accompanied by role="button" (or appropriate role), tabIndex={0}, and an onKeyDown handler covering Enter and Space — report any missing piece as a single grouped issue.
12. <img> JSX element without an alt prop = HIGH severity. alt="" is valid for decorative images; omitting alt entirely is not.
13. <label> must use htmlFor (not the HTML "for" attribute) — report if for= appears in JSX.
14. After a useState/setState update that causes important new content to appear, check for an aria-live region to announce the change to screen reader users.
15. Conditional rendering with && or ternary that removes a focused element from the DOM will lose focus — prefer aria-hidden or visibility for components that manage focus.`;
  }

  if (lang === "vue") {
    return `
VUE-SPECIFIC RULES:
11. @click on a non-<button>/non-<a> element must have role, tabindex="0", @keydown.enter, and @keydown.space — report any missing piece as a single grouped issue.
12. v-show hides via CSS display:none but does NOT set aria-hidden — if the hidden content must be invisible to assistive technology too, add :aria-hidden="!isVisible" alongside v-show.
13. <img> without :alt or a static alt attribute = missing alt text (HIGH).
14. <transition> or <transition-group> with visible animation: check that the accompanying CSS has a @media (prefers-reduced-motion: reduce) override — report if absent.
15. v-for list items that are interactive must each have a unique accessible name and be keyboard-reachable.`;
  }

  if (
    lang.includes("angular") ||
    languageId.includes("@Component") ||
    languageId.includes("*ngIf")
  ) {
    return `
ANGULAR-SPECIFIC RULES:
11. (click) binding on a <div>/<span> without [attr.role] and a (keydown) handler = keyboard inaccessibility — report as grouped issue if multiple elements affected.
12. *ngIf that shows/hides a component which manages focus: require CDK FocusTrap or explicit return-focus logic — report if neither is present.
13. Reactive form controls (<input>, <select>, <textarea>) without an associated <label [for]> or [attr.aria-label] = form labelling issue.
14. Error messages displayed via *ngIf must have role="alert" or aria-live="assertive" to be announced automatically.
15. MatDialog / CdkDialog opened without cdkFocusInitial or FocusTrap = focus not managed on open.`;
  }

  // HTML or unrecognised — main rules already cover it
  return "";
}

// Returns extra WHAT TO CHECK items relevant only to specific languages.
function getLangSpecificChecks(languageId: string): string {
  const lang = languageId.toLowerCase();

  if (lang === "css" || lang === "scss" || lang === "sass" || lang === "less") {
    return `
- Focus indicators: outline: none/0 without :focus-visible alternative
- Reduced motion: @keyframes or transitions without @media (prefers-reduced-motion: reduce) guard
- Text spacing: font-size below 16px on body selectors; line-height below 1.5
- High contrast / forced-colors: forced-colors media query support`;
  }

  if (lang === "javascript" || lang === "typescript") {
    return `
- Click/mouse handlers on non-native elements without matching keyboard (keydown Enter/Space)
- innerHTML / insertAdjacentHTML without adjacent ARIA live region for dynamic announcements
- setTimeout/setInterval changing visible content without pause/stop control
- focus() on modal open; focus return on modal close`;
  }

  if (lang === "javascriptreact" || lang === "typescriptreact") {
    return `
- onClick on non-interactive JSX elements: role + tabIndex={0} + onKeyDown required
- <img> missing alt prop (HIGH); <input> missing associated <label> or aria-label
- htmlFor on <label> (not "for"); aria-live regions for dynamic state changes
- Conditional rendering (&&, ternary) removing focused elements from DOM
- useRef + focus() for modal open/close lifecycle`;
  }

  if (lang === "vue") {
    return `
- @click on non-button/non-anchor elements: role + tabindex + @keydown.enter + @keydown.space
- v-show used without :aria-hidden counterpart for AT visibility
- <img> missing :alt or static alt; <input> missing associated label
- <transition>/<transition-group> without prefers-reduced-motion CSS guard
- v-for interactive items: accessible name uniqueness and keyboard reachability`;
  }

  if (
    lang.includes("angular") ||
    languageId.includes("@Component") ||
    languageId.includes("*ngIf")
  ) {
    return `
- (click) on <div>/<span> without [attr.role] + (keydown) keyboard handler
- *ngIf focus loss: CDK FocusTrap or explicit focus-return on hide
- Reactive form controls without <label [for]> or [attr.aria-label]
- Error messages via *ngIf without role="alert" or aria-live="assertive"
- MatDialog / CdkDialog without cdkFocusInitial or FocusTrap`;
  }

  return "";
}

// Build the user prompt with the code to analyze
export function buildAiPrompt(languageId: string, code: string, contextBlock: string): string {
  const langRules = getLangSpecificRules(languageId);
  const langChecks = getLangSpecificChecks(languageId);

  return `Perform a thorough WCAG 2.2 accessibility audit of the ${languageId} code below.

OUTPUT FORMAT — use this structure exactly for every issue:

Issue 1: <short title>
  Severity: <HIGH | MEDIUM | LOW>
  Line: <line number(s), comma-separated if same issue on multiple lines>
  Problem: <2–4 sentences: what is wrong and who is affected>
  Fix: <exact corrected code to paste in; if same issue on multiple lines, show each: "Line N: <code>">

SEVERITY:
- HIGH   = blocks access entirely (WCAG A failure)
- MEDIUM = significantly degrades experience (WCAG AA failure)
- LOW    = best-practice gap (WCAG AAA or minor barrier)

RULES:
1. GROUPING — same problem type on multiple lines = ONE block listing all line numbers. This applies even if the lines are far apart or have different content. Four progress bars missing the same ARIA attributes = ONE issue, not four.
2. Fix must show exact corrected code for every affected line (format: "Line N: <code>").
3. Skip any category with no matching elements in this code. Do not write "N/A".
4. Do NOT report colour contrast unless both foreground AND background colours are explicitly written inline in this file. Never guess from class names or external CSS.
5. Do NOT suggest redundant ARIA roles that duplicate native HTML semantics (role="banner" on <header>, role="navigation" on <nav>, etc.).
6. For <a> elements: (a) if an <a> has NO accessible name (no text content, no aria-label, no title, no aria-labelledby) = "missing accessible name" — fix by adding visible text or aria-label; (b) if an <a> HAS visible text content but NO href attribute = "missing href" — fix must add href, NOT add aria-label (the accessible name is already present). Never report the same <a> element for both issues.
7. <div>/<span> with style="width: X%" used as a progress bar must have role="progressbar" aria-valuenow aria-valuemin aria-valuemax — report ALL such elements in ONE block.
8. Only add aria-hidden="true" to purely decorative content. Never hide numbers, labels, status text, or any content that conveys information. If an <img> already has an alt attribute (even alt=""), do NOT suggest adding aria-label — alt fully provides the accessible name for images and is not missing.
9. lang: ONLY report a lang issue if lang is completely absent, or if the majority of visible body text sentences are in a different language. A brand name, site title, or single word in another language does NOT qualify — do not report it.
10. Fix must be in the same language as the audited file. If the fix requires an external file, write "(fix requires changes in external stylesheet/script)" in the Fix field.
${langRules}

WHAT TO CHECK — only for elements that actually appear in the code:
- Images: alt text on <img>, <svg> with title/aria-label, empty <figure>
- Forms: labels for inputs, error messages, required fields, autocomplete
- Keyboard: interactive elements reachable by keyboard, focus indicators, tabindex misuse, non-native interactive elements missing role/keyboard handler
- Structure: page lang, heading hierarchy, landmark regions, skip links
- ARIA: correct roles/states/properties; live regions; no redundant roles; dialogs need aria-modal and focus management
- Links & buttons: empty <a>, <a> without href, <button> misused as link, <div>/<span> used as interactive without role and keyboard support
- Tables: <th> with scope, <caption>, headers on complex tables
- Media: captions on <video>/<audio>, no autoplay without controls
- Progress & status: <div>/<span> progress bars without role="progressbar"/aria-valuenow/min/max; status indicators without role="status"
- Motion & animation: CSS animation/transition/@keyframes without prefers-reduced-motion; autoplay carousels without pause control
- Timing: setTimeout/setInterval/meta refresh without user control or warning
- Touch & pointer: drag operations without single-pointer alternative; target size below 24×24 px when explicit width/height is set inline${langChecks}

WCAG REFERENCE CONTEXT:
${contextBlock}

CODE TO AUDIT (${languageId}):
${code}

/no_think`;
}
