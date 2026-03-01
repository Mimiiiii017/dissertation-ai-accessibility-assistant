# ARIA: Live Regions and Dynamic Content

## Tags 
Tags: #aria #live-regions #dynamic-content #screen-readers #wcag

## Purpose
Ensure users of assistive technologies are informed when content changes dynamically without a page reload, such as form feedback, notifications, or status updates.

## Key points
- Dynamic content updates must be communicated to screen readers.
- ARIA live regions announce changes without requiring user focus.
- The `aria-live` attribute controls how and when updates are announced.
- Live regions should be used sparingly to avoid overwhelming users.
- Content changes that require user action should also be focus-managed.

## Developer checks
- Identify content that updates dynamically (AJAX, validation messages, status updates).
- Check whether updates are announced by screen readers.
- Verify correct `aria-live` politeness level is used.
- Ensure live regions are not overused or nested incorrectly.
- Confirm important updates are not visually hidden without an accessible alternative.

## Fix patterns
- Add `aria-live="polite"` for non-urgent updates.
- Use `aria-live="assertive"` or `role="alert"` for critical messages.
- Mark regions with `aria-atomic="true"` when full content should be read.
- Use `aria-busy="true"` during loading states.
- Combine live regions with focus movement when user action is required.

## Examples
```html
<!-- Polite live region -->
<div aria-live="polite">
  Profile saved successfully.
</div>

<!-- Assertive live region for critical feedback -->
<div role="alert">
  Error: Your session has expired.
</div>

<!-- Loading state -->
<div aria-live="polite" aria-busy="true">
  Loading results…
</div>

<!-- Atomic live region -->
<div aria-live="polite" aria-atomic="true">
  You have 3 new notifications.
</div>
```

## Framework-Specific Examples

### React/Next.js
```jsx
import { useState, useEffect } from 'react';

// Polite live region for status updates
function SaveStatus() {
  const [status, setStatus] = useState('');
  
  const handleSave = async () => {
    setStatus('Saving...');
    await saveProfile();
    setStatus('Profile saved successfully.');
  };
  
  return (
    <>
      <button onClick={handleSave}>Save Profile</button>
      <div aria-live="polite" aria-atomic="true">
        {status}
      </div>
    </>
  );
}

// Assertive live region for critical errors
function SessionMonitor() {
  const [error, setError] = useState('');
  
  use Effect(() => {
    const checkSession = () => {
      if (sessionExpired()) {
        setError('Error: Your session has expired.');
      }
    };
    const interval = setInterval(checkSession, 30000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div role="alert">
      {error}
    </div>
  );
}

// Loading state with aria-busy
function SearchResults() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  
  return (
    <div aria-live="polite" aria-busy={loading}>
      {loading ? 'Loading results…' : `Found ${results.length} items`}
    </div>
  );
}

// Notification counter
function NotificationCenter() {
  const [count, setCount] =useState(0);
  
  return (
    <div aria-live="polite" aria-atomic="true">
      {count > 0 && `You have ${count} new notifications.`}
    </div>
  );
}
```

### Vue/Nuxt
```vue
<template>
  <div>
    <!-- Polite live region for status -->
    <button @click="handleSave">Save Profile</button>
    <div aria-live="polite" aria-atomic="true">
      {{ status }}
    </div>
    
    <!-- Assertive live region for errors -->
    <div role="alert">
      {{ error }}
    </div>
    
    <!-- Loading state -->
    <div aria-live="polite" :aria-busy="loading">
      {{ loading ? 'Loading results…' : `Found ${results.length} items` }}
    </div>
    
    <!-- Notification counter -->
    <div aria-live="polite" aria-atomic="true">
      <span v-if="count > 0">You have {{ count }} new notifications.</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const status = ref('');
const error = ref('');
const loading = ref(false);
const results = ref([]);
const count = ref(0);

const handleSave = async () => {
  status.value = 'Saving...';
  await saveProfile();
  status.value = 'Profile saved successfully.';
};

// Session monitoring
let sessionInterval;
onMounted(() => {
  sessionInterval = setInterval(() => {
    if (sessionExpired()) {
      error.value = 'Error: Your session has expired.';
    }
  }, 30000);
});

onUnmounted(() => {
  clearInterval(sessionInterval);
});
</script>
```

### Angular
```typescript
// Component template

<!-- Polite live region for status -->
<button (click)="handleSave()">Save Profile</button>
<div aria-live="polite" aria-atomic="true">
  {{ status }}
</div>

<!-- Assertive live region for errors -->
<div role="alert">
  {{ error }}
</div>

<!-- Loading state -->
<div aria-live="polite" [attr.aria-busy]="loading">
  {{ loading ? 'Loading results…' : 'Found ' + results.length + ' items' }}
</div>

<!-- Notification counter -->
<div aria-live="polite" aria-atomic="true">
  <span *ngIf="count > 0">You have {{ count }} new notifications.</span>
</div>

// Component TypeScript
import { Component, OnInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-live-regions',
  templateUrl: './live-regions.component.html'
})
export class LiveRegionsComponent implements OnInit, OnDestroy {
  status = '';
  error = '';
  loading = false;
  results: any[] = [];
  count = 0;
  sessionInterval: any;
  
  async handleSave() {
    this.status = 'Saving...';
    await this.saveProfile();
    this.status = 'Profile saved successfully.';
  }
  
  ngOnInit() {
    // Monitor session
    this.sessionInterval = setInterval(() => {
      if (this.sessionExpired()) {
        this.error = 'Error: Your session has expired.';
      }
    }, 30000);
  }
  
  ngOnDestroy() {
    clearInterval(this.sessionInterval);
  }
  
  private saveProfile() {
    // Save logic
  }
  
  private sessionExpired(): boolean {
    // Check session
    return false;
  }
}
```

### Svelte/SvelteKit
```svelte
<script>
  import { onMount, onDestroy } from 'svelte';
  
  let status = '';
  let error = '';
  let loading = false;
  let results = [];
  let count = 0;
  let sessionInterval;
  
  async function handleSave() {
    status = 'Saving...';
    await saveProfile();
    status = 'Profile saved successfully.';
  }
  
  onMount(() => {
    sessionInterval = setInterval(() => {
      if (sessionExpired()) {
        error = 'Error: Your session has expired.';
      }
    }, 30000);
  });
  
  onDestroy(() => {
    clearInterval(sessionInterval);
  });
</script>

<!-- Polite live region for status -->
<button on:click={handleSave}>Save Profile</button>
<div aria-live="polite" aria-atomic="true">
  {status}
</div>

<!-- Assertive live region for errors -->
<div role="alert">
  {error}
</div>

<!-- Loading state -->
<div aria-live="polite" aria-busy={loading}>
  {loading ? 'Loading results…' : `Found ${results.length} items`}
</div>

<!-- Notification counter -->
<div aria-live="polite" aria-atomic="true">
  {#if count > 0}
    You have {count} new notifications.
  {/if}
</div>
```

### WordPress/PHP with JavaScript
```php
<!-- Polite live region -->
<div id="saveStatus" aria-live="polite" aria-atomic="true"></div>

<!-- Assertive live region -->
<div id="errorAlert" role="alert"></div>

<script>
// Update status
function updateSaveStatus(message) {
  document.getElementById('saveStatus').textContent = message;
}

// Show error
function showError(message) {
  document.getElementById('errorAlert').textContent = message;
}

// Example usage
async function handleSave() {
  updateSaveStatus('<?php esc_html_e('Saving...', 'text-domain'); ?>');
  await saveProfile();
  updateSaveStatus('<?php esc_html_e('Profile saved successfully.', 'text-domain'); ?>');
}
</script>
```
```