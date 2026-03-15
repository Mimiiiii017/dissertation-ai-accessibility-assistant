# ARIA: Live Regions and Dynamic Content

## Tags 
Tags: #aria #live-regions #dynamic-content #screen-readers #wcag

## Purpose
Ensure users of assistive technologies are informed when content changes dynamically without a page reload, such as form feedback, notifications, or status updates.

## Key points
- Dynamic content updates must be communicated to screen readers.
- ARIA live regions announce changes without requiring user focus.
- The `aria-live` attribute controls how and when updates are announced.
- Live regions should be used sparingly to avoid overwhelming users.
- Content changes that require user action should also be focus-managed.

## Developer checks
- Identify content that updates dynamically (AJAX, validation messages, status updates).
- Check whether updates are announced by screen readers.
- Verify correct `aria-live` politeness level is used.
- Ensure live regions are not overused or nested incorrectly.
- Confirm important updates are not visually hidden without an accessible alternative.

## Fix patterns
- Add `aria-live="polite"` for non-urgent updates.
- Use `aria-live="assertive"` or `role="alert"` for critical messages.
- Mark regions with `aria-atomic="true"` when full content should be read.
- Use `aria-busy="true"` during loading states.
- Combine live regions with focus movement when user action is required.

## Examples
```html
<!-- Polite live region -->
<div aria-live="polite">
  Profile saved successfully.
</div>

<!-- Assertive live region for critical feedback -->
<div role="alert">
  Error: Your session has expired.
</div>

<!-- Loading state -->
<div aria-live="polite" aria-busy="true">
  Loading results…
</div>

<!-- Atomic live region -->
<div aria-live="polite" aria-atomic="true">
  You have 3 new notifications.
</div>
```
