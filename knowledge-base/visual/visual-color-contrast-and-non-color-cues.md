# Visual Design: Color Contrast and Non-Color Cues

## Tags
Tags: #color-contrast #visual-design #non-color-cues #wcag #1.4.1 #1.4.3 #1.4.6 #1.4.11 #eaa

## Purpose
Ensure text and essential visual information are perceivable by users with low vision or color vision deficiencies by providing sufficient contrast and not relying on color alone.

## Key points
- Text must meet minimum contrast ratios against its background (WCAG 1.4.3).
- Normal text requires a contrast ratio of at least 4.5:1 (Level AA).
- Large text (18pt / 24px or 14pt / 18.5px bold and above) requires at least 3:1 (Level AA).
- Enhanced contrast (Level AAA): 7:1 for normal text, 4.5:1 for large text (WCAG 1.4.6).
- User interface components and graphical objects must have at least 3:1 contrast (WCAG 1.4.11 — see also visual-non-text-contrast.md for full detail).
- Color must not be the only method used to convey information, status, or errors (WCAG 1.4.1).
- Links within text must be distinguishable by more than colour alone — use underlines, font weight, or 3:1 contrast difference between link colour and surrounding text.
- Contrast requirements apply equally in light mode, dark mode, and user-selected themes.

## Developer checks
- Check text contrast against backgrounds for normal and large text using a contrast checker tool.
- Verify icons, borders, and focus indicators have sufficient contrast (3:1 minimum).
- Ensure error states, success states, and warnings are not color-only.
- Test contrast in light mode, dark mode, and high-contrast settings.
- Confirm links are distinguishable from surrounding text without color alone (underline or 3:1 contrast difference).
- Check placeholder text contrast (often too light — must still meet 4.5:1 if it conveys information).
- Test with colour blindness simulation tools to confirm non-colour cues are present.

### Recommended contrast tools
- **WebAIM Contrast Checker** — https://webaim.org/resources/contrastchecker/
- **Colour Contrast Analyser (CCA)** — Desktop tool by TPGi.
- **Chrome DevTools** — Inspect element → colour picker shows contrast ratio.
- **axe DevTools** — Automated contrast checking in browser.
- **Stark** — Design tool plugin (Figma, Sketch) for contrast checking.

## Fix patterns
- Adjust foreground or background colors to meet contrast requirements.
- Increase font weight or size where appropriate.
- Add non-color indicators such as text labels, icons, or patterns.
- Underline links or add visual indicators beyond color.
- Improve contrast for UI components such as buttons, inputs, and focus rings.

## Examples
```css
/* Sufficient contrast for body text (4.5:1) */
body {
  color: #333333; /* on #ffffff = 12.6:1 */
  background-color: #ffffff;
}

/* Clear focus indicator with strong contrast */
button:focus-visible {
  outline: 3px solid #005fcc;
}

/* Links distinguished by underline (not colour alone) */
a {
  color: #005fcc; /* 4.5:1 against white */
  text-decoration: underline;
}

/* Incorrect: placeholder too low contrast */
input::placeholder {
  color: #cccccc; /* on white = 1.6:1 FAIL */
}

/* Correct: placeholder with sufficient contrast */
input::placeholder {
  color: #767676; /* on white = 4.5:1 PASS */
}

/* Non-colour indicator for required fields */
.required-label::after {
  content: ' *';
  color: inherit; /* not red-only */
}
```
```html
<!-- Error message with text, icon, and border — not colour alone -->
<div class="error-message">
  <span aria-hidden="true">!</span>
  <strong>Error:</strong> Please enter a valid email address.
</div>

<!-- Link distinguished beyond colour -->
<a href="/terms">Terms and conditions</a>

<!-- Status indicators with text, not colour alone -->
<span class="status status--success">Active</span>
<span class="status status--error">Expired</span>

<!-- Form validation with multiple cues -->
<label for="email">Email address</label>
<input id="email" type="email" aria-invalid="true" aria-describedby="emailErr"
       class="input--error">
<div id="emailErr" class="error-text">
  <span aria-hidden="true">!</span> Please enter a valid email address.
</div>
```

## Framework-Specific Examples

### React/Next.js
```jsx
// Button with sufficient contrast
function PrimaryButton({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: '#005fcc', // 4.5:1 on white
        color: '#ffffff',
        padding: '12px 24px',
        border: 'none',
        borderRadius: '4px'
      }}
      className="focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-blue-600"
    >
      {children}
    </button>
  );
}

// Error message with icon and text (not color alone)
function ErrorMessage({ children }) {
  return (
    <div
      role="alert"
      style={{
        padding: '12px',
        border: '2px solid #d32f2f',
        borderRadius: '4px',
        background: '#ffebee',
        color: '#c62828' // Sufficient contrast
      }}
    >
      <span aria-hidden="true" style={{ marginRight: '8px' }}></span>
      <strong>Error:</strong> {children}
    </div>
  );
}

// Link with underline (not color alone)
function AccessibleLink({ href, children }) {
  return (
    <a
      href={href}
      style={{
        color: '#005fcc', // 4.5:1 contrast
        textDecoration: 'underline'
      }}
    >
      {children}
    </a>
  );
}

// Status indicator with text and icon
function StatusBadge({ status }) {
  const styles = {
    success: { bg: '#e8f5e9', border: '#4caf50', text: '#2e7d32' },
    error: { bg: '#ffebee', border: '#f44336', text: '#c62828' },
    warning: { bg: '#fff3e0', border: '#ff9800', text: '#e65100' }
  };
  
  const style = styles[status];
  const icons = { success: '', error: '', warning: '' };
  
  return (
    <span
      style={{
        background: style.bg,
        border: `2px solid ${style.border}`,
        color: style.text,
        padding: '4px 8px',
        borderRadius: '4px'
      }}
    >
      <span aria-hidden="true">{icons[status]} </span>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
```

### Vue/Nuxt
```vue
<template>
  <!-- Button with sufficient contrast -->
  <button class="primary-button" @click="handleClick">
    <slot></slot>
  </button>
  
  <!-- Error message with icon and text -->
  <div v-if="error" role="alert" class="error-message">
    <span aria-hidden="true"></span>
    <strong>Error:</strong> {{ error }}
  </div>
  
  <!-- Link with underline -->
  <a :href="href" class="accessible-link">
    <slot></slot>
  </a>
  
  <!-- Status badge -->
  <span :class="['status-badge', `status-${status}`]">
    <span aria-hidden="true">{{ statusIcon }}</span>
    {{ statusText }}
  </span>
</template>

<script setup>
const props = defineProps({
  status: String,
  error: String,
  href: String
});

const statusIcons = {
  success: '',
  error: '',
  warning: ''
};

const statusIcon = computed(() => statusIcons[props.status]);
const statusText = computed(() => 
  props.status.charAt(0).toUpperCase() + props.status.slice(1)
);
</script>

<style scoped>
.primary-button {
  background: #005fcc;
  color: #ffffff;
  padding: 12px 24px;
  border: none;
  border-radius: 4px;
}

.primary-button:focus-visible {
  outline: 2px solid #005fcc;
  outline-offset: 2px;
}

.error-message {
  padding: 12px;
  border: 2px solid #d32f2f;
  border-radius: 4px;
  background: #ffebee;
  color: #c62828;
}

.accessible-link {
  color: #005fcc;
  text-decoration: underline;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  border: 2px solid;
}

.status-success {
  background: #e8f5e9;
  border-color: #4caf50;
  color: #2e7d32;
}

.status-error {
  background: #ffebee;
  border-color: #f44336;
  color: #c62828;
}
</style>
```

### Angular
```typescript
// Component template
<button class="primary-button" (click)="handleClick()">
  <ng-content></ng-content>
</button>

<div *ngIf="error" role="alert" class="error-message">
  <span aria-hidden="true"></span>
  <strong>Error:</strong> {{ error }}
</div>

<a [href]="href" class="accessible-link">
  <ng-content></ng-content>
</a>

<span [class]="'status-badge status-' + status">
  <span aria-hidden="true">{{ getStatusIcon() }}</span>
  {{ getStatusText() }}
</span>

// Component styles
.primary-button {
  background: #005fcc;
  color: #ffffff;
  padding: 12px 24px;
  border: none;
  border-radius: 4px;
}

.primary-button:focus-visible {
  outline: 2px solid #005fcc;
  outline-offset: 2px;
}

.error-message {
  padding: 12px;
  border: 2px solid #d32f2f;
  border-radius: 4px;
  background: #ffebee;
  color: #c62828;
}

.accessible-link {
  color: #005fcc;
  text-decoration: underline;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  border: 2px solid;
}

.status-success {
  background: #e8f5e9;
  border-color: #4caf50;
  color: #2e7d32;
}
```

### Svelte/SvelteKit
```svelte
<script>
  export let status = 'success';
  export let error = '';
  
  const statusIcons = {
    success: '',
    error: '',
    warning: ''
  };
</script>

<!-- Button with sufficient contrast -->
<button class="primary-button" on:click>
  <slot></slot>
</button>

<!-- Error message -->
{#if error}
  <div role="alert" class="error-message">
    <span aria-hidden="true"></span>
    <strong>Error:</strong> {error}
  </div>
{/if}

<!-- Status badge -->
<span class="status-badge status-{status}">
  <span aria-hidden="true">{statusIcons[status]}</span>
  {status.charAt(0).toUpperCase() + status.slice(1)}
</span>

<style>
  .primary-button {
    background: #005fcc;
    color: #ffffff;
    padding: 12px 24px;
    border: none;
    border-radius: 4px;
  }
  
  .primary-button:focus-visible {
    outline: 2px solid #005fcc;
    outline-offset: 2px;
  }
  
  .error-message {
    padding: 12px;
    border: 2px solid #d32f2f;
    border-radius: 4px;
    background: #ffebee;
    color: #c62828;
  }
  
  .status-badge {
    padding: 4px 8px;
    border-radius: 4px;
    border: 2px solid;
  }
  
  .status-success {
    background: #e8f5e9;
    border-color: #4caf50;
    color: #2e7d32;
  }
  
  .status-error {
    background: #ffebee;
    border-color: #f44336;
    color: #c62828;
  }
</style>
```

### WordPress/PHP
```php
<!-- Button with sufficient contrast -->
<button class="primary-button" onclick="handleClick()">
  <?php esc_html_e('Submit', 'text-domain'); ?>
</button>

<!-- Error message -->
<?php if (!empty($error)) : ?>
  <div role="alert" class="error-message">
    <span aria-hidden="true"></span>
    <strong><?php esc_html_e('Error:', 'text-domain'); ?></strong>
    <?php echo esc_html($error); ?>
  </div>
<?php endif; ?>

<!-- Status badge -->
<span class="status-badge status-<?php echo esc_attr($status); ?>">
  <span aria-hidden="true"><?php echo $status === 'success' ? '' : ''; ?></span>
  <?php echo esc_html(ucfirst($status)); ?>
</span>
```

```css
/* In theme's style.css */
.primary-button {
  background: #005fcc;
  color: #ffffff;
  padding: 12px 24px;
  border: none;
  border-radius: 4px;
}

.primary-button:focus-visible {
  outline: 2px solid #005fcc;
  outline-offset: 2px;
}

.error-message {
  padding: 12px;
  border: 2px solid #d32f2f;
  border-radius: 4px;
  background: #ffebee;
  color: #c62828;
}

.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  border: 2px solid;
}

.status-success {
  background: #e8f5e9;
  border-color: #4caf50;
  color: #2e7d32;
}
```
```