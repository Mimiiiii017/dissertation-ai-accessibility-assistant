#!/usr/bin/env node
/**
 * test-nasa-tlx-simple.js
 * 
 * Simple Node.js test of NASA-TLX workload prediction.
 * Run: node test-nasa-tlx-simple.js
 */

// ── Example Test Data ────────────────────────────────────────────

const fixtures = {
  'html-clean': [],
  'html-low': [
    { title: 'Image missing alt text' },
    { title: 'Form input missing label' },
  ],
  'html-medium': [
    { title: 'Form input missing aria-label' },
    { title: 'Image alt text too short' },
    { title: 'Table missing caption' },
    { title: 'Link text is generic' },
  ],
  'html-high': [
    { title: 'Multiple images missing alt text' },
    { title: 'Form inputs lack labels' },
    { title: 'Skip links missing' },
    { title: 'Color contrast low' },
    { title: 'Focus indicators removed' },
    { title: 'Keyboard trap in modal' },
    { title: 'Dynamic updates not announced' },
    { title: 'ARIA role misuse' },
  ],
};

const devRatings = {
  'html-clean': {
    md: 10, pd: 5, td: 5, perf: 100, e: 5, f: 5,
  },
  'html-low': {
    md: 25, pd: 15, td: 20, perf: 90, e: 20, f: 15,
  },
  'html-medium': {
    md: 45, pd: 20, td: 38, perf: 75, e: 50, f: 35,
  },
  'html-high': {
    md: 78, pd: 45, td: 68, perf: 55, e: 82, f: 76,
  },
};

// ── NASA-TLX Prediction Function ─────────────────────────────

function predictTlx(fixture, issues) {
  // Simple model: more issues = higher workload
  const issueCount = issues.length;
  const factor = issueCount / 50; // Normalize by "about 50 issues = max"
  
  return {
    md: Math.min(100, 15 + issueCount * 3),
    pd: Math.min(100, 10 + issueCount * 1.5),
    td: Math.min(100, 10 + issueCount * 2),
    perf: Math.max(0, 100 - issueCount * 2),
    e: Math.min(100, 15 + issueCount * 2.5),
    f: Math.min(100, 10 + issueCount * 2)
  };
}

function calcRawTlx(dims) {
  return Math.round(
    (dims.md + dims.pd + dims.td + (100 - dims.perf) + dims.e + dims.f) / 6
  );
}

// ── Run Tests ────────────────────────────────────────────────────

console.log('═'.repeat(70));
console.log('NASA-TLX TEST: Accessibility Issues → Cognitive Load Prediction');
console.log('═'.repeat(70));
console.log();

const results = [];

for (const [fixture, issues] of Object.entries(fixtures)) {
  const predicted = predictTlx(fixture, issues);
  const predictedTlx = calcRawTlx(predicted);
  
  const devRating = devRatings[fixture];
  const actualTlx = calcRawTlx(devRating);
  
  const error = Math.abs(predictedTlx - actualTlx);
  const decision = error < 15 ? 'ACCURATE' : predictedTlx > actualTlx ? 'OVERESTIMATED' : 'UNDERESTIMATED';
  const status = error < 15 ? '✅' : error < 25 ? '⚠️' : '❌';
  
  results.push({ fixture, predictedTlx, actualTlx, error, decision });
  
  console.log(`${status} ${fixture.toUpperCase()}`);
  console.log(`   Issues: ${issues.length}`);
  console.log(`   Predicted TLX: ${predictedTlx}/100 (MD:${predicted.md} | PD:${predicted.pd} | TD:${predicted.td} | E:${predicted.e} | F:${predicted.f})`);
  console.log(`   Actual TLX:    ${actualTlx}/100 (from mock dev rating)`);
  console.log(`   Error: ${error.toFixed(1)} → ${decision}`);
  console.log();
}

// ── Summary ──────────────────────────────────────────────────

console.log('═'.repeat(70));
console.log('SUMMARY');
console.log('─'.repeat(70));

const accurate = results.filter(r => r.decision === 'ACCURATE').length;
const meanError = results.reduce((sum, r) => sum + r.error, 0) / results.length;
const predicteds = results.map(r => r.predictedTlx);
const actuals = results.map(r => r.actualTlx);

const avgPred = predicteds.reduce((a, b) => a + b, 0) / predicteds.length;
const avgActual = actuals.reduce((a, b) => a + b, 0) / actuals.length;

console.log(`Accurate predictions: ${accurate}/${results.length}`);
console.log(`Mean error: ±${meanError.toFixed(1)} points`);
console.log(`Avg Predicted TLX: ${avgPred.toFixed(1)}`);
console.log(`Avg Actual TLX:    ${avgActual.toFixed(1)}`);

// Pearson correlation
const covXY = results.reduce((sum, r) => sum + (r.predictedTlx - avgPred) * (r.actualTlx - avgActual), 0);
const stdX = Math.sqrt(results.reduce((sum, r) => sum + (r.predictedTlx - avgPred) ** 2, 0));
const stdY = Math.sqrt(results.reduce((sum, r) => sum + (r.actualTlx - avgActual) ** 2, 0));
const rPearson = covXY / (stdX * stdY);

console.log(`Pearson r: ${rPearson.toFixed(3)} (${rPearson > 0.7 ? 'STRONG' : rPearson > 0.5 ? 'MODERATE' : 'WEAK'} correlation)`);

console.log();
console.log('═'.repeat(70));
console.log('KEY INSIGHT');
console.log('═'.repeat(70));
console.log(`
NASA-TLX is NOT HTML-specific. It's a general cognitive workload metric.

This test shows:
  ✓ Accessibility issues (from HTML/CSS/JS/TSX fixtures) map to 6 workload dimensions
  ✓ More issues → higher workload (lower developer performance perception)
  ✓ Prediction accuracy: Pearson r ≈ ${rPearson.toFixed(2)}

For dissertation user study:
  1. Use kimi-k2.5 to detect issues in all 16 fixtures (F1 scores)
  2. Predict TLX from detected issues (using this harness)
  3. Get ~10 developers to rate NASA-TLX while using your extension
  4. Correlate: F1 detection accuracy ↔ developer TLX cognitive load
  5. Hypothesis: Better detection (high F1) → Lower developer workload (low TLX)

Model accuracy here: ${rPearson.toFixed(2)} correlation
  - If Pearson r > 0.7: Model validated (ready for dissertation)
  - If r < 0.5: Needs refinement (adjust barrier weights)
`);
console.log('═'.repeat(70));
