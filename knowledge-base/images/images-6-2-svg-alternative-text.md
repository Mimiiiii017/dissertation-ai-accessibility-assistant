# Images: Alternative Text for SVG

## Tags
Tags: #images #svg #alt-text #aria #wcag #1.1.1

## Purpose
Explain how to provide accessible alternative text for SVG graphics so their meaning is available to assistive technologies.

## Key points
- SVG images that convey information must have a text alternative.
- Decorative SVGs must be hidden from assistive technologies.
- Alternative text for SVGs can be provided in multiple ways depending on usage.
- The method used must ensure screen readers can access the description.
- SVGs used as icons, controls, or illustrations require different handling based on context.

## Developer checks
- Identify whether each SVG is informative or decorative.
- Check that informative SVGs expose a text alternative to screen readers.
- Verify decorative SVGs are hidden using appropriate techniques.
- Confirm that SVGs used inside links or buttons describe the action, not just the graphic.
- Test SVGs with a screen reader to ensure the text alternative is announced.

## Fix patterns
- Add a `<title>` element inside the SVG for short alternative text.
- Use `<desc>` inside the SVG for longer descriptions when necessary.
- Reference SVG text alternatives using `aria-labelledby`.
- Mark decorative SVGs with `aria-hidden="true"`.
- Avoid relying on visual-only cues inside SVGs without textual equivalents.

## Examples
```html
<!-- Informative SVG with title -->
<svg role="img" aria-labelledby="svgTitle">
  <title id="svgTitle">Sales growth chart</title>
  <!-- SVG content -->
</svg>

<!-- Decorative SVG -->
<svg aria-hidden="true">
  <!-- Decorative SVG content -->
</svg>

<!-- SVG used as a button icon -->
<button aria-label="Close">
  <svg aria-hidden="true">
    <!-- Icon SVG -->
  </svg>
</button>
```

## Framework-Specific Examples

### React/Next.js
```jsx
// Informative SVG with accessible title
function Logo() {
  return (
    <svg 
      role="img" 
      aria-labelledby="logoTitle"
      width="100" 
      height="50"
    >
      <title id="logoTitle">Company Name</title>
      <rect width="100" height="50" fill="#007bff" />
      <text x="10" y="30" fill="white">Logo</text>
    </svg>
  );
}

// Decorative SVG icon
function DecorativeIcon() {
  return (
    <svg aria-hidden="true" width="24" height="24">
      <circle cx="12" cy="12" r="10" fill="#ccc" />
    </svg>
  );
}

// SVG icon in button
function CloseButton({ onClick }) {
  return (
    <button onClick={onClick} aria-label="Close dialog">
      <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24">
        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
      </svg>
    </button>
  );
}

// Complex SVG chart
function SalesChart({ data }) {
  return (
    <svg 
      role="img" 
      aria-labelledby="chartTitle chartDesc"
      width="400" 
      height="300"
    >
      <title id="chartTitle">Monthly Sales Data</title>
      <desc id="chartDesc">
        Chart showing sales increasing from $10,000 in January to $25,000 in December
      </desc>
      {/* Chart rendering */}
    </svg>
  );
}

// Using react-icons library
import { FaUser, FaSearch } from 'react-icons/fa';

function IconExamples() {
  return (
    <>
      <button aria-label="User profile">
        <FaUser aria-hidden="true" />
      </button>
      
      <button aria-label="Search">
        <FaSearch aria-hidden="true" />
        <span className="sr-only">Search</span>
      </button>
    </>
  );
}
```

### Vue/Nuxt
```vue
<template>
  <!-- Informative SVG -->
  <svg 
    role="img" 
    aria-labelledby="logoTitle"
    width="100" 
    height="50"
  >
    <title id="logoTitle">Company Name</title>
    <rect width="100" height="50" fill="#007bff" />
  </svg>
  
  <!-- Decorative SVG -->
  <svg aria-hidden="true" width="24" height="24">
    <circle cx="12" cy="12" r="10" fill="#ccc" />
  </svg>
  
  <!-- SVG in button -->
  <button @click="handleClose" aria-label="Close dialog">
    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
  </button>
  
  <!-- Component with SVG -->
  <IconButton 
    icon="close" 
    label="Close" 
    @click="handleClick" 
  />
</template>

<script setup>
const handleClose = () => {
  // Close logic
};
</script>

<!-- Icon component -->
<template>
  <button :aria-label="label" @click="$emit('click')">
    <svg aria-hidden="true" width="24" height="24">
      <use :href="`#icon-${icon}`" />
    </svg>
  </button>
</template>

<script setup>
defineProps({
  icon: String,
  label: String
});
</script>
```

### Angular
```typescript
// Component template
<svg 
  role="img" 
  attr.aria-labelledby="logoTitle"
  width="100" 
  height="50"
>
  <title id="logoTitle">Company Name</title>
  <rect width="100" height="50" fill="#007bff" />
</svg>

<!-- Decorative SVG -->
<svg aria-hidden="true" width="24" height="24">
  <circle cx="12" cy="12" r="10" fill="#ccc" />
</svg>

<!-- SVG in button -->
<button (click)="handleClose()" aria-label="Close dialog">
  <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </svg>
</button>

<!-- Using Angular Material icons -->
<button mat-icon-button aria-label="Delete item">
  <mat-icon>delete</mat-icon>
</button>

<button mat-icon-button aria-label="Add item">
  <mat-icon aria-hidden="true">add</mat-icon>
  <span class="sr-only">Add item</span>
</button>

// Component TypeScript
import { Component } from '@angular/core';

@Component({
  selector: 'app-icon-button',
  template: `
    <button [attr.aria-label]="label" (click)="handleClick()">
      <svg aria-hidden="true" width="24" height="24">
        <use [attr.href]="'#icon-' + icon"></use>
      </svg>
    </button>
  `
})
export class IconButtonComponent {
  @Input() icon: string;
  @Input() label: string;
  @Output() clicked = new EventEmitter();
  
  handleClick() {
    this.clicked.emit();
  }
}
```

### Svelte/SvelteKit
```svelte
<script>
  export let label = '';
  export let icon = '';
</script>

<!-- Informative SVG -->
<svg 
  role="img" 
  aria-labelledby="logoTitle"
  width="100" 
  height="50"
>
  <title id="logoTitle">Company Name</title>
  <rect width="100" height="50" fill="#007bff" />
</svg>

<!-- Decorative SVG -->
<svg aria-hidden="true" width="24" height="24">
  <circle cx="12" cy="12" r="10" fill="#ccc" />
</svg>

<!-- SVG in button -->
<button on:click={handleClose} aria-label="Close dialog">
  <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </svg>
</button>

<!-- Reusable icon component -->
<button aria-label={label} on:click>
  <svg aria-hidden="true" width="24" height="24">
    <use href="#icon-{icon}" />
  </svg>
</button>
```

### WordPress/PHP
```php
<!-- Informative SVG in WordPress -->
<svg 
  role="img" 
  aria-labelledby="logoTitle"
  width="100" 
  height="50"
>
  <title id="logoTitle"><?php bloginfo('name'); ?></title>
  <rect width="100" height="50" fill="#007bff" />
</svg>

<!-- Decorative SVG -->
<svg aria-hidden="true" width="24" height="24">
  <circle cx="12" cy="12" r="10" fill="#ccc" />
</svg>

<!-- SVG in button -->
<button aria-label="<?php esc_attr_e('Close menu', 'text-domain'); ?>">
  <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
  </svg>
</button>
```
```
