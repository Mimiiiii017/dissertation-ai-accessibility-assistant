# Forms: Labels and Accessible Names

## Tags
Tags: #forms #labels #accessible-name #aria #wcag #1.3.1 #4.1.2 #3.3.2

## Purpose
Ensure all form controls have clear, programmatically associated labels so users of assistive technologies can understand what information is required.

## Key points
- Every form control must have an accessible name.
- The `<label>` element is the preferred way to label inputs.
- Labels must be explicitly associated using the `for` attribute and matching `id`.
- Placeholder text must not be used as a replacement for labels.
- When visible labels are not possible, ARIA labeling may be used as a fallback.
- Grouped controls require contextual labels to explain their purpose.

## Developer checks
- Verify each `<input>`, `<select>`, and `<textarea>` has a visible `<label>`.
- Check that each `<label>` uses `for` and matches a unique `id`.
- Confirm placeholders are supplementary, not the only label.
- Ensure icon-only or visually hidden controls still expose an accessible name.
- Check radio buttons and checkboxes for group context.

## Fix patterns
- Add missing `<label>` elements and link them correctly.
- Replace placeholder-only instructions with proper labels.
- Use visually hidden labels when design constraints exist.
- Apply `aria-label` or `aria-labelledby` only when a visible label cannot be used.
- Ensure grouped inputs are wrapped in semantic structures when needed.

## Examples
```html
<!-- Correct label association -->
<label for="email">Email address</label>
<input id="email" type="email">

<!-- Visually hidden label (still accessible) -->
<label for="search" class="sr-only">Search</label>
<input id="search" type="text">

<!-- ARIA label as a fallback -->
<input type="text" aria-label="Search">

<!-- Grouped controls -->
<fieldset>
  <legend>Preferred contact method</legend>
  <label><input type="radio" name="contact" value="email"> Email</label>
  <label><input type="radio" name="contact" value="phone"> Phone</label>
</fieldset>
```

## Framework-Specific Examples

### React/Next.js
```jsx
// Correct label association
function EmailInput() {
  return (
    <>
      <label htmlFor="email">Email address</label>
      <input id="email" type="email" />
    </>
  );
}

// Using React Hook Form with labels
import { useForm } from 'react-hook-form';

function ContactForm() {
  const { register } = useForm();
  
  return (
    <form>
      <label htmlFor="name">Name</label>
      <input {...register('name')} id="name" />
      
      <label htmlFor="email">Email</label>
      <input {...register('email')} id="email" type="email" />
    </form>
  );
}

// Visually hidden label
function SearchInput() {
  return (
    <>
      <label htmlFor="search" className="sr-only">Search</label>
      <input id="search" type="text" placeholder="Search..." />
    </>
  );
}
```

### Vue/Nuxt
```vue
<template>
  <!-- Correct label association -->
  <div>
    <label for="email">Email address</label>
    <input id="email" type="email" v-model="email" />
  </div>
  
  <!-- Visually hidden label -->
  <div>
    <label for="search" class="sr-only">Search</label>
    <input id="search" type="text" v-model="searchQuery" />
  </div>
  
  <!-- Grouped controls -->
  <fieldset>
    <legend>Preferred contact method</legend>
    <label>
      <input type="radio" name="contact" value="email" v-model="contactMethod" />
      Email
    </label>
    <label>
      <input type="radio" name="contact" value="phone" v-model="contactMethod" />
      Phone
    </label>
  </fieldset>
</template>

<script setup>
import { ref } from 'vue';

const email = ref('');
const searchQuery = ref('');
const contactMethod = ref('email');
</script>
```

### Angular
```typescript
// Component template
<div>
  <!-- Correct label association -->
  <label for="email">Email address</label>
  <input id="email" type="email" [(ngModel)]="email" />
  
  <!-- Using Reactive Forms -->
  <form [formGroup]="contactForm">
    <label for="name">Name</label>
    <input id="name" formControlName="name" />
    
    <label for="emailField">Email</label>
    <input id="emailField" formControlName="email" type="email" />
  </form>
  
  <!-- Angular Material with proper labels -->
  <mat-form-field>
    <mat-label>Email address</mat-label>
    <input matInput type="email" formControlName="email" />
  </mat-form-field>
</div>

// Component TypeScript
import { Component } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-contact-form',
  templateUrl: './contact-form.component.html'
})
export class ContactFormComponent {
  email = '';
  contactForm: FormGroup;
  
  constructor(private fb: FormBuilder) {
    this.contactForm = this.fb.group({
      name: [''],
      email: ['']
    });
  }
}
```
