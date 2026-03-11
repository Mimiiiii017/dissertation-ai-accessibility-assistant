// dashboard.js — Several common JavaScript accessibility anti-patterns

// ── Issue 1: dynamic content updated without an aria-live region ──────────
// Screen readers won't announce the new badge count to the user.
function updateNotificationCount(count) {
  const badge = document.getElementById('notification-badge');
  badge.textContent = count;
  // No aria-live region; nothing is announced to screen-reader users.
}

// ── Issue 2: modal opens but focus is never moved into it ─────────────────
// Keyboard users stay trapped outside; screen-reader users hear background.
let lastFocusedBeforeModal = null;

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.style.display = 'block';
  modal.removeAttribute('hidden');
  // Focus is NOT moved inside the modal.
  // Focus is NOT trapped — Tab can leave the modal entirely.
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.style.display = 'none';
  modal.setAttribute('hidden', '');
  // Focus is NOT returned to the element that opened the modal.
}

// ── Issue 3: dropdown has click handler only — no keyboard support ────────
// Users who navigate by keyboard cannot open or close the menu.
function setupDropdown() {
  const trigger = document.getElementById('dropdown-trigger');
  const menu    = document.getElementById('dropdown-menu');

  trigger.addEventListener('click', () => {
    const isOpen = menu.getAttribute('aria-expanded') === 'true';
    menu.setAttribute('aria-expanded', String(!isOpen));
    menu.hidden = isOpen;
    // No keydown listener: Enter / Space / Escape / Arrow keys have no effect.
  });
}

// ── Issue 4: SPA route change never updates document.title ────────────────
// Screen-reader users receive no indication that the page has changed.
function navigateTo(path) {
  history.pushState({}, '', path);
  // document.title is never updated.
  renderPage(path);
}

function renderPage(path) {
  const app = document.getElementById('app');
  app.innerHTML = getPageContent(path);
}

function getPageContent(path) {
  const name = path.slice(1) || 'Home';
  return `<h1>${name}</h1><p>Content for ${name}.</p>`;
}
