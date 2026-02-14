# Controls: Links vs Buttons

## Tags
Tags: #controls #links #buttons #semantic-html #aria #wcag

## Purpose
Ensure links and buttons are used correctly according to their function, so users of assistive technologies can predict behavior and interact with controls effectively.

## Key points
- Links (`<a>`) are for navigation to another location or resource.
- Buttons (`<button>`) are for actions that change state, submit data, or trigger behavior.
- Using the wrong element type creates confusion for screen reader and keyboard users.
- Visual styling must not determine whether something is a link or a button.
- ARIA should not be used to override native semantics unless absolutely necessary.

## Developer checks
- Identify interactive elements that look like buttons or links.
- Check whether the element performs navigation or an action.
- Verify `<div>` or `<span>` elements are not being used as interactive controls.
- Confirm keyboard behavior matches expectations (Enter for links, Enter/Space for buttons).
- Test how controls are announced by a screen reader.

## Fix patterns
- Replace clickable `<div>` or `<span>` elements with `<button>` or `<a>`.
- Use `<a href="...">` only when navigating to a new page or section.
- Use `<button>` for form submission, toggles, modals, and UI actions.
- Remove unnecessary `role="button"` when a native `<button>` can be used.
- Ensure disabled states are communicated properly for buttons.

## Examples
```html
<!-- Correct: link for navigation -->
<a href="/profile">View profile</a>

<!-- Correct: button for action -->
<button type="button" onclick="openModal()">
  Open settings
</button>

<!-- Incorrect: div used as button -->
<div onclick="submitForm()">Submit</div>

<!-- ARIA role only as a last resort -->
<div role="button" tabindex="0"
     onclick="doAction()"
     onkeydown="if(event.key==='Enter'||event.key===' ') doAction();">
  Activate
</div>
```

## Framework-Specific Examples

### React/Next.js
```jsx
// Correct: Link for navigation
import Link from 'next/link';

function ProfileLink() {
  return <Link href="/profile">View profile</Link>;
}

// Correct: Button for action
function SettingsButton() {
  const openModal = () => {
    // Open settings modal
  };
  
  return (
    <button type="button" onClick={openModal}>
      Open settings
    </button>
  );
}

// Incorrect: div used as button
function BadButton() {
  return <div onClick={submitForm}>Submit</div>;
}

// Correct: Use native button
function GoodButton() {
  return <button onClick={submitForm}>Submit</button>;
}

// Navigation with onClick (use Link instead)
// Incorrect
function BadNavigation() {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/about')}>About</button>;
}

// Correct
function GoodNavigation() {
  return <Link href="/about">About</Link>;
}

// Button that looks like a link (styling doesn't change semantics)
function TextButton() {
  return (
    <button 
      type="button" 
      onClick={handleAction}
      className="text-button" // Styles it like a link
    >
      Learn more
    </button>
  );
}
```

### Vue/Nuxt
```vue
<template>
  <!-- Correct: Link for navigation -->
  <NuxtLink to="/profile">View profile</NuxtLink>
  
  <!-- Correct: Button for action -->
  <button type="button" @click="openModal">
    Open settings
  </button>
  
  <!-- Incorrect: div used as button -->
  <div @click="submitForm">Submit</div>
  
  <!-- Correct: Use native button -->
  <button @click="submitForm">Submit</button>
  
  <!-- Link with external URL -->
  <a href="https://example.com" target="_blank" rel="noopener noreferrer">
    External link
  </a>
  
  <!-- Button that toggles state -->
  <button 
    type="button" 
    @click="isExpanded = !isExpanded"
    :aria-expanded="isExpanded"
  >
    {{ isExpanded ? 'Collapse' : 'Expand' }}
  </button>
</template>

<script setup>
import { ref } from 'vue';

const isExpanded = ref(false);

const openModal = () => {
  // Open modal
};

const submitForm = () => {
  // Submit form
};
</script>
```

### Angular
```typescript
// Component template

<!-- Correct: Link for navigation -->
<a [routerLink]="['/profile']">View profile</a>

<!-- Correct: Button for action -->
<button type="button" (click)="openModal()">
  Open settings
</button>

<!-- Incorrect: div used as button -->
<div (click)="submitForm()">Submit</div>

<!-- Correct: Use native button -->
<button (click)="submitForm()">Submit</button>

<!-- Link with external URL -->
<a href="https://example.com" target="_blank" rel="noopener noreferrer">
  External link
</a>

<!-- Button that toggles state -->
<button 
  type="button" 
  (click)="toggleExpanded()"
  [attr.aria-expanded]="isExpanded"
>
  {{ isExpanded ? 'Collapse' : 'Expand' }}
</button>

<!-- Using Angular Material -->
<a mat-button [routerLink]="['/profile']">View profile</a>
<button mat-raised-button (click)="openModal()">Open settings</button>

// Component TypeScript
import { Component } from '@angular/core';

@Component({
  selector: 'app-controls-example',
  templateUrl: './controls-example.component.html'
})
export class ControlsExampleComponent {
  isExpanded = false;
  
  openModal() {
    // Open modal
  }
  
  submitForm() {
    // Submit form
  }
  
  toggleExpanded() {
    this.isExpanded = !this.isExpanded;
  }
}
```

### Svelte/SvelteKit
```svelte
<script>
  let isExpanded = false;
  
  function openModal() {
    // Open modal
  }
  
  function submitForm() {
    // Submit form
  }
</script>

<!-- Correct: Link for navigation -->
<a href="/profile">View profile</a>

<!-- Correct: Button for action -->
<button type="button" on:click={openModal}>
  Open settings
</button>

<!-- Incorrect: div used as button -->
<div on:click={submitForm}>Submit</div>

<!-- Correct: Use native button -->
<button on:click={submitForm}>Submit</button>

<!-- Link with external URL -->
<a href="https://example.com" target="_blank" rel="noopener noreferrer">
  External link
</a>

<!-- Button that toggles state -->
<button 
  type="button" 
  on:click={() => isExpanded = !isExpanded}
  aria-expanded={isExpanded}
>
  {isExpanded ? 'Collapse' : 'Expand'}
</button>
```

### WordPress/PHP
```php
<!-- Correct: Link for navigation -->
<a href="<?php echo esc_url(get_permalink()); ?>">
  <?php the_title(); ?>
</a>

<!-- Correct: Button for action -->
<button type="button" onclick="openModal()">
  <?php esc_html_e('Open settings', 'text-domain'); ?>
</button>

<!-- WordPress navigation menu (uses links) -->
<?php
wp_nav_menu([
  'theme_location' => 'primary',
  'container' => 'nav',
  'menu_class' => 'main-menu'
]);
?>

<!-- Form submit button -->
<form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
  <button type="submit">
    <?php esc_html_e('Submit', 'text-domain'); ?>
  </button>
</form

>
```

### Django/Jinja2
```django
{# Correct: Link for navigation #}
<a href="{% url 'profile' %}">View profile</a>

{# Correct: Button for action #}
<button type="button" onclick="openModal()">
  {% trans "Open settings" %}
</button>

{# Form submit button #}
<form method="post" action="{% url 'submit_form' %}">
  {% csrf_token %}
  <button type="submit">{% trans "Submit" %}</button>
</form>

{# Link with translation #}
<a href="{% url 'about' %}">
  {% trans "About us" %}
</a>
```
```