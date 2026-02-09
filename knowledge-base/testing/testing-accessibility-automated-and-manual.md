# Testing: Accessibility Automated and Manual Testing

## Tags
Tags: #testing #accessibility-testing #automation #manual-testing #wcag

## Purpose
Explain how automated and manual accessibility testing complement each other, and why both are necessary to identify and resolve accessibility issues effectively.

## Key points
- Automated testing can detect only a portion of accessibility issues.
- Manual testing is essential for assessing usability and real user experience.
- Accessibility testing should occur throughout development, not only at the end.
- Testing must include keyboard and assistive technology checks.
- Accessibility conformance cannot be guaranteed through automation alone.

## Developer checks
- Run automated accessibility checks during development.
- Test all interactive functionality using only a keyboard.
- Review page structure, headings, and labels manually.
- Test dynamic content updates and form validation feedback.
- Verify focus order and focus visibility during interactions.

## Fix patterns
- Use automated tools to catch common issues early.
- Follow up automated results with manual inspection.
- Test pages with screen readers where possible.
- Include accessibility checks in code reviews and QA processes.
- Retest after fixes to ensure no regressions occur.

## Examples

### Recommended automated testing tools
- **axe DevTools** — Browser extension for automated WCAG checks.
- **Lighthouse** — Built into Chrome DevTools, includes accessibility audits.
- **WAVE** — Browser extension that provides visual accessibility feedback.
- **Pa11y** — Command-line tool for automated testing in CI/CD pipelines.
- **eslint-plugin-jsx-a11y** — Linter plugin for catching accessibility issues in React JSX.

### Recommended manual testing techniques
- **Keyboard-only navigation** — Tab through the entire page using Tab, Shift+Tab, Enter, Space, Escape, and arrow keys.
- **Screen reader testing** — Test with NVDA (Windows), JAWS (Windows), VoiceOver (macOS/iOS), or TalkBack (Android).
- **Zoom testing** — Zoom to 200% and 400% and check for content loss or overlap.
- **Text spacing test** — Apply WCAG text spacing bookmarklet and check for clipping.
- **Color contrast check** — Use a contrast checker tool on all text and UI components.
- **Forced colors / High contrast** — Test in Windows High Contrast Mode.

### Example CI/CD integration
```bash
# Run Pa11y in a CI pipeline
npx pa11y https://example.com --standard WCAG2AA --reporter json

# Run axe-core in a test suite
npx jest --testPathPattern=accessibility
```

```js
// axe-core integration in a test
const { axe } = require('axe-core');

describe('Accessibility', () => {
  it('should have no accessibility violations', async () => {
    const results = await axe(document);
    expect(results.violations).toHaveLength(0);
  });
});
```