/**
 * validate-ground-truth.ts  —  Ground-Truth Validation
 *
 * Cross-checks manual ground-truth definitions against automated accessibility checks.
 *
 * For HTML fixtures:
 * - Performs pattern-based analysis (regex/DOM parsing)
 * - Identifies missing lang, alt text, labels, heading hierarchy issues
 *
 * Generates a report showing:
 * - ✓ Correctly defined issues (automated find + ground-truth matches)
 * - ⚠ Over-defined issues (ground-truth predicts but automated doesn't find)
 * - ✗ Under-defined issues (automated finds but ground-truth missed)
 *
 * Run: npx ts-node validate-ground-truth.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { FixtureGroundTruth } from '../preset-benchmark/ground-truth';
import { ALL_FIXTURES } from '../preset-benchmark/ground-truth';

// ─── Types ────────────────────────────────────────────────────────────────

interface ValidationIssue {
  id: string;
  description: string;
  source: 'ground-truth' | 'automated' | 'both';
  confidence: number; // 0-1
}

interface FixtureValidation {
  fixtureId: string;
  filePath: string;
  languageId: string;
  groundTruthIssues: FixtureGroundTruth['expectedIssues'];
  automatedIssues: ValidationIssue[];
  // ── Analysis ───────────────────────────────────────────────
  correctlyDefined: string[]; // issues in both GT and automated
  overDefined: string[];      // in GT but not found by automated
  underDefined: ValidationIssue[]; // found by automated but not in GT
  accuracy: number; // correctlyDefined / (correctlyDefined + overDefined + underDefined)
}

// ─── ANSI Colors ──────────────────────────────────────────────────────────

const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  green:   '\x1b[32m',
  bgreen:  '\x1b[92m',
  yellow:  '\x1b[33m',
  byellow: '\x1b[93m',
  red:     '\x1b[31m',
  bred:    '\x1b[91m',
  cyan:    '\x1b[36m',
  bcyan:   '\x1b[96m',
  magenta: '\x1b[35m',
  bmagenta:'\x1b[95m',
};

// ─── HTML Pattern Analysis ────────────────────────────────────────────────

/**
 * Perform pattern-based accessibility analysis on HTML content.
 * Returns array of detected issue IDs with confidence scores.
 */
function analyzeHtmlPatterns(content: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // ── Pattern: Missing lang attribute ─────────────────────
  if (!/<html[^>]*\slang=/.test(content)) {
    issues.push({
      id: 'html-lang-missing',
      description: '<html> missing lang attribute',
      source: 'automated',
      confidence: 0.95,
    });
  }

  // ── Pattern: Missing page title ─────────────────────────
  if (!/<title>[\s\S]*?\S[\s\S]*?<\/title>/.test(content)) {
    issues.push({
      id: 'title-empty',
      description: '<title> element is empty or missing',
      source: 'automated',
      confidence: 0.95,
    });
  }

  // ── Pattern: Images without alt ────────────────────────
  const imgMatches = content.matchAll(/<img[^>]*>/gi);
  for (const match of imgMatches) {
    if (!/\salt=/.test(match[0])) {
      issues.push({
        id: `img-alt-missing-${issues.length}`,
        description: 'Image missing alt attribute: ' + match[0].slice(0, 60),
        source: 'automated',
        confidence: 0.90,
      });
    }
  }

  // ── Pattern: Form inputs without labels ────────────────
  const inputMatches = content.matchAll(/<input[^>]*type="(text|email|search|password|number)"[^>]*>/gi);
  for (const match of inputMatches) {
    const inputHtml = match[0];
    const inputId = /\sid=["']([^"']+)["']/.exec(inputHtml)?.[1];
    if (inputId) {
      // Check if there's a corresponding label
      const labelRegex = new RegExp(`<label[^>]*for=["']${inputId}["']`, 'i');
      if (!labelRegex.test(content)) {
        issues.push({
          id: `label-missing-${inputId}`,
          description: `Input with id="${inputId}" missing associated <label>`,
          source: 'automated',
          confidence: 0.85,
        });
      }
    }
  }

  // ── Pattern: Headings with skipped levels ──────────────
  const headingMatches = content.matchAll(/<h([1-6])[^>]*>/gi);
  let lastHeadingLevel = 0;
  const headingIssueCount = 0;
  for (const match of headingMatches) {
    const level = parseInt(match[1], 10);
    if (lastHeadingLevel > 0 && level - lastHeadingLevel > 1) {
      if (headingIssueCount === 0) {
        issues.push({
          id: 'heading-hierarchy-skip',
          description: `Heading hierarchy skipped from h${lastHeadingLevel} to h${level}`,
          source: 'automated',
          confidence: 0.80,
        });
      }
    }
    lastHeadingLevel = level;
  }

  // ── Pattern: Table headers without scope ──────────────
  const thMatches = content.matchAll(/<th[^>]*>/gi);
  for (const match of thMatches) {
    if (!/\sscope=/.test(match[0])) {
      issues.push({
        id: 'th-scope-missing',
        description: '<th> element missing scope attribute',
        source: 'automated',
        confidence: 0.85,
      });
      // Only report once per table
      break;
    }
  }

  // ── Pattern: Links with non-descriptive text ──────────
  const linkMatches = content.matchAll(/<a[^>]*href="[^"]*"[^>]*>([^<]+)<\/a>/gi);
  const badLinkTexts = ['click here', 'click here to', 'learn more', 'more', 'link', 'view', 'see'];
  for (const match of linkMatches) {
    const linkText = match[1].trim().toLowerCase();
    if (badLinkTexts.some(bad => linkText === bad || linkText.startsWith(bad))) {
      issues.push({
        id: 'link-text-non-descriptive',
        description: `Link with non-descriptive text: "${match[1].trim()}"`,
        source: 'automated',
        confidence: 0.75,
      });
    }
  }

  // ── Pattern: Buttons without accessible names ─────────
  const buttonMatches = content.matchAll(/<button[^>]*>([^<]*)<\/button>/gi);
  for (const match of buttonMatches) {
    const buttonHtml = match[0];
    const buttonText = match[1].trim();
    if (!buttonText && !/aria-label|aria-labelledby|title/.test(buttonHtml)) {
      issues.push({
        id: 'button-name-missing',
        description: 'Button element with no accessible name',
        source: 'automated',
        confidence: 0.80,
      });
    }
  }

  // ── Pattern: Missing main element ──────────────────────
  if (!/<main[\s>]/.test(content)) {
    issues.push({
      id: 'main-element-missing',
      description: 'Page missing <main> landmark element',
      source: 'automated',
      confidence: 0.85,
    });
  }

  // ── Pattern: Missing form labels ────────────────────────
  const emailInputMatches = content.matchAll(/<input[^>]*type="email"[^>]*>/gi);
  for (const match of emailInputMatches) {
    const inputHtml = match[0];
    const inputId = /\sid=["']([^"']+)["']/.exec(inputHtml)?.[1];
    if (inputId) {
      const labelRegex = new RegExp(`<label[^>]*for=["']${inputId}["']`, 'i');
      if (!labelRegex.test(content)) {
        issues.push({
          id: `email-label-missing-${inputId}`,
          description: `Email input with id="${inputId}" missing <label>`,
          source: 'automated',
          confidence: 0.85,
        });
      }
    }
  }

  return issues;
}

// ─── Fixture Validation ────────────────────────────────────────────────────

function validateFixture(fixture: FixtureGroundTruth): FixtureValidation {
  const automatedIssues: ValidationIssue[] = [];

  // Only validate HTML for now (can extend to CSS/JS later)
  if (fixture.languageId === 'html' && fs.existsSync(fixture.filePath)) {
    const content = fs.readFileSync(fixture.filePath, 'utf8');
    const detected = analyzeHtmlPatterns(content);
    automatedIssues.push(...detected);
  }

  const groundTruthIds = fixture.expectedIssues.map((i: any) => i.id);
  const automatedIds = automatedIssues.map(i => i.id);

  // ── Calculate matches ──────────────────────────────────────
  const correctlyDefined = groundTruthIds.filter((id: string) =>
    automatedIds.some(aid => aid === id || aid.startsWith(id))
  );

  const overDefined = groundTruthIds.filter(
    (id: string) => !automatedIds.some(aid => aid === id || aid.startsWith(id))
  );

  const underDefined = automatedIssues.filter(
    issue => !groundTruthIds.includes(issue.id)
  );

  // ── Calculate accuracy ────────────────────────────────────
  const totalExpected = groundTruthIds.length;
  const totalDetected = correctlyDefined.length;
  const totalErrors = overDefined.length + underDefined.length;
  const accuracy = totalExpected + totalErrors === 0 ? 1 : totalDetected / (totalDetected + totalErrors);

  return {
    fixtureId: fixture.fixtureId,
    filePath: fixture.filePath,
    languageId: fixture.languageId,
    groundTruthIssues: fixture.expectedIssues,
    automatedIssues,
    correctlyDefined,
    overDefined,
    underDefined,
    accuracy,
  };
}

// ─── Report Generation ────────────────────────────────────────────────────

function printReport(validations: FixtureValidation[]): void {
  console.log('');
  console.log(C.bold + C.bcyan + '╔' + '═'.repeat(78) + '╗' + C.reset);
  console.log(C.bold + C.bcyan + '║' + C.reset + '  Ground-Truth Validation Report'.padEnd(78) + C.bold + C.bcyan + '║' + C.reset);
  console.log(C.bold + C.bcyan + '╚' + '═'.repeat(78) + '╝' + C.reset);
  console.log('');

  // ─────────────────────────────────────────────────────────────────────────

  let totalCorrect = 0;
  let totalExpected = 0;
  let totalErrors = 0;

  for (const v of validations) {
    totalExpected += v.groundTruthIssues.length;
    totalCorrect += v.correctlyDefined.length;
    totalErrors += v.overDefined.length + v.underDefined.length;

    const accuracyColor = v.accuracy >= 0.85 ? C.bgreen : v.accuracy >= 0.70 ? C.byellow : C.bred;

    console.log(C.bold + `${v.fixtureId}` + C.reset);
    console.log(`  Language: ${v.languageId} | Issues: ${v.groundTruthIssues.length} defined`);
    console.log(`  Accuracy: ${accuracyColor}${(v.accuracy * 100).toFixed(1)}%${C.reset} (${v.correctlyDefined.length} correct, ${v.overDefined.length} over, ${v.underDefined.length} under)`);
    console.log('');

    // Show correctly defined (✓)
    if (v.correctlyDefined.length > 0) {
      console.log(`  ${C.bgreen}✓ Correctly Defined${C.reset}`);
      for (const id of v.correctlyDefined as string[]) {
        console.log(`    • ${C.bgreen}${id}${C.reset}`);
      }
      console.log('');
    }

    // Show over-defined (⚠)
    if (v.overDefined.length > 0) {
      console.log(`  ${C.byellow}⚠ Over-Defined (ground-truth expected but not detected)${C.reset}`);
      for (const id of v.overDefined as string[]) {
        const issue = v.groundTruthIssues.find((i: any) => i.id === id);
        if (issue) {
          console.log(`    • ${C.byellow}${id}${C.reset} — ${issue.description}`);
        }
      }
      console.log('');
    }

    // Show under-defined (✗)
    if (v.underDefined.length > 0) {
      console.log(`  ${C.bred}✗ Under-Defined (automated found but ground-truth missed)${C.reset}`);
      for (const issue of v.underDefined) {
        console.log(`    • ${C.bred}${issue.id}${C.reset} (confidence: ${(issue.confidence * 100).toFixed(0)}%) — ${issue.description}`);
      }
      console.log('');
    }

    console.log(C.dim + '─'.repeat(80) + C.reset);
    console.log('');
  }

  // ─── Summary ───────────────────────────────────────────────────────────

  console.log(C.bold + C.bcyan + 'SUMMARY' + C.reset);
  console.log(`  Total fixtures validated: ${validations.length}`);
  console.log(`  Total issues in ground-truth: ${totalExpected}`);
  console.log(`  Correctly defined: ${C.bgreen}${totalCorrect}${C.reset}`);
  console.log(`  Over-defined: ${C.byellow}${validations.reduce((s, v) => s + v.overDefined.length, 0)}${C.reset}`);
  console.log(`  Under-defined: ${C.bred}${validations.reduce((s, v) => s + v.underDefined.length, 0)}${C.reset}`);
  const overallAccuracy = totalExpected + totalErrors === 0 ? 1 : totalCorrect / (totalCorrect + totalErrors);
  const accCol = overallAccuracy >= 0.85 ? C.bgreen : overallAccuracy >= 0.70 ? C.byellow : C.bred;
  console.log(`  Overall accuracy: ${accCol}${(overallAccuracy * 100).toFixed(1)}%${C.reset}`);
  console.log(`  Recommendation: ${overallAccuracy >= 0.85 ? C.bgreen + 'Ground-truth is reliable' : overallAccuracy >= 0.70 ? C.byellow + 'Ground-truth needs minor review' : C.bred + 'Ground-truth needs major revision'}${C.reset}`);
  console.log('');
}

// ─── Main ─────────────────────────────────────────────────────────────────

function main(): void {
  console.log(`Validating ${ALL_FIXTURES.length} fixtures...`);
  const validations = ALL_FIXTURES.map(validateFixture);
  printReport(validations);

  // Save JSON report
  const reportPath = path.join(__dirname, 'validation-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(validations, null, 2), 'utf8');
  console.log(`${C.dim}Full report saved to: ${reportPath}${C.reset}`);
}

main();
