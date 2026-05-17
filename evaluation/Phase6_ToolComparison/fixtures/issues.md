# Benchmark Fixture — Accessibility Issues Reference

All four error fixtures contain **30 labelled accessibility issues** distributed throughout the full file length.

---

## `study-6-html-medium.html` (27 kB · 584 lines)

| # | Line | Issue |
|---|------|-------|
| 1 | 14 | Non-descriptive link text |
| 2 | 16 | Empty `aria-label` overrides visible text |
| 3 | 21 | Duplicate landmark — second `role="banner"` inside `<header>` which already maps to banner |
| 4 | 23 | `<img>` missing `alt` attribute |
| 5 | 35 | Decorative/meaningful image with empty `alt` — loses context |
| 6 | 41 | Heading level skip (`<h4>` after `<h2>`) |
| 7 | 51 | `<img>` missing `alt` attribute entirely |
| 8 | 63 | `<form>` has no accessible name (no `aria-label` / `aria-labelledby` / `<legend>`) |
| 9 | 65 | `input[type=email]` has no associated `<label>` |
| 10 | 66 | `input[type=text]` has no associated `<label>` |
| 11 | 67 | `input[type=tel]` has no associated `<label>` |
| 12 | 68 | `<select>` has no associated `<label>` |
| 13 | 73 | `<textarea>` has no associated `<label>` |
| 14 | 80 | `<table>` has no `<caption>` or `aria-label` |
| 15 | 81 | Table header row uses `<td>` instead of `<th>` |
| 16 | 102 | `<img>` missing `alt` attribute entirely |
| 17 | 103 | Image with empty `alt` in a non-decorative context |
| 18 | 104 | Alt text is not descriptive ("Not descriptive enough" counts as error per spec) |
| 19 | 105 | `role="img"` on `<div>` with no accessible name |
| 20 | 313 | Non-descriptive link text — "Get Started" is not unique when repeated across multiple cards |
| 21 | 351 | `<code>` block has no `lang` attribute — language of code snippet is not identified (WCAG 3.1.2) |
| 22 | 387 | `<article>` `aria-label` is a bare version number — not meaningful to screen reader users without context |
| 23 | 430 | Integration card has no actionable link — sighted users can click the card but keyboard/SR users have no way to activate it |
| 24 | 460 | Status `<table>` has `aria-label` but no `<caption>` element — some assistive technologies prefer a visible caption |
| 25 | 485 | Link text is a raw email address — not descriptive when encountered out of context by screen reader users |
| 26 | 532 | Job listings `<ul>` has no `aria-label` — screen reader users cannot distinguish it from other lists on the page |
| 27 | 549 | Publication date "March 2024" is plain text — should be in a `<time datetime="2024-03">` element for machine readability |
| 28 | 564 | Discord community link opens an external site without warning — users are not informed they are leaving the current site |
| 29 | 574 | Accessibility statement does not provide a phone alternative — users who cannot use email have no way to report accessibility issues |
| 30 | 578 | Cookie banner uses `role="region"` — should use `role="alert"` or `role="dialog"` so screen readers announce it when it appears |

---

## `study-6-css-medium.css` (74 kB · 2,210 lines)

| # | Line | Issue |
|---|------|-------|
| 1 | 20 | `outline:none` on all interactive elements removes ALL keyboard focus globally (WCAG 2.4.7) |
| 2 | 30 | `.caption` `font-size:10px` is below minimum readable size (WCAG 1.4.4 Resize Text) |
| 3 | 36 | `.muted` `color:#999` on white = 2.85:1 contrast, fails WCAG AA 4.5:1 minimum (SC 1.4.3) |
| 4 | 66 | `header nav a:focus` shows focus via colour change only — colour alone insufficient (WCAG 1.4.1, 2.4.7) |
| 5 | 130 | `#cta-btn:focus` removes keyboard focus indicator from primary CTA button (WCAG 2.4.7) |
| 6 | 202 | `outline:none` on all form controls removes every keyboard focus indicator (WCAG 2.4.7) |
| 7 | 213 | `label { display:none }` hides ALL form labels from sighted and AT users (WCAG 1.3.1, 2.4.6) |
| 8 | 233 | `outline:1px` on submit button fails WCAG 2.4.11 minimum focus indicator area (2 px perimeter) |
| 9 | 256 | Table header row `font-weight:normal` — indistinguishable from data rows (WCAG 1.3.1) |
| 10 | 290 | `.gallery-grid img:focus` removes focus ring from keyboard-focusable images (WCAG 2.4.7) |
| 11 | 311 | `section a:focus` removes focus outline from ALL section links (WCAG 2.4.7) |
| 12 | 366 | Table `font-size:12px` at 480 px viewport is too small (WCAG 1.4.4 Resize Text) |
| 13 | 376 | `prefers-reduced-motion: no-preference` — backwards; disables motion for the wrong users (WCAG 2.3.3) |
| 14 | 745 | `.mega-menu` uses `display:none` with no `aria-hidden`/`aria-expanded` management (WCAG 4.1.2) |
| 15 | 930 | `.form-control:focus` uses only `border` + `box-shadow` for focus — invisible in High Contrast Mode (WCAG 2.4.7) |
| 16 | 1030 | `.stat-card-value` `line-height:1` is below WCAG 1.4.12 minimum 1.5× for readable text |
| 17 | 1040 | `.badge` `line-height:1` collapses vertical spacing in badge labels (WCAG 1.4.12 Text Spacing) |
| 18 | 1056 | `.badge-dot` `font-size:10px` notification text is unreadable at small size (WCAG 1.4.4) |
| 19 | 1061 | Notification badge 16×16 px and `font-size:10px` both fail WCAG 2.5.5 minimum touch target |
| 20 | 1169 | Tab list hides overflow scrollbar with no affordance — users cannot tell the list is scrollable (WCAG 1.4.13) |
| 21 | 1294 | `.sm-hidden` hides visually on mobile but no `aria-hidden` toggled — AT may still read the content (WCAG 1.3.2) |
| 22 | 1421 | `cursor:not-allowed` implies disabled but adds no `aria-disabled` — keyboard users are unaware (WCAG 4.1.2) |
| 23 | 1434 | `visibility:hidden` hides visually but NOT from AT — use `aria-hidden` to hide from screen readers (WCAG 1.3.1) |
| 24 | 1442 | `user-select:none` blocks text copy/paste, a barrier for cognitive and motor impaired users (WCAG 1.3.3) |
| 25 | 1552 | `.avatar-xs` 24×24 px is far below WCAG 2.5.5 minimum 44×44 px touch target size |
| 26 | 1654 | `.search-clear` shown/hidden by CSS only with no focus management — keyboard users may miss it (WCAG 2.1.1) |
| 27 | 1669 | `.combobox-option` uses `cursor:pointer` as sole selection affordance — no keyboard visual cue (WCAG 1.3.3) |
| 28 | 1716 | `.focus-trap-sentinel` `opacity:0` does not hide from AT — use `aria-hidden` to suppress empty sentinels (WCAG 4.1.2) |
| 29 | 1720 | `.print-only` `display:none` hides content from both visual users and AT in screen mode (WCAG 1.3.1) |
| 30 | 1333 | `print a[href]::after` appends URL causing AT to read the link twice; `font-size:9pt` too small (WCAG 1.4.4) |

---

## `study-6-js-medium.js` (496 kB · 6,170 lines)

| # | Line | Issue |
|---|------|-------|
| 1 | 14 | `menuButton` has no `aria-expanded` update on click — keyboard/AT users cannot tell the nav is open or closed (WCAG 4.1.2) |
| 2 | 21 | Tab buttons listen only for `click` — no `ArrowLeft`/`ArrowRight` keyboard navigation, violating the ARIA TabList pattern (WCAG 2.1.1) |
| 3 | 27 | Tab panels toggled with `style.display='none'` but no `aria-hidden='true'` — hidden panels still accessible to AT (WCAG 1.3.1) |
| 4 | 43 | Error message not linked to its input via `aria-describedby` — AT users cannot associate the error with the failing field (WCAG 1.3.1) |
| 5 | 51 | Focus is not moved to the first invalid field after validation failure — keyboard users must navigate manually to find the error (WCAG 3.3.1) |
| 6 | 50 | No `aria-live` region announces the number of errors to AT — screen reader users hear no summary of what went wrong (WCAG 4.1.3) |
| 7 | 60 | `loadMore` sets `disabled` + `textContent` but no `aria-busy='true'` on the container — AT users get no loading-state announcement (WCAG 4.1.3) |
| 8 | 84 | `cartCounter` `textContent` updated directly — no `aria-live` region announces the cart count change to AT (WCAG 4.1.3) |
| 9 | 93 | `modal.style.display='block'` without moving focus into the modal, no `aria-modal`, no focus trap — keyboard users remain behind the backdrop (WCAG 2.1.2) |
| 10 | 108 | Announcement element removed after only 1000 ms — too short for screen readers to finish reading; breaks live region persistence (WCAG 4.1.3) |
| 11 | 176 | `dom.create()` provides no mechanism to set ARIA roles or states — callers must remember to add ARIA manually after element creation |
| 12 | 196 | `delegate()` attaches event handlers for any event but common usage delegates `click` only — keyboard `keydown`/`keypress` equivalents are missed (WCAG 2.1.1) |
| 13 | 387 | `MiniFramework.render()` updates the DOM imperatively without any `aria-live` region notification — dynamic content changes are invisible to AT (WCAG 4.1.3) |
| 14 | 541 | `I18n.setLocale()` changes the page language without updating the `document.lang` attribute or announcing the change to AT users (WCAG 3.1.1) |
| 15 | 702 | `Analytics.track()` is called on `click` events only — keyboard-only users' interactions via `Enter`/`Space` are not tracked, skewing accessibility metrics |
| 16 | 821 | `HttpClient` request failures are returned as rejected Promises only — no `aria-live` region announces network errors to AT users (WCAG 4.1.3) |
| 17 | 943 | `announce()` creates a new `aria-live` element for each message then removes it after 3 s — AT may not announce content added to a freshly-inserted live region (WCAG 4.1.3) |
| 18 | 1189 | `CosmosConfig.accessibility.reducedMotion` reflects `prefers-reduced-motion` but individual modules do not check it consistently before running animations (WCAG 2.3.3) |
| 19 | 1337 | `CosmosTheme` applies dark/light theme by toggling CSS classes but does not announce the theme change to AT users — action has no accessible feedback (WCAG 4.1.3) |
| 20 | 1441 | `CosmosReadingPrefs` applies `font-size` and `line-spacing` CSS variables without announcing the change — AT users receive no confirmation the preference was saved (WCAG 4.1.3) |
| 21 | 1534 | Changing `aria-live` attribute on an existing element at runtime is unreliable — some AT ignore the change and continue with the original politeness level |
| 22 | 1823 | `renderReadingTime()` sets the word count via `element.title` — title tooltips are inaccessible to keyboard and touch users and not reliably announced by AT (WCAG 1.3.1) |
| 23 | 2213 | `header.textContent` is set BEFORE `container.appendChild(header)` in CosmosSearch — AT will not announce content that was already present when the live region was first inserted into the DOM (WCAG 4.1.3) |
| 24 | 2414 | `CosmosSolarViz` declares `_canvas` for solar system rendering with mouse-only interaction — no keyboard controls and no accessible text alternative (WCAG 1.1.1, 2.1.1) |
| 25 | 2655 | `CosmosTimeline.render()` announces results via `CosmosAnnouncer.announce()` — but CosmosAnnouncer uses the unreliable freshly-inserted live-region technique (JS #17) that AT may ignore (WCAG 4.1.3) |
| 26 | 2853 | `CosmosQuiz` inserts quiz results via `_container.innerHTML` with `role="region"` but no `aria-live` — score and feedback are not announced to AT users (WCAG 4.1.3) |
| 27 | 3217 | `CosmosBookmarks.toggle()` saves/removes a bookmark without any `aria-live` announcement — AT users receive no confirmation the action succeeded (WCAG 4.1.3) |
| 28 | 3557 | `animateCounter()` updates `el.textContent` on every animation frame — screen readers announce each intermediate value, flooding AT output; should `aria-hide` during animation (WCAG 2.2.2) |
| 29 | 3890 | `CosmosNewsletter.handleSubmit()` shows success/error by swapping CSS classes only — no `aria-live` region announces the form result to AT (WCAG 4.1.3) |
| 30 | 5417 | `CosmosGlossary` renders `<dd>` definition text directly with no expand/collapse mechanism and no `aria-expanded` state — keyboard users cannot navigate an expandable glossary efficiently (WCAG 2.4.3, 4.1.2) |

---

## `study-6-tsx-medium.tsx` (62 kB · 2,108 lines)

| # | Line | Issue |
|---|------|-------|
| 1 | 12 | `<div>` used instead of `<button>`; no `role` attribute |
| 2 | 12 | `onClick={onClick}` present on `<div>` with no `tabIndex` or `onKeyDown` — element is invisible to keyboard navigation (WCAG 2.1.1) |
| 3 | 12 | `<div>` has `style` attribute but no `aria-label` — element lacks an accessible name (WCAG 4.1.2) |
| 4 | 23 | `aria-expanded` not set on menu trigger |
| 5 | 23 | Menu trigger `onClick` present but no `aria-expanded` or `aria-haspopup` — popup state not communicated to AT (WCAG 4.1.2) |
| 6 | 29 | Array index used as React `key` — can cause AT to misidentify re-ordered items |
| 7 | 31 | Icon `<span>` has no `alt` or `aria-label` |
| 8 | 37 | Empty `<div>` at menu end where `aria-live` region should be — no announcement when menu opens/closes (WCAG 4.1.3) |
| 9 | 51 | Tabs `<button>` has `role="tab"` and `aria-selected` but missing `aria-controls` — not programmatically linked to its panel (WCAG 4.1.2) |
| 10 | 52 | Tab `onClick` handler present with no `ArrowLeft`/`ArrowRight` keyboard handler — violates the ARIA TabList keyboard pattern (WCAG 2.1.1) |
| 11 | 59 | `aria-labelledby` ID doesn't match button ID |
| 12 | 60 | `display:none` hides content from all users; `visibility` or conditional render preferred |
| 13 | 934 | DataTable sort header `onClick` calls `handleSort()` but result not announced via `aria-live` — sort direction change invisible to AT (WCAG 4.1.3) |
| 14 | 1600 | FileUpload `<input type="file">` `aria-describedby` conditionally omits the error container ID until an error occurs — input not persistently linked to its validation message (WCAG 1.3.1) |
| 15 | 1184 | Combobox no-results `<li>` rendered inside `role="listbox"` with no `aria-live` — empty-list state not announced to AT (WCAG 4.1.3) |
| 16 | 1400 | DatePicker trigger has `aria-haspopup="dialog"` but is missing `aria-expanded` — calendar open/closed state not communicated to AT (WCAG 4.1.2) |
| 17 | 1662 | ColorPicker hex text `<input>` has a `pattern` attribute but no `aria-invalid` when the value is invalid — error state not communicated to AT (WCAG 1.3.1) |
| 18 | 1143 | Combobox `<input role="combobox">` missing `aria-required` when the field is required — required state not communicated to AT (WCAG 1.3.1) |
| 19 | 1409 | DatePicker calendar declares `aria-modal="true"` but has no focus trap code — keyboard focus can escape the open calendar (WCAG 2.1.2) |
| 20 | 1399 | DatePicker trigger `onKeyDown` only handles `Enter`/`Space` to open; no `Escape` handler to close the calendar — keyboard users cannot dismiss the calendar (WCAG 2.1.1) |
| 21 | 1408 | DatePicker calendar `<div role="dialog">` has no backdrop element or click-outside handler — clicking outside the dialog will not close it (WCAG 2.1.1) |
| 22 | 1408 | Calendar dialog uses `role="dialog"` with no matching backdrop overlay — modal state not visually communicated to low-vision users (WCAG 1.4.3) |
| 23 | 1289 | Stepper `<ol>` renders current step via `aria-current="step"` but has no `aria-live` region — step activation not announced to AT users (WCAG 4.1.3) |
| 24 | 576 | Badge dot `<span>` rendered without `aria-hidden="true"` — decorative indicator may be read as a symbol by AT (WCAG 1.1.1) |
| 25 | 742 | Accordion `<button>` has `aria-expanded` but is missing `aria-controls` — not programmatically linked to its disclosure panel (WCAG 4.1.2) |
| 26 | 1051 | Toast type icon `<span>` renders an emoji character without `aria-hidden="true"` — symbol may be read aloud by AT (WCAG 1.1.1) |
| 27 | 1067 | Toast dismiss button `aria-label="Close"` is generic — does not identify which notification it closes (WCAG 2.4.6) |
| 28 | 1694 | Skeleton `animation` CSS property always runs regardless of the `prefers-reduced-motion` user preference (WCAG 2.3.3) |
| 29 | 1239 | Progress `role="progressbar"` with `aria-valuenow` but no explicit `aria-live` region — value changes may not be proactively announced to AT (WCAG 4.1.3) |
| 30 | 1513 | Rating star `onMouseEnter` updates visual hover state without `aria-live` announcement — AT users unaware of the currently hovered star rating (WCAG 4.1.3) |
