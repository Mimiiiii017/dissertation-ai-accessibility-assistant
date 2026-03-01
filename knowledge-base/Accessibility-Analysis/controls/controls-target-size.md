# Controls: Target Size

## Tags
Tags: #controls #target-size #touch #mobile #wcag #2.5.8

## Purpose
Ensure interactive elements are large enough to be activated easily, preventing accidental activation and supporting users with motor impairments, tremors, or limited dexterity.

## Key points
- The target size for pointer inputs must be at least 24×24 CSS pixels (WCAG 2.5.8, Level AA).
- The enhanced target size recommendation is 44×44 CSS pixels (WCAG 2.5.5, Level AAA).
- Targets smaller than 24×24 pixels must have sufficient spacing so the 24px target area does not overlap with adjacent targets.
- Exceptions include inline text links, targets whose size is determined by the user agent, and targets where a larger alternative is available on the same page.
- Small touch targets increase error rates for all users, especially on mobile devices.
- Grouping small targets too closely causes accidental activation.

## Developer checks
- Measure interactive element sizes (links, buttons, icons, checkboxes) to confirm they meet 24×24px minimum.
- Check spacing between adjacent targets.
- Verify icon-only buttons and controls meet the minimum target size.
- Test on mobile devices and with touch input.
- Confirm form controls (checkboxes, radio buttons) have a large enough clickable/tappable area.
- Check inline links for adequate size and spacing from other links.

## Fix patterns
- Set minimum width and height on interactive elements.
- Use padding to increase the clickable area without changing visual size.
- Add spacing (margin or gap) between adjacent small targets.
- Wrap checkbox and radio inputs in their labels to increase the tappable area.
- Use CSS to ensure icon buttons have sufficient padding.

## Examples
```css
/* Minimum target size */
button,
a,
input[type="checkbox"],
input[type="radio"],
select {
  min-width: 24px;
  min-height: 24px;
}

/* Enhanced target size for touch-friendly interfaces */
.touch-target {
  min-width: 44px;
  min-height: 44px;
  padding: 8px;
}

/* Adequate spacing between adjacent targets */
.icon-toolbar button {
  min-width: 44px;
  min-height: 44px;
  margin: 4px;
}
```

```html
<!-- Checkbox with large clickable area via label -->
<label class="checkbox-label">
  <input type="checkbox" name="agree">
  <span>I agree to the terms</span>
</label>
```

```css
.checkbox-label {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 8px;
  cursor: pointer;
}
```

## Framework-Specific Examples

### React/Next.js
```jsx
// Button with adequate target size
function Button({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        minWidth: '44px',
        minHeight: '44px',
        padding: '12px 20px',
        fontSize: '16px'
      }}
    >
      {children}
    </button>
  );
}

// Icon button with proper target size
function IconButton({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        minWidth: '44px',
        minHeight: '44px',
        padding: '10px',
        border: 'none',
        background: 'transparent'
      }}
    >
      {icon}
    </button>
  );
}

// Checkbox with large clickable area
function Checkbox({ id, label, checked, onChange }) {
  return (
    <label
      htmlFor={id}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: '44px',
        padding: '8px',
        cursor: 'pointer'
      }}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{ marginRight: '8px' }}
      />
      {label}
    </label>
  );
}

// Mobile-friendly link list
function LinkList({ links }) {
  return (
    <nav>
      {links.map((link) => (
        <a
          key={link.id}
          href={link.url}
          style={{
            display: 'block',
            minHeight: '44px',
            padding: '12px 16px',
            textDecoration: 'none'
          }}
        >
          {link.text}
        </a>
      ))}
    </nav>
  );
}
```

```css
/* Tailwind classes for target size */
.btn-touch {
  @apply min-w-[44px] min-h-[44px] px-5 py-3;
}

.icon-btn-touch {
  @apply min-w-[44px] min-h-[44px] p-2.5;
}
```

### Vue/Nuxt
```vue
<template>
  <!-- Button with adequate target size -->
  <button
    @click="handleClick"
    class="touch-target"
  >
    {{ label }}
  </button>
  
  <!-- Icon button -->
  <button
    @click="handleIconClick"
    :aria-label="iconLabel"
    class="icon-button"
  >
    <component :is="icon" aria-hidden="true" />
  </button>
  
  <!-- Checkbox with large clickable area -->
  <label class="checkbox-label">
    <input 
      type="checkbox" 
      :checked="checked"
      @change="$emit('update:checked', $event.target.checked)"
    />
    <span>{{ checkboxLabel }}</span>
  </label>
  
  <!-- Mobile nav links -->
  <nav>
    <NuxtLink
      v-for="link in links"
      :key="link.id"
      :to="link.url"
      class="nav-link"
    >
      {{ link.text }}
    </NuxtLink>
  </nav>
</template>

<style scoped>
.touch-target {
  min-width: 44px;
  min-height: 44px;
  padding: 12px 20px;
  font-size: 16px;
}

.icon-button {
  min-width: 44px;
  min-height: 44px;
  padding: 10px;
  border: none;
  background: transparent;
  cursor: pointer;
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 8px;
  cursor: pointer;
}

.nav-link {
  display: block;
  min-height: 44px;
  padding: 12px 16px;
  text-decoration: none;
}
</style>
```

### Angular
```typescript
// Component template
<button
  (click)="handleClick()"
  class="touch-target"
>
  {{ label }}
</button>

<!-- Icon button -->
<button
  mat-icon-button
  [attr.aria-label]="iconLabel"
  (click)="handleIconClick()"
  class="icon-button"
>
  <mat-icon>{{ icon }}</mat-icon>
</button>

<!-- Checkbox with large clickable area -->
<label class="checkbox-label">
  <input 
    type="checkbox" 
    [checked]="checked"
    (change)="onCheckboxChange($event)"
  />
  <span>{{ checkboxLabel }}</span>
</label>

<!-- Mobile nav links -->
<nav>
  <a 
    *ngFor="let link of links"
    [routerLink]="link.url"
    class="nav-link"
  >
    {{ link.text }}
  </a>
</nav>

// Component styles
.touch-target {
  min-width: 44px;
  min-height: 44px;
  padding: 12px 20px;
  font-size: 16px;
}

.icon-button {
  min-width: 44px !important;
  min-height: 44px !important;
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 8px;
  cursor: pointer;
}

.nav-link {
  display: block;
  min-height: 44px;
  padding: 12px 16px;
  text-decoration: none;
}
```

### Svelte/SvelteKit
```svelte
<script>
  export let label = '';
  export let icon = null;
  export let checked = false;
  
  function handleClick() {
    // Click handler
  }
</script>

<!-- Button with adequate target size -->
<button
  on:click={handleClick}
  class="touch-target"
>
  {label}
</button>

<!-- Icon button -->
<button
  on:click={handleClick}
  aria-label={label}
  class="icon-button"
>
  <svelte:component this={icon} aria-hidden="true" />
</button>

<!-- Checkbox with large clickable area -->
<label class="checkbox-label">
  <input 
    type="checkbox" 
    bind:checked
  />
  <span>{label}</span>
</label>

<style>
  .touch-target {
    min-width: 44px;
    min-height: 44px;
    padding: 12px 20px;
    font-size: 16px;
  }
  
  .icon-button {
    min-width: 44px;
    min-height: 44px;
    padding: 10px;
    border: none;
    background: transparent;
    cursor: pointer;
  }
  
  .checkbox-label {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 8px;
    cursor: pointer;
  }
</style>
```

### WordPress/PHP
```php
<!-- Button with adequate target size -->
<button 
  class="wp-button touch-target"
  onclick="handleClick()"
>
  <?php esc_html_e('Submit', 'text-domain'); ?>
</button>

<!-- Checkbox with large clickable area -->
<label class="checkbox-label">
  <input 
    type="checkbox" 
    name="agree" 
    value="1"
    <?php checked(isset($_POST['agree'])); ?>
  />
  <span><?php esc_html_e('I agree to the terms', 'text-domain'); ?></span>
</label>

<!-- Mobile nav menu -->
<nav class="mobile-menu">
  <?php
  wp_nav_menu([
    'theme_location' => 'primary',
    'container' => false,
    'menu_class' => 'mobile-nav-list'
  ]);
  ?>
</nav>
```

```css
/* In theme's style.css */
.touch-target {
  min-width: 44px;
  min-height: 44px;
  padding: 12px 20px;
  font-size: 16px;
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 8px;
  cursor: pointer;
}

.mobile-nav-list a {
  display: block;
  min-height: 44px;
  padding: 12px 16px;
  text-decoration: none;
}
```
```
