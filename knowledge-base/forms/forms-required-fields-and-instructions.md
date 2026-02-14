# Forms: Required Fields and Instructions

## Tags
Tags: #forms #required-fields #instructions #aria #wcag #3.3.2

## Purpose
Ensure users can clearly identify which form fields are required and understand instructions before and during form completion, reducing errors and cognitive load.

## Key points
- Required fields must be communicated programmatically and visually.
- Do not rely on color alone to indicate required status.
- Instructions should be provided before users interact with fields when possible.
- Screen reader users must be informed when a field is mandatory.
- Required indicators must be consistent across the form.

## Developer checks
- Check that required fields are clearly marked in the UI.
- Verify required fields expose their status to assistive technologies.
- Confirm that instructions are associated with the relevant fields.
- Ensure symbols (e.g., `*`) are explained to users.
- Check that required status is not conveyed by color alone.

## Fix patterns
- Add `aria-required="true"` to required form controls when needed.
- Use visible text such as “Required” in addition to symbols.
- Associate instructions with fields using `aria-describedby`.
- Provide a short explanation at the top of the form explaining required indicators.
- Keep required field messaging consistent across all forms.

## Examples
```html
<!-- Required field with visible indicator -->
<label for="name">Name <span aria-hidden="true">*</span></label>
<input id="name" type="text" aria-required="true">

<!-- Instruction linked to field -->
<label for="password">Password</label>
<input id="password" type="password" aria-describedby="passwordHelp" aria-required="true">
<div id="passwordHelp">
  Password must be at least 8 characters long.
</div>

<!-- Form-level instruction -->
<p id="requiredInfo">
  Fields marked with * are required.
</p>
```

## Framework-Specific Examples

### React/Next.js
```jsx
// Required field with validation
import { useForm } from 'react-hook-form';

function ContactForm() {
  const { register, formState: { errors } } = useForm();
  
  return (
    <form>
      <p id="requiredInfo">
        Fields marked with <span aria-label="asterisk">*</span> are required.
      </p>
      
      <div>
        <label htmlFor="name">
          Name <span aria-hidden="true">*</span>
        </label>
        <input
          id="name"
          {...register('name', { required: 'Name is required' })}
          aria-required="true"
          aria-invalid={errors.name ? 'true' : 'false'}
          aria-describedby={errors.name ? 'name-error' : undefined}
        />
        {errors.name && (
          <div id="name-error" role="alert">
            {errors.name.message}
          </div>
        )}
      </div>
      
      <div>
        <label htmlFor="email">
          Email <span aria-hidden="true">*</span>
        </label>
        <input
          id="email"
          type="email"
          {...register('email', {
            required: 'Email is required',
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: 'Invalid email address'
            }
          })}
          aria-required="true"
          aria-describedby="email-help email-error"
        />
        <div id="email-help">We'll never share your email.</div>
        {errors.email && (
          <div id="email-error" role="alert">
            {errors.email.message}
          </div>
        )}
      </div>
      
      <button type="submit">Submit</button>
    </form>
  );
}
```

### Vue/Nuxt
```vue
<template>
  <form @submit.prevent="handleSubmit">
    <p id="requiredInfo">
      Fields marked with <span aria-label="asterisk">*</span> are required.
    </p>
    
    <div>
      <label for="name">
        Name <span aria-hidden="true">*</span>
      </label>
      <input
        id="name"
        v-model="form.name"
        aria-required="true"
        :aria-invalid="errors.name ? 'true' : 'false'"
        :aria-describedby="errors.name ? 'name-error' : undefined"
      />
      <div v-if="errors.name" id="name-error" role="alert">
        {{ errors.name }}
      </div>
    </div>
    
    <div>
      <label for="phone">
        Phone <span aria-hidden="true">*</span>
      </label>
      <input
        id="phone"
        v-model="form.phone"
        type="tel"
        aria-required="true"
        aria-describedby="phone-help"
      />
      <div id="phone-help">Format: (555) 555-5555</div>
    </div>
    
    <button type="submit">Submit</button>
  </form>
</template>

<script setup>
import { ref } from 'vue';

const form = ref({ name: '', phone: '' });
const errors = ref({});

const handleSubmit = () => {
  errors.value = {};
  
  if (!form.value.name) {
    errors.value.name = 'Name is required';
  }
  
  if (!form.value.phone) {
    errors.value.phone = 'Phone is required';
  }
  
  if (Object.keys(errors.value).length === 0) {
    // Submit form
  }
};
</script>
```

### Angular
```typescript
// Component template
<form [formGroup]="contactForm" (ngSubmit)="onSubmit()">
  <p id="requiredInfo">
    Fields marked with <span aria-label="asterisk">*</span> are required.
  </p>
  
  <div>
    <label for="name">
      Name <span aria-hidden="true">*</span>
    </label>
    <input
      id="name"
      formControlName="name"
      aria-required="true"
      [attr.aria-invalid]="name?.invalid && name?.touched ? 'true' : 'false'"
      [attr.aria-describedby]="name?.invalid && name?.touched ? 'name-error' : null"
    />
    <div 
      *ngIf="name?.invalid && name?.touched" 
      id="name-error" 
      role="alert"
    >
      <span *ngIf="name?.errors?.['required']">Name is required</span>
    </div>
  </div>
  
  <button type="submit" [disabled]="contactForm.invalid">Submit</button>
</form>

// Component TypeScript
import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';

@Component({
  selector: 'app-contact-form',
  templateUrl: './contact-form.component.html'
})
export class ContactFormComponent {
  contactForm = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]]
  });
  
  constructor(private fb: FormBuilder) {}
  
  get name() {
    return this.contactForm.get('name');
  }
  
  onSubmit() {
    if (this.contactForm.valid) {
      // Submit form
    }
  }
}
```

### Svelte/SvelteKit
```svelte
<script>
  let form = { name: '', email: '' };
  let errors = {};
  
  function handleSubmit() {
    errors = {};
    
    if (!form.name) {
      errors.name = 'Name is required';
    }
    
    if (!form.email) {
      errors.email = 'Email is required';
    }
    
    if (Object.keys(errors).length === 0) {
      // Submit form
    }
  }
</script>

<form on:submit|preventDefault={handleSubmit}>
  <p id="requiredInfo">
    Fields marked with <span aria-label="asterisk">*</span> are required.
  </p>
  
  <div>
    <label for="name">
      Name <span aria-hidden="true">*</span>
    </label>
    <input
      id="name"
      bind:value={form.name}
      aria-required="true"
      aria-invalid={errors.name ? 'true' : 'false'}
      aria-describedby={errors.name ? 'name-error' : undefined}
    />
    {#if errors.name}
      <div id="name-error" role="alert">
        {errors.name}
      </div>
    {/if}
  </div>
  
  <div>
    <label for="email">
      Email <span aria-hidden="true">*</span>
    </label>
    <input
      id="email"
      type="email"
      bind:value={form.email}
      aria-required="true"
      aria-describedby="email-help"
    />
    <div id="email-help">We'll send a confirmation to this address.</div>
  </div>
  
  <button type="submit">Submit</button>
</form>
```

### WordPress/PHP
```php
<form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
  <?php wp_nonce_field('contact_form', 'contact_nonce'); ?>
  <input type="hidden" name="action" value="submit_contact_form" />
  
  <p id="requiredInfo">
    <?php esc_html_e('Fields marked with * are required.', 'text-domain'); ?>
  </p>
  
  <div>
    <label for="name">
      <?php esc_html_e('Name', 'text-domain'); ?> 
      <span aria-hidden="true">*</span>
    </label>
    <input
      id="name"
      name="name"
      type="text"
      value="<?php echo esc_attr($posted_data['name'] ?? ''); ?>"
      aria-required="true"
      <?php if (!empty($errors['name'])) : ?>
        aria-invalid="true"
        aria-describedby="name-error"
      <?php endif; ?>
    />
    <?php if (!empty($errors['name'])) : ?>
      <div id="name-error" role="alert">
        <?php echo esc_html($errors['name']); ?>
      </div>
    <?php endif; ?>
  </div>
  
  <button type="submit"><?php esc_html_e('Submit', 'text-domain'); ?></button>
</form>
```
```