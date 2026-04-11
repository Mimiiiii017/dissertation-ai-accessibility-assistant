// prompt.ts — builds the instruction text that tells the model what to look for and how to respond
// Builds the prompts sent to the Ollama model.
// SYSTEM_PROMPT defines the model's role and strict output format.
// buildAiPrompt assembles the full user message with the code excerpt and
// retrieved RAG context.
// Used by: commands/analyzeFile.ts

// System message that locks the model into the accessibility auditor role
export const SYSTEM_PROMPT = `You are a senior WCAG 2.2 accessibility auditor. Your task has two strict phases. Output Issue blocks and nothing else — no prose, no commentary, no markdown, no JSON.

PHASE 1 — READ AND MAP (produce NO output during this phase):
Read every single line of the code from top to bottom. Build a complete internal inventory before drawing any conclusions:
  - Every element that carries an id attribute — record each id value exactly.
  - How many <nav>, <section>, and <aside> elements exist, and whether each has aria-label or aria-labelledby.
  - Every aria-labelledby / aria-describedby / aria-controls value — note the target id(s) so you can verify they exist.
  - Every interactive element: <a>, <button>, <input>, <select>, <textarea>, <img> — note existing accessible-name attributes.
  - Page structure: <html lang>, <title>, heading order (h1–h6), landmark elements.
  - Every <button> or role="button" element — note whether it has aria-controls or class/text suggesting it toggles content.
Do NOT write any output during Phase 1.

PHASE 2 — REPORT ISSUES (using your Phase 1 inventory):
Using the complete picture you built in Phase 1, report every violation you can confirm from the code. Never report something you did not observe.

CORE RULES:
- Only report issues for elements that LITERALLY exist in the code. If an attribute is already present, do NOT report it missing.
- CONFIDENCE GATE: Only report an issue if you can point to the exact element from your Phase 1 inventory. If you cannot name the specific element, skip it. Hedged language ("may be", "possibly", "it is likely") means skip.
- Output issue blocks only. No text before Issue 1, between blocks, or after the last block.`;

// Returns language-specific structured sweep instructions.
// Each language gets a dedicated Phase 1 inventory + sweep algorithms rather
// than a simple rule list, so the model has a concrete scanning procedure.
function getLangSpecificRules(languageId: string): string {
  const lang = languageId.toLowerCase();

  if (lang === "css" || lang === "scss" || lang === "sass" || lang === "less") {
    return `
MANDATORY CSS ACCESSIBILITY SWEEPS — run ALL sweeps CSS-A through CSS-H:

⚠ ACTIVATION MANDATE: You MUST execute all CSS-A through CSS-H sweeps regardless of whether supplementary guidance was retrieved. These sweeps operate solely on the CSS source code. After completing Phase 1, self-verify: a dense stylesheet typically contains 10 or more violations — if your inventory has zero outline:none selectors and zero undersized interactive elements, you have not fully read the file. Re-read from line 1 before proceeding.

PHASE 1 CSS — build this inventory before any sweep:
  • Every rule containing outline: none, outline: 0, or outline: transparent — record its selector. Include base component selectors, not just :focus/:focus-visible rules.
  • Every selector targeting a potentially interactive element (button, a, input, select, textarea, summary, [role="button"], [role="tab"], [role="menuitem"], or any project-specific class applied to clickable/focusable elements) that sets an explicit height, width, min-height, or min-width value in px.
  • Every @media (prefers-reduced-motion) block — which selectors it covers.
  • Every @media (forced-colors: active) block — whether it exists.
  • The sr-only / visually-hidden / screen-reader-text utility class (if present) — every property it sets.
  • Every word-spacing or letter-spacing value that is negative.
  • Every rule that sets text-decoration: none on a, a:link, or a:visited selectors.

SWEEP CSS-A — Focus indicator removed without replacement (HIGH):
  For every selector in your Phase 1 outline inventory — whether a base component selector (any project-specific class applied to buttons, links, inputs, navigation items, cards, icon buttons, or other interactive elements) OR a :focus / :focus-visible pseudo-class rule:
  Check whether that selector or a paired rule for the same base selector provides a visible alternative: box-shadow, border with a visually distinct colour, or a non-zero outline value.
  If no visible alternative exists → report “focus indicator removed without replacement on <selector>” (HIGH), one Issue block per selector.
  Do NOT skip base-class selectors that lack a :focus pseudo-class — a base rule setting outline: none removes the focus ring in ALL states including keyboard focus.
  ⚠ outline-offset alone is NOT a visible focus ring. Only skip if the same rule-block also contains box-shadow, a non-transparent border, or a non-zero outline value.
  Skip structural containers (div, p, section, article, ul, li) where keyboard focus is not expected.

SWEEP CSS-B — Touch target too small (MEDIUM):
  For every interactive-element selector in your size inventory: if the explicitly-set height, width, min-height, or min-width is below 24px → report “touch target below minimum size: <selector> <value>” (MEDIUM).
  If 24–43px → report “touch target may be below 44px recommended size: <selector>” (MEDIUM) unless surrounding margin/padding ≥8px compensates.
  Do NOT report elements that have no explicit size rule.

SWEEP CSS-C — Broken visually-hidden utility (HIGH):
  Inspect the sr-only / visually-hidden utility rule. Correct: position: absolute, 1px × 1px, clip/clip-path, no display: none or visibility: hidden.
  If it uses display: none or visibility: hidden → report “visually-hidden utility removes content from screen readers” (HIGH).

SWEEP CSS-D — Motion animation without prefers-reduced-motion override (MEDIUM):
  For every transition or animation causing spatial movement (transition: transform, animation: slide/fade/bounce, translate/scale/rotate): if no @media (prefers-reduced-motion: reduce) disables or overrides that selector → report (MEDIUM).
  Do NOT report opacity-only or colour-only transitions.

SWEEP CSS-E — Negative word-spacing (MEDIUM):
  If any rule sets word-spacing to a negative value → report “negative word-spacing impairs readability: <selector>” (MEDIUM).

SWEEP CSS-F — Colour contrast failure (HIGH):
  Only report when BOTH foreground AND background colour values are literally present in this file (hex, rgb(), or a custom property defined in this file). If either value must be estimated or assumed, skip. Contrast below 4.5:1 for normal text or 3:1 for large text (18px+ or 14px+ bold) → report (HIGH) with both values and ratio.

SWEEP CSS-G — No forced-colors/high-contrast support (MEDIUM):
  If the stylesheet sets colour or background-color on interactive elements AND there is NO @media (forced-colors: active) block → report (MEDIUM).

SWEEP CSS-H — Link underlines removed with no alternative (MEDIUM):
  If any rule removes underlines from body-text links (text-decoration: none on a, a:link, a:visited) AND no other non-colour visual differentiator (font-weight increase, border-bottom, background :hover highlight) is provided → report (MEDIUM), SC 1.4.1.

COMPLETION CHECK: verify you ran all sweeps CSS-A through CSS-H. A dense stylesheet yields 10+ issues. Each distinct selector in your outline or size inventory is a separate Issue block.
⚠ FALSE-POSITIVE CHECK: before reporting each issue, verify you can quote the exact CSS property and value from the source. Do not report inferred or estimated violations.`;
  }

  if (lang === "javascript" || lang === "typescript") {
    return `
MANDATORY JAVASCRIPT/TYPESCRIPT ARIA SWEEPS — run ALL sweeps JS-A through JS-G:

PHASE 1 JS — build this inventory before any sweep:
  • Every function whose name or body suggests toggling or showing/hiding content (look for toggle, open, close, expand, collapse, show, hide, activate, deactivate in function names or DOM operations). Does each call setAttribute('aria-expanded', ...) or assign .ariaExpanded?
  • Every button-like element reference in a toggle function. Does the function call setAttribute('aria-pressed', ...) or assign .ariaPressed?
  • Every block updating visible content in reaction to user input (innerHTML, textContent, insertAdjacentHTML, classList changes switching display/visibility): is there a companion aria-live region updated immediately after?
  • Every form validation function: does it setAttribute('aria-invalid', 'true') on invalid inputs and setAttribute('aria-invalid', 'false') (or removeAttribute) on valid inputs?
  • Every interactive widget (accordion, nav drawer, dropdown, combobox, modal) closed/hidden on initial page load: does any DOMContentLoaded/init function set aria-expanded="false" on its trigger?
  • Every element whose visibility is toggled dynamically (floating buttons, nav drawers, autocomplete lists, loading overlays, toasts): does the code that changes CSS display/visibility also update aria-hidden?

SWEEP JS-A — Toggle functions not updating aria-expanded (HIGH):
  For every toggle function that changes the visible state of a panel, menu, accordion, drawer, or suggestion list: if no setAttribute('aria-expanded', ...) or .ariaExpanded assignment exists → report (HIGH), naming the function and trigger element.

SWEEP JS-B — Toggle buttons not updating aria-pressed (HIGH):
  For every button cycling between two states (on/off, active/inactive, play/pause): if no setAttribute('aria-pressed', ...) or .ariaPressed assignment → report (HIGH).

SWEEP JS-C — Dynamic content updates not announced via live region (MEDIUM):
  For every code path that changes visible content in response to user action (result counts, status labels, mode labels, wizard step indicators) AND no aria-live region is written to immediately after → report (MEDIUM).

SWEEP JS-D — Form validation errors not reflected in aria-invalid (HIGH):
  For every validation function that marks an input invalid (error class, inserts error message): if no setAttribute('aria-invalid', 'true') → report (HIGH).
  If valid-state resets do not clear aria-invalid → report (MEDIUM).

SWEEP JS-E — aria-expanded not initialised at page load (MEDIUM):
  For every toggle widget closed/hidden on load: if no DOMContentLoaded/init code sets aria-expanded="false" on the trigger → report (MEDIUM).
  Also check: if the trigger has no aria-controls and the controlled region has an id → report “toggle trigger missing aria-controls” (MEDIUM).

SWEEP JS-F — Dynamically-hidden elements not removed from accessibility tree (MEDIUM):
  For every visibility-toggled element in your inventory: if the hide function does NOT also set aria-hidden="true", or the show function does not remove aria-hidden → report (MEDIUM).

SWEEP JS-G — User actions with no live-region announcement (MEDIUM):
  For every user-triggered action that updates visible content (filter, search, result count, mode change, accordion, nav open/close, wizard step, keyboard shortcut, floating element): if no aria-live region is written to after the action → report (MEDIUM).
  Skip: purely navigational actions (route changes) or actions that directly move keyboard focus to the new content.

SWEEP JS-EXTRA — Non-native interactive elements (HIGH):
  For every addEventListener('click') or onclick on a non-button/non-anchor DOM element: if no keydown/keyup handler covers Enter and Space → report (HIGH).
  Programmatic focus() on modal/dialog open is required; focus must return to the trigger element on close — report if either is missing.
  setTimeout/setInterval that auto-changes visible content without a user-controllable pause/stop → report (MEDIUM), SC 2.2.1.

COMPLETION CHECK: verify you ran all sweeps JS-A through JS-G plus JS-EXTRA. A high-density file yields 18–30 issues. Each unique function or element is a separate Issue block.`;
  }

  if (lang === "javascriptreact" || lang === "typescriptreact") {
    return `
MANDATORY TSX/JSX ARIA SWEEPS — run ALL sweeps TSX-A through TSX-J:

PHASE 1 TSX — build this inventory before any sweep:
  • Every component with a boolean state variable controlling a show/hide region (isOpen, isExpanded, isMenuOpen, showDropdown, open, expanded, visible, isDialogOpen, etc.). Does the trigger element receive aria-expanded={stateVar}?
  • Every <svg> or named icon component: does it have aria-hidden={true} or role="img" + aria-label?
  • Every form field component (<input>, <textarea>, <select>, or custom Input/TextInput): (a) label via <label htmlFor> or aria-label? (b) aria-invalid when in error state? (c) required or aria-required when required?
  • Every tab, filter button, card, or two-state toggle whose active state is tracked (isSelected, isActive, activeTab, selectedFilter, isChecked). Does the element receive aria-selected/aria-pressed/aria-checked?
  • Active navigation links — do they receive aria-current="page"?
  • Buttons with a loading state (isLoading, isSubmitting): do they receive aria-busy={isLoading}?
  • Spinner components rendered during loading: do they have aria-hidden={true}?
  • Every <section>, <nav>, <aside> appearing more than once — each needs aria-label or aria-labelledby.
  • Every <article> in a repeated card/grid context: needs aria-labelledby referencing the heading inside it.
  • Decorative overlays, backdrops, skeletons, and cloned/duplicate DOM elements: need aria-hidden={true}.
  • Named page-section components wrapping <section> or <nav>: needs aria-labelledby or aria-label.
  • Groups of related controls inside a section not covered by a nearby heading (CTA groups, trust-badge rows, action bars): need aria-label.

SWEEP TSX-A — Disclosure toggles missing aria-expanded (HIGH):
  For every boolean-controlled show/hide component: if trigger does NOT receive aria-expanded={stateVar} → report (HIGH), naming component, trigger element, and state variable.

SWEEP TSX-B — Decorative icons not hidden from AT (MEDIUM):
  For every <svg>/icon component inside an element that already has text content or aria-label: if no aria-hidden={true} → report (MEDIUM).
  Skip icon components that ARE the sole accessible name of their parent.

SWEEP TSX-C — Icon-only interactive elements missing accessible names (HIGH):
  For every button/link whose only content is an icon (no visible text, aria-label, aria-labelledby, or title) → report (HIGH).

SWEEP TSX-D — Form fields missing label, aria-invalid, or aria-required (HIGH):
  (1) No label → HIGH. (2) Error state, no aria-invalid → HIGH. (3) Required, no required/aria-required → HIGH. (4) Error message rendered, no aria-describedby link → MEDIUM.

SWEEP TSX-E — Interactive state not communicated to AT (HIGH):
  For every tab, filter button, card, or two-state toggle with tracked state: if no aria-selected/aria-pressed/aria-checked mirrors the state variable → report (HIGH).

SWEEP TSX-F — Landmark and card regions missing accessible names (MEDIUM):
  Repeated <section>/<nav>/<aside> without aria-label/aria-labelledby → report (MEDIUM).
  <article> in repeated card grid without aria-labelledby referencing a heading inside it → report (MEDIUM).

SWEEP TSX-G — Required-field markers not properly managed (MEDIUM):
  Required-field marker (<span>*</span>) without aria-hidden={true} → LOW.
  aria-hidden on marker but no required/aria-required on the field → HIGH.

SWEEP TSX-H — Loading state not communicated (MEDIUM):
  Button with isLoading/isSubmitting state without aria-busy={isLoading} → MEDIUM.
  Spinner rendered during loading without aria-hidden={true} → MEDIUM.

SWEEP TSX-I — Active navigation links missing aria-current (MEDIUM):
  Navigation link with active/current-page indicator (isActive, className containing active/current/selected) without aria-current="page" → report (MEDIUM).

SWEEP TSX-J — Page-section components and card grids missing accessible names (MEDIUM):
  • Any <section> used as a major page section (hero/banner, statistics, feature grid, pricing, testimonials, etc.) — needs aria-labelledby referencing its visible heading, or an aria-label.
  • Any sub-group of related controls not covered by a surrounding heading (CTA button row, trust-badge strip, social-proof group) — needs aria-label.
  • Each <article> in a repeated card grid — needs aria-labelledby, AND its primary CTA must have an aria-label including the item name.
  • More than one <nav> — each needs a unique aria-label.
  • DOM duplicate/cloned elements — need aria-hidden={true}.
  For each missing label → report (MEDIUM).

SWEEP TSX-EXTRA — React-specific patterns (HIGH/MEDIUM):
  onClick on <div>/<span>: needs role="button", tabIndex={0}, onKeyDown for Enter+Space → report any missing piece (HIGH).
  <img> without alt prop → HIGH. <label> using for= instead of htmlFor → MEDIUM.
  useState/setState causing important new content: needs aria-live region → MEDIUM.
  Conditional && / ternary removing a focused element from DOM → prefer aria-hidden → MEDIUM.

COMPLETION CHECK: verify you ran all sweeps TSX-A through TSX-J plus TSX-EXTRA. Each unique component instance is a separate Issue block.`;
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
// CSS/JS/TSX use structured sweeps in getLangSpecificRules; this supplements HTML and other langs.
function getLangSpecificChecks(languageId: string): string {
  const lang = languageId.toLowerCase();

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
  const lang = languageId.toLowerCase();

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
11. href="#" is a VALID href value. Do NOT flag it as invalid. Only flag an <a> as misused when it has NO href attribute at all.
12. target="_blank" is NOT a WCAG 2.2 failure. Do not report it.
13. autocomplete compound values (e.g. "work email", "home tel") are valid per WHATWG spec. Do not flag them. Only flag autocomplete for personal data inputs (name, email, tel, address, birthday, card) when autocomplete is completely absent. Do NOT flag search, username, password, comment, subject, coupon, or promo inputs.
14. Only report a broken aria-labelledby / aria-describedby / aria-controls reference if you confirmed in Phase 1 that the referenced id is absent from the entire document. If your Phase 1 id inventory is incomplete, skip all broken-reference reports.
15. Do NOT flag missing aria-required on an <input> that already has the HTML required attribute.
16. Only flag a <fieldset> as "missing legend" when there is genuinely NO <legend> element as a direct child.
17. TABLE HEADER SCOPE — Only flag a <th> as "missing scope" if (a) the scope attribute is literally absent AND (b) the table is ambiguous: the header row has more than one <th>, or multiple <th> elements appear in the same column position across rows. Do NOT flag every <th> in a simple table where position is unambiguous.
18. FOCUS INDICATOR REPLACEMENT — A CSS rule that sets outline: none AND provides a visible alternative in the SAME rule-block (box-shadow, visually distinct border, or non-zero outline) is NOT a violation. outline-offset alone is NOT a visible focus ring.
19. CONFIDENCE GATE — Only report an issue if you can point to the exact element from your Phase 1 inventory. Hedged language ("may be", "possibly", "it is likely") means skip. Always cite the specific selector, line number, or id.
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

${lang === 'html' ? `
MANDATORY HTML SWEEPS — run these using your Phase 1 inventory before reporting anything else:

SWEEP A — Links: for every <a>, compute accessible name (aria-label > aria-labelledby > visible text excluding aria-hidden children). No name → report HIGH. Name is only "click here", "here", "read more", "learn more", or "more" → report MEDIUM.
SWEEP B — Buttons: for every <button>, compute accessible name (aria-label > aria-labelledby > visible text including .sr-only > title). SVG aria-hidden contributes nothing. No name → report HIGH.
SWEEP C — Table headers: for every <th> without scope → report MEDIUM.
SWEEP D — Heading skips: list headings in document order; a jump of 2+ levels (h2→h4) with no intermediate heading → report MEDIUM.
SWEEP E — Form inputs: for every <input>/<select>/<textarea> (excluding hidden/submit/button/reset/image/checkbox/radio/range/color/file): no <label for>, no wrapping <label>, no aria-label, no aria-labelledby → report HIGH.
SWEEP F — Image alt: for every <img> with no alt attribute at all (alt="" is fine) → report HIGH.
SWEEP G — Landmark labels: for each of the types <nav>, <section>, <aside> — count how many of that type exist in the document. If MORE than one of the same type exists, any instance without aria-label or aria-labelledby → report MEDIUM. If only one of a given type exists, skip that type entirely (a unique landmark needs no distinguishing label). Do not apply to <main>, <header>, or <footer>.
SWEEP H — Broken ARIA refs: for every aria-labelledby / aria-describedby / aria-controls value, check your Phase 1 id inventory. If the referenced id is absent from your complete inventory → report HIGH. Only report if Phase 1 inventory is complete.
SWEEP I — Toggle buttons: for every <button> (or role="button") whose class/text/aria-controls suggests it shows or hides content (toggle, expand, collapse, accordion, hamburger, menu, dropdown, disclosure, show, hide) and that has no aria-expanded → report HIGH.
SWEEP J — Autocomplete: for every <input>/<select>/<textarea> whose name, id, type, or placeholder contains a clear personal data signal (given-name, family-name, name, email, phone, tel, address, street, city, postcode, zip, country, birthday, card) and that has no autocomplete attribute → report MEDIUM citing SC 1.3.5. Skip if signal is ambiguous.` : ''}

CODE TO AUDIT (${languageId}):
${code}

SUPPLEMENTARY WCAG GUIDANCE (retrieved — consult after reading the code above):
${contextBlock}

/no_think`;
}
