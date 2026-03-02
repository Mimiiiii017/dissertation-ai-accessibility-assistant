# Keyboard: Focus Indicators

## Tags
Tags: #keyboard #focus #focus-indicator #wcag #2.4.7 #2.4.13

## Purpose
Ensure users navigating with a keyboard can always see which element currently has focus, supporting orientation, efficiency, and error prevention.

## Key points
- A visible focus indicator must be present for all focusable elements.
- Focus indicators must be clearly distinguishable from the default state.
- Removing focus outlines without providing an accessible alternative creates barriers.
- Focus styles must be visible against all backgrounds and themes.
- Custom components must provide their own focus styles.

## Developer checks
- Navigate the page using only the keyboard and observe focus visibility.
- Check that focus indicators are not disabled using `outline: none` without replacement.
- Verify focus is visible on buttons, links, form fields, and custom widgets.
- Ensure focus styles meet sufficient contrast against the background.
- Test focus visibility in high-contrast modes and zoomed views.

## Fix patterns
- Restore default browser focus styles when they have been removed.
- Add custom focus styles using `:focus` or `:focus-visible`.
- Ensure focus indicators are at least as visible as hover states.
- Avoid relying solely on color changes that may be subtle or low-contrast.
- Apply consistent focus styling across all interactive elements.

## Examples
```css
/* Default-friendly custom focus style */
button:focus {
  outline: 2px solid #005fcc;
  outline-offset: 2px;
}

/* Using :focus-visible to avoid mouse-triggered focus styles */
a:focus-visible,
button:focus-visible,
input:focus-visible {
  outline: 3px solid #005fcc;
}
```

```html
<!-- Focusable element with visible focus -->
<a href="/settings">Account settings</a>
```

## Framework-Specific Examples

### React/Next.js
```jsx
// Custom focus styles in Next.js with Tailwind
function Navigation() {
  return (
    <nav>
      <a 
        href="/home"
        className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Home
      </a>
      <a 
        href="/about"
        className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        About
      </a>
    </nav>
  );
}

// Custom button with focus indicator
function Button({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 16px',
        border: '1px solid #ccc',
        borderRadius: '4px'
      }}
      className="focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
    >
      {children}
    </button>
  );
}
```

```css
/* Global focus styles in CSS modules or global CSS */
*:focus-visible {
  outline: 3px solid #005fcc;
  outline-offset: 2px;
}

button:focus-visible,
a:focus-visible,
input:focus-visible,
select:focus-visible,
textarea:focus-visible {
  outline: 3px solid #005fcc;
  outline-offset: 2px;
}
```

### Vue/Nuxt
```vue
<template>
  <nav>
    <NuxtLink 
      to="/home"
      class="nav-link"
    >
      Home
    </NuxtLink>
    <NuxtLink 
      to="/about"
      class="nav-link"
    >
      About
    </NuxtLink>
  </nav>
</template>

<style scoped>
.nav-link {
  padding: 8px 16px;
  text-decoration: none;
  color: #333;
}

.nav-link:focus-visible {
  outline: 3px solid #005fcc;
  outline-offset: 2px;
  border-radius: 4px;
}

/* Alternative: custom focus ring */
.nav-link:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px rgba(0, 95, 204, 0.5);
}
</style>
```

### Angular
```typescript
// Component template
<nav>
  <a 
    routerLink="/home" 
    routerLinkActive="active"
    class="nav-link"
  >
    Home
  </a>
  <a 
    routerLink="/about" 
    routerLinkActive="active"
    class="nav-link"
  >
    About
  </a>
</nav>

<button 
  mat-raised-button 
  color="primary"
  (click)="handleClick()"
>
  Submit
</button>
```

```css
/* Global styles.css */
*:focus-visible {
  outline: 3px solid #005fcc;
  outline-offset: 2px;
}

/* Component styles */
.nav-link {
  padding: 8px 16px;
  text-decoration: none;
}

.nav-link:focus-visible {
  outline: 3px solid #005fcc;
  outline-offset: 2px;
  border-radius: 4px;
}

/* Angular Material focus indicators are built-in */
```
