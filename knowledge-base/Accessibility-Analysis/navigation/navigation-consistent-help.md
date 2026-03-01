# Navigation: Consistent Help

## Tags
Tags: #navigation #help #consistent-help #wcag #3.2.6 #eaa

## Purpose
Ensure help mechanisms are available in a consistent location across pages, so users who need assistance can reliably find it.

## Key points
- If a help mechanism is provided on multiple pages, it must appear in the same relative location on each page (WCAG 3.2.6).
- Help mechanisms include: contact information, human contact options, self-help resources, and fully automated contact mechanisms (chatbots).
- Consistent placement reduces cognitive load for users who need assistance.
- Help should be easy to find without requiring users to search for it.
- This applies to phone numbers, email links, chat widgets, FAQ links, and help pages.

## Developer checks
- Identify all help mechanisms available on the site (contact pages, chat widgets, help links, phone numbers).
- Verify help is available in the same relative location on every page (e.g., always in the footer, always in the header).
- Check that the labeling of help mechanisms is consistent across pages.
- Confirm help mechanisms are accessible to keyboard and screen reader users.
- Verify chat widgets and help overlays follow modal focus management rules.

## Fix patterns
- Place help links or contact information in a consistent location (e.g., header or footer) across all pages.
- Use a shared component for the help section to ensure consistency.
- Label help mechanisms consistently (e.g., always use "Help" or always use "Support").
- Ensure chatbot widgets are keyboard accessible and have ARIA roles.
- Include multiple help methods where possible (phone, email, chat, FAQ).

## Examples
```html
<!-- Consistent help in footer across all pages -->
<footer>
  <div class="help-section">
    <h2>Need help?</h2>
    <ul>
      <li><a href="/help">Help centre</a></li>
      <li><a href="/contact">Contact us</a></li>
      <li>Phone: <a href="tel:+353123456789">+353 1 234 5678</a></li>
      <li>Email: <a href="mailto:support@example.com">support@example.com</a></li>
    </ul>
  </div>
</footer>

<!-- Consistent help link in header -->
<header>
  <nav aria-label="Main navigation">
    <ul>
      <li><a href="/">Home</a></li>
      <li><a href="/products">Products</a></li>
      <li><a href="/help">Help</a></li>
    </ul>
  </nav>
</header>
```
