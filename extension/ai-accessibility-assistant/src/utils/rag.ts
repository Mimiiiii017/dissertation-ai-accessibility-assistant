type RagChunk = { id: string; source: string; text: string };
type RagRetrieveResponse = { chunks: RagChunk[] };

// Get relevant context from the RAG knowledge base
export async function ragRetrieve(endpoint: string, query: string, topK: number): Promise<RagRetrieveResponse> {
  const url = `${endpoint.replace(/\/$/, "")}/retrieve`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, top_k: topK }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`RAG retrieve failed (HTTP ${res.status}): ${body || res.statusText}`);
  }

  return (await res.json()) as RagRetrieveResponse;
}

// Build a smart query based on what's in the code (helps RAG find relevant docs)
export function buildRagQuery(languageId: string, code: string): string {
  const lower = code.toLowerCase();
  const hints: string[] = [];

  // Core web technologies - HTML
  if (languageId === "html") {
    hints.push("HTML accessibility WCAG guidelines semantic HTML");
    
    // Images & Media
    if (lower.includes("<img")) {
      hints.push("images alt text non-text content WCAG 1.1.1 SVG figures figcaption");
    }
    if (lower.includes("video") || lower.includes("audio") || lower.includes("<track")) {
      hints.push("media captions audio descriptions transcripts sign language audio control WCAG 1.2");
    }
    
    // Forms & Input
    if (lower.includes("<form") || lower.includes("<input") || lower.includes("<label")) {
      hints.push("forms labels accessible names input purpose autocomplete error messages validation required fields redundant entry accessible authentication WCAG 1.3.5 3.3");
    }
    
    // ARIA
    if (lower.includes("aria-")) {
      hints.push("ARIA best practices five rules widget patterns live regions status messages dynamic content WCAG 4.1.2");
    }
    
    // Keyboard & Focus
    if (lower.includes("button") || lower.includes("onclick") || lower.includes("tabindex") || lower.includes("autofocus")) {
      hints.push("keyboard navigation focus tab order focus indicators focus visible focus not obscured links versus buttons character key shortcuts WCAG 2.1 2.4.7");
    }
    
    // Navigation & Structure
    if (lower.includes("<nav") || lower.includes("menu") || lower.includes("<header") || lower.includes("<main")) {
      hints.push("navigation landmarks consistent navigation skip links breadcrumbs multiple ways page titles link purpose consistent identification WCAG 2.4 3.2");
    }
    if (lower.includes("<h1") || lower.includes("<h2") || lower.includes("heading")) {
      hints.push("headings logical hierarchy structure meaningful sequence WCAG 1.3.1 2.4.6");
    }
    
    // Tables
    if (lower.includes("<table")) {
      hints.push("tables headers scope caption data tables accessibility WCAG 1.3.1");
    }
    
    // Visual & Color
    if (lower.includes("color") || lower.includes("style") || lower.includes("background")) {
      hints.push("visual color contrast text spacing resize reflow dark mode high contrast non-text contrast images of text WCAG 1.4");
    }
    
    // Dialogs & Modals
    if (lower.includes("dialog") || lower.includes("modal") || lower.includes("popup") || lower.includes("aria-modal")) {
      hints.push("dialogs modal focus management focus trapping escape key dismissible WCAG 2.4.3");
    }
    
    // Gestures & Touch
    if (lower.includes("drag") || lower.includes("swipe") || lower.includes("gesture") || lower.includes("touch")) {
      hints.push("controls pointer gestures dragging movements motion actuation single-pointer alternatives target size WCAG 2.5");
    }
    
    // Timing & Animation
    if (lower.includes("timer") || lower.includes("timeout") || lower.includes("setinterval") || lower.includes("settimeout")) {
      hints.push("timing adjustable time limits auto-updating content pause stop hide WCAG 2.2");
    }
    if (lower.includes("animate") || lower.includes("transition") || lower.includes("@keyframes") || lower.includes("flash")) {
      hints.push("visual animation motion seizure prevention reduced motion parallax prefers-reduced-motion WCAG 2.3");
    }
    
    // Language & Internationalization
    if (lower.includes("lang=") || lower.includes("dir=") || lower.includes("rtl") || lower.includes("ltr")) {
      hints.push("structure language of page RTL bidirectional text internationalisation WCAG 3.1");
    }
    
    // Visibility & Hiding
    if (lower.includes("display:none") || lower.includes("visibility:hidden") || lower.includes("aria-hidden")) {
      hints.push("visual CSS visibility accessible hiding screen reader only content off-screen techniques");
    }
    
    // Hover & Focus States
    if (lower.includes("hover") || lower.includes(":hover") || lower.includes(":focus")) {
      hints.push("visual content on hover or focus dismissible hoverable persistent pointer focus WCAG 1.4.13");
    }
    
    // Testing & Documentation
    if (lower.includes("test") || lower.includes("axe") || lower.includes("validator")) {
      hints.push("testing automated testing manual testing accessibility evaluation tools");
    }
    
    hints.push("cognitive load readability predictable behavior assistive technology screen readers");
  }
  
  // CSS & Preprocessors
  else if (["css", "scss", "sass", "less"].includes(languageId)) {
    hints.push("CSS accessibility visual design WCAG");
    
    if (lower.includes("color") || lower.includes("background") || lower.includes("contrast")) {
      hints.push("color contrast text contrast non-text contrast WCAG 1.4.3 1.4.6 1.4.11");
    }
    if (lower.includes(":focus") || lower.includes("outline") || lower.includes("focus-visible")) {
      hints.push("focus indicators visible focus focus styles keyboard navigation WCAG 2.4.7 2.4.11");
    }
    if (lower.includes("animation") || lower.includes("transition") || lower.includes("@keyframes")) {
      hints.push("animation motion reduced motion prefers-reduced-motion seizure prevention WCAG 2.3");
    }
    if (lower.includes("font-size") || lower.includes("line-height") || lower.includes("letter-spacing")) {
      hints.push("text spacing resize reflow zoom WCAG 1.4.4 1.4.10 1.4.12");
    }
    if (lower.includes("prefers-color-scheme") || lower.includes("dark") || lower.includes("forced-colors")) {
      hints.push("dark mode high contrast forced colors WCAG 1.4.1");
    }
    if (lower.includes("@media")) {
      hints.push("responsive design orientation viewport media queries accessibility");
    }
    
    hints.push("visual accessibility CSS design patterns");
  }
  
  // React, Next.js, Gatsby
  else if (languageId.includes("react") || lower.includes("import react") || lower.includes("from 'react'") ||
           lower.includes("next/") || lower.includes("gatsby")) {
    hints.push("React accessibility JSX ARIA keyboard navigation focus management");
    
    if (lower.includes("onclick") || lower.includes("onkeydown") || lower.includes("tabindex")) {
      hints.push("keyboard events focus management interactive elements WCAG 2.1");
    }
    if (lower.includes("aria-")) {
      hints.push("ARIA in React live regions dynamic content widget patterns");
    }
    if (lower.includes("useref") || lower.includes("focus()")) {
      hints.push("focus management React refs modal dialogs WCAG 2.4.3");
    }
    if (lower.includes("<img") || lower.includes("<image") || lower.includes("alt=")) {
      hints.push("images alt text Next.js Image Gatsby Image optimization");
    }
    if (lower.includes("form") || lower.includes("input")) {
      hints.push("forms labels validation React forms accessible names");
    }
    if (lower.includes("modal") || lower.includes("dialog") || lower.includes("portal")) {
      hints.push("modal dialogs focus trapping portals accessibility");
    }
    if (lower.includes("useeffect") || lower.includes("usestate")) {
      hints.push("React hooks accessibility side effects dynamic content");
    }
    
    hints.push("component accessibility semantic HTML");
  }
  
  // Vue, Nuxt
  else if (languageId === "vue" || lower.includes("vue") || lower.includes("nuxt") || 
           lower.includes("v-model") || lower.includes("@click")) {
    hints.push("Vue accessibility directives ARIA keyboard navigation");
    
    if (lower.includes("@click") || lower.includes("@keydown") || lower.includes("tabindex")) {
      hints.push("keyboard events Vue event handling interactive elements WCAG 2.1");
    }
    if (lower.includes("aria-")) {
      hints.push("ARIA Vue components live regions accessibility");
    }
    if (lower.includes("$refs") || lower.includes("v-focus")) {
      hints.push("focus management Vue refs modal dialogs");
    }
    if (lower.includes("v-if") || lower.includes("v-show")) {
      hints.push("conditional rendering visibility screen readers");
    }
    if (lower.includes("transition") || lower.includes("v-enter") || lower.includes("v-leave")) {
      hints.push("Vue transitions animation accessibility reduced motion");
    }
    
    hints.push("Vue component patterns semantic HTML accessibility");
  }
  
  // Angular
  else if (lower.includes("@angular") || lower.includes("@component") || lower.includes("@ngmodule") ||
           lower.includes("*ngif") || lower.includes("[(ngmodel)]")) {
    hints.push("Angular accessibility CDK ARIA forms");
    
    if (lower.includes("(click)") || lower.includes("(keydown)") || lower.includes("tabindex")) {
      hints.push("keyboard events Angular event binding interactive elements WCAG 2.1");
    }
    if (lower.includes("aria-")) {
      hints.push("ARIA Angular components accessibility patterns");
    }
    if (lower.includes("cdkfocus") || lower.includes("focustrap") || lower.includes("viewchild")) {
      hints.push("Angular CDK focus management focus trapping modal accessibility");
    }
    if (lower.includes("matdialog") || lower.includes("mat-dialog")) {
      hints.push("Angular Material dialog modal accessibility");
    }
    if (lower.includes("formcontrol") || lower.includes("formgroup") || lower.includes("reactive forms")) {
      hints.push("Angular forms reactive forms validation accessibility");
    }
    
    hints.push("Angular accessibility Material CDK patterns");
  }
  
  // Svelte, SvelteKit
  else if (languageId === "svelte" || lower.includes("svelte") || lower.includes("on:") || 
           lower.includes("bind:")) {
    hints.push("Svelte accessibility reactive components ARIA");
    
    if (lower.includes("on:click") || lower.includes("on:keydown") || lower.includes("tabindex")) {
      hints.push("keyboard events Svelte event handling interactive elements");
    }
    if (lower.includes("bind:this")) {
      hints.push("Svelte bindings focus management refs");
    }
    if (lower.includes("transition:") || lower.includes("animate:")) {
      hints.push("Svelte transitions animation accessibility reduced motion");
    }
    
    hints.push("Svelte component accessibility semantic HTML");
  }
  
  // Solid.js, Alpine.js, HTMX, Qwik
  else if (lower.includes("solid-js") || lower.includes("createsignal") ||
           lower.includes("x-data") || lower.includes("alpine") ||
           lower.includes("hx-") || lower.includes("htmx") ||
           lower.includes("component$") || lower.includes("qwik")) {
    const framework = lower.includes("solid-js") ? "Solid.js" :
                     lower.includes("alpine") ? "Alpine.js" :
                     lower.includes("htmx") ? "HTMX" : "Qwik";
    
    hints.push(`${framework} accessibility progressive enhancement ARIA`);
    
    if (lower.includes("aria-")) {
      hints.push("ARIA live regions dynamic content");
    }
    if (lower.includes("@click") || lower.includes("onclick") || lower.includes("hx-trigger")) {
      hints.push("keyboard navigation interactive elements progressive enhancement");
    }
    
    hints.push("semantic HTML accessibility patterns");
  }
  
  // Ember.js
  else if (lower.includes("@ember") || lower.includes("ember.") || lower.includes("{{action")) {
    hints.push("Ember accessibility Handlebars templates ARIA");
    
    if (lower.includes("{{on")) {
      hints.push("Ember event handling keyboard accessibility");
    }
    if (lower.includes("aria-")) {
      hints.push("ARIA Ember components accessibility");
    }
    
    hints.push("Ember component patterns accessibility");
  }
  
  // Web Components, Lit
  else if (lower.includes("customelement") || lower.includes("litelement") || 
           lower.includes("shadowroot") || lower.includes("@lit")) {
    hints.push("Web Components accessibility Shadow DOM ARIA");
    
    if (lower.includes("shadowroot") || lower.includes("attachshadow")) {
      hints.push("Shadow DOM accessibility delegatesFocus focus management");
    }
    if (lower.includes("slot")) {
      hints.push("slots accessibility semantic HTML");
    }
    if (lower.includes("elementinternals") || lower.includes("formassociated")) {
      hints.push("form-associated custom elements accessibility");
    }
    
    hints.push("custom elements semantic HTML ARIA patterns");
  }
  
  // Template Engines - Handlebars, Mustache, EJS, Pug
  else if (["handlebars", "hbs", "mustache", "ejs", "pug", "jade"].includes(languageId) ||
           lower.includes("{{#if") || lower.includes("{{#each") || 
           lower.includes("<%=") || (languageId === "pug" && /^\s*\w+\(/m.test(code))) {
    const engine = languageId === "pug" || languageId === "jade" ? "Pug" :
                  languageId === "ejs" ? "EJS" : "Handlebars";
    
    hints.push(`${engine} templates accessibility semantic HTML ARIA`);
    
    if (lower.includes("<img") || lower.includes("img(")) {
      hints.push("images alt text templates");
    }
    if (lower.includes("<form") || lower.includes("form(")) {
      hints.push("forms labels validation accessibility");
    }
    
    hints.push("server-side rendering accessibility WCAG");
  }
  
  // Server-Side: PHP, WordPress, Drupal
  else if (languageId === "php" || lower.includes("<?php")) {
    if (lower.includes("wp_") || lower.includes("the_") || lower.includes("wordpress")) {
      hints.push("WordPress accessibility theme development WCAG screen-reader-text");
      
      if (lower.includes("wp_nav_menu")) {
        hints.push("WordPress navigation menus accessibility");
      }
      if (lower.includes("the_post_thumbnail") || lower.includes("wp_get_attachment_image")) {
        hints.push("WordPress images alt text featured images");
      }
    } else if (lower.includes("drupal") || lower.includes("{{ content")) {
      hints.push("Drupal accessibility Twig templates ARIA");
    } else {
      hints.push("PHP accessibility server-side rendering HTML ARIA");
    }
    
    if (lower.includes("form") || lower.includes("input")) {
      hints.push("forms labels validation accessibility");
    }
    
    hints.push("semantic HTML WCAG guidelines");
  }
  
  // Python Templates - Jinja2, Django
  else if (languageId === "jinja" || languageId === "django-html" || 
           (lower.includes("{%") && (lower.includes("{% for") || lower.includes("{% if")))) {
    hints.push("Django Jinja2 templates accessibility forms ARIA");
    
    if (lower.includes("{{ form") || lower.includes("{% csrf_token")) {
      hints.push("Django forms accessibility labels validation");
    }
    if (lower.includes("{% trans")) {
      hints.push("internationalization language accessibility");
    }
    
    hints.push("Python templates semantic HTML WCAG");
  }
  
  // Ruby, Rails, ERB
  else if (languageId === "erb" || (languageId === "ruby" && lower.includes("<%"))) {
    hints.push("Ruby on Rails ERB templates accessibility forms");
    
    if (lower.includes("form_for") || lower.includes("form_with")) {
      hints.push("Rails forms accessibility labels validation helpers");
    }
    if (lower.includes("image_tag")) {
      hints.push("Rails image helpers alt text accessibility");
    }
    if (lower.includes("link_to") || lower.includes("button_to")) {
      hints.push("Rails link helpers navigation accessibility");
    }
    
    hints.push("Rails accessibility semantic HTML WCAG");
  }
  
  // Blazor, Razor (C#)
  else if (languageId === "razor" || languageId === "cshtml" || 
           lower.includes("@code") || lower.includes("@page") || lower.includes("@model")) {
    const framework = lower.includes("@code") || lower.includes("@page") ? "Blazor" : "Razor Pages";
    hints.push(`${framework} accessibility ASP.NET ARIA forms`);
    
    if (lower.includes("editform") || lower.includes("inputtext")) {
      hints.push("Blazor forms components validation accessibility");
    }
    if (lower.includes("@onclick") || lower.includes("@bind")) {
      hints.push("Blazor event handling data binding accessibility");
    }
    
    hints.push("ASP.NET accessibility semantic HTML");
  }
  
  // Twig (Symfony)
  else if (languageId === "twig" || (lower.includes("{{") && lower.includes("{% "))) {
    hints.push("Twig Symfony templates accessibility forms");
    
    if (lower.includes("form_widget") || lower.includes("form_label")) {
      hints.push("Symfony forms accessibility Twig helpers");
    }
    
    hints.push("Symfony accessibility semantic HTML WCAG");
  }
  
  // Liquid (Shopify, Jekyll)
  else if (languageId === "liquid" || lower.includes("{% if") && lower.includes("{{ product")) {
    hints.push("Liquid templates Shopify Jekyll accessibility");
    
    if (lower.includes("{{ product") || lower.includes("{{ image")) {
      hints.push("Shopify accessibility product images alt text");
    }
    
    hints.push("e-commerce accessibility semantic HTML");
  }
  
  // Go Templates
  else if ((languageId === "go" || languageId === "gotemplate") && lower.includes("{{")) {
    hints.push("Go templates html/template accessibility");
    hints.push("server-side rendering semantic HTML ARIA");
  }
  
  // Thymeleaf (Java, Spring)
  else if (lower.includes("th:") || lower.includes("xmlns:th")) {
    hints.push("Thymeleaf Spring accessibility Java templates");
    
    if (lower.includes("th:field") || lower.includes("th:errors")) {
      hints.push("Thymeleaf forms validation accessibility");
    }
    
    hints.push("Spring Boot accessibility semantic HTML");
  }
  
  // Elm
  else if (languageId === "elm") {
    hints.push("Elm accessibility functional programming Html.Attributes");
    
    if (lower.includes("html.button") || lower.includes("onclick")) {
      hints.push("Elm event handling keyboard accessibility");
    }
    
    hints.push("Elm semantic HTML ARIA patterns");
  }
  
  // Astro
  else if (languageId === "astro" || lower.includes("astro.props")) {
    hints.push("Astro accessibility islands architecture SSG");
    
    if (lower.includes("client:")) {
      hints.push("Astro client directives progressive enhancement accessibility");
    }
    
    hints.push("static site accessibility semantic HTML");
  }
  
  // Remix (Full-stack React)
  else if (lower.includes("@remix-run") || lower.includes("useloaderdata")) {
    hints.push("Remix accessibility React forms progressive enhancement");
    
    if (lower.includes("<form") || lower.includes("useactiondata")) {
      hints.push("Remix forms accessibility server-side validation");
    }
    
    hints.push("full-stack React accessibility WCAG");
  }
  
  // Markdown
  else if (languageId === "markdown" || languageId === "md") {
    hints.push("Markdown accessibility documentation alt text headings");
    
    if (lower.includes("![")) {
      hints.push("images alt text in Markdown accessibility documentation");
    }
    if (lower.includes("# ") || lower.includes("## ")) {
      hints.push("headings hierarchy documentation structure");
    }
    if (lower.includes("```") && lower.includes("html")) {
      hints.push("code examples accessibility HTML ARIA");
    }
    
    hints.push("accessible documentation WCAG guidelines");
  }
  
  // JSON (manifests, configs)
  else if (languageId === "json" || languageId === "jsonc") {
    hints.push("JSON accessibility configuration web manifest PWA");
    
    if (lower.includes("manifest") || lower.includes("icons") || lower.includes("theme_color")) {
      hints.push("web manifest PWA accessibility app settings");
    }
    if (lower.includes("lang") || lower.includes("dir")) {
      hints.push("language direction internationalization");
    }
    
    hints.push("configuration accessibility settings");
  }
  
  // XML, SVG
  else if (languageId === "xml" || languageId === "svg" || lower.includes("<svg")) {
    hints.push("SVG accessibility graphics alternative text ARIA");
    
    if (lower.includes("<svg") || lower.includes("<title>") || lower.includes("<desc>")) {
      hints.push("SVG accessibility title desc role img focusable");
    }
    
    hints.push("graphics accessibility WCAG 1.1.1 complex images");
  }
  
  // Plain JavaScript/TypeScript
  else if (["javascript", "typescript", "javascriptreact", "typescriptreact"].includes(languageId)) {
    hints.push("JavaScript accessibility ARIA DOM manipulation keyboard events");
    
    if (lower.includes("addeventlistener") || lower.includes("onclick")) {
      hints.push("event listeners keyboard accessibility mouse alternatives");
    }
    if (lower.includes("focus()") || lower.includes("blur()")) {
      hints.push("focus management JavaScript keyboard navigation");
    }
    if (lower.includes("queryselector")) {
      hints.push("DOM manipulation accessibility ARIA attributes");
    }
    if (lower.includes("modal") || lower.includes("dialog")) {
      hints.push("modal dialogs focus trapping JavaScript");
    }
    
    hints.push("JavaScript patterns WCAG interactive elements");
  }
  
  // Generic fallback
  else {
    hints.push(`${languageId} accessibility WCAG ARIA keyboard navigation semantic HTML`);
    hints.push("best practices assistive technology screen readers");
  }

  return hints.join(", ");
}

// Format RAG chunks into a readable context block for the AI prompt
export function formatRagContext(chunks: RagChunk[]): string {
  if (!chunks.length) {
    return "(no context)";
  }
  // Truncate each chunk to 800 chars to keep prompt manageable
  return chunks.map((c, i) =>
    `[#${i + 1}] ${c.id}\n${c.text.slice(0, 800)}${c.text.length > 800 ? "…" : ""}`
  ).join("\n\n");
}
