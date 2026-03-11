/**
 * ground-truth.ts  —  Fixture definitions + expected accessibility issues
 *
 * Each FixtureGroundTruth describes one test file:
 *   • "issues" fixtures  — code with deliberate accessibility bugs
 *   • "clean"  fixtures  — fully accessible code (zero issues expected)
 *
 * IssueConcept.keywords are checked (case-insensitive substring) against the
 * title + explanation that the LLM emits.  A concept is matched ("TP") when
 * any keyword appears in the found issue.  Keep keywords broad enough to
 * tolerate normal phrasing variation between models.
 */

import * as path from 'path';

const F = (name: string) => path.join(__dirname, 'fixtures', name);

// ─── Types ────────────────────────────────────────────────────────────────

export type IssueConcept = {
  /** Short unique id, used in miss/FP reporting */
  id: string;
  /** One or more lower-case substrings; a match on ANY of them = TP */
  keywords: string[];
  /** Human-readable description of what the issue is */
  description: string;
};

export type FixtureGroundTruth = {
  fixtureId: string;
  filePath: string;
  languageId: string;
  /** true → no issues expected; every LLM-emitted issue is a false positive */
  isClean: boolean;
  expectedIssues: IssueConcept[];
};

// ─── HTML fixtures ────────────────────────────────────────────────────────

const HTML_ISSUES_CONCEPTS: IssueConcept[] = [
  {
    id: 'lang-missing',
    keywords: ['lang', 'language attribute', 'html element'],
    description: 'The <html> element is missing the lang attribute.',
  },
  {
    id: 'img-missing-alt',
    keywords: ['alt', 'alternative text', 'img', 'image'],
    description: 'One or more <img> elements lack an alt attribute.',
  },
  {
    id: 'low-contrast',
    keywords: ['contrast', 'colour', 'color', 'text visibility'],
    description: 'Hero section uses #ccc text on #eee background (~1.4:1 contrast ratio).',
  },
  {
    id: 'heading-skip',
    keywords: ['heading', 'h4', 'hierarchy', 'heading level', 'skip'],
    description: 'Page jumps from <h1> to <h4>, skipping h2 and h3.',
  },
  {
    id: 'ambiguous-link-text',
    keywords: ['click here', 'ambiguous', 'link text', 'descriptive link', 'anchor text'],
    description: '"click here" link text is not descriptive out of context.',
  },
  {
    id: 'input-no-label',
    keywords: ['label', 'input', 'form control', 'placeholder'],
    description: 'Email input has no <label>; it relies only on a placeholder attribute.',
  },
  {
    id: 'button-no-accessible-name',
    keywords: ['button', 'accessible name', 'aria-label', 'icon button', 'svg'],
    description: 'Submit button contains only an SVG icon with no accessible name.',
  },
];

const HTML_ISSUES: FixtureGroundTruth = {
  fixtureId:      'html-issues',
  filePath:       F('html-issues.html'),
  languageId:     'html',
  isClean:        false,
  expectedIssues: HTML_ISSUES_CONCEPTS,
};

const HTML_CLEAN: FixtureGroundTruth = {
  fixtureId:      'html-clean',
  filePath:       F('html-clean.html'),
  languageId:     'html',
  isClean:        true,
  expectedIssues: [],
};

// ─── TSX fixtures ─────────────────────────────────────────────────────────

const TSX_ISSUES_CONCEPTS: IssueConcept[] = [
  {
    id: 'div-click-no-keyboard',
    keywords: ['div', 'onclick', 'click', 'keyboard', 'interactive element', 'role'],
    description: 'ProductCard <div> has an onClick handler but no keyboard support or role.',
  },
  {
    id: 'icon-button-no-label',
    keywords: ['button', 'aria-label', 'accessible name', 'icon button', 'icon', 'svg'],
    description: 'Heart/favourite button is an icon-only button with no accessible name.',
  },
  {
    id: 'input-no-label-tsx',
    keywords: ['label', 'input', 'placeholder', 'accessible name', 'form'],
    description: 'Display-name text input has no <label>; relies solely on placeholder.',
  },
  {
    id: 'select-no-label',
    keywords: ['select', 'label', 'dropdown', 'accessible name'],
    description: 'Theme <select> element has no associated label.',
  },
  {
    id: 'toggle-div-no-role',
    keywords: ['toggle', 'div', 'role', 'keyboard', 'interactive', 'click'],
    description: 'Notifications toggle is a <div> with onClick but no role or keyboard handler.',
  },
  {
    id: 'video-autoplay',
    keywords: ['autoplay', 'video', 'motion', 'reduced-motion', 'pause', 'vestibular'],
    description: '<video> uses autoPlay and loop with no mechanism to pause playback.',
  },
];

const TSX_ISSUES: FixtureGroundTruth = {
  fixtureId:      'tsx-issues',
  filePath:       F('tsx-issues.tsx'),
  languageId:     'typescriptreact',
  isClean:        false,
  expectedIssues: TSX_ISSUES_CONCEPTS,
};

const TSX_CLEAN: FixtureGroundTruth = {
  fixtureId:      'tsx-clean',
  filePath:       F('tsx-clean.tsx'),
  languageId:     'typescriptreact',
  isClean:        true,
  expectedIssues: [],
};

// ─── CSS fixtures ─────────────────────────────────────────────────────────

const CSS_ISSUES_CONCEPTS: IssueConcept[] = [
  {
    id: 'focus-outline-removed',
    keywords: ['focus', 'outline', 'keyboard', 'focus indicator', 'focus-visible'],
    description: ':focus and :focus-visible selectors set outline: none, hiding focus rings.',
  },
  {
    id: 'animation-no-reduced-motion',
    keywords: ['animation', 'reduced-motion', 'prefers-reduced-motion', 'vestibular', 'motion'],
    description: 'Animations are not guarded by a prefers-reduced-motion media query.',
  },
  {
    id: 'text-too-small',
    keywords: ['font-size', '8px', 'font size', 'small text', 'text size', 'readability'],
    description: '.legal-text uses 8px font-size, well below readable minimums.',
  },
  {
    id: 'low-contrast-card',
    keywords: ['contrast', 'colour', 'color', 'card', '#ccc', 'cccccc', 'text visibility'],
    description: '.card uses #cccccc text on white background (~1.6:1 contrast ratio).',
  },
];

const CSS_ISSUES: FixtureGroundTruth = {
  fixtureId:      'css-issues',
  filePath:       F('css-issues.css'),
  languageId:     'css',
  isClean:        false,
  expectedIssues: CSS_ISSUES_CONCEPTS,
};

const CSS_CLEAN: FixtureGroundTruth = {
  fixtureId:      'css-clean',
  filePath:       F('css-clean.css'),
  languageId:     'css',
  isClean:        true,
  expectedIssues: [],
};

// ─── JavaScript fixtures ──────────────────────────────────────────────────

const JS_ISSUES_CONCEPTS: IssueConcept[] = [
  {
    id: 'no-live-region',
    keywords: ['aria-live', 'live region', 'dynamic content', 'announcement', 'screen reader'],
    description: 'updateNotificationCount() updates a badge with no aria-live region.',
  },
  {
    id: 'modal-no-focus-management',
    keywords: ['focus', 'modal', 'dialog', 'trap', 'focus management', 'focus trap'],
    description: 'openModal/closeModal do not move focus into the modal or return it on close.',
  },
  {
    id: 'no-keyboard-handler',
    keywords: ['keyboard', 'keydown', 'enter', 'space', 'escape', 'click only', 'dropdown'],
    description: 'Dropdown trigger has a click listener only; keyboard users cannot operate it.',
  },
  {
    id: 'no-title-update',
    keywords: ['title', 'document.title', 'page title', 'navigation', 'route', 'spa'],
    description: 'SPA navigateTo() changes the URL but never updates document.title.',
  },
];

const JS_ISSUES: FixtureGroundTruth = {
  fixtureId:      'js-issues',
  filePath:       F('js-issues.js'),
  languageId:     'javascript',
  isClean:        false,
  expectedIssues: JS_ISSUES_CONCEPTS,
};

const JS_CLEAN: FixtureGroundTruth = {
  fixtureId:      'js-clean',
  filePath:       F('js-clean.js'),
  languageId:     'javascript',
  isClean:        true,
  expectedIssues: [],
};

// ─── Exports ──────────────────────────────────────────────────────────────

export const ALL_FIXTURES: FixtureGroundTruth[] = [
  HTML_ISSUES,
  HTML_CLEAN,
  TSX_ISSUES,
  TSX_CLEAN,
  CSS_ISSUES,
  CSS_CLEAN,
  JS_ISSUES,
  JS_CLEAN,
];

export const FIXTURE_MAP = new Map<string, FixtureGroundTruth>(
  ALL_FIXTURES.map(f => [f.fixtureId, f])
);
