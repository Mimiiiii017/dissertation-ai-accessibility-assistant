# Images: Managing Alternative Text (alt)

## Tags
Tags: #images #alt-text #non-text-content #wcag #1.1.1

## Purpose
Explain how to provide appropriate alternative text for images so non-text content is accessible to users of assistive technologies.

## Key points
- Every `<img>` and `<input type="image">` must have an `alt` attribute.
- The `alt` text must convey the purpose or information of the image.
- Decorative images must have an empty `alt` attribute (`alt=""`).
- Informative images must have meaningful, concise alternative text.
- Images that act as links or buttons must describe the action, not just the appearance.
- The same image used in different contexts may require different `alt` text.

## Developer checks
- Check that all `<img>` elements include an `alt` attribute.
- Verify that decorative images use `alt=""` and are not announced by screen readers.
- Ensure informative images do not have vague alt text such as “image” or “photo”.
- Confirm that image links describe the destination or action.
- Check `<input type="image">` elements for appropriate `alt` text.

## Fix patterns
- Add missing `alt` attributes to images.
- Replace filename-based or generic alt text with meaningful descriptions.
- Use `alt=""` for purely decorative images that add no information.
- Rewrite alt text to describe function when images are interactive.
- Avoid duplicating adjacent text content in the `alt` attribute unless necessary.

## Examples
```html
<!-- Informative image -->
<img src="logo.png" alt="Company name">

<!-- Decorative image -->
<img src="divider.png" alt="">

<!-- Image used as a link -->
<a href="/home">
  <img src="home-icon.png" alt="Go to homepage">
</a>

<!-- Image input -->
<input type="image" src="search.png" alt="Search">
```