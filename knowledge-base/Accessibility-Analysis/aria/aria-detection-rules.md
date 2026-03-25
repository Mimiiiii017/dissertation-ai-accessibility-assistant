# ARIA: Detection Rules for Accessibility Violations

These are precise detection rules. Check the FIRES condition against the actual code. Do not report if the DOES NOT FIRE condition applies.

---

## Redundant ARIA role on native element — best practice violation

FIRES when: a native semantic element has a `role` that duplicates its implicit role (adds no value, clutters the accessibility tree).

Examples that FIRE:
- `<nav role="navigation">` — `<nav>` already has role=navigation
- `<main role="main">` — `<main>` already has role=main
- `<header role="banner">` — `<header>` at page level already has role=banner
- `<footer role="contentinfo">` — `<footer>` at page level already has role=contentinfo
- `<button role="button">` — redundant
- `<ul role="list">` — redundant

DOES NOT FIRE when:
- The role CHANGES the element's semantics (e.g. `<div role="button">`) — this is not redundant, but may need other checks
- The role is intentionally overriding a default (e.g. `<ul role="presentation">`)

---

## Element with aria-hidden="true" contains focusable children — SC 1.3.1, SC 4.1.2

FIRES when: an element with `aria-hidden="true"` contains focusable children (`<a>`, `<button>`, `<input>`, `tabindex="0"`) that would still receive keyboard focus but be invisible to screen readers.

DOES NOT FIRE when:
- All focusable children also have `tabindex="-1"` (removed from tab order)
- The element is also `display:none` or `visibility:hidden` (truly hidden from all users)
- `aria-hidden="true"` is on a purely decorative icon inside a well-named button

---

## aria-labelledby references non-existent id — SC 1.3.1

FIRES when: `aria-labelledby="some-id"` but no element with `id="some-id"` exists in the DOM.

DOES NOT FIRE when: the referenced `id` exists and the element has visible text.

---

## Interactive element missing accessible name — SC 4.1.2

FIRES when: any of these have no computed accessible name:
- `<input>` (not type=hidden, not type=submit with value)
- `<select>`
- `<textarea>`
- `<button>`
- `<a>` with `href`

DOES NOT FIRE when: the element has a label, `aria-label`, `aria-labelledby`, or (for buttons/links) visible text content.

---

## Missing lang attribute on html element — SC 3.1.1 (F1)

FIRES when: `<html>` element has no `lang` attribute.

DOES NOT FIRE when: `<html lang="en">` or any valid BCP 47 language tag is present.

Note: do NOT fire this if the lang attribute is present, even if the value could be more specific (e.g. `lang="en"` vs `lang="en-GB"` — the shorter form is acceptable for SC 3.1.1).

---

## Live region missing role or aria-live — SC 4.1.3

FIRES when: dynamic content that updates after user interaction (status messages, alerts, form validation results, loading indicators) is not in a `role="status"`, `role="alert"`, or `aria-live` region.

DOES NOT FIRE when:
- `role="alert"` or `role="status"` wraps the dynamic content
- `aria-live="polite"` or `aria-live="assertive"` is present
- The content is in a modal dialog that receives focus on open
