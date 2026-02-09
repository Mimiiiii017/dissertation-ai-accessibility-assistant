# Standards: EAA Support Services, Feedback, and Documentation

## Tags
Tags: #standards #eaa #en-301-549 #support-services #feedback #documentation

## Purpose
Explain the EAA and EN 301 549 requirements for accessible support services, user feedback mechanisms, and product documentation.

## Key points
- Support services (help desks, call centres, technical support) must communicate accessibility features and be accessible themselves.
- Users must be able to provide feedback on accessibility barriers and receive responses.
- Product documentation must describe accessibility features, how to use them, and compatibility with assistive technologies.
- Support must be available through multiple communication channels (phone, email, chat, text relay).
- The feedback mechanism must be easy to find, accessible, and responsive.
- Documentation must be available in accessible formats.

### Support services requirements
- Help desks must be trained on the accessibility features of the product.
- Support must be available in at least the same channels as general customer support.
- Communication must accommodate users of assistive technologies (e.g., text relay services for phone support).
- Response times for accessibility-related queries should match or exceed general support response times.

### Feedback mechanism requirements
- A mechanism for users to report accessibility barriers must be provided.
- The feedback mechanism itself must be accessible.
- Organisations must respond to accessibility feedback within a reasonable timeframe.
- Feedback should result in documented improvements or explanations.

### Documentation requirements
- Product documentation must describe all accessibility features.
- Documentation must explain how to activate and use accessibility features.
- Documentation must list compatible assistive technologies.
- Documentation itself must be in an accessible format (HTML, accessible PDF, not image-only).

## Developer checks
- Verify a feedback mechanism exists for reporting accessibility issues.
- Check that the feedback form or contact method is itself accessible.
- Confirm product documentation describes accessibility features.
- Verify documentation is available in accessible formats.
- Check that support services are aware of accessibility features.
- Ensure multiple communication channels are available for support.

## Fix patterns
- Add an accessible feedback form or email address for accessibility issues.
- Include an "Accessibility" page on the website explaining features and how to get help.
- Create accessible documentation (HTML preferred, accessible PDF acceptable).
- Train support staff on accessibility features and common assistive technology workflows.
- Document compatibility with screen readers, magnification, voice control, and keyboard navigation.
- Publish an accessibility statement with contact information for accessibility issues.

## Examples
```html
<!-- Accessibility feedback link in footer -->
<footer>
  <a href="/accessibility">Accessibility</a>
  <a href="/accessibility-feedback">Report an accessibility issue</a>
</footer>

<!-- Accessible feedback form -->
<form action="/accessibility-feedback" method="post">
  <h2>Report an accessibility issue</h2>

  <label for="feedbackName">Your name</label>
  <input id="feedbackName" type="text" autocomplete="name">

  <label for="feedbackEmail">Email address</label>
  <input id="feedbackEmail" type="email" autocomplete="email">

  <label for="feedbackDesc">Describe the accessibility issue</label>
  <textarea id="feedbackDesc" rows="5"></textarea>

  <label for="feedbackPage">Page URL where the issue occurs</label>
  <input id="feedbackPage" type="url">

  <button type="submit">Submit feedback</button>
</form>
```

```html
<!-- Accessibility statement page -->
<main>
  <h1>Accessibility Statement</h1>
  <p>We are committed to ensuring our website is accessible to all users.</p>

  <h2>Conformance status</h2>
  <p>This website conforms to WCAG 2.1 Level AA with the exceptions noted below.</p>

  <h2>Known limitations</h2>
  <ul>
    <li>Some older PDF documents may not be fully accessible.</li>
  </ul>

  <h2>Feedback</h2>
  <p>If you encounter an accessibility barrier, please
    <a href="/accessibility-feedback">let us know</a>.</p>
  <p>Email: <a href="mailto:accessibility@example.com">accessibility@example.com</a></p>
  <p>Phone: <a href="tel:+353123456789">+353 1 234 5678</a></p>

  <h2>Compatibility</h2>
  <p>This website is designed to be compatible with NVDA, JAWS, VoiceOver, TalkBack, and Dragon NaturallySpeaking.</p>
</main>
```
