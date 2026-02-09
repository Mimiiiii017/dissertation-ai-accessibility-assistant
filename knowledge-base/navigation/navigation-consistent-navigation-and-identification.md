# Navigation: Consistent Navigation and Identification

## Tags
Tags: #navigation #consistency #consistent-navigation #consistent-identification #wcag #3.2.3 #3.2.4

## Purpose
Ensure navigation mechanisms and functional components are presented consistently across pages, so users can predict where to find them and what they do.

## Key points
- Navigation menus that appear on multiple pages must be presented in the same relative order on each page (WCAG 3.2.3).
- Components that have the same functionality across pages must be identified consistently (same text, icons, and labels) (WCAG 3.2.4).
- Consistent navigation helps users with cognitive disabilities build mental models of the site.
- Changing the order or labeling of navigation items between pages creates confusion.
- Additional items may be added to navigation, but the existing order must be maintained.
- Consistent identification means a search function should always be labeled "Search," not "Find" on one page and "Search" on another.

## Developer checks
- Compare the navigation menu across multiple pages and confirm the order is consistent.
- Check that icons used for the same function are identical across pages.
- Verify labels for the same function are consistent (e.g., "Log in" vs. "Sign in" used interchangeably).
- Confirm the search function has the same label and position on all pages.
- Check header and footer content for consistent ordering and labeling.

## Fix patterns
- Use shared navigation components (templates or components) to enforce consistency.
- Standardise labels across the site (choose "Log in" or "Sign in" and use it everywhere).
- Keep navigation item order stable; only add new items without rearranging existing ones.
- Use the same icon and label combinations for repeated functions.
- Create a design system or style guide that documents standard labels and patterns.

## Examples
```html
<!-- Consistent navigation across pages -->
<!-- Page 1 -->
<nav aria-label="Main navigation">
  <ul>
    <li><a href="/">Home</a></li>
    <li><a href="/products">Products</a></li>
    <li><a href="/about">About</a></li>
    <li><a href="/contact">Contact</a></li>
  </ul>
</nav>

<!-- Page 2: same order maintained -->
<nav aria-label="Main navigation">
  <ul>
    <li><a href="/">Home</a></li>
    <li><a href="/products">Products</a></li>
    <li><a href="/about">About</a></li>
    <li><a href="/contact">Contact</a></li>
  </ul>
</nav>

<!-- Incorrect: inconsistent labeling of the same function -->
<!-- Page 1 -->
<a href="/search">Search</a>
<!-- Page 2 -->
<a href="/search">Find</a>

<!-- Correct: consistent labeling -->
<!-- All pages -->
<a href="/search">Search</a>
```
