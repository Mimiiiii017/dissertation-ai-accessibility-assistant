# Forms: Error Messages and Validation Feedback

## Tags
Tags: #forms #errors #validation #aria #wcag #3.3.1 #3.3.3

## Purpose
Ensure form errors and validation feedback are clearly communicated to all users, including those using assistive technologies, so issues can be identified and corrected efficiently.

## Key points
- Error messages must be perceivable, understandable, and programmatically associated with the relevant field.
- Errors should explain what went wrong and how to fix it.
- Do not rely on color alone to indicate errors.
- Errors triggered dynamically must be announced to screen readers.
- Error summaries are recommended for forms with multiple errors.

## Developer checks
- Check that each invalid field has an associated error message.
- Verify error messages are linked to fields using `aria-describedby` or equivalent.
- Confirm dynamic errors are announced (e.g., via live regions).
- Ensure error text is concise and actionable.
- Check that focus moves to the error (or error summary) on submission failure.

## Fix patterns
- Add a dedicated error message element per field and link it programmatically.
- Use `role="alert"` or `aria-live="assertive"` for dynamic error announcements.
- Include an error summary at the top of the form when multiple errors occur.
- Provide clear guidance on how to correct each error.
- Pair visual indicators (icons, text) with color to signal errors.

## Examples
```html
<!-- Field-level error message -->
<label for="email">Email address</label>
<input id="email" type="email" aria-describedby="emailError" aria-invalid="true">
<div id="emailError">
  Please enter a valid email address.
</div>

<!-- Dynamic error announcement -->
<div role="alert">
  There was a problem submitting the form. Please review the errors below.
</div>

<!-- Error summary -->
<div role="alert">
  <p>Please fix the following errors:</p>
  <ul>
    <li>Email address is invalid.</li>
    <li>Password must be at least 8 characters.</li>
  </ul>
</div>
```

## Framework-Specific Examples

### React/Next.js
```jsx
import { useState } from 'react';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  
  const validate = () => {
    const newErrors = {};
    
    if (!email.includes('@')) {
      newErrors.email = 'Please enter a valid email address.';
    }
    
    if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters.';
    }
    
    return newErrors;
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    const validationErrors = validate();
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      // Focus on error summary or first error
      document.getElementById('errorSummary')?.focus();
    } else {
      // Submit form
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Error summary */}
      {Object.keys(errors).length > 0 && (
        <div 
          id="errorSummary" 
          role="alert" 
          tabIndex={-1}
        >
          <p>Please fix the following errors:</p>
          <ul>
            {Object.values(errors).map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Email field */}
      <div>
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-describedby={errors.email ? 'emailError' : undefined}
          aria-invalid={!!errors.email}
        />
        {errors.email && (
          <div id="emailError" className="error">
            {errors.email}
          </div>
        )}
      </div>
      
      {/* Password field */}
      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby={errors.password ? 'passwordError' : undefined}
          aria-invalid={!!errors.password}
        />
        {errors.password && (
          <div id="passwordError" className="error">
            {errors.password}
          </div>
        )}
      </div>
      
      <button type="submit">Log in</button>
    </form>
  );
}

// Using React Hook Form
import { useForm } from 'react-hook-form';

function SignupForm() {
  const { 
    register, 
    handleSubmit, 
    formState: { errors } 
  } = useForm();
  
  const onSubmit = (data) => {
    // Submit form
  };
  
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* Error summary */}
      {Object.keys(errors).length > 0 && (
        <div role="alert">
          <p>Please fix the following errors:</p>
          <ul>
            {Object.values(errors).map((error, i) => (
              <li key={i}>{error.message}</li>
            ))}
          </ul>
        </div>
      )}
      
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          {...register('email', {
            required: 'Email is required',
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: 'Please enter a valid email address'
            }
          })}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'emailError' : undefined}
        />
        {errors.email && (
          <div id="emailError">{errors.email.message}</div>
        )}
      </div>
      
      <button type="submit">Sign up</button>
    </form>
  );
}
```

### Vue/Nuxt
```vue
<template>
  <form @submit.prevent="handleSubmit">
    <!-- Error summary -->
    <div v-if="Object.keys(errors).length > 0" role="alert" tabindex="-1" ref="errorSummary">
      <p>Please fix the following errors:</p>
      <ul>
        <li v-for="(error, key) in errors" :key="key">{{ error }}</li>
      </ul>
    </div>
    
    <!-- Email field -->
    <div>
      <label for="email">Email address</label>
      <input
        id="email"
        type="email"
        v-model="email"
        :aria-describedby="errors.email ? 'emailError' : undefined"
        :aria-invalid="!!errors.email"
      />
      <div v-if="errors.email" id="emailError" class="error">
        {{ errors.email }}
      </div>
    </div>
    
    <!-- Password field -->
    <div>
      <label for="password">Password</label>
      <input
        id="password"
        type="password"
        v-model="password"
        :aria-describedby="errors.password ? 'passwordError' : undefined"
        :aria-invalid="!!errors.password"
      />
      <div v-if="errors.password" id="passwordError" class="error">
        {{ errors.password }}
      </div>
    </div>
    
    <button type="submit">Log in</button>
  </form>
</template>

<script setup>
import { ref, nextTick } from 'vue';

const email = ref('');
const password = ref('');
const errors = ref({});
const errorSummary = ref(null);

const validate = () => {
  const newErrors = {};
  
  if (!email.value.includes('@')) {
    newErrors.email = 'Please enter a valid email address.';
  }
  
  if (password.value.length < 8) {
    newErrors.password = 'Password must be at least 8 characters.';
  }
  
  return newErrors;
};

const handleSubmit = async () => {
  const validationErrors = validate();
  errors.value = validationErrors;
  
  if (Object.keys(validationErrors).length > 0) {
    await nextTick();
    errorSummary.value?.focus();
  } else {
    // Submit form
  }
};
</script>
```

### Angular
```typescript
// Component template
<form [formGroup]="loginForm" (ngSubmit)="handleSubmit()">
  <!-- Error summary -->
  <div 
    *ngIf="showErrors && !loginForm.valid" 
    role="alert" 
    tabindex="-1"
    #errorSummary
  >
    <p>Please fix the following errors:</p>
    <ul>
      <li *ngIf="loginForm.get('email')?.errors">
        {{ getEmailError() }}
      </li>
      <li *ngIf="loginForm.get('password')?.errors">
        {{ getPasswordError() }}
      </li>
    </ul>
  </div>
  
  <!-- Email field -->
  <div>
    <label for="email">Email address</label>
    <input
      id="email"
      type="email"
      formControlName="email"
      [attr.aria-describedby]="loginForm.get('email')?.invalid && showErrors ? 'emailError' : null"
      [attr.aria-invalid]="loginForm.get('email')?.invalid && showErrors"
    />
    <div 
      *ngIf="loginForm.get('email')?.invalid && showErrors" 
      id="emailError" 
      class="error"
    >
      {{ getEmailError() }}
    </div>
  </div>
  
  <!-- Password field -->
  <div>
    <label for="password">Password</label>
    <input
      id="password"
      type="password"
      formControlName="password"
      [attr.aria-describedby]="loginForm.get('password')?.invalid && showErrors ? 'passwordError' : null"
      [attr.aria-invalid]="loginForm.get('password')?.invalid && showErrors"
    />
    <div 
      *ngIf="loginForm.get('password')?.invalid && showErrors" 
      id="passwordError" 
      class="error"
    >
      {{ getPasswordError() }}
    </div>
  </div>
  
  <button type="submit">Log in</button>
</form>

// Component TypeScript
import { Component, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

@Component({
  selector: 'app-login-form',
  templateUrl: './login-form.component.html'
})
export class LoginFormComponent {
  @ViewChild('errorSummary') errorSummary!: ElementRef;
  
  loginForm: FormGroup;
  showErrors = false;
  
  constructor(private fb: FormBuilder) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]]
    });
  }
  
  handleSubmit() {
    this.showErrors = true;
    
    if (this.loginForm.invalid) {
      setTimeout(() => this.errorSummary?.nativeElement.focus(), 0);
      return;
    }
    
    // Submit form
  }
  
  getEmailError(): string {
    const emailControl = this.loginForm.get('email');
    if (emailControl?.hasError('required')) {
      return 'Email is required.';
    }
    if (emailControl?.hasError('email')) {
      return 'Please enter a valid email address.';
    }
    return '';
  }
  
  getPasswordError(): string {
    const passwordControl = this.loginForm.get('password');
    if (passwordControl?.hasError('required')) {
      return 'Password is required.';
    }
    if (passwordControl?.hasError('minlength')) {
      return 'Password must be at least 8 characters.';
    }
    return '';
  }
}
```
