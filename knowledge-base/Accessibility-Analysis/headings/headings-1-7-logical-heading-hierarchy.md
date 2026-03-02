# Headings: Logical Hierarchy (H1–H6)

## Tags
Tags: #headings #structure #semantic-html #aria #wcag #1.3.1 #2.4.6

## Purpose
Ensure headings create a logical, thorough page structure so users (especially screen reader users) can understand content and navigate efficiently.

## Key points
- All elements that function as headings must be marked up using heading tags (`<h1>` to `<h6>`).
- The heading structure must be logical and thorough across the page.
- Avoid inconsistencies in heading levels.
- Ideally, avoid “jumps” in the hierarchy (e.g., `<h1>` directly to `<h3>` without an `<h2>`).
- Multiple `<h1>` elements may be used on a page when there are primary headings.
- Good practice is to avoid using hidden headings.
- ARIA can assign heading semantics to non-heading elements using `role="heading"` with `aria-level="1"` to `"6"`, but this should be a last resort and is not optimal compared to real heading elements.

## Developer checks
- Scan the DOM for visual headings implemented as `<div>`, `<p>`, or styled text instead of `<h1>`–`<h6>`.
- Verify heading levels progress logically (no unexpected level jumps).
- Confirm the page has a clear top-level heading strategy (single or multiple `<h1>` used consistently).
- Check that headings are not used purely for styling (e.g., heading tags applied to non-heading content).
- If `role="heading"` is used, verify that a matching `aria-level` is present and that replacing with native headings is not feasible.

## Fix patterns
- Replace non-semantic “heading-like” elements (e.g., `<div class="title">`) with appropriate `<h*>` tags.
- Reorder heading levels to remove skips (insert missing intermediate headings where needed).
- Ensure headings reflect the content outline (think of the page as a “Table of Contents”).
- Use CSS classes for styling rather than choosing heading levels for appearance.
- Only use `role="heading"` + `aria-level` when native heading tags cannot be used.

## Examples
```html
<!-- Correct example (logical and thorough) -->
<h1><a href="/"><img src="GreenPeace.png" alt="GreenPeace (go back to homepage)" /></a></h1>

<h2>In the spotlight</h2>
<h3>The Canadian government should not be writing blank cheques for Texas oil-giant</h3>

<h2>The latest updates</h2>
<h3>Plastic pollution reaches the Antarctic</h3>
<h3>Captain Crudeau’s Colossal Mistake</h3>

<h2>Multimedia</h2>
<h2>Join the movement</h2>
<h2>Become volunteer</h2>

<!-- ARIA heading as a last resort (not optimal) -->
<p role="heading" aria-level="1">Heading Level 1</p>
<div role="heading" aria-level="3">Heading Level 3</div>
```

## Framework-Specific Examples

### React/Next.js
```jsx
// Logical heading structure in React
function HomePage() {
  return (
    <>
      <h1>
        <a href="/">
          <img src="/logo.png" alt="Company Name (go back to homepage)" />
        </a>
      </h1>
      
      <h2>Featured Products</h2>
      <section>
        <h3>Product Category 1</h3>
        <ProductList category="1" />
        
        <h3>Product Category 2</h3>
        <ProductList category="2" />
      </section>
      
      <h2>Latest News</h2>
      <article>
        <h3>Article Title</h3>
        <p>Article content...</p>
      </article>
    </>
  );
}

// Dynamic heading levels
function Heading({ level, children }) {
  const Tag = `h${level}`;
  return <Tag>{children}</Tag>;
}

// Usage
<Heading level={2}>Section Title</Heading>

// Next.js with metadata
export const metadata = {
  title: 'Page Title', // Used for <title> tag
};
```

### Vue/Nuxt
```vue
<template>
  <div>
    <h1>
      <NuxtLink to="/">
        <img src="/logo.png" alt="Company Name (go back to homepage)" />
      </NuxtLink>
    </h1>
    
    <h2>Featured Products</h2>
    <section>
      <h3>Product Category 1</h3>
      <ProductList category="1" />
      
      <h3>Product Category 2</h3>
      <ProductList category="2" />
    </section>
    
    <h2>Latest News</h2>
    <article>
      <h3>{{ article.title }}</h3>
      <p>{{ article.content }}</p>
    </article>
  </div>
</template>

<!-- Dynamic heading component -->
<template>
  <component :is="tag">
    <slot></slot>
  </component>
</template>

<script setup>
const props = defineProps({
  level: {
    type: Number,
    required: true,
    validator: (value) => value >= 1 && value <= 6
  }
});

const tag = computed(() => `h${props.level}`);
</script>

<!-- Usage -->
<Heading :level="2">Section Title</Heading>

<!-- Nuxt metadata -->
<script setup>
useHead({
  title: 'Page Title'
});
</script>
```

### Angular
```typescript
// Component template
<div>
  <h1>
    <a [routerLink]="['/']">
      <img src="/logo.png" alt="Company Name (go back to homepage)" />
    </a>
  </h1>
  
  <h2>Featured Products</h2>
  <section>
    <h3>Product Category 1</h3>
    <app-product-list [category]="'1'"></app-product-list>
    
    <h3>Product Category 2</h3>
    <app-product-list [category]="'2'"></app-product-list>
  </section>
  
  <h2>Latest News</h2>
  <article *ngFor="let article of articles">
    <h3>{{ article.title }}</h3>
    <p>{{ article.content }}</p>
  </article>
</div>

// Dynamic heading component
<ng-container [ngSwitch]="level">
  <h1 *ngSwitchCase="1"><ng-content></ng-content></h1>
  <h2 *ngSwitchCase="2"><ng-content></ng-content></h2>
  <h3 *ngSwitchCase="3"><ng-content></ng-content></h3>
  <h4 *ngSwitchCase="4"><ng-content></ng-content></h4>
  <h5 *ngSwitchCase="5"><ng-content></ng-content></h5>
  <h6 *ngSwitchCase="6"><ng-content></ng-content></h6>
</ng-container>

// Component TypeScript
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-heading',
  templateUrl: './heading.component.html'
})
export class HeadingComponent {
  @Input() level: number = 2;
}
```
