# Standards: WCAG, EAA, and EN 301 549 Alignment

## Tags
Tags: #wcag #eaa #en-301-549 #standards #accessibility

## Purpose
Explain how WCAG guidelines relate to the European Accessibility Act (EAA) and EN 301 549, helping developers understand how technical accessibility requirements map to legal obligations in the EU.

## Key points
- WCAG provides the technical success criteria for accessible web content.
- The European Accessibility Act (EAA) establishes legal accessibility requirements in the EU, enforceable from June 28, 2025.
- EN 301 549 is the European technical standard that operationalises accessibility requirements.
- EN 301 549 references WCAG 2.1 Level AA success criteria for web content accessibility (clauses 9, 10, 11).
- Meeting WCAG 2.1 Level AA generally supports compliance with EAA web requirements.
- EAA focuses on outcomes and obligations, while WCAG focuses on implementation details.
- WCAG is structured around four principles: Perceivable, Operable, Understandable, and Robust (POUR).
- WCAG 2.2 (2023) adds additional success criteria including Focus Not Obscured, Dragging Movements, Target Size, Consistent Help, Redundant Entry, and Accessible Authentication.
- EN 301 549 also includes functional performance statements that address usage without vision, hearing, vocal capability, manipulation, and cognition.
- The EAA scope extends beyond web to include mobile apps, self-service terminals, e-commerce, banking, and transport services.

## Developer checks
- Identify which parts of the website fall under EAA scope (e.g. digital services).
- Check whether WCAG Level AA success criteria are met across the site.
- Verify accessibility requirements are considered during procurement and delivery.
- Ensure accessibility is maintained during updates and new feature development.
- Confirm documentation exists showing how accessibility requirements are addressed.

## Fix patterns
- Use WCAG 2.1/2.2 Level AA as the baseline for web accessibility.
- Map WCAG success criteria to EN 301 549 requirements during audits.
- Treat accessibility as a continuous requirement, not a one-time fix.
- Integrate accessibility checks into development and QA workflows.
- Document accessibility decisions and known limitations where applicable.

## Examples

### WCAG 2.1 Level AA Success Criteria mapped to EN 301 549
| WCAG Principle | Example Success Criteria | EN 301 549 Clause |
|---|---|---|
| Perceivable | 1.1.1 Non-text Content | 9.1.1.1 |
| Perceivable | 1.4.3 Contrast (Minimum) | 9.1.4.3 |
| Perceivable | 1.4.10 Reflow | 9.1.4.10 |
| Operable | 2.1.1 Keyboard | 9.2.1.1 |
| Operable | 2.4.7 Focus Visible | 9.2.4.7 |
| Understandable | 3.1.1 Language of Page | 9.3.1.1 |
| Understandable | 3.3.1 Error Identification | 9.3.3.1 |
| Robust | 4.1.2 Name, Role, Value | 9.4.1.2 |

### EAA Compliance Scope Checklist
- Website accessible to WCAG 2.1 AA? 
- Mobile app follows platform accessibility guidelines? 
- Accessibility statement published? 
- Feedback mechanism for accessibility issues? 
- Support services aware of accessibility features? 
- Documentation describes accessibility features?
