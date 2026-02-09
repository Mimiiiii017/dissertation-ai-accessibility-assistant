# Controls: Links vs Buttons

## Tags
Tags: #controls #links #buttons #semantic-html #aria #wcag

## Purpose
Ensure links and buttons are used correctly according to their function, so users of assistive technologies can predict behavior and interact with controls effectively.

## Key points
- Links (`<a>`) are for navigation to another location or resource.
- Buttons (`<button>`) are for actions that change state, submit data, or trigger behavior.
- Using the wrong element type creates confusion for screen reader and keyboard users.
- Visual styling must not determine whether something is a link or a button.
- ARIA should not be used to override native semantics unless absolutely necessary.

## Developer checks
- Identify interactive elements that look like buttons or links.
- Check whether the element performs navigation or an action.
- Verify `<div>` or `<span>` elements are not being used as interactive controls.
- Confirm keyboard behavior matches expectations (Enter for links, Enter/Space for buttons).
- Test how controls are announced by a screen reader.

## Fix patterns
- Replace clickable `<div>` or `<span>` elements with `<button>` or `<a>`.
- Use `<a href="...">` only when navigating to a new page or section.
- Use `<button>` for form submission, toggles, modals, and UI actions.
- Remove unnecessary `role="button"` when a native `<button>` can be used.
- Ensure disabled states are communicated properly for buttons.

## Examples
```html
<!-- Correct: link for navigation -->
<a href="/profile">View profile</a>

<!-- Correct: button for action -->
<button type="button" onclick="openModal()">
  Open settings
</button>

<!-- Incorrect: div used as button -->
<div onclick="submitForm()">Submit</div>

<!-- ARIA role only as a last resort -->
<div role="button" tabindex="0"
     onclick="doAction()"
     onkeydown="if(event.key==='Enter'||event.key===' ') doAction();">
  Activate
</div>
```