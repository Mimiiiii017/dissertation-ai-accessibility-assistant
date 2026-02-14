# Dialogs: Modal Dialogs and Focus Management

## Tags
Tags: #dialogs #modals #focus-management #keyboard #aria #wcag #2.4.3 #2.4.7

## Purpose
Ensure modal dialogs are accessible by managing focus correctly so keyboard and screen reader users can interact with dialogs without losing context.

## Key points
- When a modal dialog opens, focus must move inside the dialog.
- While the dialog is open, focus must be trapped within it.
- When the dialog closes, focus must return to the element that opened it.
- Background content must not be accessible while the modal is open.
- Dialogs must have an accessible name that describes their purpose.

## Developer checks
- Open the modal using only the keyboard and observe where focus moves.
- Verify focus does not move to background content while the dialog is open.
- Check that the dialog has a clear title announced by screen readers.
- Confirm Escape key closes the modal when appropriate.
- Ensure focus returns to the triggering control after closing.

## Fix patterns
- Move focus to the first meaningful element inside the dialog on open.
- Trap focus within the dialog using JavaScript.
- Restore focus to the trigger element when the dialog closes.
- Mark the dialog container with `role="dialog"` or `role="alertdialog"` when needed.
- Hide background content from assistive technologies while the dialog is open.

## Examples
```html
<!-- Modal dialog -->
<div role="dialog" aria-labelledby="dialogTitle" aria-modal="true">
  <h2 id="dialogTitle">Delete item</h2>
  <p>Are you sure you want to delete this item?</p>
  <button type="button">Cancel</button>
  <button type="button">Delete</button>
</div>
```

```js
// Open dialog and move focus
function openDialog(dialog, trigger) {
  dialog.removeAttribute('hidden');
  dialog.querySelector('[autofocus]')?.focus() || dialog.focus();

  // Trap focus inside dialog
  dialog.addEventListener('keydown', function trapFocus(e) {
    if (e.key === 'Tab') {
      const focusable = dialog.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    if (e.key === 'Escape') {
      closeDialog(dialog, trigger);
    }
  });
}

// Close dialog and restore focus
function closeDialog(dialog, trigger) {
  dialog.setAttribute('hidden', '');
  trigger.focus();
}
```

```html
<!-- Trigger button -->
<button id="openDialog">Delete item</button>
```

## Framework-Specific Examples

### React/Next.js
```jsx
import { useRef, useEffect } from 'react';

function Modal({ isOpen, onClose, title, children }) {
  const dialogRef = useRef(null);
  const triggerRef = useRef(null);
  
  // Move focus into dialog when it opens
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      const focusableElements = dialogRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusableElements[0]?.focus();
    }
  }, [isOpen]);
  
  // Trap focus within dialog
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    
    if (e.key === 'Tab') {
      const focusableElements = dialogRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div 
      ref={dialogRef}
      role="dialog" 
      aria-labelledby="dialogTitle"
      aria-modal="true"
      onKeyDown={handleKeyDown}
    >
      <h2 id="dialogTitle">{title}</h2>
      {children}
    </div>
  );
}

// Usage
function App() {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <>
      <button onClick={() => setIsOpen(true)}>
        Delete item
      </button>
      
      <Modal 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)}
        title="Delete item"
      >
        <p>Are you sure you want to delete this item?</p>
        <button onClick={() => setIsOpen(false)}>Cancel</button>
        <button onClick={handleDelete}>Delete</button>
      </Modal>
    </>
  );
}
```

### Vue/Nuxt
```vue
<template>
  <div>
    <button @click="isOpen = true">Delete item</button>
    
    <div 
      v-if="isOpen"
      ref="dialogRef"
      role="dialog" 
      aria-labelledby="dialogTitle"
      aria-modal="true"
      @keydown="handleKeyDown"
    >
      <h2 id="dialogTitle">{{ title }}</h2>
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue';

const props = defineProps({
  title: String
});

const emit = defineEmits(['close']);

const isOpen = ref(false);
const dialogRef = ref(null);

// Move focus into dialog when it opens
watch(isOpen, async (newVal) => {
  if (newVal) {
    await nextTick();
    const focusableElements = dialogRef.value.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusableElements[0]?.focus();
  }
});

const handleKeyDown = (e) => {
  if (e.key === 'Escape') {
    isOpen.value = false;
    emit('close');
    return;
  }
  
  if (e.key === 'Tab') {
    const focusableElements = dialogRef.value.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }
};
</script>

<!-- Usage -->
<template>
  <Modal title="Delete item">
    <p>Are you sure you want to delete this item?</p>
    <button @click="isOpen = false">Cancel</button>
    <button @click="handleDelete">Delete</button>
  </Modal>
</template>
```

### Angular
```typescript
// Component template
<button (click)="openDialog()">Delete item</button>

<div 
  *ngIf="isOpen"
  #dialogRef
  role="dialog" 
  [attr.aria-labelledby]="'dialogTitle'"
  aria-modal="true"
  (keydown)="handleKeyDown($event)"
>
  <h2 id="dialogTitle">{{ title }}</h2>
  <ng-content></ng-content>
</div>

// Component TypeScript
import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';

@Component({
  selector: 'app-modal',
  templateUrl: './modal.component.html'
})
export class ModalComponent implements AfterViewInit {
  @ViewChild('dialogRef') dialogRef!: ElementRef;
  
  isOpen = false;
  title = 'Delete item';
  
  ngAfterViewInit() {
    if (this.isOpen && this.dialogRef) {
      this.moveFocusToDialog();
    }
  }
  
  openDialog() {
    this.isOpen = true;
    setTimeout(() => this.moveFocusToDialog(), 0);
  }
  
  closeDialog() {
    this.isOpen = false;
  }
  
  moveFocusToDialog() {
    const focusableElements = this.dialogRef.nativeElement.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    focusableElements[0]?.focus();
  }
  
  handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      this.closeDialog();
      return;
    }
    
    if (event.key === 'Tab') {
      const focusableElements = this.dialogRef.nativeElement.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
      
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }
}

// Using Angular Material Dialog (accessible by default)
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-delete-dialog',
  template: `
    <h2 mat-dialog-title>Delete item</h2>
    <mat-dialog-content>
      <p>Are you sure you want to delete this item?</p>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-button [mat-dialog-close]="false">Cancel</button>
      <button mat-button [mat-dialog-close]="true" cdkFocusInitial>Delete</button>
    </mat-dialog-actions>
  `
})
export class DeleteDialogComponent {}

// Usage
constructor(private dialog: MatDialog) {}

openDialog() {
  const dialogRef = this.dialog.open(DeleteDialogComponent);
  dialogRef.afterClosed().subscribe(result => {
    if (result) {
      this.handleDelete();
    }
  });
}
```

### Svelte/SvelteKit
```svelte
<script>
  import { onMount, tick } from 'svelte';
  
  export let isOpen = false;
  export let title = '';
  
  let dialogRef;
  
  $: if (isOpen && dialogRef) {
    tick().then(() => {
      const focusableElements = dialogRef.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusableElements[0]?.focus();
    });
  }
  
  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      isOpen = false;
      return;
    }
    
    if (e.key === 'Tab') {
      const focusableElements = dialogRef.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  }
</script>

<!-- Usage -->
<button on:click={() => isOpen = true}>Delete item</button>

{#if isOpen}
  <div 
    bind:this={dialogRef}
    role="dialog" 
    aria-labelledby="dialogTitle"
    aria-modal="true"
    on:keydown={handleKeyDown}
  >
    <h2 id="dialogTitle">{title}</h2>
    <slot></slot>
  </div>
{/if}
```
```