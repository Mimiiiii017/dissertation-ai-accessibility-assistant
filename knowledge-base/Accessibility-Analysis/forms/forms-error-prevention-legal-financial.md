# Forms: Error Prevention for Legal, Financial, and Data Submissions

## Tags
Tags: #forms #error-prevention #legal #financial #wcag #3.3.4

## Purpose
Ensure that submissions involving legal commitments, financial transactions, or data modification are reversible, verifiable, or confirmable, protecting users from serious consequences of errors.

## Key points
- Submissions that cause legal, financial, or data consequences must include at least one of: reversibility (undo), review (check before submit), or confirmation (explicit acknowledgement).
- Users with disabilities are more likely to make input errors due to interface barriers.
- One-click purchases, irrevocable deletions, and binding agreements without confirmation are high-risk patterns.
- Review pages that summarise input before final submission are a strong pattern.
- Confirmation dialogs for destructive or irreversible actions add a safety net.

## Developer checks
- Identify all forms that involve legal, financial, or data-changing actions.
- Check whether users can review their input before final submission.
- Verify that submitted data can be corrected or reversed after submission.
- Confirm destructive actions (delete, cancel subscription) require confirmation.
- Ensure error recovery mechanisms exist for critical transactions.

## Fix patterns
- Add a review/confirmation step before final submission of critical forms.
- Allow users to edit submitted information within a reasonable time period.
- Provide an undo mechanism for reversible actions.
- Require explicit confirmation for deletions and irreversible changes.
- Clearly label the final submission button (e.g., "Confirm and Pay" vs. "Next").

## Examples
```html
<!-- Review step before submission -->
<section aria-label="Review your order">
  <h2>Review your order</h2>
  <dl>
    <dt>Item</dt>
    <dd>Widget Pro</dd>
    <dt>Quantity</dt>
    <dd>2</dd>
    <dt>Total</dt>
    <dd>€49.98</dd>
  </dl>
  <button onclick="goBack()">Edit order</button>
  <button onclick="confirmOrder()">Confirm and pay</button>
</section>

<!-- Confirmation dialog for deletion -->
<div role="alertdialog" aria-labelledby="deleteTitle" aria-describedby="deleteDesc">
  <h2 id="deleteTitle">Delete account</h2>
  <p id="deleteDesc">This action cannot be undone. All your data will be permanently deleted.</p>
  <button onclick="cancelDelete()">Cancel</button>
  <button onclick="confirmDelete()">Delete my account</button>
</div>

<!-- Undo option after action -->
<div role="status" aria-live="polite">
  <p>Item deleted. <button onclick="undoDelete()">Undo</button></p>
</div>
```
