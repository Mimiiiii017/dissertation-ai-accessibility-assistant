/**
 * generate-adversarial-fixtures.ts  —  Adversarial Edge-Case Generation
 *
 * Generates minimal HTML fixtures targeting specific accessibility violations.
 * Each fixture is a "knife" designed to expose specific model weaknesses:
 *
 * - Simple pattern (single violation) vs. complex (multiple violations)
 * - Varied contexts (button, link, form, image, etc.)
 * - Boundary cases (empty text, whitespace-only, aria-label vs. inner text, etc.)
 *
 * Run:   npx ts-node generate-adversarial-fixtures.ts
 * Output: evaluation/Cloud-LLM-Preliminary/adversarial-fixtures.json
 *
 * Usage in benchmark:
 *   1. Load adversarial fixtures
 *   2. Run models against them
 *   3. Identify which violations each model catches/misses
 *   4. Report "Model X is blind to: [violation patterns]"
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Types ────────────────────────────────────────────────────────────────

interface AdversarialFixture {
  id: string;
  category: string; // e.g., "button", "form", "heading", "image", "aria"
  violation: string; // e.g., "no-accessible-name", "missing-label", "wrong-role"
  description: string;
  html: string;
  expectedIssueIds: string[]; // concept IDs that should be detected
  complexity: 'simple' | 'moderate' | 'complex'; // number of violations
  expectedDifficulty: 'easy' | 'medium' | 'hard'; // how hard for models to detect
}

// ─── ANSI Colors ──────────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  bgreen: '\x1b[92m',
  yellow: '\x1b[33m',
  byellow: '\x1b[93m',
  cyan: '\x1b[36m',
  bcyan: '\x1b[96m',
};

// ─── Fixture Generator ────────────────────────────────────────────────────

function fixtures(): AdversarialFixture[] {
  return [
    // ╔══════════════════════════════════════════════════════════╗
    // ║  BUTTON ACCESSIBILITY VIOLATIONS                        ║
    // ╚══════════════════════════════════════════════════════════╝

    {
      id: 'button-no-name',
      category: 'button',
      violation: 'no-accessible-name',
      description: 'Button with no text, no aria-label, no title',
      html: `<button onclick="alert('clicked')"></button>`,
      expectedIssueIds: ['button-name-missing'],
      complexity: 'simple',
      expectedDifficulty: 'medium',
    },
    {
      id: 'button-icon-only',
      category: 'button',
      violation: 'icon-without-label',
      description: 'Icon-only button with SVG, no aria-label',
      html: `<button onclick="save()"><svg><use href="#icon-save"></use></svg></button>`,
      expectedIssueIds: ['button-icon-no-label'],
      complexity: 'simple',
      expectedDifficulty: 'hard',
    },
    {
      id: 'button-aria-label-mismatch',
      category: 'button',
      violation: 'aria-label-text-mismatch',
      description: 'Button where aria-label differs from visible text (confusing)',
      html: `<button aria-label="Delete item">Remove</button>`,
      expectedIssueIds: ['button-label-mismatch'],
      complexity: 'moderate',
      expectedDifficulty: 'hard',
    },
    {
      id: 'button-disabled-no-state',
      category: 'button',
      violation: 'disabled-no-aria-disabled',
      description: 'Button styled disabled but no aria-disabled',
      html: `<button style="opacity: 0.5; pointer-events: none;">Save</button>`,
      expectedIssueIds: ['button-disabled-no-aria'],
      complexity: 'simple',
      expectedDifficulty: 'hard',
    },

    // ╔══════════════════════════════════════════════════════════╗
    // ║  FORM & INPUT VIOLATIONS                                ║
    // ╚══════════════════════════════════════════════════════════╝

    {
      id: 'input-no-label',
      category: 'form',
      violation: 'input-missing-label',
      description: 'Input field with no <label> element',
      html: `<input type="text" placeholder="Name" />`,
      expectedIssueIds: ['input-label-missing'],
      complexity: 'simple',
      expectedDifficulty: 'easy',
    },
    {
      id: 'input-placeholder-as-label',
      category: 'form',
      violation: 'placeholder-not-label',
      description: 'Input using only placeholder (no <label>)',
      html: `<input type="email" placeholder="your@email.com" />`,
      expectedIssueIds: ['input-placeholder-only'],
      complexity: 'simple',
      expectedDifficulty: 'medium',
    },
    {
      id: 'form-no-submit-label',
      category: 'form',
      violation: 'submit-button-no-name',
      description: 'Form submit button with icon but no accessible name',
      html: `<form><button type="submit"><i class="icon-arrow"></i></button></form>`,
      expectedIssueIds: ['submit-button-no-name'],
      complexity: 'simple',
      expectedDifficulty: 'hard',
    },
    {
      id: 'form-error-no-aria',
      category: 'form',
      violation: 'error-message-no-association',
      description: 'Error message not associated with input (no aria-describedby)',
      html: `<input type="email" id="email" /><span id="error">Email is required</span>`,
      expectedIssueIds: ['error-not-associated'],
      complexity: 'moderate',
      expectedDifficulty: 'hard',
    },

    // ╔══════════════════════════════════════════════════════════╗
    // ║  IMAGE & VISUAL VIOLATIONS                              ║
    // ╚══════════════════════════════════════════════════════════╝

    {
      id: 'image-no-alt',
      category: 'image',
      violation: 'missing-alt-text',
      description: 'Image with no alt attribute',
      html: `<img src="chart.png" />`,
      expectedIssueIds: ['image-alt-missing'],
      complexity: 'simple',
      expectedDifficulty: 'easy',
    },
    {
      id: 'image-empty-alt',
      category: 'image',
      violation: 'empty-alt-text',
      description: 'Image with empty alt (should be fine for decorative, but unclear intent)',
      html: `<img src="divider.png" alt="" role="presentation" />`,
      expectedIssueIds: [],
      complexity: 'simple',
      expectedDifficulty: 'medium',
    },
    {
      id: 'image-link-no-alt',
      category: 'image',
      violation: 'image-link-no-accessible-name',
      description: 'Image inside link with no alt, making link non-accessible',
      html: `<a href="/about"><img src="logo.png" /></a>`,
      expectedIssueIds: ['image-link-no-name'],
      complexity: 'simple',
      expectedDifficulty: 'hard',
    },
    {
      id: 'svg-no-title',
      category: 'image',
      violation: 'svg-missing-title',
      description: 'SVG with no <title> or aria-label',
      html: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" /></svg>`,
      expectedIssueIds: ['svg-no-title'],
      complexity: 'simple',
      expectedDifficulty: 'hard',
    },

    // ╔══════════════════════════════════════════════════════════╗
    // ║  HEADING & STRUCTURE VIOLATIONS                         ║
    // ╚══════════════════════════════════════════════════════════╝

    {
      id: 'heading-skip-level',
      category: 'heading',
      violation: 'heading-level-skip',
      description: 'Heading jumps from h2 directly to h4 (skips h3)',
      html: `<h2>Main Section</h2><h4>Subsection</h4>`,
      expectedIssueIds: ['heading-skip'],
      complexity: 'simple',
      expectedDifficulty: 'medium',
    },
    {
      id: 'heading-styled-as-div',
      category: 'heading',
      violation: 'fake-heading',
      description: 'Div styled to look like heading, but not semantic',
      html: `<div style="font-size: 2em; font-weight: bold;">Important Section</div>`,
      expectedIssueIds: ['fake-heading'],
      complexity: 'simple',
      expectedDifficulty: 'hard',
    },
    {
      id: 'missing-page-title',
      category: 'heading',
      violation: 'no-page-title',
      description: 'Page with no h1 or page <title>',
      html: `<html><head><title></title></head><body><p>Content</p></body></html>`,
      expectedIssueIds: ['no-page-title', 'empty-title'],
      complexity: 'simple',
      expectedDifficulty: 'easy',
    },

    // ╔══════════════════════════════════════════════════════════╗
    // ║  ARIA VIOLATIONS                                         ║
    // ╚══════════════════════════════════════════════════════════╝

    {
      id: 'aria-hidden-focusable',
      category: 'aria',
      violation: 'aria-hidden-but-focusable',
      description: 'Element marked aria-hidden but is focusable',
      html: `<div aria-hidden="true"><button>Hidden but clickable</button></div>`,
      expectedIssueIds: ['aria-hidden-focusable'],
      complexity: 'moderate',
      expectedDifficulty: 'hard',
    },
    {
      id: 'invalid-aria-role',
      category: 'aria',
      violation: 'invalid-role-value',
      description: 'Element with invalid or misspelled ARIA role',
      html: `<div role="buttton">Click me</div>`,
      expectedIssueIds: ['invalid-role'],
      complexity: 'simple',
      expectedDifficulty: 'hard',
    },
    {
      id: 'aria-label-with-image',
      category: 'aria',
      violation: 'aria-label-instead-of-alt',
      description: 'Image using aria-label instead of alt attribute',
      html: `<img src="chart.png" aria-label="Sales chart" />`,
      expectedIssueIds: ['image-alt-missing', 'aria-label-for-image'],
      complexity: 'simple',
      expectedDifficulty: 'hard',
    },
    {
      id: 'aria-live-no-polite',
      category: 'aria',
      violation: 'aria-live-missing-politeness',
      description: 'aria-live region without politeness level',
      html: `<div aria-live>Updates appear here</div>`,
      expectedIssueIds: ['aria-live-no-level'],
      complexity: 'simple',
      expectedDifficulty: 'hard',
    },

    // ╔══════════════════════════════════════════════════════════╗
    // ║  LINK VIOLATIONS                                         ║
    // ╚══════════════════════════════════════════════════════════╝

    {
      id: 'link-non-descriptive',
      category: 'link',
      violation: 'generic-link-text',
      description: 'Link with non-descriptive text ("click here")',
      html: `<a href="/docs">Click here</a>`,
      expectedIssueIds: ['link-text-generic'],
      complexity: 'simple',
      expectedDifficulty: 'medium',
    },
    {
      id: 'link-icon-only',
      category: 'link',
      violation: 'icon-link-no-label',
      description: 'Icon-only link with no aria-label',
      html: `<a href="https://twitter.com" aria-label="Follow on Twitter"><i class="icon-twitter"></i></a>`,
      expectedIssueIds: [],
      complexity: 'simple',
      expectedDifficulty: 'hard',
    },
    {
      id: 'link-opens-new-window',
      category: 'link',
      violation: 'link-opens-new-tab-not-indicated',
      description: 'Link that opens in new tab, but no indication to user',
      html: `<a href="/page" target="_blank">Go to page</a>`,
      expectedIssueIds: ['link-new-tab-no-warning'],
      complexity: 'simple',
      expectedDifficulty: 'hard',
    },

    // ╔══════════════════════════════════════════════════════════╗
    // ║  COMPLEX / BOUNDARY CASES                               ║
    // ╚══════════════════════════════════════════════════════════╝

    {
      id: 'complex-aria-modal',
      category: 'aria',
      violation: 'modal-missing-role-or-focus',
      description: 'Modal-like div missing role="dialog" and aria-modal',
      html: `<div style="position: fixed; z-index: 1000;"><h2>Are you sure?</h2><button>Yes</button><button>No</button></div>`,
      expectedIssueIds: ['modal-no-role', 'modal-no-focus'],
      complexity: 'complex',
      expectedDifficulty: 'hard',
    },
    {
      id: 'complex-nested-buttons',
      category: 'button',
      violation: 'nested-interactive-elements',
      description: 'Button inside another button (invalid nesting)',
      html: `<button><span>Save</span><button>Options</button></button>`,
      expectedIssueIds: ['nested-button'],
      complexity: 'complex',
      expectedDifficulty: 'hard',
    },
    {
      id: 'complex-table-no-headers',
      category: 'table',
      violation: 'table-no-headers',
      description: 'Data table with no <thead>, no scope attributes',
      html: `<table><tr><td>A</td><td>B</td></tr><tr><td>1</td><td>2</td></tr></table>`,
      expectedIssueIds: ['table-no-headers'],
      complexity: 'moderate',
      expectedDifficulty: 'easy',
    },
  ];
}

// ─── Main ─────────────────────────────────────────────────────────────────

function main(): void {
  console.log('');
  console.log(C.bcyan + C.bold + '╔' + '═'.repeat(76) + '╗' + C.reset);
  console.log(C.bcyan + C.bold + '║' + C.reset + '  Generating Adversarial Edge-Case Fixtures'.padEnd(76) + C.bcyan + C.bold + '║' + C.reset);
  console.log(C.bcyan + C.bold + '╚' + '═'.repeat(76) + '╝' + C.reset);
  console.log('');

  const allFixtures = fixtures();

  // Organize by category
  const byCategory = new Map<string, AdversarialFixture[]>();
  for (const fixture of allFixtures) {
    if (!byCategory.has(fixture.category)) {
      byCategory.set(fixture.category, []);
    }
    byCategory.get(fixture.category)!.push(fixture);
  }

  // Print summary
  for (const [category, categoryFixtures] of byCategory) {
    console.log(`  ${C.bold}${category.toUpperCase()}${C.reset} (${categoryFixtures.length} fixture${categoryFixtures.length !== 1 ? 's' : ''})`);
    for (const f of categoryFixtures) {
      const diffCol = f.expectedDifficulty === 'hard' ? C.byellow : f.expectedDifficulty === 'medium' ? C.bcyan : C.bgreen;
      const complexCol = f.complexity === 'complex' ? C.byellow : f.complexity === 'moderate' ? C.bcyan : C.bgreen;
      console.log(`    ${diffCol}[${f.expectedDifficulty.toUpperCase()}]${C.reset} ${f.id.padEnd(25)} ${f.description}`);
    }
    console.log('');
  }

  // Calculate statistics
  const byComplexity = new Map<string, number>();
  const byDifficulty = new Map<string, number>();
  for (const f of allFixtures) {
    byComplexity.set(f.complexity, (byComplexity.get(f.complexity) ?? 0) + 1);
    byDifficulty.set(f.expectedDifficulty, (byDifficulty.get(f.expectedDifficulty) ?? 0) + 1);
  }

  console.log(`  ${C.bold}SUMMARY${C.reset}`);
  console.log(`    Total fixtures: ${allFixtures.length}`);
  console.log(`    By complexity: simple=${byComplexity.get('simple') ?? 0}, moderate=${byComplexity.get('moderate') ?? 0}, complex=${byComplexity.get('complex') ?? 0}`);
  console.log(`    By difficulty: easy=${byDifficulty.get('easy') ?? 0}, medium=${byDifficulty.get('medium') ?? 0}, hard=${byDifficulty.get('hard') ?? 0}`);
  console.log('');

  // Save to JSON
  const outDir = path.join(__dirname, '..', 'preset-benchmark', 'adversarial-fixtures');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  for (const fixture of allFixtures) {
    const htmlFile = path.join(outDir, `${fixture.id}.html`);
    fs.writeFileSync(htmlFile, fixture.html, 'utf8');
  }

  const jsonFile = path.join(__dirname, '..', 'preset-benchmark', 'adversarial-fixtures.json');
  fs.writeFileSync(jsonFile, JSON.stringify(allFixtures, null, 2), 'utf8');

  console.log(`  ${C.bgreen}✓${C.reset} Generated ${allFixtures.length} fixture HTML files in: ${outDir}/`);
  console.log(`  ${C.bgreen}✓${C.reset} Generated metadata JSON: ${path.basename(jsonFile)}`);
  console.log('');
}

main();
