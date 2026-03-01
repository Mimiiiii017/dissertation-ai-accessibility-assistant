# Input Modalities: Switch Access and Alternative Input Devices

## Tags
Tags: #input-modalities #switch-access #alternative-input #assistive-technology #wcag #eaa

## Purpose
Ensure web content is usable with switch access devices and other alternative input methods used by people with significant motor impairments.

## Key points
- Switch access allows users to interact with a device using one or more switches (buttons, sip-and-puff, head movement sensors).
- Switch users typically navigate by scanning through focusable elements sequentially.
- All interactive elements must be focusable and operable with switch input.
- The focus order must be logical and efficient — excessive focusable elements increase scan time.
- Custom widgets must support focus and activation through standard keyboard events, which switch devices emulate.
- Switch users need visible focus indicators, efficient navigation paths, and skip links.

## Developer checks
- Tab through the entire page and count the number of focusable elements; minimize unnecessary tab stops.
- Verify all interactive elements are keyboard-focusable and activatable.
- Check that focus order follows a logical, efficient sequence.
- Confirm skip links are present to bypass repetitive navigation.
- Test that custom widgets respond to Enter and Space key events.
- Verify focus indicators are clearly visible.
- Ensure no keyboard traps exist that would prevent switch users from continuing.

## Fix patterns
- Use semantic HTML elements that are natively focusable and activatable.
- Provide skip links to reduce scanning time.
- Minimise the number of focusable elements on a page where possible.
- Group related controls to reduce the number of tab stops.
- Use `tabindex="-1"` to remove non-essential elements from the tab order.
- Ensure focus indicators have strong visual contrast.
- Avoid interactions that require holding a key/button, as switch users typically use momentary activation.

## Examples
```html
<!-- Skip link benefits switch users by reducing scanning -->
<a href="#main" class="skip-link">Skip to main content</a>

<!-- Efficient grouping: toolbar with roving tabindex -->
<div role="toolbar" aria-label="Text formatting">
  <button tabindex="0" aria-label="Bold">B</button>
  <button tabindex="-1" aria-label="Italic">I</button>
  <button tabindex="-1" aria-label="Underline">U</button>
</div>
```

```js
// Roving tabindex: reduce tab stops for switch users
toolbar.addEventListener('keydown', (e) => {
  const buttons = [...toolbar.querySelectorAll('button')];
  const current = buttons.indexOf(document.activeElement);

  if (e.key === 'ArrowRight') {
    const next = (current + 1) % buttons.length;
    buttons[current].tabIndex = -1;
    buttons[next].tabIndex = 0;
    buttons[next].focus();
  }
  if (e.key === 'ArrowLeft') {
    const prev = (current - 1 + buttons.length) % buttons.length;
    buttons[current].tabIndex = -1;
    buttons[prev].tabIndex = 0;
    buttons[prev].focus();
  }
});
```
