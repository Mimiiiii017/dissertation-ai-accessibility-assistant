# Cognitive: Reading Disabilities and Dyslexia

## Tags
Tags: #cognitive #reading-disabilities #dyslexia #plain-language #wcag #eaa

## Purpose
Ensure web content is accessible to users with reading disabilities, dyslexia, and other cognitive or learning disabilities by using clear language, supportive layout, and flexible presentation.

## Key points
- Approximately 10–15% of the population has dyslexia or a related reading difficulty.
- Long paragraphs, dense text, justified alignment, and poor line spacing create reading barriers.
- Plain, clear language reduces cognitive load for all users.
- Users should be able to customise text presentation (size, spacing, font, color).
- Supplementary content (images, icons, diagrams) supports comprehension.
- Complex vocabulary, idioms, and abbreviations without explanation create barriers.

## Developer checks
- Review content for unnecessarily complex vocabulary and jargon.
- Check text alignment — avoid full justification (`text-align: justify`).
- Verify line height is at least 1.5× the font size.
- Confirm paragraph spacing is adequate.
- Check that abbreviations and acronyms are explained on first use.
- Verify users can adjust text spacing without content loss (WCAG 1.4.12).
- Ensure text can be resized to 200% without loss of content.

## Fix patterns
- Use plain language; keep sentences short and direct.
- Avoid full justification — use left-aligned text (`text-align: left` for LTR languages).
- Set line height to at least 1.5.
- Use generous paragraph spacing.
- Explain abbreviations on first use with `<abbr>` or inline text.
- Supplement text with icons, images, or diagrams where helpful.
- Allow font and color customisation through user stylesheets or site settings.
- Provide a glossary for specialised terminology.

## Examples
```css
/* Dyslexia-friendly text defaults */
body {
  font-family: 'Arial', 'Helvetica', sans-serif;
  font-size: 1rem;
  line-height: 1.8;
  text-align: left;
  letter-spacing: 0.03em;
  word-spacing: 0.1em;
  max-width: 70ch; /* limit line length */
}

p + p {
  margin-top: 1.5em;
}

/* Avoid: justified text creates uneven spacing */
.bad-example {
  text-align: justify;
}
```

```html
<!-- Abbreviation explained -->
<p>The <abbr title="European Accessibility Act">EAA</abbr> requires digital services to be accessible.</p>

<!-- Supplementary visual alongside text -->
<div class="instruction">
  <img src="save-icon.png" alt="" aria-hidden="true">
  <p>Click <strong>Save</strong> to store your changes.</p>
</div>

<!-- Simple, clear language -->
<!-- Incorrect: "Utilise the aforementioned mechanism to effectuate a modification." -->
<!-- Correct: -->
<p>Use the tool above to make a change.</p>
```
