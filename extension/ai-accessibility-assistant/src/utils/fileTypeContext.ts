// fileTypeContext.ts — decides which lines of code to extract from the active file
// Returns a list of accessibility-relevant keywords for the active file's
// language and framework. These keywords drive the excerpt builder — only
// lines containing them (plus surrounding context) are sent to the model,
// keeping prompts short and focused.
// Covers 30+ languages and frameworks based on WCAG 2.2 (A, AA, AAA) and
// the European Accessibility Act (EAA).
// Used by: commands/analyzeFile.ts

import * as vscode from "vscode";

export interface FileTypeContext {
  keywords: string[];
}

// ---------------------------------------------------------------------------
// Shared ARIA keyword constants
// Spread these into each framework's keywords array to avoid repeating the
// same boilerplate attribute strings across 30+ sections.
// ---------------------------------------------------------------------------

/** The three universal label attributes present in every HTML-producing framework */
const ARIA_LABELS: readonly string[] = [
  "aria-label", "aria-labelledby", "aria-describedby",
];

/** Full ARIA widget-state set used in rich SPA frameworks */
const ARIA_WIDGET_STATES: readonly string[] = [
  "aria-expanded", "aria-pressed", "aria-checked", "aria-selected",
  "aria-current", "aria-disabled", "aria-invalid", "aria-required",
];

// Get comprehensive file type context for multimodal accessibility analysis
export function getFileTypeContext(doc: vscode.TextDocument): FileTypeContext {
  const languageId = doc.languageId.toLowerCase();
  const content = doc.getText();
  
  // HTML files - comprehensive multimodal coverage
  if (languageId === "html") {
    return {
      keywords: [
        // VISUAL: Color & Contrast
        "color", "background", "style=", "bgcolor", "contrast", "opacity", "filter",
        
        // VISUAL: Animation & Motion (seizure prevention, vestibular)
        "animation", "transition", "@keyframes", "transform", "scroll", "parallax",
        
        // MOTOR/KEYBOARD: Navigation & Focus
        "tabindex", "autofocus", ":focus", "focus(", "blur(", "accesskey",
        
        // MOTOR/KEYBOARD: Interactive Elements
        "<button", "<a ", "<input", "onclick", "onkeydown", "onkeyup", "onkeypress",
        
        // MOTOR: Target Size & Touch
        "width", "height", "padding", "margin", "min-width", "min-height",
        
        // AUDITORY: Media Elements
        "<audio", "<video", "<track", "captions", "subtitles", "transcript",
        "autoplay", "controls", "muted", "<source",
        
        // COGNITIVE: Language & Readability
        "lang=", "xml:lang", "dir=", "translate",
        
        // COGNITIVE: Timing & Auto-Update
        "setTimeout", "setInterval", "meta refresh", "autoplay", "autoupdate",
        
        // STRUCTURE: Landmarks & Regions
        "<nav", "<main", "<header", "<footer", "<aside", "<section", "<article",
        "role=", "banner", "navigation", "complementary", "contentinfo",
        
        // STRUCTURE: Headings
        "<h1", "<h2", "<h3", "<h4", "<h5", "<h6",
        
        // FORMS: Labels & Input
        "<form", "<label", "for=", "<input", "<select", "<textarea", "<fieldset",
        "<legend", "required", "aria-required",
        
        // FORMS: Validation & Error
        "required", "pattern", "aria-invalid", "aria-errormessage", "novalidate",
        
        // FORMS: Autocomplete & Input Purpose
        "autocomplete", "name=", "type=", "inputmode",
        
        // IMAGES: Alternative Text
        "<img", "alt=", "<svg", "<figure", "<figcaption", "aria-describedby",
        
        // TABLES: Structure & Headers
        "<table", "<th", "<td", "scope=", "<caption", "headers=", "<thead", "<tbody",
        
        // ARIA: Roles & Properties
        ...ARIA_LABELS, "aria-hidden",
        
        // ARIA: Live Regions & Dynamic Content
        "aria-live", "aria-atomic", "aria-busy", "role=\"alert", "role=\"status",
        
        // ARIA: Widget States
        "aria-expanded", "aria-pressed", "aria-checked", "aria-selected",
        "aria-current", "aria-disabled",
        
        // ARIA: Modal & Dialog
        "aria-modal", "role=\"dialog", "role=\"alertdialog",
        
        // COGNITIVE: Skip Links & Help
        "skip", "href=\"#", "title=", "placeholder",
        
        // VISUAL: Text & Content Adaptation
        "font-size", "line-height", "letter-spacing", "word-spacing",
        
        // VISUAL: Images of Text
        "<canvas", "text-rendering",
        
        // Generic containers (check for proper semantic usage)
        "<div", "<span"
      ]
    };
  }
  
  // CSS/SCSS/Less files - comprehensive styling accessibility
  if (["css", "scss", "sass", "less"].includes(languageId)) {
    return {
      keywords: [
        // VISUAL: Color & Contrast
        "color:", "background-color:", "background:", "border-color:",
        "fill:", "stroke:", "text-shadow:", "box-shadow:",
        
        // VISUAL: High Contrast & Dark Mode
        "prefers-contrast", "prefers-color-scheme", "forced-colors",
        "@media", "contrast(", "brightness(", "filter:",
        
        // VISUAL: Animation & Motion (seizure/vestibular)
        "animation:", "animation-duration:", "transition:", "@keyframes",
        "transform:", "prefers-reduced-motion", "scroll-behavior:",
        "will-change:", "perspective:",
        
        // VISUAL: Text Spacing & Reflow
        "line-height:", "letter-spacing:", "word-spacing:", "text-spacing:",
        "white-space:", "overflow:", "text-overflow:",
        
        // VISUAL: Resize & Zoom
        "font-size:", "zoom:", "min-width:", "max-width:", "viewport",
        "rem", "em", "%", "vw", "vh",
        
        // MOTOR: Focus Indicators
        ":focus", ":focus-visible", ":focus-within", "outline:", "outline-offset:",
        "box-shadow:", "border:",
        
        // MOTOR: Interactive States
        ":hover", ":active", ":visited", ":disabled", ":enabled",
        
        // MOTOR: Target Size
        "width:", "height:", "min-width:", "min-height:", "padding:",
        "margin:", "touch-action:", "pointer-events:",
        
        // MOTOR: Pointer & Cursor
        "cursor:", "pointer-events:", "user-select:",
        
        // VISUAL: Content on Hover/Focus
        ":hover:after", ":focus:before", "::before", "::after",
        "content:", "position: absolute", "position: fixed",
        
        // VISUAL: Visibility & Hiding
        "display:", "visibility:", "opacity:", "clip:", "clip-path:",
        "position: absolute", "left: -", "top: -",
        
        // COGNITIVE: Orientation
        "orientation:", "@media (orientation",
        
        // VISUAL: Non-text Contrast (UI components, graphics)
        "border:", "border-radius:", "outline:", "fill:", "stroke:",
        
        // VISUAL: Images of Text
        "background-image:", "content: url(",
        
        // TIMING: Auto-scrolling & Parallax
        "scroll-behavior:", "overflow-x:", "overflow-y:", "scroll-snap-"
      ]
    };
  }
  
  // React (JSX/TSX) - comprehensive component accessibility
  if (["javascript", "typescript", "javascriptreact", "typescriptreact"].includes(languageId)) {
    const isReact = /import.*react|from ['"]react['"]|<[A-Z][a-zA-Z]*|jsx|tsx/i.test(content);
    const isVue = /\.vue$/.test(doc.fileName) || /<template>|<script>|export default \{/i.test(content);
    const isAngular = /@Component|@NgModule|\.component\.ts$/.test(content);
    
    if (isReact || languageId.includes("react")) {
      return {
        keywords: [
          // ARIA: Roles & Labels
          ...ARIA_LABELS, "role=",
          "aria-hidden", "aria-live", "aria-atomic", "aria-busy",
          
          // ARIA: Widget States
          ...ARIA_WIDGET_STATES,
          
          // MOTOR: Keyboard Events
          "onKeyDown", "onKeyUp", "onKeyPress", "onKeyboardEvent",
          "tabIndex", "autoFocus", "onFocus", "onBlur",
          
          // MOTOR: Mouse/Pointer Events
          "onClick", "onDoubleClick", "onMouseDown", "onMouseUp",
          "onPointerDown", "onPointerUp", "onPointerCancel",
          "onTouchStart", "onTouchEnd", "onTouchCancel",
          
          // MOTOR: Focus Management
          "ref=", "useRef", ".focus()", ".blur()", "focusable",
          "currentTarget", "document.activeElement",
          
          // VISUAL: Color & Styling
          "color", "background", "backgroundColor", "style={{",
          "className", "css`", "styled.", "theme.",
          
          // VISUAL: Animation & Motion
          "animation", "transition", "transform", "useSpring",
          "animate", "motion.", "Transition", "AnimatePresence",
          
          // AUDITORY: Media Elements
          "<video", "<audio", "controls", "autoPlay", "muted",
          "VideoPlayer", "AudioPlayer", "MediaPlayer",
          
          // FORMS: Input Elements
          "<input", "<button", "<select", "<textarea", "<form",
          "type=", "value=", "onChange", "onSubmit", "onInput",
          
          // FORMS: Labels & Validation
          "<label", "htmlFor", "required", "disabled", "readOnly",
          "placeholder", "aria-invalid", "aria-errormessage",
          
          // FORMS: Autocomplete
          "autoComplete", "inputMode", "name=",
          
          // IMAGES: Alternative Text
          "<img", "alt=", "<svg", "<Image", "aria-label",
          
          // STRUCTURE: Semantic Elements
          "<nav", "<main", "<header", "<footer", "<section", "<article",
          "<aside", "<h1", "<h2", "<h3", "<h4", "<h5", "<h6",
          
          // TABLES: Data Tables
          "<table", "<th", "<td", "scope=", "<caption", "<thead", "<tbody",
          
          // COGNITIVE: Language & Timing
          "lang=", "useState", "useEffect", "setTimeout", "setInterval",
          
          // ARIA: Modal & Dialog
          "Dialog", "Modal", "Popover", "aria-modal", "Portal",
          "isOpen", "onClose", "onDismiss",
          
          // VISUAL: Visibility
          "hidden", "display", "visibility", "opacity",
          
          // MOTOR: Drag & Drop
          "onDragStart", "onDragEnd", "onDrop", "draggable",
          
          // COGNITIVE: Notifications & Alerts
          "Toast", "Alert", "Notification", "role=\"alert",
          
          // Links & Navigation
          "<a ", "href=", "<Link", "to=", "navigate"
        ]
      };
    }
    
    if (isVue) {
      return {
        keywords: [
          // ARIA: Roles & Labels
          ...ARIA_LABELS, "role=",
          "aria-hidden", "aria-live", "aria-atomic", "aria-busy",
          
          // ARIA: Widget States
          ...ARIA_WIDGET_STATES,
          
          // MOTOR: Keyboard Events
          "@keydown", "@keyup", "@keypress", "tabindex", "autofocus",
          "@focus", "@blur", "v-focus",
          
          // MOTOR: Mouse/Pointer Events
          "@click", "@dblclick", "@mousedown", "@mouseup",
          "@touchstart", "@touchend", "@touchcancel",
          
          // MOTOR: Focus Management
          "ref=", "$refs", "focus()", "blur()", "nextTick",
          
          // VISUAL: Color & Styling
          ":style", ":class", "v-bind:style", "v-bind:class",
          "color", "background",
          
          // VISUAL: Animation & Motion
          "transition", "animation", "<transition", "<transition-group",
          "v-enter", "v-leave", "v-motion",
          
          // AUDITORY: Media Elements
          "<video", "<audio", "controls", "autoplay", "muted",
          
          // FORMS: Input Elements
          "<input", "<button", "<select", "<textarea", "<form",
          "v-model", "@input", "@change", "@submit",
          
          // FORMS: Labels & Validation
          "<label", "for=", "required", "disabled", "readonly",
          "placeholder", ":aria-invalid",
          
          // FORMS: Autocomplete
          "autocomplete", "inputmode", "name=",
          
          // IMAGES: Alternative Text
          "<img", "alt=", ":alt", "<svg",
          
          // STRUCTURE: Semantic Elements
          "<nav", "<main", "<header", "<footer", "<section", "<article",
          "<h1", "<h2", "<h3", "<h4", "<h5", "<h6",
          
          // TABLES: Data Tables
          "<table", "<th", "<td", "scope=", "<caption",
          
          // COGNITIVE: Conditional & Timing
          "v-if", "v-show", "v-for", "setTimeout", "setInterval",
          
          // COGNITIVE: Language
          "lang=", ":lang",
          
          // ARIA: Modal & Dialog
          "v-dialog", "v-modal", ":aria-modal",
          
          // VISUAL: Visibility
          "v-show", "hidden", "display", "visibility",
          
          // MOTOR: Drag & Drop
          "@drop", "@dragstart", "draggable",
          
          // Links & Navigation
          "<a ", "href=", "<router-link", "to="
        ]
      };
    }
    
    if (isAngular) {
      return {
        keywords: [
          // ARIA: Roles & Labels
          ...ARIA_LABELS, "role=",
          "aria-hidden", "aria-live", "aria-atomic", "aria-busy",
          
          // ARIA: Widget States
          ...ARIA_WIDGET_STATES,
          
          // MOTOR: Keyboard Events
          "(keydown)", "(keyup)", "(keypress)", "tabindex", "autofocus",
          "(focus)", "(blur)", "cdkFocusInitial",
          
          // MOTOR: Mouse/Pointer Events
          "(click)", "(dblclick)", "(mousedown)", "(mouseup)",
          "(touchstart)", "(touchend)",
          
          // MOTOR: Focus Management (CDK)
          "ViewChild", "ElementRef", "focus()", "FocusTrap",
          "cdkTrapFocus", "cdkFocusRegion",
          
          // VISUAL: Color & Styling
          "[style", "[ngStyle]", "[class", "[ngClass]",
          "color", "background",
          
          // VISUAL: Animation & Motion
          "@Component animations", "trigger(", "state(", "transition(",
          "[@animationName]",
          
          // AUDITORY: Media Elements
          "<video", "<audio", "controls", "autoplay", "muted",
          
          // FORMS: Input Elements (Reactive & Template-driven)
          "<input", "<button", "<select", "<textarea", "<form",
          "[(ngModel)]", "formControl", "formGroup", "(ngSubmit)",
          
          // FORMS: Labels & Validation
          "<label", "for=", "required", "disabled", "readonly",
          "placeholder", "[aria-invalid]", "mat-error",
          
          // FORMS: Autocomplete
          "autocomplete", "name=", "matInput",
          
          // IMAGES: Alternative Text
          "<img", "alt=", "[alt]", "<svg",
          
          // STRUCTURE: Semantic Elements
          "<nav", "<main", "<header", "<footer", "<section",
          "<h1", "<h2", "<h3", "<h4", "<h5", "<h6",
          
          // TABLES: Data Tables (including Material)
          "<table", "mat-table", "<th", "mat-header-cell",
          "<td", "mat-cell", "scope=",
          
          // COGNITIVE: Conditional & Timing
          "*ngIf", "*ngFor", "setTimeout", "setInterval", "async pipe",
          
          // COGNITIVE: Language
          "lang=", "[lang]",
          
          // ARIA: Modal & Dialog (Material)
          "MatDialog", "mat-dialog", "[aria-modal]",
          
          // VISUAL: Visibility
          "*ngIf", "hidden", "[hidden]", "display",
          
          // MOTOR: Drag & Drop (CDK)
          "cdkDrag", "cdkDropList", "(cdkDropListDropped)",
          
          // Links & Navigation
          "<a ", "routerLink", "[routerLink]"
        ]
      };
    }
    
    // Plain JavaScript/TypeScript - DOM manipulation & event handling
    return {
      keywords: [
        // MOTOR: Event Listeners
        "addEventListener", "onclick", "onkeydown", "onkeyup", "onkeypress",
        "onfocus", "onblur", "onmousedown", "onmouseup",
        
        // MOTOR: Focus Management
        "focus()", "blur()", "tabIndex", "autofocus",
        "document.activeElement", "hasFocus",
        
        // DOM: Element Selection
        "querySelector", "querySelectorAll", "getElementById",
        "getElementsByClassName", "getElementsByTagName",
        
        // DOM: Element Creation & Modification
        "createElement", "createTextNode", "setAttribute",
        "getAttribute", "removeAttribute", "classList",
        
        // ARIA: Attributes
        "aria-", "role", "aria-label", "aria-labelledby",
        "aria-describedby", "aria-hidden", "aria-live",
        
        // VISUAL: Content & Styling
        "textContent", "innerHTML", "innerText", "style.",
        "className", "classList.add", "classList.remove",
        
        // FORMS: Form Handling
        "value", "checked", "disabled", "required",
        "validity", "checkValidity", "reportValidity",
        
        // COGNITIVE: Timing
        "setTimeout", "setInterval", "clearTimeout", "clearInterval",
        "requestAnimationFrame",
        
        // VISUAL: Visibility
        "hidden", "display", "visibility", "opacity",
        
        // AUDITORY: Media API
        "play()", "pause()", "currentTime", "HTMLMediaElement",
        "HTMLVideoElement", "HTMLAudioElement",
        
        // TABLES: Table DOM
        "insertRow", "insertCell", "HTMLTableElement",
        
        // MODAL: Dialog API
        "showModal", "close()", "HTMLDialogElement"
      ]
    };
  }
  
  // Svelte - reactive component framework
  if (languageId === "svelte" || /\.svelte$/.test(doc.fileName)) {
    return {
      keywords: [
        // ARIA: Roles & Labels
        ...ARIA_LABELS, "role=",
        "aria-hidden", "aria-live", "aria-atomic", "aria-busy",
        
        // ARIA: Widget States
        ...ARIA_WIDGET_STATES,
        
        // MOTOR: Keyboard Events
        "on:keydown", "on:keyup", "on:keypress", "tabindex", "autofocus",
        "on:focus", "on:blur",
        
        // MOTOR: Mouse/Pointer Events
        "on:click", "on:dblclick", "on:mousedown", "on:mouseup",
        "on:touchstart", "on:touchend",
        
        // MOTOR: Focus Management
        "bind:this", ".focus()", "use:action",
        
        // VISUAL: Styling & Classes
        "class:", "style:", "class=", "style=",
        
        // VISUAL: Animation & Transitions
        "transition:", "in:", "out:", "animate:",
        
        // FORMS: Input Binding
        "bind:value", "bind:checked", "bind:group",
        "<input", "<button", "<select", "<textarea", "<form",
        
        // FORMS: Labels & Validation
        "<label", "for=", "required", "disabled",
        
        // STRUCTURE: Semantic Elements
        "<nav", "<main", "<header", "<footer", "<section",
        "<h1", "<h2", "<h3", "<h4", "<h5", "<h6",
        
        // SVELTE: Reactivity & Conditionals
        "{#if", "{#each", "{#await", "$:", "on:",
        
        // IMAGES: Alternative Text
        "<img", "alt=", "<svg",
        
        // AUDITORY: Media
        "<video", "<audio", "controls", "autoplay",
        
        // Links & Navigation
        "<a ", "href="
      ]
    };
  }
  
  // Solid.js - reactive JavaScript library
  if (content.includes("solid-js") || /import.*from ['"]solid-js['"]/.test(content)) {
    return {
      keywords: [
        // ARIA: All attributes
        ...ARIA_LABELS, "role=",
        "aria-hidden", "aria-live", "aria-expanded", "aria-pressed",
        
        // MOTOR: Events & Focus
        "onClick", "onKeyDown", "onKeyUp", "onFocus", "onBlur",
        "tabIndex", "ref=",
        
        // SOLID: Reactivity
        "createSignal", "createEffect", "createMemo", "Show", "For",
        "Switch", "Match",
        
        // FORMS: Input elements
        "<input", "<button", "<select", "<textarea", "value=",
        
        // STRUCTURE: Semantic HTML
        "<nav", "<main", "<header", "<footer",
        
        // IMAGES: Alt text
        "<img", "alt=", "<svg"
      ]
    };
  }
  
  // Web Components / Lit - custom elements
  if (languageId === "webcomponents" || content.includes("@lit") || 
      content.includes("LitElement") || content.includes("customElements.define")) {
    return {
      keywords: [
        // ARIA: Attributes
        "aria-label", "aria-labelledby", "aria-describedby", "role",
        "aria-hidden", "aria-live", "aria-expanded",
        
        // WEB COMPONENTS: Custom Elements
        "customElements.define", "shadowRoot", "attachShadow",
        "slot", "<slot", "::slotted",
        
        // LIT: Template & Properties
        "@property", "@state", "@query", "render()", "html`",
        "@event", "this.shadowRoot",
        
        // MOTOR: Events
        "@click", "@keydown", "@focus", "tabindex",
        "addEventListener", "dispatchEvent",
        
        // FORMS: Form-associated
        "formAssociated", "ElementInternals", "attachInternals",
        
        // ARIA: Shadow DOM accessibility
        "delegatesFocus", "aria-", "role=",
        
        // STRUCTURE: Semantic elements
        "<nav", "<main", "<button", "<input"
      ]
    };
  }
  
  // Alpine.js - lightweight JavaScript framework
  if (content.includes("x-data") || content.includes("@click") || content.includes("Alpine")) {
    return {
      keywords: [
        // ALPINE: Directives
        "x-data", "x-show", "x-if", "x-for", "x-model",
        "@click", "@keydown", "@focus", "@blur",
        
        // ARIA: Attributes
        "aria-label", "aria-labelledby", "aria-expanded", "aria-hidden",
        
        // MOTOR: Interactive
        "tabindex", "x-on:", "@keydown.escape", "@keydown.enter",
        
        // FORMS: Input elements
        "<input", "<button", "<form", "x-model",
        
        // STRUCTURE: Semantic HTML
        "<nav", "<main", "<header", "<footer",
        
        // IMAGES: Alt text
        "<img", "alt="
      ]
    };
  }
  
  // Handlebars / Mustache templates
  if (["handlebars", "hbs", "mustache"].includes(languageId) || 
      /\.hbs$|\.mustache$/.test(doc.fileName)) {
    return {
      keywords: [
        // ARIA: Attributes
        ...ARIA_LABELS, "role=",
        
        // STRUCTURE: Semantic elements
        "<nav", "<main", "<header", "<footer", "<button", "<input",
        "<h1", "<h2", "<h3", "<h4", "<h5", "<h6",
        
        // FORMS: Labels
        "<label", "for=", "<form", "required",
        
        // IMAGES: Alt text
        "<img", "alt=", "{{alt}}",
        
        // HANDLEBARS: Conditionals & loops
        "{{#if", "{{#each", "{{#unless",
        
        // MOTOR: Interactive
        "tabindex", "onclick", "{{onClick}}"
      ]
    };
  }
  
  // PHP - server-side with HTML
  if (languageId === "php") {
    return {
      keywords: [
        // ARIA: Attributes
        ...ARIA_LABELS, "role=",
        "aria-hidden", "aria-live", "aria-expanded",
        
        // STRUCTURE: Semantic HTML
        "<nav", "<main", "<header", "<footer", "<section",
        "<h1", "<h2", "<h3", "<h4", "<h5", "<h6",
        
        // FORMS: PHP with HTML forms
        "<form", "<input", "<label", "for=", "<button",
        "<?php", "echo", "htmlspecialchars",
        
        // IMAGES: Alt text
        "<img", "alt=",
        
        // VISUAL: Styling
        "style=", "class=", "color", "background",
        
        // MOTOR: Interactive elements
        "tabindex", "onclick", "onkeydown",
        
        // TABLES: Data tables
        "<table", "<th", "<td", "scope="
      ]
    };
  }
  
  // Python templates (Jinja2 / Django)
  if (languageId === "jinja" || languageId === "django-html" || 
      languageId === "jinja-html" || /\{%|\{\{/.test(content)) {
    return {
      keywords: [
        // ARIA: Attributes
        ...ARIA_LABELS, "role=",
        "aria-hidden", "aria-live",
        
        // JINJA/DJANGO: Template syntax
        "{% if", "{% for", "{% block", "{% extends",
        "{{ ", "}}", "|", "{% trans",
        
        // STRUCTURE: Semantic HTML
        "<nav", "<main", "<header", "<footer",
        "<h1", "<h2", "<h3", "<h4", "<h5", "<h6",
        
        // FORMS: Django forms
        "<form", "{{ form", "{% csrf_token", "<input", "<label",
        "form.errors", "{% for field in form %}",
        
        // IMAGES: Alt text
        "<img", "alt=", "{{ image.alt",
        
        // MOTOR: Interactive
        "tabindex", "onclick"
      ]
    };
  }
  
  // Ruby ERB templates
  if (languageId === "erb" || languageId === "ruby" && /<%.+%>/.test(content)) {
    return {
      keywords: [
        // ARIA: Attributes
        "aria-label", "aria-labelledby", "aria-describedby", "role:",
        "aria_hidden", "aria_live",
        
        // ERB: Ruby template syntax
        "<%=", "<%", "%>", "form_for", "form_with",
        "link_to", "button_to", "image_tag",
        
        // STRUCTURE: Semantic HTML
        "<nav", "<main", "<header", "<footer",
        "<h1", "<h2", "<h3", "<h4", "<h5", "<h6",
        
        // FORMS: Rails form helpers
        "label_tag", "text_field", "submit_tag",
        "f.label", "f.text_field", "f.submit",
        
        // IMAGES: Rails helpers
        "image_tag", "alt:", ":alt",
        
        // MOTOR: Interactive
        "tabindex:", "data:", "aria:"
      ]
    };
  }
  
  // EJS (Embedded JavaScript)
  if (languageId === "ejs" || /\.ejs$/.test(doc.fileName)) {
    return {
      keywords: [
        // ARIA: Attributes
        ...ARIA_LABELS, "role=",
        
        // EJS: Template syntax
        "<%=", "<%", "%>", "<%- include",
        
        // STRUCTURE: Semantic HTML
        "<nav", "<main", "<header", "<footer",
        "<h1", "<h2", "<h3", "<h4", "<h5", "<h6",
        
        // FORMS: Input elements
        "<form", "<input", "<label", "for=", "<button",
        
        // IMAGES: Alt text
        "<img", "alt=", "<%= alt %>",
        
        // MOTOR: Interactive
        "tabindex", "onclick"
      ]
    };
  }
  
  // Pug / Jade templates
  if (["pug", "jade"].includes(languageId)) {
    return {
      keywords: [
        // ARIA: Attributes (Pug syntax)
        "aria-label=", "aria-labelledby=", "aria-describedby=", "role=",
        "(aria-", "aria-hidden", "aria-live",
        
        // STRUCTURE: Pug semantic elements
        "nav", "main", "header", "footer", "section", "article",
        "h1", "h2", "h3", "h4", "h5", "h6",
        
        // FORMS: Pug form elements
        "form", "input", "label", "button", "select", "textarea",
        "(for=", "(required", "(disabled",
        
        // IMAGES: Alt attribute
        "img(", "alt=", "(alt=",
        
        // MOTOR: Interactive attributes
        "(tabindex=", "(onclick=", "(onkeydown=",
        
        // VISUAL: Classes & IDs
        ".", "#", "(class=", "(style=",
        
        // PUG: Conditionals & loops
        "if ", "else", "each ", "while"
      ]
    };
  }
  
  // Ember.js - JavaScript framework
  if (content.includes("@ember") || content.includes("Ember.") || 
      /import.*from ['"]@ember/.test(content)) {
    return {
      keywords: [
        // ARIA: Attributes
        ...ARIA_LABELS, "role=",
        "aria-hidden", "aria-live", "aria-expanded",
        
        // EMBER: Template syntax (Handlebars)
        "{{#if", "{{#each", "{{action", "{{on",
        "@action", "@tracked",
        
        // MOTOR: Events
        "{{on \"click\"", "{{on \"keydown\"", "tabindex=",
        
        // FORMS: Ember Input helpers
        "{{input", "{{textarea", "<Input", "<Textarea",
        
        // STRUCTURE: Semantic elements
        "<nav", "<main", "<header", "<footer",
        
        // EMBER: Components
        "{{component", "<LinkTo", "{{link-to",
        
        // IMAGES: Alt text
        "<img", "alt="
      ]
    };
  }
  
  // Markdown - documentation with accessibility guidelines
  if (languageId === "markdown" || ["md", "markdown"].includes(languageId)) {
    return {
      keywords: [
        // IMAGES: Alt text in markdown
        "![", "](", "alt=",
        
        // STRUCTURE: Headings
        "# ", "## ", "### ", "#### ", "##### ", "###### ",
        
        // LINKS: Accessible link text
        "[", "](", "http", "https",
        
        // TABLES: Markdown tables
        "|", "---|", ":-", "-:",
        
        // HTML in Markdown
        "<img", "<a ", "aria-", "role=",
        
        // CODE: Code blocks (may contain accessibility examples)
        "```html", "```css", "```javascript",
        
        // ACCESSIBILITY: Common keywords in docs
        "ARIA", "WCAG", "accessibility", "a11y", "screen reader",
        "keyboard", "focus", "alt text", "contrast", "semantic"
      ]
    };
  }
  
  // JSON - manifest files, configuration
  if (languageId === "json" || languageId === "jsonc") {
    return {
      keywords: [
        // WEB MANIFEST: PWA accessibility
        "\"name\"", "\"short_name\"", "\"description\"",
        "\"lang\"", "\"dir\"", "\"orientation\"",
        "\"theme_color\"", "\"background_color\"",
        
        // ICONS: Icon descriptions
        "\"icons\"", "\"src\"", "\"sizes\"", "\"purpose\"",
        
        // CONFIG: Accessibility settings
        "\"accessibility\"", "\"a11y\"", "\"aria\"",
        "\"contrast\"", "\"motion\"", "\"font-size\"",
        
        // I18N: Language & localization
        "\"locale\"", "\"language\"", "\"translation\""
      ]
    };
  }
  
  // XML / SVG - graphics with accessibility
  if (languageId === "xml" || (languageId === "svg" || content.includes("<svg"))) {
    return {
      keywords: [
        // ARIA: SVG accessibility
        ...ARIA_LABELS,
        "role=", "aria-hidden",
        
        // SVG: Accessible SVG elements
        "<svg", "<title>", "<desc>", "role=\"img\"",
        "focusable=", "tabindex",
        
        // SVG: Graphics elements
        "<text", "<g", "<path", "<circle", "<rect",
        
        // XML: Language
        "xml:lang", "lang=",
        
        // VISUAL: Colors & presentation
        "fill=", "stroke=", "opacity="
      ]
    };
  }
  
  // HTMX - hypermedia framework
  if (content.includes("hx-") || content.includes("htmx")) {
    return {
      keywords: [
        // HTMX: Attributes
        "hx-get", "hx-post", "hx-put", "hx-delete", "hx-swap",
        "hx-target", "hx-trigger", "hx-boost", "hx-push-url",
        "hx-indicator", "hx-confirm",
        
        // ARIA: Dynamic content & live regions
        "aria-live", "aria-busy", "aria-atomic", "aria-label",
        "aria-describedby", "aria-hidden",
        
        // HTMX: Accessibility extensions
        "hx-disable", "hx-disabled-elt", "hx-on",
        
        // STRUCTURE: Semantic HTML (HTMX encourages)
        "<button", "<a ", "<form", "<nav", "<main",
        
        // MOTOR: Keyboard & focus
        "tabindex", "autofocus", "hx-trigger=\"keyup\"",
        
        // FORMS: Progressive enhancement
        "<input", "<label", "for=", "required",
        
        // IMAGES: Alt text
        "<img", "alt="
      ]
    };
  }
  
  // Astro - modern static site generator
  if (languageId === "astro" || /\.astro$/.test(doc.fileName)) {
    return {
      keywords: [
        // ASTRO: Component syntax
        "---", "Astro.props", "Astro.slots",
        
        // ARIA: Attributes
        ...ARIA_LABELS,
        "aria-hidden", "aria-live", "role=",
        
        // STRUCTURE: Semantic HTML
        "<nav", "<main", "<header", "<footer", "<section",
        "<h1", "<h2", "<h3", "<h4", "<h5", "<h6",
        
        // ASTRO: Special elements
        "<Image", "<Picture", "alt=", "loading=",
        
        // FORMS: Input elements
        "<form", "<input", "<label", "for=", "<button",
        
        // MOTOR: Interactive
        "client:", "client:load", "client:visible", "client:idle",
        
        // VISUAL: Styling
        "<style", "class=", "is:global"
      ]
    };
  }
  
  // Blazor (C# for web)
  if (languageId === "razor" || content.includes("@code") || content.includes("@page")) {
    return {
      keywords: [
        // BLAZOR: Component syntax
        "@code", "@page", "@inject", "@using", "@bind",
        "@onclick", "@onkeydown", "@onfocus",
        
        // ARIA: Attributes (Blazor syntax)
        "aria-label=", "aria-labelledby=", "aria-describedby=",
        "aria-hidden=", "aria-live=", "role=",
        
        // STRUCTURE: Razor/HTML
        "<nav", "<main", "<header", "<footer",
        "<h1", "<h2", "<h3", "<h4", "<h5", "<h6",
        
        // FORMS: Blazor components
        "<EditForm", "<InputText", "<InputCheckbox",
        "<ValidationMessage", "<ValidationSummary",
        
        // FORMS: Standard HTML
        "<form", "<input", "<label", "for=", "<button",
        
        // MOTOR: Events
        "@onclick", "@onkeypress", "tabindex=",
        
        // IMAGES: Alt text
        "<img", "alt=",
        
        // BLAZOR: Conditionals
        "@if", "@foreach", "@switch"
      ]
    };
  }
  
  // Razor Pages (ASP.NET)
  if (languageId === "cshtml" || /\.cshtml$/.test(doc.fileName)) {
    return {
      keywords: [
        // RAZOR: Syntax
        "@model", "@Html", "@Url", "@RenderBody", "@RenderSection",
        "@foreach", "@if", "@switch",
        
        // RAZOR: HTML Helpers
        "Html.LabelFor", "Html.TextBoxFor", "Html.ValidationMessageFor",
        "Html.BeginForm", "Html.ActionLink",
        
        // ARIA: Attributes
        ...ARIA_LABELS,
        
        // STRUCTURE: Semantic HTML
        "<nav", "<main", "<header", "<footer",
        
        // FORMS: Input elements
        "<form", "<input", "<label", "for=", "<button",
        
        // IMAGES: Alt text
        "<img", "alt=",
        
        // MOTOR: Interactive
        "tabindex", "onclick"
      ]
    };
  }
  
  // Twig (Symfony PHP)
  if (languageId === "twig" || /\.twig$/.test(doc.fileName)) {
    return {
      keywords: [
        // TWIG: Syntax
        "{{", "}}", "{%", "%}", "{#",
        "{% if", "{% for", "{% block", "{% extends",
        "{% include", "{{ form_widget", "{{ form_label",
        
        // ARIA: Attributes
        ...ARIA_LABELS,
        "aria-hidden", "aria-live",
        
        // STRUCTURE: Semantic HTML
        "<nav", "<main", "<header", "<footer",
        "<h1", "<h2", "<h3", "<h4", "<h5", "<h6",
        
        // FORMS: Symfony form helpers
        "form_start", "form_end", "form_row", "form_errors",
        
        // FORMS: Standard HTML
        "<form", "<input", "<label", "for=", "<button",
        
        // IMAGES: Alt text
        "<img", "alt=", "{{ asset(",
        
        // MOTOR: Interactive
        "tabindex"
      ]
    };
  }
  
  // Liquid (Shopify / Jekyll)
  if (languageId === "liquid" || /\.liquid$/.test(doc.fileName)) {
    return {
      keywords: [
        // LIQUID: Syntax
        "{{", "}}", "{%", "%}",
        "{% if", "{% for", "{% include", "{% render",
        "{% assign", "{% capture",
        
        // ARIA: Attributes
        ...ARIA_LABELS,
        "aria-hidden", "aria-live",
        
        // STRUCTURE: Semantic HTML
        "<nav", "<main", "<header", "<footer",
        "<h1", "<h2", "<h3", "<h4", "<h5", "<h6",
        
        // LIQUID: Shopify specific
        "{{ product", "{{ image", "| img_url", "| img_tag",
        "alt:", "alt=",
        
        // FORMS: Input elements
        "<form", "<input", "<label", "for=", "<button",
        "{% form", "{% endform",
        
        // IMAGES: Alt text
        "<img", "alt=", "{{ image.alt",
        
        // MOTOR: Interactive
        "tabindex"
      ]
    };
  }
  
  // Go templates (html/template)
  if ((languageId === "go" || languageId === "gotemplate" || languageId === "gotmpl") && 
      /\{\{|\}\}/.test(content)) {
    return {
      keywords: [
        // GO TEMPLATE: Syntax
        "{{", "}}", "{{ range", "{{ if", "{{ with", "{{ template",
        "{{ define", "{{ block", "{{ end }}",
        
        // ARIA: Attributes
        ...ARIA_LABELS,
        "aria-hidden", "aria-live",
        
        // STRUCTURE: Semantic HTML
        "<nav", "<main", "<header", "<footer",
        "<h1", "<h2", "<h3", "<h4", "<h5", "<h6",
        
        // FORMS: Input elements
        "<form", "<input", "<label", "for=", "<button",
        
        // IMAGES: Alt text
        "<img", "alt=", "{{ .Alt }}",
        
        // MOTOR: Interactive
        "tabindex"
      ]
    };
  }
  
  // Thymeleaf (Java / Spring)
  if (content.includes("th:") || content.includes("xmlns:th")) {
    return {
      keywords: [
        // THYMELEAF: Attributes
        "th:text", "th:if", "th:each", "th:href", "th:src",
        "th:attr", "th:field", "th:errors", "th:object",
        "th:fragment", "th:replace",
        
        // ARIA: Attributes (Thymeleaf syntax)
        "th:aria-label", "th:aria-labelledby", "aria-label=",
        "aria-describedby", "aria-hidden",
        
        // STRUCTURE: Semantic HTML
        "<nav", "<main", "<header", "<footer",
        "<h1", "<h2", "<h3", "<h4", "<h5", "<h6",
        
        // FORMS: Thymeleaf form binding
        "th:action", "th:object", "th:field", "th:errors",
        
        // FORMS: Standard HTML
        "<form", "<input", "<label", "for=", "<button",
        
        // IMAGES: Alt text
        "<img", "alt=", "th:alt",
        
        // MOTOR: Interactive
        "tabindex", "th:onclick"
      ]
    };
  }
  
  // Elm - functional programming language
  if (languageId === "elm" || /\.elm$/.test(doc.fileName)) {
    return {
      keywords: [
        // ELM: HTML functions
        "Html.node", "Html.text", "Html.button", "Html.input",
        "Html.label", "Html.img", "Html.nav", "Html.main_",
        "Html.header", "Html.footer", "Html.form",
        
        // ELM: Attributes
        "Attributes.attribute", "Attributes.alt", "Attributes.tabindex",
        "Attributes.disabled", "Attributes.required",
        
        // ARIA: Elm attributes
        "attribute \"aria-label\"", "attribute \"aria-describedby\"",
        "attribute \"role\"",
        
        // ELM: Events
        "onClick", "onInput", "onFocus", "onBlur", "onSubmit",
        "onKeyDown", "onKeyPress",
        
        // ELM: Accessibility module
        "Html.Attributes.attribute", "custom", "on"
      ]
    };
  }
  
  // Qwik - resumable framework
  if (content.includes("@builder.io/qwik") || content.includes("component$")) {
    return {
      keywords: [
        // QWIK: Component syntax
        "component$", "useSignal", "useStore", "useTask$",
        "$:", "onClick$", "onKeyDown$",
        
        // ARIA: Attributes
        ...ARIA_LABELS,
        "aria-hidden", "aria-live", "role=",
        
        // MOTOR: Events (Qwik syntax)
        "onClick$", "onKeyDown$", "onFocus$", "onBlur$",
        
        // STRUCTURE: Semantic elements
        "<nav", "<main", "<header", "<footer",
        
        // FORMS: Input elements
        "<input", "<button", "<form", "<label",
        
        // IMAGES: Alt text
        "<img", "alt="
      ]
    };
  }
  
  // Next.js specific features (extends React)
  if (content.includes("next/") || content.includes("getServerSideProps") || 
      content.includes("getStaticProps") || content.includes("next/image")) {
    return {
      keywords: [
        // NEXT.JS: Components
        "<Image", "<Link", "<Head", "<Script",
        "next/image", "next/link", "next/head", "next/script",
        
        // NEXT.JS: Image props (accessibility)
        "alt=", "priority", "loading=", "placeholder=",
        
        // ARIA: All React patterns plus Next.js
        ...ARIA_LABELS,
        "role=", "aria-hidden", "aria-live",
        
        // MOTOR: Navigation
        "onClick", "onKeyDown", "tabIndex", "href=",
        "shallow", "passHref",
        
        // STRUCTURE: Semantic HTML
        "<nav", "<main", "<header", "<footer",
        
        // FORMS: Input elements
        "<input", "<button", "<form", "<label",
        
        // NEXT.JS: Metadata (accessibility)
        "metadata", "title", "description", "lang"
      ]
    };
  }
  
  // Nuxt.js specific features (extends Vue)
  if (content.includes("nuxt") || content.includes("useNuxtApp") || 
      content.includes("defineNuxtComponent")) {
    return {
      keywords: [
        // NUXT: Components
        "<NuxtLink", "<NuxtImg", "<NuxtPicture", "<NuxtLayout",
        "NuxtPage", "<ClientOnly",
        
        // NUXT: Image props
        "alt=", ":alt", "loading=", "sizes=",
        
        // ARIA: All Vue patterns plus Nuxt
        ...ARIA_LABELS,
        "role=", "aria-hidden", "aria-live",
        
        // MOTOR: Navigation
        "@click", "@keydown", "tabindex", "to=",
        
        // STRUCTURE: Semantic HTML
        "<nav", "<main", "<header", "<footer",
        
        // FORMS: Input elements
        "<input", "<button", "<form", "<label",
        
        // NUXT: Metadata
        "useHead", "title:", "meta:", "lang:"
      ]
    };
  }
  
  // Tailwind CSS - utility-first CSS framework
  if (content.includes("class=") && /\b(flex|grid|bg-|text-|p-|m-|w-|h-)/i.test(content)) {
    return {
      keywords: [
        // TAILWIND: Focus utilities
        "focus:", "focus-visible:", "focus-within:",
        
        // TAILWIND: Accessibility utilities
        "sr-only", "not-sr-only", "screen-reader",
        
        // MOTOR: Interactive states
        "hover:", "active:", "disabled:", "focus:",
        
        // VISUAL: Color & contrast
        "bg-", "text-", "border-", "contrast-",
        
        // VISUAL: Motion & animation
        "transition", "animate-", "motion-reduce:",
        "motion-safe:",
        
        // VISUAL: Dark mode
        "dark:", "dark:bg-", "dark:text-",
        
        // MOTOR: Touch targets
        "w-", "h-", "p-", "min-w-", "min-h-",
        
        // ARIA: Standard attributes
        ...ARIA_LABELS,
        
        // STRUCTURE: Semantic elements
        "<button", "<input", "<nav", "<main"
      ]
    };
  }
  
  // Bootstrap - popular CSS framework
  if (content.includes("bootstrap") || /\b(btn|form-control|sr-only|visually-hidden)\b/.test(content)) {
    return {
      keywords: [
        // BOOTSTRAP: Accessibility classes
        "sr-only", "sr-only-focusable", "visually-hidden",
        "visually-hidden-focusable",
        
        // BOOTSTRAP: Form classes
        "form-control", "form-label", "form-check",
        "invalid-feedback", "valid-feedback", "was-validated",
        
        // BOOTSTRAP: Button classes
        "btn", "btn-primary", "disabled", "active",
        
        // BOOTSTRAP: Modal
        "modal", "modal-dialog", "data-bs-toggle", "data-bs-dismiss",
        "aria-labelledby", "aria-hidden",
        
        // BOOTSTRAP: Tooltips & Popovers
        "data-bs-toggle=\"tooltip\"", "data-bs-toggle=\"popover\"",
        "data-bs-content", "title=",
        
        // BOOTSTRAP: Navbar
        "navbar", "navbar-toggler", "navbar-collapse",
        "aria-controls", "aria-expanded",
        
        // ARIA: Standard attributes
        "aria-label", "aria-describedby", "role=",
        
        // STRUCTURE: Semantic elements
        "<button", "<input", "<nav", "<form"
      ]
    };
  }
  
  // Remix - React framework for full-stack web
  if (content.includes("@remix-run") || content.includes("useLoaderData") || 
      content.includes("useActionData")) {
    return {
      keywords: [
        // REMIX: Components & hooks
        "<Link", "<Form", "useLoaderData", "useActionData",
        "useFetcher", "useTransition", "useMatches",
        
        // REMIX: Form props
        "method=", "action=", "reloadDocument", "replace",
        
        // REMIX: Meta & links
        "meta", "links", "title", "description",
        
        // ARIA: All React patterns
        ...ARIA_LABELS,
        "role=", "aria-hidden", "aria-live", "aria-busy",
        
        // MOTOR: Events & focus
        "onClick", "onKeyDown", "tabIndex", "autoFocus",
        
        // STRUCTURE: Semantic HTML
        "<nav", "<main", "<header", "<footer",
        
        // FORMS: Input elements
        "<input", "<button", "<label", "htmlFor",
        
        // IMAGES: Alt text
        "<img", "alt="
      ]
    };
  }
  
  // SvelteKit - full-stack Svelte framework
  if (content.includes("$app/") || content.includes("load") && languageId === "svelte") {
    return {
      keywords: [
        // SVELTEKIT: Special imports
        "$app/navigation", "$app/stores", "$app/environment",
        "goto", "invalidate", "beforeNavigate", "afterNavigate",
        
        // SVELTEKIT: Forms
        "use:enhance", "<form", "method=", "action=",
        
        // ARIA: All Svelte patterns
        ...ARIA_LABELS,
        "aria-hidden", "aria-live", "role=",
        
        // MOTOR: Events
        "on:click", "on:keydown", "on:focus", "tabindex",
        
        // STRUCTURE: Semantic elements
        "<nav", "<main", "<header", "<footer",
        
        // FORMS: Input elements
        "<input", "<button", "<label", "bind:value",
        
        // IMAGES: Alt text
        "<img", "alt="
      ]
    };
  }
  
  // Gatsby - React-based static site generator
  if (content.includes("gatsby") || content.includes("StaticQuery") || 
      content.includes("graphql`")) {
    return {
      keywords: [
        // GATSBY: Components
        "<Link", "<StaticImage", "<GatsbyImage",
        "StaticQuery", "useStaticQuery", "graphql",
        
        // GATSBY: Image props
        "alt=", "loading=", "placeholder=",
        
        // ARIA: All React patterns
        ...ARIA_LABELS,
        "role=", "aria-hidden",
        
        // MOTOR: Navigation
        "onClick", "onKeyDown", "to=", "tabIndex",
        
        // STRUCTURE: Semantic HTML
        "<nav", "<main", "<header", "<footer",
        
        // FORMS: Input elements
        "<input", "<button", "<form", "<label",
        
        // GATSBY: SEO component
        "<Helmet", "title", "lang", "meta"
      ]
    };
  }
  
  // WordPress / PHP with WordPress functions
  if ((languageId === "php" || languageId === "html") && 
      (content.includes("wp_") || content.includes("the_") || content.includes("get_"))) {
    return {
      keywords: [
        // WORDPRESS: Template tags
        "the_title", "the_content", "the_post_thumbnail",
        "wp_nav_menu", "get_header", "get_footer",
        "get_template_part",
        
        // WORDPRESS: Image functions
        "wp_get_attachment_image", "the_post_thumbnail_url",
        "'alt'", "get_post_meta",
        
        // WORDPRESS: Accessibility
        "screen-reader-text", "skip-link",
        ...ARIA_LABELS,
        
        // STRUCTURE: Semantic HTML
        "<nav", "<main", "<header", "<footer", "<article",
        
        // WORDPRESS: Navigation
        "wp_nav_menu", "menu_class", "container",
        
        // FORMS: WordPress forms
        "wp_login_form", "comment_form", "<input", "<label",
        
        // MOTOR: Interactive
        "tabindex", "role="
      ]
    };
  }
  
  // Drupal / PHP with Drupal Twig
  if (content.includes("drupal") || content.includes("{{ content") || 
      (content.includes("{% trans") && content.includes("{% block"))) {
    return {
      keywords: [
        // DRUPAL: Twig syntax
        "{{ content", "{{ page", "{{ node",
        "{% trans", "{% block", "{{ 'text'|t }}",
        
        // DRUPAL: Render arrays
        "content.field_", "{{ content.body",
        
        // ARIA: Attributes
        ...ARIA_LABELS,
        "role=", "aria-hidden",
        
        // STRUCTURE: Semantic HTML
        "<nav", "<main", "<header", "<footer", "<article",
        
        // DRUPAL: Regions
        "{{ page.header", "{{ page.content", "{{ page.sidebar",
        
        // FORMS: Input elements
        "<form", "<input", "<label", "for=",
        
        // IMAGES: Alt text
        "<img", "alt=", "{{ node.field_image.alt"
      ]
    };
  }
  
  // Default fallback - basic accessibility coverage
  return {
    keywords: [
      "aria-", "role", "tabindex", "alt", "label", "lang",
      "button", "input", "form", "nav", "main", "header",
      "color", "background", "focus", "disabled", "hidden"
    ]
  };
}
