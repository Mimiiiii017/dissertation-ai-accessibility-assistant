// accessible-dashboard.js — Properly-implemented accessibility patterns

// ── 1. Live region for dynamic content ────────────────────────────────────
function updateNotificationCount(count) {
  const badge = document.getElementById('notification-badge');
  badge.textContent = count;

  // Polite live region — screen readers will announce the update.
  const live = document.getElementById('notification-live');
  if (live) {
    live.textContent = `You have ${count} new notification${count !== 1 ? 's' : ''}.`;
  }
}

// ── 2. Modal with full focus management ───────────────────────────────────
let lastFocused = null;

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  lastFocused = document.activeElement;

  modal.removeAttribute('hidden');
  modal.setAttribute('aria-modal', 'true');

  // Move focus to the first focusable element inside the modal.
  const focusable = modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (focusable.length) focusable[0].focus();

  modal.addEventListener('keydown', trapFocus);
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.setAttribute('hidden', '');
  modal.removeEventListener('keydown', trapFocus);

  // Return focus to the element that opened the modal.
  if (lastFocused) lastFocused.focus();
}

function trapFocus(e) {
  if (e.key !== 'Tab') return;
  const focusable = Array.from(
    e.currentTarget.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  );
  const first = focusable[0];
  const last  = focusable[focusable.length - 1];

  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

// ── 3. Keyboard-accessible dropdown ──────────────────────────────────────
function setupDropdown() {
  const trigger = document.getElementById('dropdown-trigger');
  const menu    = document.getElementById('dropdown-menu');

  function toggleMenu(open) {
    menu.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    if (open) {
      const first = menu.querySelector('[role="menuitem"]');
      if (first) first.focus();
    } else {
      trigger.focus();
    }
  }

  trigger.addEventListener('click', () => toggleMenu(menu.hidden));

  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleMenu(menu.hidden);
    }
    if (e.key === 'Escape') toggleMenu(false);
  });

  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') toggleMenu(false);
  });
}

// ── 4. SPA navigation with title update ──────────────────────────────────
function navigateTo(path, pageTitle) {
  history.pushState({ title: pageTitle }, '', path);
  document.title = `${pageTitle} — My App`;
  renderPage(pageTitle);
}

function renderPage(pageTitle) {
  const app = document.getElementById('app');
  app.innerHTML = `<h1>${pageTitle}</h1>`;
}
