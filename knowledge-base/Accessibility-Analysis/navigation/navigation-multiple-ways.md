# Navigation: Multiple Ways to Find Pages

## Tags
Tags: #navigation #multiple-ways #site-map #search #wcag #2.4.5

## Purpose
Ensure users can locate web pages within a set of pages through more than one method, accommodating different user needs and navigation preferences.

## Key points
- At least two methods must be available to find and navigate to any page in the site.
- Common methods include: navigation menus, site maps, site search, tables of contents, and links between related pages.
- Different users prefer different navigation methods depending on their abilities and context.
- Screen reader users may prefer search or site maps over complex menus.
- Users with cognitive disabilities benefit from multiple navigation strategies.
- This applies to sets of pages, not to pages that are part of a linear process (e.g., checkout steps).

## Developer checks
- Verify at least two navigation methods are available (e.g., main menu plus search).
- Check that a site map or table of contents exists for larger sites.
- Confirm the search function works and returns relevant results.
- Ensure all navigation methods are keyboard accessible.
- Verify linked pages include contextual or related links where appropriate.

## Fix patterns
- Add a site search feature if only a main navigation menu exists.
- Create a site map page listing all major pages and sections.
- Add breadcrumb navigation to help users understand their location.
- Include related page links at the bottom of content pages.
- Ensure the search function is prominent and accessible.

## Examples
```html
<!-- Primary navigation -->
<nav aria-label="Main navigation">
  <ul>
    <li><a href="/">Home</a></li>
    <li><a href="/products">Products</a></li>
    <li><a href="/about">About</a></li>
    <li><a href="/contact">Contact</a></li>
  </ul>
</nav>

<!-- Site search (second way to find content) -->
<form role="search" aria-label="Site search">
  <label for="search">Search</label>
  <input type="search" id="search" name="q">
  <button type="submit">Search</button>
</form>

<!-- Breadcrumb navigation (additional context) -->
<nav aria-label="Breadcrumb">
  <ol>
    <li><a href="/">Home</a></li>
    <li><a href="/products">Products</a></li>
    <li aria-current="page">Widget Pro</li>
  </ol>
</nav>

<!-- Site map link -->
<footer>
  <a href="/sitemap">Site Map</a>
</footer>
```
