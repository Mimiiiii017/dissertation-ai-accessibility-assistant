# Standards: Accessible Documents and PDFs

## Tags
Tags: #standards #documents #pdf #accessible-documents #eaa #en-301-549

## Purpose
Ensure non-web documents (PDFs, Word documents, spreadsheets, presentations) meet accessibility requirements, as required by the EAA and EN 301 549.

## Key points
- The EAA and EN 301 549 require documents published as part of digital services to be accessible.
- PDF is the most common non-web document format and is also the most problematic for accessibility.
- Accessible PDFs must be tagged with a logical structure (headings, lists, tables, reading order).
- Image-only (scanned) PDFs are completely inaccessible to screen readers.
- HTML is almost always more accessible than PDF — offer HTML alternatives when possible.
- Microsoft Office documents must use built-in accessibility features (heading styles, alt text, table headers).

### PDF accessibility requirements
- PDFs must be tagged (not image-only scans).
- A logical reading order must be defined.
- All images must have alternative text.
- Tables must have row and column headers marked.
- Language must be specified in the document properties.
- Links must be clearly labelled.
- Colour contrast must meet minimum ratios.
- Forms in PDFs must have labelled fields.

## Developer checks
- Check whether PDFs are tagged or image-only scans (open in Acrobat and check Tags panel).
- Verify reading order matches the visual layout.
- Confirm all images have alt text.
- Check that tables have header cells marked correctly.
- Verify the document language is set.
- Test the PDF with a screen reader (NVDA, JAWS, VoiceOver).
- Run the built-in accessibility checker in Adobe Acrobat or PAC (PDF Accessibility Checker).

## Fix patterns
- Use heading styles in the source application (Word, InDesign) before exporting to PDF.
- Export PDFs with the "Create tagged PDF" option enabled.
- Run OCR on scanned documents and then add structural tags.
- Replace image-only PDFs with tagged PDFs or HTML alternatives.
- Add alt text to all informational images before exporting.
- Set the document language in file properties.
- Offer an HTML version of the content as an accessible alternative.
- Use the Acrobat Accessibility Checker (or PAC 2024) to identify and fix remaining issues.

### Recommended tools
- **Adobe Acrobat Pro** — Full PDF tagging, reading order, and accessibility checking.
- **PAC (PDF Accessibility Checker)** — Free tool for checking PDF/UA compliance.
- **axesPDF** — Automated and manual PDF accessibility remediation.
- **Microsoft Word Accessibility Checker** — Built-in checker in Word before PDF export.
- **LibreOffice** — Supports tagged PDF export.

## Examples
```html
<!-- Offer HTML alternative alongside PDF -->
<p>Download the report:</p>
<ul>
  <li><a href="/report.html">Annual Report 2025 (HTML)</a></li>
  <li><a href="/report.pdf">Annual Report 2025 (PDF, 2.4 MB)</a></li>
</ul>
```

### Accessible Word document checklist (before PDF export)
1. Use heading styles (Heading 1, Heading 2, etc.) — do not fake headings with bold text.
2. Add alt text to all images via right-click → Edit Alt Text.
3. Use built-in list styles for numbered and bulleted lists.
4. Define header rows in tables (Table Properties → Row → Repeat as header).
5. Set the document language (File → Options → Language).
6. Use meaningful hyperlink text (not "click here").
7. Run the Accessibility Checker (Review → Check Accessibility).
8. Export with "Create tagged PDF" and "Document structure tags for accessibility" enabled.
