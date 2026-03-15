# Tables: Data Tables and Headers

## Tags
Tags: #tables #data-tables #semantic-html #wcag #1.3.1

## Purpose
Ensure data tables are structured so users of assistive technologies can understand relationships between headers and data cells.

## Key points
- Tables must be used only for tabular data, not layout.
- Header cells must be identified using `<th>`.
- Relationships between headers and data cells must be programmatically defined.
- Simple tables can rely on proper `<th>` placement.
- Complex tables may require additional attributes to clarify associations.

## Developer checks
- Confirm tables are used for data, not visual layout.
- Check that column and row headers use `<th>` instead of `<td>`.
- Verify headers are correctly scoped to rows or columns.
- Ensure table captions are present when context is needed.
- Test table navigation with a screen reader to confirm header announcements.

## Fix patterns
- Replace layout tables with CSS-based layouts.
- Convert header cells from `<td>` to `<th>`.
- Add `scope="col"` or `scope="row"` to header cells.
- Include a `<caption>` to describe the table’s purpose.
- Simplify overly complex tables where possible.

## Examples
```html
<!-- Simple data table -->
<table>
  <caption>Monthly sales figures</caption>
  <thead>
    <tr>
      <th scope="col">Month</th>
      <th scope="col">Sales</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th scope="row">January</th>
      <td>€10,000</td>
    </tr>
    <tr>
      <th scope="row">February</th>
      <td>€12,500</td>
    </tr>
  </tbody>
</table>

<!-- Incorrect (layout table – not recommended) -->
<table>
  <tr>
    <td>Sidebar</td>
    <td>Main content</td>
  </tr>
</table>
```
