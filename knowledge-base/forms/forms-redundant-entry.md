# Forms: Redundant Entry

## Tags
Tags: #forms #redundant-entry #wcag #3.3.7 #eaa

## Purpose
Ensure users are not required to re-enter information they have already provided in the same process, reducing cognitive load and errors.

## Key points
- Information previously entered by the user in the same process must be auto-populated or available for selection, unless re-entering is essential for security or the data is no longer valid (WCAG 3.3.7).
- Requiring users to re-enter information increases cognitive load, especially for users with memory or cognitive disabilities.
- Common violations include asking for shipping and billing addresses separately when they are the same, or requiring email re-entry for confirmation.
- Auto-population, "same as above" checkboxes, and pre-filled fields are all valid solutions.
- This applies within a single session/process, not across separate sessions.

## Developer checks
- Trace multi-step forms and identify fields that request information already provided.
- Check whether previously entered data is auto-populated in subsequent steps.
- Verify "same as" or "copy from" options exist where users might need to repeat similar data.
- Confirm re-entry is not required for confirmation purposes (e.g., "confirm email") unless essential.
- Test the full user journey to catch redundant data requests.

## Fix patterns
- Auto-populate fields with data entered in previous steps of the same process.
- Provide a "Same as shipping address" checkbox for billing address fields.
- Store data within the session and pre-fill fields when appropriate.
- Remove unnecessary confirmation fields (e.g., "confirm email address").
- Allow users to select from previously entered data rather than re-typing.

## Examples
```html
<!-- Copy address option -->
<fieldset>
  <legend>Shipping address</legend>
  <label for="shipStreet">Street address</label>
  <input id="shipStreet" type="text" autocomplete="shipping street-address">
</fieldset>

<fieldset>
  <legend>Billing address</legend>
  <label>
    <input type="checkbox" id="sameAddress" onchange="copyShippingToBilling()">
    Same as shipping address
  </label>
  <label for="billStreet">Street address</label>
  <input id="billStreet" type="text" autocomplete="billing street-address">
</fieldset>
```

```js
function copyShippingToBilling() {
  const sameAddress = document.getElementById('sameAddress').checked;
  const billStreet = document.getElementById('billStreet');
  const shipStreet = document.getElementById('shipStreet');

  if (sameAddress) {
    billStreet.value = shipStreet.value;
    billStreet.disabled = true;
  } else {
    billStreet.disabled = false;
  }
}
```
