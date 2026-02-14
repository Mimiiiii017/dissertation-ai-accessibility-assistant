# Assistive Technology: Braille Displays

## Tags
Tags: #assistive-technology #braille #braille-displays #screen-readers #wcag #eaa

## Purpose
Ensure web content works well with refreshable braille displays, which render screen reader output as tactile braille characters for users who are deafblind or prefer braille over speech.

## Key points
- Braille displays present content as tactile braille characters line by line.
- Braille users rely on the same accessibility tree as screen reader speech users, but the output modality is different.
- Content structure (headings, landmarks, lists) is critical for braille navigation.
- Alt text, labels, and ARIA attributes are read on braille displays exactly as provided.
- Overly long accessible names or alt text cause content to overflow the limited display width (typically 40–80 cells).
- Special characters, emoji, and non-standard symbols may not render meaningfully in braille.

## Developer checks
- Verify all content has programmatic structure (headings, lists, tables, landmarks).
- Check that accessible names and alt text are concise (braille displays are typically 40 characters wide).
- Confirm ARIA roles and properties are correctly applied so braille users get accurate structural information.
- Test with a screen reader in braille mode if possible (NVDA and JAWS support braille output).
- Ensure form labels, error messages, and instructions are clearly structured.
- Avoid relying on emoji or special symbols to convey meaning.

## Fix patterns
- Keep alt text and `aria-label` values concise (under 80 characters where possible).
- Use proper heading hierarchy so braille users can navigate by heading.
- Ensure all interactive elements have clear, descriptive accessible names.
- Replace emoji or symbols used for meaning with text equivalents.
- Use `<abbr>` with a `title` attribute for abbreviations that may be ambiguous in braille.
- Structure data tables with proper headers so they are navigable on braille displays.

## Examples
```html
<!-- Good: concise alt text for braille display -->
<img src="chart.png" alt="Sales increased 20% in Q4 2025">

<!-- Poor: excessively long alt text overflows braille display -->
<img src="chart.png" alt="This is a detailed bar chart showing the company's quarterly sales figures for the year 2025 including Q1 at 50000 euros Q2 at 55000 euros Q3 at 58000 euros and Q4 at 66000 euros representing a 20 percent increase in the final quarter compared to Q1">

<!-- Use text instead of emoji for meaning -->
<!-- Incorrect -->
<p>Status: </p>
<!-- Correct -->
<p>Status: Approved</p>

<!-- Abbreviations with expanded form -->
<p>Tested with <abbr title="NonVisual Desktop Access">NVDA</abbr> braille output.</p>
```
