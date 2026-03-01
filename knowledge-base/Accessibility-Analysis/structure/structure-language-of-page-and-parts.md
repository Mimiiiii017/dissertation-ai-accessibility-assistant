# Structure: Language of Page and Parts

## Tags
Tags: #structure #language #lang-attribute #wcag #3.1.1 #3.1.2

## Purpose
Ensure the default human language of each page and any language changes within the content are programmatically identified, so screen readers and other assistive technologies can switch pronunciation and processing rules correctly.

## Key points
- The primary language of each web page must be identified using the `lang` attribute on the `<html>` element (WCAG 3.1.1).
- Passages or phrases in a language different from the page default must be identified with a `lang` attribute on the enclosing element (WCAG 3.1.2).
- Screen readers use the `lang` attribute to select the correct speech synthesiser and pronunciation rules.
- Incorrect or missing language identification causes screen readers to mispronounce content.
- Language codes must use valid BCP 47 values (e.g., `en`, `fr`, `de`, `es`, `nl`).
- Exceptions include proper nouns, technical terms, and words that have become part of the surrounding language.

## Developer checks
- Confirm the `<html>` element has a `lang` attribute with a valid language code.
- Verify the `lang` value matches the actual language of the page.
- Identify any passages in a different language and check they have a `lang` attribute.
- Test with a screen reader to confirm correct pronunciation switching.
- Check that language codes are valid BCP 47 values (not made-up or incorrect codes).

## Fix patterns
- Add `lang` to the `<html>` element if missing.
- Correct invalid language codes (e.g., `lang="english"` should be `lang="en"`).
- Wrap foreign-language passages in a `<span>` or other element with the correct `lang` attribute.
- Include `lang` on blockquotes, citations, and embedded content in other languages.
- Document the primary language decision for multilingual sites.

## Examples
```html
<!-- Correct: page-level language -->
<html lang="en">

<!-- Correct: language change within content -->
<p>The French phrase <span lang="fr">c'est la vie</span> means "that's life."</p>

<!-- Correct: blockquote in another language -->
<blockquote lang="de">
  <p>Die Würde des Menschen ist unantastbar.</p>
</blockquote>

<!-- Correct: navigation in a multilingual site -->
<nav>
  <a href="/en" lang="en">English</a>
  <a href="/fr" lang="fr">Français</a>
  <a href="/es" lang="es">Español</a>
</nav>

<!-- Incorrect: missing lang attribute -->
<html>
  <!-- screen reader will guess the language -->

<!-- Incorrect: invalid lang value -->
<html lang="english">
```
