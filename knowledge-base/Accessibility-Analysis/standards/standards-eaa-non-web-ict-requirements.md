# Standards: EAA Non-Web ICT Requirements

## Tags
Tags: #standards #eaa #en-301-549 #non-web #ict #mobile-apps #kiosks

## Purpose
Explain how the European Accessibility Act and EN 301 549 extend beyond web content to cover mobile applications, self-service terminals, e-commerce platforms, and other digital products and services.

## Key points
- The EAA covers more than websites — it applies to a wide range of products and services.
- Products in scope include: computers, smartphones, tablets, self-service terminals (ATMs, ticket machines, kiosks), e-readers, and telecommunication equipment.
- Services in scope include: e-commerce, banking services, transport services, telephony and audiovisual media services, and e-books.
- Mobile native applications must meet accessibility requirements, not just websites.
- Self-service terminals must be operable by people with a range of disabilities (visual, hearing, motor, cognitive).
- EN 301 549 provides the technical standard and maps WCAG requirements to non-web contexts.
- Requirements cover hardware, software, documentation, and support services.

## Developer checks
- Determine whether the product or service falls under EAA scope.
- Identify whether the platform includes non-web components (mobile apps, kiosks, terminal interfaces).
- Check that mobile applications follow platform accessibility guidelines (iOS, Android).
- Verify self-service terminals support alternative input and output methods.
- Confirm accessibility requirements are included in procurement specifications.
- Ensure third-party components and embedded services also meet requirements.

## Fix patterns
- Apply WCAG 2.1 Level AA to web content and web-based mobile applications.
- Follow platform-specific accessibility guidelines for native mobile apps (Apple HIG, Android Accessibility).
- Design self-service terminals with audio output, tactile feedback, and adjustable height options.
- Provide alternative channels for services offered through inaccessible terminals.
- Include accessibility requirements in contracts with third-party vendors.
- Document accessibility features and limitations for all ICT products.

## Examples
No code examples — this topic is about scope and compliance rather than implementation patterns.

### Checklist for EAA scope assessment
- Is the product a computer, smartphone, tablet, e-reader, or self-service terminal? → Product requirements apply.
- Is the service e-commerce, banking, transport, telephony, or audiovisual? → Service requirements apply.
- Does the product include a web interface? → WCAG 2.1 AA applies.
- Does the product include a mobile app? → Platform accessibility guidelines apply.
- Does the product include a self-service terminal? → Hardware and software accessibility requirements apply.
- Is the product sold or provided within the EU? → EAA applies from June 2025.
