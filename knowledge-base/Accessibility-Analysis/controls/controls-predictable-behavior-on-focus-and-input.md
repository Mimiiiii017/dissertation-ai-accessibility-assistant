# Controls: Predictable Behaviour on Focus and Input

## Tags
Tags: #controls #predictable #on-focus #on-input #wcag #3.2.1 #3.2.2

## Purpose
Ensure that receiving focus or changing the value of a form control does not automatically trigger unexpected changes in context, which can disorient users.

## Key points
- Receiving focus on an element must not cause a change of context (WCAG 3.2.1).
- Changing a form setting (selecting an option, toggling a checkbox) must not automatically cause a change of context unless the user has been advised in advance (WCAG 3.2.2).
- Changes of context include: navigating to a new page, significantly rearranging the page, moving focus unexpectedly, or opening a new window.
- Submitting a form on input change (e.g., auto-submitting when a dropdown value changes) is a common violation.
- Opening a new window or tab on focus or on input is especially disorienting for screen reader users.

## Developer checks
- Tab through the page and confirm nothing unexpected happens when elements receive focus.
- Test all form controls (dropdowns, checkboxes, radio buttons, text inputs) and verify changing their value does not navigate away or trigger a context change.
- Check for auto-submitting forms when a dropdown selection changes.
- Verify no new windows or popups open automatically on focus.
- Confirm focus does not jump unexpectedly when interacting with controls.

## Fix patterns
- Require explicit user action (e.g., pressing a Submit button) to trigger form submission or navigation.
- If a change of context on input is necessary, warn users in advance with clear instructions.
- Avoid opening new windows on focus events.
- Use `onchange` for non-context-changing updates only (e.g., filtering a list on the same page).
- Add a visible submit button next to auto-submit dropdowns.

## Examples
```html
<!-- Incorrect: auto-navigates on dropdown change -->
<label for="country">Country</label>
<select id="country" onchange="window.location.href = this.value;">
  <option value="/us">United States</option>
  <option value="/uk">United Kingdom</option>
</select>

<!-- Correct: requires explicit submit -->
<label for="country">Country</label>
<select id="country">
  <option value="/us">United States</option>
  <option value="/uk">United Kingdom</option>
</select>
<button type="submit">Go</button>

<!-- Incorrect: opens new window on focus -->
<input type="text" onfocus="window.open('help.html')">

<!-- Correct: help link provided separately -->
<label for="email">Email</label>
<input type="email" id="email" aria-describedby="emailHelp">
<a href="help.html" id="emailHelp" target="_blank" rel="noopener">
  Email help (opens in new window)
</a>
```

## Framework-Specific Examples

### React/Next.js
```jsx
// Correct: Form with explicit submit button
function CountrySelector() {
  const [country, setCountry] = useState('');
  const router = useRouter();
  
  const handleSubmit = (e) => {
    e.preventDefault();
    router.push(`/${country}`);
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="country">Select your country</label>
      <select
        id="country"
        value={country}
        onChange={(e) => setCountry(e.target.value)}
      >
        <option value="">Choose...</option>
        <option value="us">United States</option>
        <option value="uk">United Kingdom</option>
      </select>
      <button type="submit">Go</button>
    </form>
  );
}

// Correct: Filter without context change
function ProductFilter() {
  const [category, setCategory] = useState('all');
  const [products, setProducts] = useState([]);
  
  const handleCategoryChange = (e) => {
    const newCategory = e.target.value;
    setCategory(newCategory);
    // Filter on same page - no context change
    setProducts(filterProducts(newCategory));
  };
  
  return (
    <div>
      <label htmlFor="category">Filter by category</label>
      <select
        id="category"
        value={category}
        onChange={handleCategoryChange}
        aria-controls="product-list"
      >
        <option value="all">All products</option>
        <option value="electronics">Electronics</option>
      </select>
      <div id="product-list" aria-live="polite">
        {products.map(product => <Product key={product.id} {...product} />)}
      </div>
    </div>
  );
}

// Incorrect: Auto-opening modal on focus
// DON'T DO THIS
function BadInput() {
  return (
    <input
      onFocus={() => window.open('/help')} // Bad!
      placeholder="Email"
    />
  );
}

// Correct: Provide help link separately
function GoodInput() {
  return (
    <div>
      <label htmlFor="email">Email</label>
      <input id="email" type="email" aria-describedby="email-help" />
      <a href="/help" id="email-help" target="_blank" rel="noopener">
        Email help (opens in new window)
      </a>
    </div>
  );
}
```

### Vue/Nuxt
```vue
<template>
  <!-- Correct: Form with explicit submit -->
  <form @submit.prevent="handleSubmit">
    <label for="country">Select your country</label>
    <select id="country" v-model="country">
      <option value="">Choose...</option>
      <option value="us">United States</option>
      <option value="uk">United Kingdom</option>
    </select>
    <button type="submit">Go</button>
  </form>
  
  <!-- Correct: Filter without navigation -->
  <div>
    <label for="category">Filter by category</label>
    <select
      id="category"
      v-model="category"
      @change="filterProducts"
      aria-controls="product-list"
    >
      <option value="all">All products</option>
      <option value="electronics">Electronics</option>
    </select>
    <div id="product-list" aria-live="polite">
      <Product v-for="product in filteredProducts" :key="product.id" v-bind="product" />
    </div>
  </div>
  
  <!-- Correct: Help link separate from input -->
  <div>
    <label for="email">Email</label>
    <input id="email" type="email" aria-describedby="email-help" />
    <a href="/help" id="email-help" target="_blank" rel="noopener">
      Email help (opens in new window)
    </a>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const country = ref('');
const category = ref('all');
const filteredProducts = ref([]);

const handleSubmit = () => {
  router.push(`/${country.value}`);
};

const filterProducts = () => {
  // Filter on same page
  filteredProducts.value = products.filter(p => 
    category.value === 'all' || p.category === category.value
  );
};
</script>
```

### Angular
```typescript
// Component template
<form (ngSubmit)="handleSubmit()">
  <label for="country">Select your country</label>
  <select id="country" [(ngModel)]="country" name="country">
    <option value="">Choose...</option>
    <option value="us">United States</option>
    <option value="uk">United Kingdom</option>
  </select>
  <button type="submit">Go</button>
</form>

<!-- Filter without context change -->
<div>
  <label for="category">Filter by category</label>
  <select
    id="category"
    [(ngModel)]="category"
    (change)="filterProducts()"
    attr.aria-controls="product-list"
  >
    <option value="all">All products</option>
    <option value="electronics">Electronics</option>
  </select>
  <div id="product-list" aria-live="polite">
    <app-product *ngFor="let product of filteredProducts" [product]="product"></app-product>
  </div>
</div>

// Component TypeScript
import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-country-selector',
  templateUrl: './country-selector.component.html'
})
export class CountrySelectorComponent {
  country = '';
  category = 'all';
  filteredProducts = [];
  
  constructor(private router: Router) {}
  
  handleSubmit() {
    this.router.navigate([`/${this.country}`]);
  }
  
  filterProducts() {
    // Filter on same page, no navigation
    this.filteredProducts = this.products.filter(p =>
      this.category === 'all' || p.category === this.category
    );
  }
}
```
