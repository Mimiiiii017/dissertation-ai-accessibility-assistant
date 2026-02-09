# Navigation: Link Purpose and Meaningful Link Text

## Tags
Tags: #navigation #links #link-purpose #link-text #wcag #2.4.4

## Purpose
Ensure link text clearly describes the destination or action of the link, so users of screen readers and other assistive technologies can understand links without needing surrounding context.

## Key points
- Every link must have text that describes its purpose.
- Link purpose must be determinable from the link text alone or from the link text together with its programmatic context (enclosing paragraph, list item, table cell, or heading).
- Generic link text such as "click here," "read more," or "learn more" is insufficient on its own.
- Screen reader users often navigate links out of context (e.g., listing all links on a page).
- Image links must use alt text to describe the link destination.
- Links to files should indicate the file type and size where possible.

## Developer checks
- List all links on the page and review their text in isolation.
- Check for generic text like "click here," "more," "read more," or "here."
- Verify image links have meaningful alt text describing the destination.
- Confirm links to downloads include file type information (e.g., "Annual Report (PDF, 2MB)").
- Test by using a screen reader's link list feature and checking whether links are understandable.

## Fix patterns
- Replace generic link text with descriptive text (e.g., "Read the accessibility policy" instead of "click here").
- Use `aria-label` or `aria-labelledby` to provide a more descriptive name when the visible text must remain short.
- Add visually hidden text to supplement brief visible link text.
- Include file type and size in link text for downloads.
- Ensure link text is unique when links go to different destinations.

## Examples
```html
<!-- Incorrect: generic link text -->
<p>To view our accessibility policy, <a href="/policy">click here</a>.</p>

<!-- Correct: descriptive link text -->
<p><a href="/policy">View our accessibility policy</a>.</p>

<!-- Correct: aria-label supplements short visible text -->
<a href="/report" aria-label="Read the 2025 Annual Report (PDF, 3MB)">
  Annual Report
</a>

<!-- Correct: visually hidden text adds context -->
<a href="/news/climate">
  Read more <span class="sr-only">about climate change initiatives</span>
</a>

<!-- Correct: image link with descriptive alt -->
<a href="/home">
  <img src="logo.png" alt="Acme Corp homepage">
</a>

<!-- Correct: download link with file info -->
<a href="/files/guide.pdf">
  Accessibility guide (PDF, 1.2 MB)
</a>
```

```css
/* Visually hidden class for supplementary link text */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```
