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

export const BENCHMARK_SYSTEM_PROMPT = `You are a senior WCAG 2.2 accessibility auditor. Your task has two strict phases. Output Issue blocks and nothing else — no prose, no commentary, no markdown, no JSON.

PHASE 1 — READ AND MAP (produce NO output during this phase):
Read every single line of the code from top to bottom. Build a complete internal inventory before drawing any conclusions:
  • Every element that carries an id attribute — record each id value exactly.
  • How many <nav>, <section>, and <aside> elements exist, and whether each has aria-label or aria-labelledby.
  • Every aria-labelledby / aria-describedby / aria-controls value — note the target id(s) so you can verify they exist.
  • Every interactive element: <a>, <button>, <input>, <select>, <textarea>, <img> — note existing accessible-name attributes.
  • Page structure: <html lang>, <title>, heading order (h1–h6), landmark elements.
  • Every <button> or role="button" element — note whether it has aria-controls or class/text suggesting it toggles content.
Do NOT write any output during Phase 1.

PHASE 2 — REPORT ISSUES (using your Phase 1 inventory):
Using the complete picture you built in Phase 1, run each mandatory sweep and report every violation you can confirm from the code. Never report something you did not observe.

#1 MOST IMPORTANT RULE — ONE ISSUE PER ELEMENT:
Write a SEPARATE Issue block for each individual element that has a problem.
Do NOT group multiple elements into one block.
Example: four images each missing alt text → FOUR separate Issue blocks, one per image, each identifying the specific element (by line number, id, class, src, or surrounding context).
This is required so every distinct violation can be traced back to its specific element.

CORE RULES:
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

[vi] CONFIDENCE GATE — Only report an issue if you can point to the exact element from your Phase 1 inventory. "It is likely", "it may be", or "it possibly" are not grounds for reporting. If you did not observe the specific element in Phase 1, skip it. Failing to identify a real accessibility barrier is more harmful to users than reporting a debatable case — report every concern you can directly observe from your Phase 1 inventory, but always cite the specific selector, line number, or id from your Phase 1 scan.

[vii] SWEEP J (autocomplete) — Only flag an <input> if you confirmed during Phase 1 that its name, id, type, or placeholder contains a clear personal data signal (given-name, family-name, name, email, phone, tel, address, street, city, postcode, zip, country, birthday, card). If the signal is ambiguous or absent, skip the element entirely. Do NOT flag inputs whose purpose is clearly non-personal (search, query, message, subject, comment, username, password, coupon, promo).

[viii] SWEEP H (broken ARIA references) — Only report a broken aria-labelledby / aria-describedby / aria-controls reference if you built a complete id inventory in Phase 1 AND that id is absent from your inventory. If you did not record every id in Phase 1, do NOT report any broken references — incomplete inventories produce false positives.

[ix]  TABLE HEADER SCOPE — A <th> element does NOT require a scope attribute when its position alone unambiguously identifies its axis. Specifically: if a row contains only ONE <th> at the start of the row, screen readers infer row scope. If a column contains only ONE <th> in the header row, screen readers infer col scope. Only flag a <th> as "missing scope" if (a) the scope attribute is literally absent AND (b) there are multiple <th> elements in the same row (ambiguous row headers) or multiple <th> elements in the same column position across rows (ambiguous col headers). Do NOT flag every <th> in a simple table where position is unambiguous.

[x]   FOCUS INDICATOR REPLACEMENT — A CSS rule that sets outline: none or outline: 0 AND provides a visible alternative in the SAME rule-block is NOT a violation. A visible alternative means: box-shadow with non-zero spread and visible colour, a visually distinct border, or a non-zero outline value. Example: ".btn:focus-visible { outline: none; box-shadow: 0 0 0 3px blue; }" is valid — do NOT report it. Only report when NO visible alternative exists anywhere for that selector or its paired base selector.

[xi]  JS FUNCTION CITATION — For every issue you report in JS sweeps (JS-A through JS-G): the function name and element selector you cite must appear literally in the source code. Do not report a function or handler that you inferred from class names, assumed patterns, or cross-file conventions — only report what you can directly quote from the file being analysed. If you cannot point to the exact function name or element selector in the source, skip that issue.
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
MANDATORY ELEMENT SWEEPS — run ALL sweeps A–J against your Phase 1 inventory:

Execute every sweep below fully and independently. The supplementary WCAG guidance that follows is reference-only — it does not replace, reduce, or skip any sweep. In particular, do not skip the basic visual sweeps (F: images, A: links, G: landmarks) regardless of what the retrieved context covers.

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
  For every <th>: apply BOTH conditions before reporting:
  (a) The scope attribute is literally absent from that element.
  (b) The table is ambiguous — i.e. the header row contains more than one <th>, OR multiple <th> elements appear in the same column position across rows.
  If a table has a single header row with clearly distinct column <th> elements AND no row <th> elements, position is unambiguous and scope is NOT required.
  Only report "table header missing scope" when BOTH (a) and (b) are true.

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

SWEEP G — Repeated landmark elements missing distinguishing labels:
  Using your Phase 1 inventory, apply this check independently for each of the following element types: <nav>, <section>, <aside>.
  For each type:
    Count how many elements of that type exist in the entire document.
    If MORE than one element of that type exists: every instance that has NEITHER aria-label NOR aria-labelledby → report "landmark missing distinguishing label" (MEDIUM), identifying the element type and its position or surrounding context.
    If only ONE element of that type exists: skip — a unique landmark does not require a label.
  Do NOT apply this sweep to <main>, <header>, or <footer> — these are typically unique per page.
  Rationale: when multiple regions of the same type exist, assistive technology users navigating by landmarks cannot tell them apart without a distinguishing label (WCAG 2.4.1, ARIA technique ARIA11).

SWEEP H — Broken ARIA id references:
  Using your Phase 1 id inventory: for every element that has an aria-labelledby, aria-describedby, or aria-controls attribute, check each id value it references.
  If a referenced id does NOT exist anywhere in the document → report "broken ARIA reference: element references id that does not exist" (HIGH), naming the element and the missing id.
  Only report when the id is genuinely absent from the entire document. Do NOT report if the id exists anywhere, even far from the referencing element.

SWEEP I — Toggle/disclosure buttons missing aria-expanded (SC 4.1.2):
  Using your Phase 1 inventory: for every <button> (or element with role="button") that controls expandable or collapsible content:
  A button controls expandable content if it has an aria-controls attribute, OR its class name or text includes words like toggle, expand, collapse, accordion, hamburger, menu, submenu, dropdown, disclosure, show, hide.
  If it is a toggle button AND has no aria-expanded attribute → report "toggle button missing aria-expanded" (HIGH).
  Do NOT report plain action buttons (submit, form submit, navigation links). Only report buttons whose primary purpose is to show or hide a region of content.

SWEEP J — Personal data inputs missing autocomplete (SC 1.3.5):
  For every <input>, <select>, <textarea> whose name, id, type, or placeholder suggests it collects personal information:
  Personal data signals: name, given-name, family-name, email, phone, tel, address, street, city, postcode, postal, zip, country, birthday, birth, card, credit.
  If the element has no autocomplete attribute → report "missing autocomplete attribute" (MEDIUM), citing SC 1.3.5.
  Do NOT report if autocomplete is already present (any value). Do NOT report for input types: hidden, submit, button, reset, image, checkbox, radio, range, color, file.

COMPLETION CHECK — before finalising output:
  Verify you executed every sweep above (A through J) using your Phase 1 inventory.
  If you have produced fewer than 8 Issue blocks, you almost certainly did not complete every sweep.
  Return to the sweep list and run each one explicitly before writing output.
`;

/**
 * Mandatory element sweeps for CSS — mirrors HTML_MANDATORY_SWEEPS in structure.
 *
 * T17 showed CSS F1 average ~31% vs HTML ~36%. The gap is not fundamental;
 * models lack a scanning algorithm for CSS patterns equivalent to the HTML sweeps.
 * These sweeps target the most common missed issues observed in T17 FN analysis.
 */
const CSS_MANDATORY_SWEEPS = `
MANDATORY CSS ACCESSIBILITY SWEEPS — run ALL sweeps CSS-A through CSS-H against your Phase 1 inventory:

⚠ ACTIVATION MANDATE: You MUST execute all CSS-A through CSS-H sweeps regardless of whether supplementary WCAG guidance was retrieved. These sweeps operate solely on the CSS source code identified in your Phase 1 inventory. After completing Phase 1, self-verify: a dense stylesheet typically contains 10 or more violations — if your Phase 1 inventory has zero outline:none selectors and zero undersized interactive elements, you have not fully read the file. Re-read from line 1 before proceeding to the sweeps.
⚠ BASE-SELECTOR REMINDER: outline:none and outline:0 most commonly appear in BASE component rules — e.g. .btn { outline: none }, .tab { outline: 0 }, .form-input { outline: none } — NOT only in :focus or :focus-visible pseudo-class rules. Your Phase 1 outline inventory must include both base-class rules and pseudo-class rules. If you recorded only :focus-scoped selectors, return and scan the stylesheet for base component class rules that also suppress the outline.

Execute every sweep below fully and independently. Supplementary WCAG guidance that follows is reference-only — it does not replace or skip any sweep.

PHASE 1 CSS — before any sweep, build this inventory:
  • Every rule containing outline: none, outline: 0, or outline: transparent — record its selector. Do NOT limit this to :focus or :focus-visible rules; base component rules (e.g. .btn { outline: none }, .tab { outline: 0 }) count equally and each is a separate inventory entry.
  • Every selector targeting a potentially interactive element (button, a, input, select, textarea, summary, [role="button"], [role="tab"], [role="menuitem"]) that sets an explicit height, width, min-height, or min-width value in px. Also include any class-based selector whose name suggests it is applied to a button-like component, navigation item, form control, icon button, skip link, or interactive card — the exact class names vary per project (they might be .btn, .tab, .chip, .pill, .icon-btn, .nav-link, .skip-link, .form-input, .checkbox, or project-specific names). Look for any class applied to clickable or focusable elements that records a px size.
  • Every @media (prefers-reduced-motion) block — record which selectors and properties it covers.
  • Every @media (forced-colors: active) block — note whether it exists.
  • The sr-only / visually-hidden / screen-reader-text utility class declaration (if present) — record every property it sets.
  • Every word-spacing or letter-spacing value that is negative.
  • Every rule that sets text-decoration: none on a, a:link, or a:visited selectors.

SWEEP CSS-A — Focus indicator removed without replacement (HIGH):
  For every selector in your Phase 1 outline inventory — whether a base component selector (any project-specific class applied to buttons, links, inputs, navigation items, cards, icon buttons, checkboxes, or other interactive elements) OR a :focus / :focus-visible pseudo-class rule:
  Check whether that selector — or a paired rule for the same base selector — provides a visible alternative: box-shadow, border with a visually distinct colour, or outline with a non-zero value.
  If no visible alternative exists → report "focus indicator removed without replacement on <selector>" (HIGH), one Issue block per selector.
  Do NOT skip base-class selectors because they lack a :focus pseudo-class — a base rule setting outline: none removes the focus ring in ALL states including keyboard focus.
  ⚠ CRITICAL: outline-offset is NOT a visible focus ring. A rule that sets only "outline: none; outline-offset: Xpx" and nothing else is a VIOLATION — the offset applies to a zero-width outline and renders nothing. Only skip reporting if the same rule-block also contains box-shadow, a non-transparent border, or a non-zero outline value.
  Do NOT report a :focus or :focus-visible rule if its own rule-block also sets box-shadow, a visible border, or a non-zero outline — that IS the replacement style, not a violation.
  Skip outline removal on non-interactive structural containers (div, p, section, article, ul, li) where keyboard focus is not expected.

SWEEP CSS-B — Touch target too small (MEDIUM):
  For every interactive-element selector in your height/width/min-height/min-width inventory: if the explicitly-set height, width, min-height, OR min-width is below 24px → report "touch target below minimum size: <selector> height/width <value>" (MEDIUM).
  If the value is 24–43px, also report as a potential violation — "touch target may be below 44px recommended size: <selector>" (MEDIUM) — unless surrounding margin or padding of ≥8px on each side compensates.
  Do NOT report elements that have no explicit height, width, min-height, or min-width rule.

SWEEP CSS-C — Broken visually-hidden utility (HIGH):
  Inspect the sr-only / visually-hidden / screen-reader-text utility rule. A correct implementation uses: position: absolute, very small dimensions (1px × 1px or equivalent), clip or clip-path, and does NOT use display: none or visibility: hidden.
  If the utility uses display: none or visibility: hidden → report "visually-hidden utility removes content from screen readers" (HIGH).

SWEEP CSS-D — Motion animation without prefers-reduced-motion override (MEDIUM):
  For every transition or animation that causes spatial movement (transition: transform ..., animation: slide/fade-in/bounce, transform with translate/scale/rotate): if no @media (prefers-reduced-motion: reduce) rule disables or overrides that specific motion for that selector → report "motion animation missing prefers-reduced-motion override: <selector>" (MEDIUM).
  Do NOT report opacity-only or colour-only transitions. Do NOT report if the selector is already covered by a reduced-motion override.

SWEEP CSS-E — Negative word-spacing (MEDIUM):
  If any rule sets word-spacing to a negative value → report "negative word-spacing impairs readability: <selector>" (MEDIUM).

SWEEP CSS-F — Colour contrast failure — only when both values confirmed (HIGH):
  Only report a colour contrast issue when you can find BOTH the foreground colour value AND the background colour value from the CSS in the same file (literal hex, rgb(), or a custom property whose value is defined in the same file). Do NOT estimate from colour names alone.
  If both values are present and their contrast ratio is clearly below 4.5:1 for normal text or below 3:1 for large text (18px+ or 14px+ bold) → report "insufficient colour contrast: foreground <value> / background <value> ratio <ratio>:1" (HIGH).

SWEEP CSS-G — No forced-colors/high-contrast support (MEDIUM):
  If the stylesheet sets colour or background-color on interactive elements (buttons, links, focus rings) AND there is NO @media (forced-colors: active) block anywhere in the file → report "no forced-colors/high-contrast-mode override present" (MEDIUM).

SWEEP CSS-H — Link underlines removed with no alternative (MEDIUM):
  If any rule explicitly removes underlines from body-text links (text-decoration: none on a, a:link, a:visited) AND no other non-colour visual differentiator (font-weight increase, border-bottom, background highlight on :hover) is provided → report "link underline removed — colour alone distinguishes links from surrounding text" (MEDIUM), SC 1.4.1.

COMPLETION CHECK — before finalising output:
  Verify you executed every sweep above (CSS-A through CSS-H) using your Phase 1 inventory.
  If you have produced fewer than 10 Issue blocks, you almost certainly did not complete every sweep.
  Return to the sweep list and run each one explicitly before writing output.
  Note: each distinct selector in your Phase 1 outline inventory (CSS-A) and each distinct selector below the size threshold (CSS-B) is a separate Issue block — a stylesheet applying outline: none across 15 component selectors is 15 separate issues.
  A dense stylesheet typically yields 20–50 separate issues across all sweeps; if you have fewer than 10, return to CSS-A and ensure you reported every selector in your Phase 1 outline inventory that lacks a visible focus replacement.
  ⚠ FALSE-POSITIVE CHECK: Before reporting each issue, verify you can quote the exact CSS property and value from the source file that causes it. If you cannot point to a specific rule — for example if you are estimating a touch-target size from a class name rather than a measured px property, or asserting a reduced-motion violation without finding both the animation and the absence of the @media (prefers-reduced-motion) override in Phase 1 — omit that issue. Do not report inferred or estimated violations.
  ⚠ FP CHECK: If you have identified more than 40 CSS issues, re-verify each one before writing it. For each issue ask: "Can I quote the exact selector and property from the source that causes this?" Remove any issue where the answer is no. Both missed issues and false positives harm users — report everything you can directly confirm from the source.
`;

/**
 * Mandatory element sweeps for JavaScript — mirrors HTML_MANDATORY_SWEEPS.
 *
 * T17 showed JS F1 average ~9% across all models. The primary cause is that
 * models have no scanning algorithm for dynamic ARIA patterns. The ground truth
 * issues are STATIC code patterns (toggle functions that do not set aria-expanded,
 * validation logic that does not set aria-invalid) — fully observable from source.
 * These sweeps give models the same step-by-step scanning approach as HTML sweeps.
 */
const JS_MANDATORY_SWEEPS = `
MANDATORY JAVASCRIPT ARIA SWEEPS — run ALL sweeps JS-A through JS-G against your Phase 1 inventory:

Execute every sweep below fully and independently. Supplementary WCAG guidance that follows is reference-only — it does not replace or skip any sweep.

PHASE 1 JS — before any sweep, build THREE explicit lists:

  LIST 1 — JS INTERACTION TABLE: scan every function that toggles/shows/hides content (names containing toggle, open, close, expand, collapse, show, hide, activate, deactivate) AND every addEventListener / on* handler in the file. For each entry record four columns: (a) function or handler name, (b) element/selector it operates on, (c) trigger event or call site, (d) the visible DOM change it causes (class toggle, display change, innerHTML update, etc.). Also note per row: whether it calls setAttribute('aria-expanded',...), whether it writes to an aria-live region (role="status"/role="alert"/aria-live), and whether it sets aria-hidden.
  ⚠ DEPTH REQUIREMENT: LIST 1 must capture handlers and functions at ALL nesting levels — those inside DOMContentLoaded / window.onload callbacks, module IIFE bodies, class method definitions, and helper functions called from init. Do not stop after the outermost-level definitions or after the first 10–15 entries. An event listener registered inside an init callback is IN SCOPE for LIST 1. Scan the full file top-to-bottom without truncating.

  LIST 2 — VALIDATION FUNCTIONS: every function that evaluates form field correctness (look for validate, check, isValid, onSubmit, handleSubmit, handleBlur). For each: does it setAttribute('aria-invalid','true') on invalid fields and setAttribute('aria-invalid','false') or removeAttribute on valid fields?

  LIST 3 — VISIBILITY-TOGGLED ELEMENTS: every element whose CSS display or visibility is changed dynamically (scroll-triggered show/hide, drawer open/close, autocomplete list appear/disappear, overlay appear/disappear). For each: does the function that hides it also set aria-hidden="true", and the function that shows it also remove aria-hidden?

SWEEP JS-A — Toggle functions not updating aria-expanded (HIGH):
  For every entry in LIST 1 (JS Interaction Table) that changes the visible state of a panel, menu, accordion, drawer, or combobox suggestion list: if no setAttribute('aria-expanded', ...) or .ariaExpanded = ... assignment exists in that function (or its directly paired open/close counterpart) → report "toggle function does not update aria-expanded on trigger element" (HIGH), naming the function and the trigger element selector.

SWEEP JS-B — Toggle buttons not updating aria-pressed (HIGH):
  For every button that acts as a two-state toggle (on/off, active/inactive, play/pause, mute/unmute) — identifiable by its name, class, or the fact that it cycles between exactly two modes — if no setAttribute('aria-pressed', ...) or .ariaPressed = ... assignment → report "toggle button does not update aria-pressed" (HIGH), naming the element selector and function.

SWEEP JS-C — Dynamic content updates not announced via live region (MEDIUM):
  For every code path that changes visible content in response to user action (e.g. result counts, status labels, wizard step indicators, mode labels) AND no companion aria-live region is written to immediately after → report "dynamic content update not announced to screen readers" (MEDIUM), naming the update type and function.
  A live-region write means: assigning .textContent or .innerHTML to an element with role="status", role="alert", aria-live="polite", or aria-live="assertive".

SWEEP JS-D — Form validation errors not reflected in aria-invalid (HIGH):
  For every validation function that marks an input as invalid (adds error class, inserts error message): if no setAttribute('aria-invalid', 'true') call is made for that same input → report "form validation error not reflected in aria-invalid" (HIGH), naming the input element.
  If valid-state resets do not clear aria-invalid to 'false' → report "aria-invalid not cleared on valid input" (MEDIUM).

SWEEP JS-E — aria-expanded not initialised at page load (MEDIUM):
  For every toggle widget (nav, accordion, dropdown, combobox) that is closed/hidden on load: if no DOMContentLoaded / module-init code sets aria-expanded="false" on the trigger element → report "aria-expanded not initialised on page load" (MEDIUM), naming the element.
  Also check: does any init function set aria-controls on the trigger to point to the controlled region's id? If the trigger has no aria-controls and the region has an id → report "toggle trigger missing aria-controls" (MEDIUM).

SWEEP JS-F — Dynamically-hidden elements not removed from accessibility tree (MEDIUM):
  For every element in your Phase 1 visibility-toggle inventory: if the function that hides it (sets display:none, visibility:hidden, removes a show-class) does NOT also set aria-hidden="true" on that element → report "dynamically-hidden element not updated in accessibility tree" (MEDIUM), naming the element and function.
  Conversely, if the function that reveals the element does not remove aria-hidden or set it to "false" → same report.
  Do NOT report elements that are hidden with aria-hidden from the start and never shown dynamically.

SWEEP JS-G — User actions with no live-region announcement (MEDIUM):
  Using LIST 1 (JS Interaction Table) from Phase 1: for each entry whose visible DOM change is one of the following categories — filter/search result update, result count change, view or mode label change, accordion panel open/close, navigation drawer open/close, wizard step advance, keyboard shortcut action, billing or plan change, scroll-to-top activation, suggestion list update — check whether that entry (or a function it calls) writes to an aria-live region immediately after making the DOM change.
  An aria-live write means: assigning .textContent or .innerHTML to an element that has role="status", role="alert", aria-live="polite", or aria-live="assertive".
  ⚠ SPECIFICITY: An aria-live write satisfies this check only if it announces this specific state change. A generic status region written to by multiple unrelated actions does NOT count — each action must have its own dedicated announcement.
  If the entry causes a visible change but NO dedicated live-region write exists → report "user action result not announced via aria-live region" (MEDIUM), naming the specific handler, the element it is attached to, and the visible change it causes.
  Work through LIST 1 entry by entry — do not skip any entry that causes a content change.
  Do NOT report: (a) route navigation changes, (b) actions whose handler directly calls element.focus() on the newly revealed content — focus movement is an acceptable alternative to live-region announcement.

COMPLETION CHECK — before finalising output:
  Verify you executed every sweep above (JS-A through JS-G) using your Phase 1 inventory.
  If you have produced fewer than 10 Issue blocks, you almost certainly did not complete every sweep.
  Return to the sweep list and run each one explicitly before writing output.
  A medium-density JS file typically yields 15–25 statically-detectable issues; a high-density file with many interactive handlers typically yields 25–50. Each unique function or element is a separate Issue block.
`;

/**
 * Mandatory element sweeps for TypeScript/React (TSX/JSX) — mirrors HTML_MANDATORY_SWEEPS.
 *
 * T17 showed TSX F1 average ~25% overall (kimi outlier at 46%). The main missed
 * issues are consistently: missing aria-expanded on disclosure toggles, decorative
 * icons lacking aria-hidden, missing aria-invalid/aria-required on form fields,
 * and missing aria-selected/aria-pressed on state-bearing interactive components.
 * These sweeps provide the scanning algorithm that drives detection.
 */
const TSX_MANDATORY_SWEEPS = `
MANDATORY TSX/JSX ARIA SWEEPS — run ALL sweeps TSX-A through TSX-K against your Phase 1 inventory:

Execute every sweep below fully and independently. Supplementary WCAG guidance that follows is reference-only — it does not replace or skip any sweep.

PHASE 1 TSX — before any sweep, build this inventory:
  • Every component with a boolean state variable that shows or hides content: state variables named isOpen, isExpanded, isMenuOpen, showDropdown, open, expanded, visible, isDialogOpen, etc.
    For each: does the trigger element (button, or element with role="button") receive an aria-expanded={stateVar} prop?
  • Every <svg> element or named icon component (<ChevronIcon>, <CloseIcon>, <ArrowIcon>, <StarIcon>, <SpinnerIcon>, <SearchIcon>, etc.): does it have aria-hidden={true} or a role="img" + aria-label?
  • Every form field component (<input>, <textarea>, <select>, or custom Input/TextInput/Select): does it have (a) a <label htmlFor={id}> or aria-label, (b) an aria-invalid prop when in error state, (c) aria-required or the HTML required attribute when required?
  • Every tab, filter pill, pricing plan card, or toggle button whose active/selected state is tracked (isSelected, isActive, activeTab, currentPlan, selectedFilter, isChecked): does the element receive aria-selected, aria-pressed, or aria-checked matching that state?
  • Every navigation list: do active/current-page links receive aria-current="page"?
  • Every button with a loading/submitting state (isLoading, isSubmitting, isSaving): does it receive aria-busy={isLoading}?
  • Every spinner component rendered during loading: does it have aria-hidden={true}?
  • Every <section>, <nav>, <aside> appearing more than once — does each have aria-label or aria-labelledby?
  • Every <article> in a repeated card or grid context (pricing plans, product cards, feature cards, testimonial cards, team members, etc.): record the first heading text inside each; does the article have aria-labelledby referencing that heading's id? Also note any star-rating or review widget in any such card — does the widget container have role="img" + aria-label, or do individual interactive stars have role="radio" + aria-label each?
  • Every decorative overlay, backdrop, skeleton, cloned template element, or visually-duplicated grid item: does each have aria-hidden={true} to prevent duplicate or meaningless content being read by assistive technology?
  • Every named page-section component that wraps a <section> or <nav>: does the underlying element have aria-labelledby referencing its visible heading, or an aria-label? This applies to any section component whose name suggests a distinct page region (hero, stats, features, pricing, integrations, testimonials, navigation, etc.).
  • Every group of related controls rendered inside a section whose purpose is not already conveyed by a surrounding heading (e.g. a button group, a trust-badge row, a social-proof strip, an account action bar): does each group have an aria-label identifying what it contains?

SWEEP TSX-A — Disclosure toggle components missing aria-expanded (HIGH):
  For every component using a boolean to control a show/hide region: if the trigger element does NOT receive aria-expanded={stateVariable} → report "toggle component trigger missing aria-expanded prop" (HIGH), naming the component, the trigger element, and the state variable.

SWEEP TSX-B — Decorative icon components not hidden from assistive technology (MEDIUM):
  For every <svg> or named icon component rendered inside an element that already has text content or an aria-label: if the icon has no aria-hidden={true} prop → report "decorative icon missing aria-hidden={true}" (MEDIUM), naming the icon and its parent context.
  Do NOT report icon components that ARE the sole accessible name of their parent (those need an aria-label instead).

SWEEP TSX-C — Icon-only interactive elements missing accessible names (HIGH):
  For every button, link, or role="button"/"link" element whose only content is an icon (no visible text, no aria-label, no aria-labelledby, no title): report "icon-only interactive element missing accessible name" (HIGH), naming the component.

SWEEP TSX-D — Form fields missing label, aria-invalid, or aria-required (HIGH):
  For every form input component:
  (1) No <label htmlFor={id}>, aria-label, or aria-labelledby → report "form field missing accessible label" (HIGH).
  (2) Component has an error/invalid state AND no aria-invalid prop → report "form field missing aria-invalid state" (HIGH).
  (3) Field is required AND neither required nor aria-required is passed → report "required field not programmatically marked as required" (HIGH).
  (4) Error message is rendered AND no aria-describedby links it to the input → report "form field error message not connected via aria-describedby" (MEDIUM).

SWEEP TSX-E — Interactive state not communicated to assistive technology (HIGH):
  For every tab, filter button, pricing plan card, or two-state toggle whose state is tracked by a boolean: if no aria-selected, aria-pressed, or aria-checked prop mirrors that state variable → report "interactive state not communicated to assistive technology" (HIGH), naming the component and state variable.

SWEEP TSX-F — Landmark and card regions missing accessible names (MEDIUM):
  For every <section>, <nav>, or <aside> that appears more than once: if neither aria-label nor aria-labelledby is present → report "repeated landmark region missing accessible name" (MEDIUM), naming the element and approximate location.
  For every <article> component in a repeated card/grid context (pricing plans, feature cards, testimonials): if no aria-labelledby references a heading inside it → report "card article missing accessible name via aria-labelledby" (MEDIUM), naming the component and location.

SWEEP TSX-G — Required-field markers not properly managed (MEDIUM):
  If a required-field visual marker (<span>*</span>) is rendered: (a) without aria-hidden={true} → report "required-field marker announces bare asterisk to AT — add aria-hidden" (LOW); (b) with aria-hidden={true} but the input has neither aria-required nor required → report "required field marked visually only — add aria-required or required attr" (HIGH).

SWEEP TSX-H — Loading state not communicated (MEDIUM):
  For every button with isLoading/isSubmitting state: if no aria-busy={isLoading} prop → report "loading button missing aria-busy" (MEDIUM). For every spinner rendered during loading without aria-hidden={true} → report "spinner icon missing aria-hidden" (MEDIUM).

SWEEP TSX-I — Active navigation items missing aria-current (MEDIUM):
  For every navigation link with an active/current-page indicator (isActive prop, className containing 'active'/'current'/'selected'): if no aria-current="page" prop is applied → report "active navigation link missing aria-current" (MEDIUM).

SWEEP TSX-J — Page-section components and card grids missing accessible names (MEDIUM):
  Using your Phase 1 named-section inventory, apply these checks to whichever patterns exist in the file:
  • Any <section> or region component used as a major page section (hero/banner, statistics display, feature grid, pricing grid, testimonial section, integration showcase, etc.) — must have aria-labelledby referencing its visible heading, or an aria-label. Report each missing label as a separate issue.
  • Any sub-group of related controls rendered inside a section whose purpose is not conveyed by a surrounding <h1>–<h6> (e.g. a row of CTA buttons, a strip of trust badges, a group of social proof items) — must have an aria-label naming the group.
  • Each <article> in a repeated card grid — check the heading text you recorded in Phase 1; the article must have aria-labelledby pointing to that heading's id. Also check that the card's primary CTA link or button has an aria-label that includes the item name.
  • If more than one <nav> element exists — each must have a unique aria-label distinguishing it (e.g. "Main", "Mobile", "Breadcrumb", "Footer").
  • Any element that is a DOM duplicate of visible content (cloned for layout purposes, skeleton placeholders, off-screen template copies) — must have aria-hidden={true}.
  For each missing accessible name or unlabelled duplicate → report "page-section or card component missing accessible name" (MEDIUM), identifying the component and the specific missing label.

SWEEP TSX-K — Star ratings and review widgets missing accessible semantics (MEDIUM):
  ⚠ MANDATORY: This sweep is required even if no star or rating elements are immediately obvious. Before marking this sweep complete, actively search for:
    • Any <svg> or named icon component (e.g. <StarIcon>, <RatingIcon>, <FillStar>) inside a row of sibling elements that may represent a score scale
    • Any component whose name contains 'star', 'rating', 'score', or 'review'
    • Any group of 4–5 sibling icons or identical repeated elements that could represent a rating scale
    • Any numeric display adjacent to icon elements (e.g. "4.8" next to star icons)
  For every star-rating, score display, or review-count widget found:
  (a) If the widget is read-only (display only): the container must have role="img" and an aria-label that states the numerical value (e.g. aria-label="4 out of 5 stars"). If it has neither, and individual filled/empty star elements have no accessible label → report "star rating widget missing accessible label" (MEDIUM).
  (b) If the widget is interactive (user can select a star): each star element must have role="radio" and an aria-label naming the value (e.g. "1 star", "2 stars"). If individual stars have no role or aria-label → report "interactive star rating missing radio role and labels" (HIGH).
  (c) Individual star icons (SVG or icon components) that are purely decorative within a labelled container must have aria-hidden={true}.
  ⚠ The absence of role and aria-label IS the accessibility defect — report it even if the element renders visually correctly. Do not skip any star/rating element that lacks these attributes.

COMPLETION CHECK — before finalising output:
  Verify you executed every sweep above (TSX-A through TSX-K) using your Phase 1 inventory.
  If you have produced fewer than 8 Issue blocks, you almost certainly did not complete every sweep.
  Return to the sweep list and run each one explicitly before writing output.
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

  const ANCHOR = 'SUPPLEMENTARY WCAG GUIDANCE (retrieved — consult after reading the code above):';

  if (lang === 'html') {
    const injection = `${ANTI_FP_SUPPLEMENT.trim()}\n\n${HTML_MANDATORY_SWEEPS.trim()}`;
    return base.replace(ANCHOR, `${injection}\n\n${ANCHOR}`);
  }

  if (lang === 'css') {
    const injection = `${ANTI_FP_SUPPLEMENT.trim()}\n\n${CSS_MANDATORY_SWEEPS.trim()}`;
    return base.replace(ANCHOR, `${injection}\n\n${ANCHOR}`);
  }

  if (lang === 'javascript') {
    const injection = `${ANTI_FP_SUPPLEMENT.trim()}\n\n${JS_MANDATORY_SWEEPS.trim()}`;
    return base.replace(ANCHOR, `${injection}\n\n${ANCHOR}`);
  }

  if (lang === 'typescriptreact') {
    const injection = `${ANTI_FP_SUPPLEMENT.trim()}\n\n${TSX_MANDATORY_SWEEPS.trim()}`;
    return base.replace(ANCHOR, `${injection}\n\n${ANCHOR}`);
  }

  // All other languages: anti-FP supplement only
  return base.replace(ANCHOR, `${ANTI_FP_SUPPLEMENT.trim()}\n\n${ANCHOR}`);
}