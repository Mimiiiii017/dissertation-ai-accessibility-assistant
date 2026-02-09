# Keyboard: Focus Indicators

## Tags
Tags: #keyboard #focus #focus-indicator #wcag #2.4.7 #2.4.13

## Purpose
Ensure users navigating with a keyboard can always see which element currently has focus, supporting orientation, efficiency, and error prevention.

## Key points
- A visible focus indicator must be present for all focusable elements.
- Focus indicators must be clearly distinguishable from the default state.
- Removing focus outlines without providing an accessible alternative creates barriers.
- Focus styles must be visible against all backgrounds and themes.
- Custom components must provide their own focus styles.

## Developer checks
- Navigate the page using only the keyboard and observe focus visibility.
- Check that focus indicators are not disabled using `outline: none` without replacement.
- Verify focus is visible on buttons, links, form fields, and custom widgets.
- Ensure focus styles meet sufficient contrast against the background.
- Test focus visibility in high-contrast modes and zoomed views.

## Fix patterns
- Restore default browser focus styles when they have been removed.
- Add custom focus styles using `:focus` or `:focus-visible`.
- Ensure focus indicators are at least as visible as hover states.
- Avoid relying solely on color changes that may be subtle or low-contrast.
- Apply consistent focus styling across all interactive elements.

## Examples
```css
/* Default-friendly custom focus style */
button:focus {
  outline: 2px solid #005fcc;
  outline-offset: 2px;
}

/* Using :focus-visible to avoid mouse-triggered focus styles */
a:focus-visible,
button:focus-visible,
input:focus-visible {
  outline: 3px solid #005fcc;
}
```

```html
<!-- Focusable element with visible focus -->
<a href="/settings">Account settings</a>
```