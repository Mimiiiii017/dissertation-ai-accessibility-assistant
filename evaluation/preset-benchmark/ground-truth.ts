/**
 * ground-truth.ts  —  Fixture definitions
 *
 * Each FixtureGroundTruth describes one test file.
 * All current fixtures are "clean" — fully accessible code with zero issues
 * expected.  Every issue emitted by the LLM against a clean fixture is
 * therefore a false positive.
 */

import * as path from 'path';

const F = (subfolder: string, name: string) =>
  path.join(__dirname, 'fixtures', subfolder, name);

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

// ─── HTML ─────────────────────────────────────────────────────────────────

const HTML_CLEAN: FixtureGroundTruth = {
  fixtureId:      'html-clean',
  filePath:       F('html', 'html-clean.html'),
  languageId:     'html',
  isClean:        true,
  expectedIssues: [],
};

// ─── TSX ──────────────────────────────────────────────────────────────────

const TSX_CLEAN: FixtureGroundTruth = {
  fixtureId:      'tsx-clean',
  filePath:       F('tsx', 'tsx-clean.tsx'),
  languageId:     'typescriptreact',
  isClean:        true,
  expectedIssues: [],
};

// ─── CSS ──────────────────────────────────────────────────────────────────

const CSS_CLEAN: FixtureGroundTruth = {
  fixtureId:      'css-clean',
  filePath:       F('css', 'css-clean.css'),
  languageId:     'css',
  isClean:        true,
  expectedIssues: [],
};

// ─── JavaScript ───────────────────────────────────────────────────────────

const JS_CLEAN: FixtureGroundTruth = {
  fixtureId:      'js-clean',
  filePath:       F('js', 'js-clean.js'),
  languageId:     'javascript',
  isClean:        true,
  expectedIssues: [],
};

// ─── Exports ──────────────────────────────────────────────────────────────

export const ALL_FIXTURES: FixtureGroundTruth[] = [
  HTML_CLEAN,
  TSX_CLEAN,
  CSS_CLEAN,
  JS_CLEAN,
];

export const FIXTURE_MAP = new Map<string, FixtureGroundTruth>(
  ALL_FIXTURES.map(f => [f.fixtureId, f])
);
