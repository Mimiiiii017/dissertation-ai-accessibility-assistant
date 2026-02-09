# Standards: EAA Functional Performance Statements

## Tags
Tags: #standards #eaa #en-301-549 #functional-performance #disabilities

## Purpose
Explain the functional performance statements in EN 301 549, which define the conditions under which ICT products and services must be usable, covering a range of disabilities and usage contexts.

## Key points
- Functional performance statements describe usage scenarios based on disability rather than specific technical criteria.
- They ensure products are usable when a person has no vision, limited vision, no colour perception, no hearing, limited hearing, no vocal capability, limited manipulation or strength, limited reach, or limited cognition.
- These statements apply when specific technical requirements in EN 301 549 do not cover a particular situation.
- They provide a "safety net" to ensure accessibility is addressed even for scenarios not covered by WCAG.
- Products must provide at least one mode of operation that works for each functional performance condition.
- The statements bridge the gap between technical standards and real-world usability.

### The Functional Performance Statements
1. **Usage without vision** — All functionality must be available without visual output.
2. **Usage with limited vision** — Content must be perceivable with reduced visual acuity.
3. **Usage without perception of colour** — Information must not rely on colour alone.
4. **Usage without hearing** — All functionality must be available without audio output.
5. **Usage with limited hearing** — Audio content must be perceivable with reduced hearing.
6. **Usage without vocal capability** — Functionality must not require voice input exclusively.
7. **Usage with limited manipulation or strength** — Interaction must not require fine motor control or physical strength.
8. **Usage with limited reach** — Physical products must be reachable from various positions.
9. **Usage to minimise triggers for photosensitive seizures** — Content must not cause seizures.
10. **Usage with limited cognition, language, or learning** — Content must be understandable and operable.
11. **Privacy** — Accessibility features must maintain user privacy equally.

## Developer checks
- For each functional performance statement, verify the product provides at least one mode of operation that satisfies it.
- Check if any functionality is only available through a single modality (e.g., audio-only, visual-only, voice-only).
- Verify privacy-sensitive features (e.g., password entry) are equally accessible in alternative modes.
- Assess whether assistive technology compatibility covers all functional performance scenarios.
- Review product documentation for references to supported usage modes.

## Fix patterns
- Provide text alternatives for all visual content (usage without vision).
- Support zoom, magnification, and high contrast (usage with limited vision).
- Use non-colour indicators alongside colour (usage without colour perception).
- Provide captions and visual alternatives for audio (usage without hearing).
- Offer keyboard and switch alternatives for all mouse and voice interactions.
- Ensure physical products have reachable controls and do not require excessive force.
- Use clear, simple language and consistent navigation (usage with limited cognition).
- Ensure private data entry is accessible without exposing information to bystanders.

## Examples
No code examples — this topic covers compliance framework and assessment approaches.
