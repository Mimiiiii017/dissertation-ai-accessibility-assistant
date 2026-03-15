# Forms: Error Messages and Validation Feedback

## Tags
Tags: #forms #errors #validation #aria #wcag #3.3.1 #3.3.3

## Purpose
Ensure form errors and validation feedback are clearly communicated to all users, including those using assistive technologies, so issues can be identified and corrected efficiently.

## Key points
- Error messages must be perceivable, understandable, and programmatically associated with the relevant field.
- Errors should explain what went wrong and how to fix it.
- Do not rely on color alone to indicate errors.
- Errors triggered dynamically must be announced to screen readers.
- Error summaries are recommended for forms with multiple errors.

## Developer checks
- Check that each invalid field has an associated error message.
- Verify error messages are linked to fields using `aria-describedby` or equivalent.
- Confirm dynamic errors are announced (e.g., via live regions).
- Ensure error text is concise and actionable.
- Check that focus moves to the error (or error summary) on submission failure.

## Fix patterns
- Add a dedicated error message element per field and link it programmatically.
- Use `role="alert"` or `aria-live="assertive"` for dynamic error announcements.
- Include an error summary at the top of the form when multiple errors occur.
- Provide clear guidance on how to correct each error.
- Pair visual indicators (icons, text) with color to signal errors.

## Examples
```html
<!-- Field-level error message -->
<label for="email">Email address</label>
<input id="email" type="email" aria-describedby="emailError" aria-invalid="true">
<div id="emailError">
  Please enter a valid email address.
</div>

<!-- Dynamic error announcement -->
<div role="alert">
  There was a problem submitting the form. Please review the errors below.
</div>

<!-- Error summary -->
<div role="alert">
  <p>Please fix the following errors:</p>
  <ul>
    <li>Email address is invalid.</li>
    <li>Password must be at least 8 characters.</li>
  </ul>
</div>
```
