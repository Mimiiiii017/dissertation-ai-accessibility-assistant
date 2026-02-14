# Keyboard: Navigation and Tab Order

## Tags
Tags: #keyboard #navigation #tab-order #focus #wcag #2.1.1 #2.1.2 #2.4.3

## Purpose
Ensure all website functionality is usable with a keyboard alone, allowing users with motor impairments or assistive technologies to navigate and interact effectively.

## Key points
- All interactive elements must be reachable using the keyboard.
- Keyboard navigation must follow a logical, predictable order.
- Users must always be able to see which element currently has focus.
- Mouse-only interactions create accessibility barriers.
- Keyboard support is essential for screen readers and other assistive technologies.

## Developer checks
- Test the entire page using only the Tab, Shift+Tab, Enter, and Space keys.
- Check that buttons, links, inputs, and custom controls are focusable.
- Verify tab order follows the visual and reading order of the page.
- Ensure no keyboard traps exist.
- Confirm focus is not lost during dynamic updates or page changes.

## Fix patterns
- Use native interactive elements (`<button>`, `<a>`, `<input>`) instead of non-semantic containers.
- Add `tabindex="0"` to custom interactive elements when necessary.
- Remove positive tabindex values (`tabindex="1"` or higher).
- Ensure JavaScript click handlers also respond to keyboard events.
- Restore focus appropriately after dynamic actions (e.g., modals, form submission).

## Examples
```html
<!-- Native keyboard-accessible button -->
<button type="submit">Submit</button>

<!-- Custom interactive element made keyboard-focusable -->
<div tabindex="0" role="button" onclick="doAction()"
     onkeydown="if(event.key === 'Enter' || event.key === ' ') doAction();">
  Activate
</div>

<!-- Logical tab order -->
<input type="text" id="name">
<input type="email" id="email">
<button type="submit">Send</button>
```

## Framework-Specific Examples

### React/Next.js
```jsx
// Native keyboard-accessible button
function SubmitForm() {
  return <button type="submit">Submit</button>;
}

// Custom interactive element with keyboard support
function CustomButton({ onClick, children }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };
  
  return (
    <div 
      tabIndex={0} 
      role="button" 
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}

// Focus management with useRef
import { useRef, useEffect } from 'react';

function SearchModal({ isOpen }) {
  const inputRef = useRef(null);
  
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);
  
  return (
    <div role="dialog">
      <input ref={inputRef} type="text" placeholder="Search..." />
    </div>
  );
}

// Logical tab order maintained
function ContactForm() {
  return (
    <form>
      <input type="text" id="name" placeholder="Name" />
      <input type="email" id="email" placeholder="Email" />
      <textarea id="message" placeholder="Message" />
      <button type="submit">Send</button>
    </form>
  );
}
```

### Vue/Nuxt
```vue
<template>
  <!-- Native keyboard-accessible button -->
  <button type="submit">Submit</button>
  
  <!-- Custom interactive element with keyboard support -->
  <div 
    tabindex="0" 
    role="button" 
    @click="handleClick"
    @keydown.enter="handleClick"
    @keydown.space.prevent="handleClick"
  >
    Activate
  </div>
  
  <!-- Focus management with refs -->
  <div v-if="isOpen" role="dialog">
    <input ref="searchInput" type="text" placeholder="Search..." />
  </div>
  
  <!-- Logical tab order -->
  <form>
    <input type="text" id="name" v-model="name" />
    <input type="email" id="email" v-model="email" />
    <textarea id="message" v-model="message" />
    <button type="submit">Send</button>
  </form>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';

const isOpen = ref(false);
const searchInput = ref(null);
const name = ref('');
const email = ref('');
const message = ref('');

const handleClick = () => {
  // Handle click
};

watch(isOpen, (newVal) => {
  if (newVal) {
    nextTick(() => {
      searchInput.value?.focus();
    });
  }
});
</script>
```

### Angular
```typescript
// Component template

<!-- Native keyboard-accessible button -->
<button type="submit">Submit</button>

<!-- Custom interactive element with keyboard support -->
<div 
  tabindex="0" 
  role="button" 
  (click)="handleClick()"
  (keydown.enter)="handleClick()"
  (keydown.space)="handleClick($event)"
>
  Activate
</div>

<!-- Focus management with ViewChild -->
<div *ngIf="isOpen" role="dialog">
  <input #searchInput type="text" placeholder="Search..." />
</div>

<!-- Logical tab order -->
<form>
  <input type="text" id="name" [(ngModel)]="name" />
  <input type="email" id="email" [(ngModel)]="email" />
  <textarea id="message" [(ngModel)]="message"></textarea>
  <button type="submit">Send</button>
</form>

// Component TypeScript
import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';

@Component({
  selector: 'app-search-modal',
  templateUrl: './search-modal.component.html'
})
export class SearchModalComponent implements AfterViewInit {
  @ViewChild('searchInput') searchInput!: ElementRef;
  isOpen = false;
  name = '';
  email = '';
  message = '';
  
  ngAfterViewInit() {
    if (this.isOpen && this.searchInput) {
      this.searchInput.nativeElement.focus();
    }
  }
  
  handleClick(event?: Event) {
    if (event && event.type === 'keydown') {
      event.preventDefault();
    }
    // Handle action
  }
}
```

### Svelte/SvelteKit
```svelte
<script>
  import { onMount } from 'svelte';
  
  let isOpen = false;
  let searchInput;
  let name = '';
  let email = '';
  let message = '';
  
  function handleClick() {
    // Handle click
  }
  
  function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }
  
  $: if (isOpen && searchInput) {
    searchInput.focus();
  }
</script>

<!-- Native keyboard-accessible button -->
<button type="submit">Submit</button>

<!-- Custom interactive element with keyboard support -->
<div 
  tabindex="0" 
  role="button" 
  on:click={handleClick}
  on:keydown={handleKeyDown}
>
  Activate
</div>

<!-- Focus management with bind:this -->
{#if isOpen}
  <div role="dialog">
    <input bind:this={searchInput} type="text" placeholder="Search..." />
  </div>
{/if}

<!-- Logical tab order -->
<form>
  <input type="text" id="name" bind:value={name} />
  <input type="email" id="email" bind:value={email} />
  <textarea id="message" bind:value={message}></textarea>
  <button type="submit">Send</button>
</form>
```

### WordPress/PHP
```php
<!-- Native keyboard-accessible button -->
<button type="submit"><?php esc_html_e('Submit', 'text-domain'); ?></button>

<!-- Custom interactive element (use native when possible) -->
<div 
  tabindex="0" 
  role="button" 
  onclick="doAction()"
  onkeydown="if(event.key === 'Enter' || event.key === ' ') doAction();"
>
  Activate
</div>

<!-- Logical tab order -->
<form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
  <input type="text" id="name" name="name" />
  <input type="email" id="email" name="email" />
  <textarea id="message" name="message"></textarea>
  <button type="submit">Send</button>
</form>
```
```