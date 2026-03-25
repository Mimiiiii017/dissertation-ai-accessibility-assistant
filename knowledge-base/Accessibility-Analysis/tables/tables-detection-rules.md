# Tables: Detection Rules for Accessibility Violations

These are precise detection rules. Check the FIRES condition against the actual code. Do not report if the DOES NOT FIRE condition applies.

---

## Table header missing scope attribute — SC 1.3.1 (F63)

FIRES when: a data table (`<table>`) contains `<th>` elements that have no `scope` attribute AND the table has both row and column headers (complex table). Without `scope`, screen readers cannot determine which data cells the header applies to.

DOES NOT FIRE when:
- `<th scope="col">` or `<th scope="row">` is present
- The table is a simple one-directional table with only column headers in the first row (some screen readers can infer `scope="col"` in this case, but explicit is preferred)
- The element is NOT a data table (e.g. a layout table with `role="presentation"`)

```html
<!-- FIRES: th with no scope in a complex table -->
<table>
  <tr><th></th><th>Q1</th><th>Q2</th></tr>
  <tr><th>Revenue</th><td>100</td><td>200</td></tr>
</table>

<!-- DOES NOT FIRE -->
<table>
  <tr><th scope="col">Name</th><th scope="col">Score</th></tr>
  <tr><td>Alice</td><td>95</td></tr>
</table>
```

---

## Data table with no caption or summary — SC 1.3.1

FIRES when: a data table has no `<caption>` element AND the table is not labelled by `aria-label` or `aria-labelledby`, making its purpose unclear to screen reader users.

DOES NOT FIRE when:
- `<caption>` is present and describes the table
- `aria-label="..."` on the `<table>` element
- The table is a layout table (`role="presentation"`)

---

## Layout table using th elements — best practice

FIRES when: a table used purely for layout (no data relationship between cells) contains `<th>` elements, which incorrectly announce header semantics to screen readers.

DOES NOT FIRE when:
- The table uses `role="presentation"` or `role="none"` (suppresses table semantics)
- The table is a genuine data table with meaningful row/column relationships
