# ARIA: Common Widget Patterns

## Tags
Tags: #aria #widgets #tabs #accordions #menus #combobox #disclosure #wcag #eaa

## Purpose
Provide accessible implementation patterns for common interactive widgets that require ARIA roles, states, and keyboard interaction to be usable by assistive technology users.

## Key points
- Custom widgets must use the correct ARIA roles, states, and properties.
- Keyboard interaction must follow established patterns from the WAI-ARIA Authoring Practices Guide (APG).
- Each widget type has expected keyboard behaviour that users rely on.
- Native HTML elements should be used wherever possible before resorting to ARIA widgets.
- Focus management within composite widgets (tabs, menus, tree views) must follow roving tabindex or `aria-activedescendant` patterns.

## Developer checks
- Confirm each widget has the correct ARIA role applied.
- Verify all required ARIA states and properties are present and updated dynamically.
- Test keyboard navigation matches the expected pattern for the widget type.
- Ensure screen readers announce the widget role, name, and current state.
- Check that focus is managed correctly within composite widgets.
- Test with at least two screen readers (e.g., NVDA + VoiceOver).

---

## Tab Panel

### Structure
```html
<div role="tablist" aria-label="Account settings">
  <button role="tab" id="tab-1" aria-selected="true" aria-controls="panel-1" tabindex="0">
    Profile
  </button>
  <button role="tab" id="tab-2" aria-selected="false" aria-controls="panel-2" tabindex="-1">
    Security
  </button>
  <button role="tab" id="tab-3" aria-selected="false" aria-controls="panel-3" tabindex="-1">
    Notifications
  </button>
</div>

<div role="tabpanel" id="panel-1" aria-labelledby="tab-1">
  <p>Profile settings content...</p>
</div>
<div role="tabpanel" id="panel-2" aria-labelledby="tab-2" hidden>
  <p>Security settings content...</p>
</div>
<div role="tabpanel" id="panel-3" aria-labelledby="tab-3" hidden>
  <p>Notification settings content...</p>
</div>
```

### Keyboard interaction
- **Arrow Left / Arrow Right**: Move between tabs.
- **Tab**: Move focus into the tab panel content.
- **Home / End**: Move to first / last tab.

---

## Accordion (Disclosure pattern)

### Structure
```html
<div class="accordion">
  <h3>
    <button id="accordion-header-1" aria-expanded="true" aria-controls="section-1">
      Shipping information
    </button>
  </h3>
  <div id="section-1" role="region" aria-labelledby="accordion-header-1">
    <p>We ship to all EU countries...</p>
  </div>

  <h3>
    <button id="accordion-header-2" aria-expanded="false" aria-controls="section-2">
      Returns policy
    </button>
  </h3>
  <div id="section-2" role="region" aria-labelledby="accordion-header-2" hidden>
    <p>You can return items within 30 days...</p>
  </div>
</div>
```

### Keyboard interaction
- **Enter / Space**: Toggle the accordion section.
- **Tab**: Move to the next focusable element.

---

## Dropdown Menu

### Structure
```html
<nav aria-label="Main menu">
  <ul role="menubar">
    <li role="none">
      <button role="menuitem" aria-haspopup="true" aria-expanded="false">
        Products
      </button>
      <ul role="menu" hidden>
        <li role="none"><a role="menuitem" href="/widgets">Widgets</a></li>
        <li role="none"><a role="menuitem" href="/gadgets">Gadgets</a></li>
      </ul>
    </li>
    <li role="none">
      <a role="menuitem" href="/about">About</a>
    </li>
  </ul>
</nav>
```

### Keyboard interaction
- **Enter / Space / Arrow Down**: Open submenu.
- **Arrow Up / Arrow Down**: Navigate within submenu.
- **Escape**: Close submenu, return focus to trigger.
- **Arrow Left / Arrow Right**: Navigate between top-level items.

---

## Combobox (Autocomplete)

### Structure
```html
<label for="city-input">City</label>
<div role="combobox" aria-expanded="false" aria-haspopup="listbox" aria-owns="city-listbox">
  <input id="city-input" type="text" 
         aria-autocomplete="list" 
         aria-controls="city-listbox"
         aria-activedescendant="">
</div>
<ul id="city-listbox" role="listbox" hidden>
  <li id="city-1" role="option">Dublin</li>
  <li id="city-2" role="option">Cork</li>
  <li id="city-3" role="option">Galway</li>
</ul>
```

### Keyboard interaction
- **Arrow Down**: Open the listbox and move to the first option.
- **Arrow Up / Arrow Down**: Navigate options.
- **Enter**: Select the highlighted option.
- **Escape**: Close the listbox.
- **Typing**: Filters the list.

---

## Disclosure (Show/Hide)

### Structure
```html
<button aria-expanded="false" aria-controls="details-content">
  Show more details
</button>
<div id="details-content" hidden>
  <p>Additional details are shown here...</p>
</div>
```

### Keyboard interaction
- **Enter / Space**: Toggle visibility.

---

## Fix patterns
- Always reference the WAI-ARIA Authoring Practices Guide (APG) for the correct pattern.
- Use roving tabindex for composite widgets (tabs, menubars, toolbars).
- Update `aria-selected`, `aria-expanded`, `aria-checked`, and `aria-activedescendant` dynamically via JavaScript.
- Provide visible focus indicators within all widget components.
- Test every widget with keyboard-only and screen reader navigation.
- Prefer native HTML elements (e.g., `<details>` / `<summary>` for disclosure) before using ARIA.
