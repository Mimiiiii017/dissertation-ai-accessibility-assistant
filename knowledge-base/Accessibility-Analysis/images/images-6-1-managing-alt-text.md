# Images: Managing Alternative Text (alt)

## Tags
Tags: #images #alt-text #non-text-content #wcag #1.1.1

## Purpose
Explain how to provide appropriate alternative text for images so non-text content is accessible to users of assistive technologies.

## Key points
- Every `<img>` and `<input type="image">` must have an `alt` attribute.
- The `alt` text must convey the purpose or information of the image.
- Decorative images must have an empty `alt` attribute (`alt=""`).
- Informative images must have meaningful, concise alternative text.
- Images that act as links or buttons must describe the action, not just the appearance.
- The same image used in different contexts may require different `alt` text.

## Developer checks
- Check that all `<img>` elements include an `alt` attribute.
- Verify that decorative images use `alt=""` and are not announced by screen readers.
- Ensure informative images do not have vague alt text such as “image” or “photo”.
- Confirm that image links describe the destination or action.
- Check `<input type="image">` elements for appropriate `alt` text.

## Fix patterns
- Add missing `alt` attributes to images.
- Replace filename-based or generic alt text with meaningful descriptions.
- Use `alt=""` for purely decorative images that add no information.
- Rewrite alt text to describe function when images are interactive.
- Avoid duplicating adjacent text content in the `alt` attribute unless necessary.

## Examples
```html
<!-- Informative image -->
<img src="logo.png" alt="Company name">

<!-- Decorative image -->
<img src="divider.png" alt="">

<!-- Image used as a link -->
<a href="/home">
  <img src="home-icon.png" alt="Go to homepage">
</a>

<!-- Image input -->
<input type="image" src="search.png" alt="Search">
```

## Framework-Specific Examples

### React/Next.js
```jsx
// Informative image
function Logo() {
  return <img src="/logo.png" alt="Company name" />;
}

// Decorative image
function Divider() {
  return <img src="/divider.png" alt="" />;
}

// Image as a link
function HomeLink() {
  return (
    <a href="/home">
      <img src="/home-icon.png" alt="Go to homepage" />
    </a>
  );
}

// Next.js Image component with proper alt text
import Image from 'next/image';

function ProductImage({ product }) {
  return (
    <Image 
      src={product.imageUrl} 
      alt={product.imageAlt || product.name}
      width={500}
      height={300}
    />
  );
}

// Decorative background image (not announced)
function Hero() {
  return (
    <div 
      style={{ backgroundImage: 'url(/hero.jpg)' }}
      role="img"
      aria-label="Team collaboration in modern office"
    >
      <h1>Welcome to our company</h1>
    </div>
  );
}

// Image button
function DeleteButton() {
  return (
    <button type="button" aria-label="Delete item">
      <img src="/trash-icon.png" alt="" />
    </button>
  );
}
```

### Vue/Nuxt
```vue
<template>
  <!-- Informative image -->
  <img src="/logo.png" alt="Company name" />
  
  <!-- Decorative image -->
  <img src="/divider.png" alt="" />
  
  <!-- Image as a link -->
  <a href="/home">
    <img src="/home-icon.png" alt="Go to homepage" />
  </a>
  
  <!-- Nuxt Image component -->
  <NuxtImg 
    :src="product.imageUrl" 
    :alt="product.imageAlt || product.name"
    width="500"
    height="300"
  />
  
  <!-- Dynamic alt text -->
  <img 
    :src="item.image" 
    :alt="item.description || 'Product image'" 
  />
  
  <!-- Image button with accessible name -->
  <button type="button" aria-label="Delete item">
    <img src="/trash-icon.png" alt="" />
  </button>
</template>

<script setup>
import { ref } from 'vue';

const product = ref({
  imageUrl: '/product.jpg',
  name: 'Blue widget',
  imageAlt: 'Blue widget with chrome finish'
});
</script>
```

### Angular
```typescript
// Component template

<!-- Informative image -->
<img src="/logo.png" alt="Company name" />

<!-- Decorative image -->
<img src="/divider.png" alt="" />

<!-- Image as a link -->
<a [routerLink]="['/home']">
  <img src="/home-icon.png" alt="Go to homepage" />
</a>

<!-- Dynamic alt text -->
<img 
  [src]="product.imageUrl" 
  [alt]="product.imageAlt || product.name"
/>

<!-- Image with async data -->
<img 
  *ngIf="user$ | async as user"
  [src]="user.avatarUrl" 
  [alt]="user.name + ' profile picture'"
/>

<!-- Image button -->
<button type="button" aria-label="Delete item">
  <img src="/trash-icon.png" alt="" />
  <!-- Or with Material Icon -->
  <mat-icon>delete</mat-icon>
</button>

// Component TypeScript
import { Component } from '@angular/core';

@Component({
  selector: 'app-product-image',
  templateUrl: './product-image.component.html'
})
export class ProductImageComponent {
  product = {
    imageUrl: '/product.jpg',
    name: 'Blue widget',
    imageAlt: 'Blue widget with chrome finish'
  };
}
```

### Svelte/SvelteKit
```svelte
<script>
  let product = {
    imageUrl: '/product.jpg',
    name: 'Blue widget',
    imageAlt: 'Blue widget with chrome finish'
  };
</script>

<!-- Informative image -->
<img src="/logo.png" alt="Company name" />

<!-- Decorative image -->
<img src="/divider.png" alt="" />

<!-- Image as a link -->
<a href="/home">
  <img src="/home-icon.png" alt="Go to homepage" />
</a>

<!-- Dynamic alt text -->
<img 
  src={product.imageUrl} 
  alt={product.imageAlt || product.name}
/>

<!-- Image button -->
<button type="button" aria-label="Delete item">
  <img src="/trash-icon.png" alt="" />
</button>
```

### WordPress/PHP
```php
<!-- Informative image -->
<img src="<?php echo esc_url(get_template_directory_uri() . '/images/logo.png'); ?>" 
     alt="<?php echo esc_attr(get_bloginfo('name')); ?>" />

<!-- Post thumbnail with alt text -->
<?php 
if (has_post_thumbnail()) {
  the_post_thumbnail('medium', ['alt' => get_the_title()]);
}
?>

<!-- Dynamic image with alt text -->
<?php
$image_id = get_post_meta(get_the_ID(), 'custom_image', true);
$image_alt = get_post_meta($image_id, '_wp_attachment_image_alt', true);
echo wp_get_attachment_image(
  $image_id, 
  'large', 
  false, 
  ['alt' => $image_alt ?: get_the_title()]
);
?>

<!-- Decorative image -->
<img src="<?php echo esc_url($decorative_url); ?>" alt="" />

<!-- Image in link -->
<a href="<?php echo esc_url(home_url('/')); ?>">
  <img src="<?php echo esc_url($logo_url); ?>" 
       alt="<?php esc_attr_e('Go to homepage', 'text-domain'); ?>" />
</a>
```

### Django/Jinja2
```django
{# Informative image #}
<img src="{% static 'images/logo.png' %}" alt="{{ site_name }}" />

{# Decorative image #}
<img src="{% static 'images/divider.png' %}" alt="" />

{# Image as a link #}
<a href="{% url 'home' %}">
  <img src="{% static 'images/home-icon.png' %}" alt="Go to homepage" />
</a>

{# Dynamic alt text from model #}
<img src="{{ product.image.url }}" 
     alt="{{ product.image_alt|default:product.name }}" />

{# Image with translation #}
<img src="{{ logo_url }}" 
     alt="{% trans 'Company logo' %}" />
```
```