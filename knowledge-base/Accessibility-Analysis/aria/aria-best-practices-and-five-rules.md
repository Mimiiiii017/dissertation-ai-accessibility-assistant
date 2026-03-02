# ARIA: Best Practices and the Five Rules of ARIA

## Tags
Tags: #aria #best-practices #five-rules-of-aria #semantic-html #wcag

## Purpose
Explain when and how ARIA should be used correctly, and highlight common misuse that can reduce accessibility instead of improving it.

## Key points
- ARIA is meant to enhance accessibility, not replace semantic HTML.
- Native HTML elements already provide built-in accessibility features.
- Incorrect ARIA usage can make interfaces harder to use with assistive technologies.
- The “Five Rules of ARIA” guide safe and effective usage.
- ARIA should only be used when native HTML cannot achieve the desired accessibility.

### The Five Rules of ARIA
1. **Do not use ARIA if you can use native HTML instead**  
   Native elements (`<button>`, `<input>`, `<nav>`, etc.) have built-in semantics and keyboard support.

2. **Do not change native semantics unless absolutely necessary**  
   Overriding roles can confuse assistive technologies.

3. **All interactive ARIA controls must be keyboard accessible**  
   ARIA does not add keyboard behavior automatically.

4. **Do not hide focusable elements from assistive technologies**  
   Elements that receive focus must be perceivable by screen readers.

5. **Accessible name and role are required**  
   Elements must expose both a role and a name that users can understand.

## Developer checks
- Look for ARIA roles applied to native elements unnecessarily.
- Check for `role="button"` on elements that could be `<button>`.
- Verify all ARIA widgets support keyboard interaction.
- Confirm accessible names are present (`aria-label`, `aria-labelledby`).
- Ensure ARIA is not used to mask structural or semantic issues.

## Fix patterns
- Replace ARIA-enhanced elements with native HTML where possible.
- Remove redundant or conflicting ARIA roles.
- Add keyboard event handling to custom widgets.
- Ensure all ARIA widgets have clear, descriptive accessible names.
- Test ARIA-heavy interfaces with screen readers.

## Examples
```html
<!-- Incorrect: unnecessary ARIA -->
<button role="button">Submit</button>

<!-- Correct: native element without ARIA -->
<button>Submit</button>

<!-- ARIA used appropriately for custom control -->
<div role="button" tabindex="0"
     aria-label="Expand details"
     onclick="toggleDetails()"
     onkeydown="if(event.key==='Enter'||event.key===' ') toggleDetails();">
  Show details
</div>

<!-- Incorrect: hiding focusable element -->
<button aria-hidden="true">Save</button>
```

## Framework-Specific Examples

### React/Next.js
```jsx
// Rule 1: Use native HTML instead of ARIA
// Incorrect: unnecessary ARIA
function SubmitButton() {
  return <button role="button">Submit</button>;
}

// Correct: native element without ARIA
function SubmitButton() {
  return <button>Submit</button>;
}

// Rule 3: All interactive ARIA controls must be keyboard accessible
// Incorrect: missing keyboard support
function CustomButton() {
  return (
    <div role="button" onClick={handleClick}>
      Click me
    </div>
  );
}

// Correct: keyboard support added
function CustomButton() {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };
  
  return (
    <div 
      role="button" 
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      aria-label="Expand details"
    >
      Click me
    </div>
  );
}

// Rule 5: Accessible name required
// Incorrect: no accessible name
function IconButton() {
  return <button>×</button>;
}

// Correct: accessible name provided
function IconButton() {
  return <button aria-label="Close dialog">×</button>;
}
```

### Vue/Nuxt
```vue
<template>
  <!-- Rule 1: Use native HTML instead of ARIA -->
  <!-- Incorrect: unnecessary ARIA -->
  <button role="button">Submit</button>
  
  <!-- Correct: native element -->
  <button>Submit</button>
  
  <!-- Rule 3: Keyboard accessibility for custom controls -->
  <!-- Incorrect: missing keyboard support -->
  <div role="button" @click="handleClick">
    Click me
  </div>
  
  <!-- Correct: keyboard support added -->
  <div 
    role="button" 
    tabindex="0"
    @click="handleClick"
    @keydown.enter="handleClick"
    @keydown.space.prevent="handleClick"
    aria-label="Expand details"
  >
    Click me
  </div>
  
  <!-- Rule 5: Accessible name required -->
  <!-- Incorrect -->
  <button>×</button>
  
  <!-- Correct -->
  <button aria-label="Close dialog">×</button>
</template>

<script setup>
const handleClick = () => {
  // Handle click
};
</script>
```

### Angular
```typescript
// Component template

<!-- Rule 1: Use native HTML instead of ARIA -->
<!-- Incorrect: unnecessary ARIA -->
<button role="button">Submit</button>

<!-- Correct: native element -->
<button>Submit</button>

<!-- Rule 3: Keyboard accessibility for custom controls -->
<!-- Incorrect: missing keyboard support -->
<div role="button" (click)="handleClick()">
  Click me
</div>

<!-- Correct: keyboard support added -->
<div 
  role="button" 
  tabindex="0"
  (click)="handleClick()"
  (keydown.enter)="handleClick()"
  (keydown.space)="handleClick($event)"
  aria-label="Expand details"
>
  Click me
</div>

<!-- Rule 5: Using Angular Material (accessible by default) -->
<button mat-button aria-label="Close dialog">
  <mat-icon>close</mat-icon>
</button>

// Component TypeScript
import { Component } from '@angular/core';

@Component({
  selector: 'app-custom-button',
  templateUrl: './custom-button.component.html'
})
export class CustomButtonComponent {
  handleClick(event?: Event) {
    if (event && event.type === 'keydown') {
      event.preventDefault();
    }
    // Handle action
  }
}
```
