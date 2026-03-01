# Assistive Technology: Screen Magnification

## Tags
Tags: #assistive-technology #magnification #zoom #low-vision #wcag #eaa

## Purpose
Ensure web content is usable with screen magnification tools, which enlarge a portion of the screen for users with low vision.

## Key points
- Screen magnification users see only a small portion of the screen at any time.
- Content must remain readable and functional when magnified up to 200–400%.
- Spatial relationships between elements (e.g., a label and its field) must be maintained at high magnification levels.
- Tooltips, error messages, and notifications may appear outside the magnified viewport.
- Content that relies on the user seeing the full page at once is inaccessible to magnification users.
- Common magnification tools include ZoomText, Windows Magnifier, macOS Zoom, and browser zoom.

## Developer checks
- Zoom the browser to 200% and 400% and verify all content is accessible.
- Check that labels remain visually close to their associated form fields at high zoom.
- Verify tooltips and error messages appear near the triggering element.
- Confirm no content is clipped by `overflow: hidden` when zoomed.
- Test that focus indicators are visible and correctly positioned when magnified.
- Ensure notifications and status messages appear near the user's current viewport area.

## Fix patterns
- Keep labels adjacent to (preferably above) their form fields so they remain visible when zoomed.
- Position error messages and tooltips near their associated elements.
- Use relative units for layout to support smooth zoom behaviour.
- Avoid absolute positioning that separates related elements at high magnification.
- Ensure content reflows at narrow widths (equivalent to high zoom).
- Place status messages and notifications near the user's focus area, not in distant corners.

## Examples
```css
/* Labels above fields stay visible when zoomed */
.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  margin-bottom: 4px;
}

/* Error messages positioned near their field */
.field-error {
  margin-top: 4px;
  color: #c00;
  font-size: 0.9rem;
}
```

```html
<!-- Label above input (magnification-friendly) -->
<div class="form-group">
  <label for="email">Email address</label>
  <input id="email" type="email" aria-describedby="emailError">
  <div id="emailError" class="field-error">Please enter a valid email.</div>
</div>

<!-- Avoid: label far from input -->
<!-- On a magnified view, the user may see the input but not the label -->
<table>
  <tr>
    <td>Email address</td>
    <td><input type="email"></td>
  </tr>
</table>
```
