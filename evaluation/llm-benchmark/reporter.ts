/**
 * reporter.ts  —  LLM Benchmark Reporter
 *
 * Renders three views:
 *   1. OVERALL RANKING — composite score (80 % F1 + 20 % speed), plus raw metrics
 *   2. DETAIL BY FIXTURE — how each model performed on each file
 *   3. FALSE POSITIVE ANALYSIS — what each model hallucinated on clean files
 *
 * Also writes JSON (full data) and CSV (summary) to disk.
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  ModelRunResult,
  ModelAggregateStats,
  aggregateByModel,
  applyCompositeScores,
  percentile,
  shortName,
} from './benchmark';
import { AnalysisPresetId, ANALYSIS_PRESETS } from
  '../../extension/ai-accessibility-assistant/src/utils/llm/ollama';

// ─── ANSI helpers ─────────────────────────────────────────────────────────

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  red:    '\x1b[31m',
  cyan:   '\x1b[36m',
  magenta:'\x1b[35m',
  white:  '\x1b[37m',
};

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function ms(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${Math.round(n)}ms`;
}

function pad(s: string | number, w: number, left = false): string {
  const str = String(s);
  const diff = w - str.length;
  if (diff <= 0) return str;
  return left ? str + ' '.repeat(diff) : ' '.repeat(diff) + str;
}

function hr(char = '─', width = 90): string {
  return char.repeat(width);
}

const MEDALS = ['🥇', '🥈', '🥉'];
function medal(rank: number): string {
  return MEDALS[rank] ?? ` ${rank + 1}.`;
}

function scoreBar(score: number, width = 20): string {
  const filled = Math.round(score * width);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  const col = score >= 0.7 ? C.green : score >= 0.5 ? C.yellow : C.red;
  return col + bar + C.reset;
}

// ─── Main report ──────────────────────────────────────────────────────────

export function printReport(
  results: ModelRunResult[],
  models: string[],
  presetId: AnalysisPresetId
): void {
  const rawStats = models.map(m => aggregateByModel(results, m, presetId));
  const stats = applyCompositeScores(rawStats);
  const ranked = [...stats].sort((a, b) => b.compositeScore - a.compositeScore);
  const presetLabel = ANALYSIS_PRESETS[presetId]?.label ?? presetId;

  // ── Header ────────────────────────────────────────────────────────
  console.log('');
  console.log(C.bold + hr('═') + C.reset);
  console.log(C.bold + '  LLM MODEL BENCHMARK — Accessibility Auditing Quality' + C.reset);
  console.log(`  Preset:  ${C.cyan}${presetLabel}${C.reset}  (fixed — only model differs)`);
  console.log(`  Models:  ${models.length}`);
  const runsPerCombo = results.filter(
    r => r.modelId === models[0] && r.fixtureId === results[0]?.fixtureId
  ).length;
  console.log(`  Runs per combination: ${runsPerCombo}`);
  console.log(`  Composite score = 80% F1  +  20% speed (higher = better)`);
  console.log(C.bold + hr('═') + C.reset);
  console.log('');

  // ── Overall ranking ───────────────────────────────────────────────
  console.log(C.bold + '  OVERALL RANKING' + C.reset);
  console.log('');

  const hdr = [
    pad('',           4),
    pad('Model',      30, true),
    pad('Score',      7),
    pad('',          20),   // bar
    pad('F1',         7),
    pad('Prec',       7),
    pad('Recall',     8),
    pad('TP', 4),
    pad('FN', 4),
    pad('FP', 4),
    pad('AvgTime',    9),
    pad('Errs',       5),
  ].join(' ');
  console.log('  ' + C.dim + hdr + C.reset);
  console.log('  ' + hr('─', hdr.length));

  for (let i = 0; i < ranked.length; i++) {
    const s = ranked[i];
    const name = shortName(s.modelId);
    const f1Col = s.avgF1 >= 0.7 ? C.green : s.avgF1 >= 0.5 ? C.yellow : C.red;
    const row = [
      pad(medal(i), 4),
      pad(name, 30, true),
      pad(pct(s.compositeScore), 7),
      scoreBar(s.compositeScore),
      f1Col + pad(pct(s.avgF1), 7) + C.reset,
      pad(pct(s.avgPrecision), 7),
      pad(pct(s.avgRecall), 8),
      pad(s.totalTP, 4),
      pad(s.totalFN, 4),
      pad(s.totalFP, 4),
      pad(ms(s.avgResponseMs), 9),
      pad(s.errorCount, 5),
    ].join(' ');
    console.log('  ' + row);
  }

  // ── Recommendation ────────────────────────────────────────────────
  console.log('');
  const best         = ranked[0];
  const bestF1       = ranked.reduce((a, b) => a.avgF1       > b.avgF1       ? a : b);
  const bestAcc      = ranked.reduce((a, b) => a.avgAccuracy > b.avgAccuracy ? a : b);
  const bestMCC      = ranked.reduce((a, b) => a.avgMCC      > b.avgMCC      ? a : b);
  const bestSpeed    = ranked.filter(s => s.avgResponseMs > 0)
    .reduce((a, b) => a.avgResponseMs < b.avgResponseMs ? a : b);
  const fewestFP     = ranked.reduce((a, b) => a.totalFP < b.totalFP ? a : b);
  const fewestFN     = ranked.reduce((a, b) => a.totalFN < b.totalFN ? a : b);
  const mostConsist  = ranked.filter(s => s.f1StdDev >= 0)
    .reduce((a, b) => a.f1StdDev < b.f1StdDev ? a : b);

  console.log(C.bold + '  RECOMMENDATION' + C.reset);
  console.log(`  Best overall (composite) : ${C.green}${C.bold}${shortName(best.modelId)}${C.reset}  [composite=${pct(best.compositeScore)}]`);
  if (bestF1.modelId  !== best.modelId)
    console.log(`  Best F1 (most accurate)  : ${C.cyan}${shortName(bestF1.modelId)}${C.reset}  [F1=${pct(bestF1.avgF1)}]`);
  if (bestAcc.modelId !== best.modelId)
    console.log(`  Best accuracy            : ${C.cyan}${shortName(bestAcc.modelId)}${C.reset}  [Acc=${pct(bestAcc.avgAccuracy)}]`);
  if (bestMCC.modelId !== best.modelId)
    console.log(`  Best MCC                 : ${C.cyan}${shortName(bestMCC.modelId)}${C.reset}  [MCC=${bestMCC.avgMCC.toFixed(3)}]`);
  if (bestSpeed.modelId !== best.modelId)
    console.log(`  Fastest                  : ${C.cyan}${shortName(bestSpeed.modelId)}${C.reset}  [${ms(bestSpeed.avgResponseMs)} avg / p95=${ms(bestSpeed.p95ResponseMs)}]`);
  if (fewestFP.modelId !== best.modelId)
    console.log(`  Fewest false positives   : ${C.cyan}${shortName(fewestFP.modelId)}${C.reset}  [${fewestFP.totalFP} FP total]`);
  if (fewestFN.modelId !== best.modelId)
    console.log(`  Fewest missed issues     : ${C.cyan}${shortName(fewestFN.modelId)}${C.reset}  [${fewestFN.totalFN} FN total]`);
  if (mostConsist.f1StdDev > 0)
    console.log(`  Most consistent (F1 σ)   : ${C.cyan}${shortName(mostConsist.modelId)}${C.reset}  [σ=${mostConsist.f1StdDev.toFixed(3)}]`);

  // ── Extended confusion-matrix metrics ────────────────────────────
  console.log('');
  console.log(C.bold + '  EXTENDED METRICS' + C.reset);
  console.log(`  ${C.dim}TP/TN/FP/FN are concept-level counts across all fixtures and runs${C.reset}`);
  console.log('');

  const ehdr = [
    pad('',           4),
    pad('Model',      30, true),
    pad('Acc',         7),
    pad('BalAcc',      8),
    pad('MCC',         7),
    pad('Specif',      8),
    pad('NPV',         7),
    pad('TP',  5),  pad('TN',  6),  pad('FP',  5),  pad('FN',  5),
  ].join(' ');
  console.log('  ' + C.dim + ehdr + C.reset);
  console.log('  ' + hr('─', ehdr.length));

  for (let i = 0; i < ranked.length; i++) {
    const s = ranked[i];
    const accCol = s.avgAccuracy >= 0.8 ? C.green : s.avgAccuracy >= 0.6 ? C.yellow : C.red;
    const mccCol = s.avgMCC     >= 0.6 ? C.green : s.avgMCC     >= 0.3 ? C.yellow : C.red;
    const erow = [
      pad(medal(i), 4),
      pad(shortName(s.modelId), 30, true),
      accCol + pad(pct(s.avgAccuracy),         7) + C.reset,
      pad(pct(s.avgBalancedAccuracy),          8),
      mccCol + pad(s.avgMCC.toFixed(3),         7) + C.reset,
      pad(pct(s.avgSpecificity),               8),
      pad(pct(s.avgNPV),                       7),
      pad(s.totalTP, 5),
      pad(s.totalTN, 6),
      pad(s.totalFP, 5),
      pad(s.totalFN, 5),
    ].join(' ');
    console.log('  ' + erow);
  }

  // ── Response time analysis ────────────────────────────────────────
  console.log('');
  console.log(C.bold + '  RESPONSE TIME ANALYSIS' + C.reset);
  console.log(`  ${C.dim}Avg / Median (p50) / 95th-percentile across all successful runs${C.reset}`);
  console.log('');

  const thdr = [
    pad('',           4),
    pad('Model',      30, true),
    pad('Avg',         9),
    pad('p50',         9),
    pad('p95',         9),
    pad('Issues/run',  11),
  ].join(' ');
  console.log('  ' + C.dim + thdr + C.reset);
  console.log('  ' + hr('─', thdr.length));

  const bySpeed = [...ranked].sort((a, b) => a.avgResponseMs - b.avgResponseMs);
  for (let i = 0; i < bySpeed.length; i++) {
    const s = bySpeed[i];
    const speedCol = i === 0 ? C.green : i === bySpeed.length - 1 ? C.red : C.reset;
    const trow = [
      pad(` ${i + 1}.`, 4),
      pad(shortName(s.modelId), 30, true),
      speedCol + pad(ms(s.avgResponseMs),  9) + C.reset,
      pad(ms(s.p50ResponseMs),  9),
      pad(ms(s.p95ResponseMs),  9),
      pad(s.avgIssuesFound.toFixed(1),    11),
    ].join(' ');
    console.log('  ' + trow);
  }

  // ── Consistency analysis (only meaningful when runs > 1) ─────────
  const hasMultipleRuns = results.some(
    r => results.filter(x => x.modelId === r.modelId && x.fixtureId === r.fixtureId).length > 1
  );
  if (hasMultipleRuns) {
    console.log('');
    console.log(C.bold + '  CONSISTENCY ANALYSIS' + C.reset);
    console.log(`  ${C.dim}F1 standard deviation across repeated runs — lower σ means more reproducible${C.reset}`);
    console.log('');

    const chdr = [
      pad('',           4),
      pad('Model',      30, true),
      pad('F1 σ',        7),
      pad('',           20),  // bar
      pad('Min F1',      8),
      pad('Max F1',      8),
    ].join(' ');
    console.log('  ' + C.dim + chdr + C.reset);
    console.log('  ' + hr('─', chdr.length));

    const byConsistency = [...ranked].sort((a, b) => a.f1StdDev - b.f1StdDev);
    for (let i = 0; i < byConsistency.length; i++) {
      const s   = byConsistency[i];
      const runs = results.filter(r => r.modelId === s.modelId && !r.errorOccurred);
      const f1s  = runs.map(r => r.f1);
      const minF1 = f1s.length ? Math.min(...f1s) : 0;
      const maxF1 = f1s.length ? Math.max(...f1s) : 0;
      // Invert bar: full bar = perfectly consistent (σ = 0)
      const consistScore = 1 - Math.min(s.f1StdDev * 4, 1);
      const cCol = s.f1StdDev <= 0.05 ? C.green : s.f1StdDev <= 0.15 ? C.yellow : C.red;
      const crow = [
        pad(` ${i + 1}.`, 4),
        pad(shortName(s.modelId), 30, true),
        cCol + pad(s.f1StdDev.toFixed(3), 7) + C.reset,
        scoreBar(consistScore),
        pad(pct(minF1),  8),
        pad(pct(maxF1),  8),
      ].join(' ');
      console.log('  ' + crow);
    }
  }

  // ── Per-fixture breakdown ─────────────────────────────────────────
  const fixtureIds = [...new Set(results.map(r => r.fixtureId))];
  console.log('');
  console.log(C.bold + '  DETAIL BY FIXTURE' + C.reset);

  for (const fixtureId of fixtureIds) {
    const fixResults = results.filter(r => r.fixtureId === fixtureId);
    const firstResult = fixResults[0];
    const isClean = firstResult.tp === 0 && firstResult.fn === 0 && firstResult.fp >= 0;
    // Better: check if fixture is clean by seeing if fn was 0 across all models even when 0 TP
    const cleanLabel = firstResult && firstResult.missedIds.length === 0 && firstResult.fn === 0 &&
                       !firstResult.issuesFound.length
      ? ` ${C.dim}(false-positive test)${C.reset}`
      : '';

    console.log('');
    console.log(`  ${C.cyan}${C.bold}${fixtureId}${C.reset}${cleanLabel}`);

    const fHdr = [
      pad('Model',     28, true),
      pad('Found',     6),
      pad('TP',  4),
      pad('TN',  5),
      pad('FP',  4),
      pad('FN',  4),
      pad('F1%',   7),
      pad('Acc%',  6),
      pad('MCC',   6),
      pad('Time',  9),
      'Notes',
    ].join('  ');
    console.log('  ' + C.dim + fHdr + C.reset);
    console.log('  ' + hr('─', 110));

    // Sort by F1 descending for this fixture
    const modelOrder = models
      .map(m => {
        const runs = fixResults.filter(r => r.modelId === m);
        const avgF1 = runs.length
          ? runs.reduce((s, r) => s + r.f1, 0) / runs.length
          : 0;
        return { modelId: m, avgF1 };
      })
      .sort((a, b) => b.avgF1 - a.avgF1);

    for (const { modelId } of modelOrder) {
      const runs = fixResults.filter(r => r.modelId === modelId && !r.errorOccurred);
      if (runs.length === 0) {
        const errRun = fixResults.find(r => r.modelId === modelId && r.errorOccurred);
        const row = [
          pad(shortName(modelId), 28, true),
          pad('-', 6),
          pad('-', 4),
          pad('-', 5),
          pad('-', 4),
          pad('-', 4),
          C.red + pad('-', 7) + C.reset,
          pad('-', 6),
          pad('-', 6),
          pad('-', 9),
          `ERROR: ${errRun?.errorMessage ?? 'unknown'}`,
        ].join('  ');
        console.log('  ' + row);
        continue;
      }

      const avgF1   = runs.reduce((s, r) => s + r.f1,           0) / runs.length;
      const avgTP   = runs.reduce((s, r) => s + r.tp,           0) / runs.length;
      const avgTN   = runs.reduce((s, r) => s + r.tn,           0) / runs.length;
      const avgFN   = runs.reduce((s, r) => s + r.fn,           0) / runs.length;
      const avgFP   = runs.reduce((s, r) => s + r.fp,           0) / runs.length;
      const avgAcc  = runs.reduce((s, r) => s + r.accuracy,     0) / runs.length;
      const avgMCC  = runs.reduce((s, r) => s + r.mcc,          0) / runs.length;
      const avgMs   = runs.reduce((s, r) => s + r.responseTimeMs, 0) / runs.length;
      const found   = runs.reduce((s, r) => s + r.issuesFound.length, 0) / runs.length;

      const firstRun = runs[0];
      let notes = '';
      if (firstRun.missedIds.length)  notes += `MISS:[${firstRun.missedIds.join(', ')}] `;
      if (firstRun.fpTitles.length)   notes += `FP:[${firstRun.fpTitles.slice(0, 2).join(' | ')}${firstRun.fpTitles.length > 2 ? ` +${firstRun.fpTitles.length - 2} more` : ''}]`;
      if (!notes && avgFP === 0 && avgFN === 0) notes = `${C.green}✓ perfect${C.reset}`;

      const f1Col  = avgF1  >= 0.8 ? C.green : avgF1  >= 0.5 ? C.yellow : C.red;
      const accCol = avgAcc >= 0.8 ? C.green : avgAcc >= 0.6 ? C.yellow : C.red;
      const mccCol = avgMCC >= 0.6 ? C.green : avgMCC >= 0.3 ? C.yellow : C.red;
      const row = [
        pad(shortName(modelId), 28, true),
        pad(Math.round(found),   6),
        pad(avgTP.toFixed(1),    4),
        pad(avgTN.toFixed(1),    5),
        pad(avgFP.toFixed(1),    4),
        pad(avgFN.toFixed(1),    4),
        f1Col  + pad(pct(avgF1),      7) + C.reset,
        accCol + pad(pct(avgAcc),     6) + C.reset,
        mccCol + pad(avgMCC.toFixed(2), 6) + C.reset,
        pad(ms(avgMs),           9),
        notes,
      ].join('  ');
      console.log('  ' + row);
    }
  }

  // ── False positive analysis ────────────────────────────────────────
  const fpResults = results.filter(r => r.fp > 0 && !r.errorOccurred);
  console.log('');
  console.log(C.bold + '  FALSE POSITIVE ANALYSIS' + C.reset);
  console.log(`  ${C.dim}(issues found in "clean" fixtures — every issue here is a hallucination)${C.reset}`);
  console.log('');

  for (const modelId of models) {
    const modelFPs = fpResults.filter(r => r.modelId === modelId);
    const name = shortName(modelId);
    if (modelFPs.length === 0) {
      console.log(`  ${C.green}✓ ${name}: zero false positives on all clean fixtures${C.reset}`);
      continue;
    }
    const totalFP = modelFPs.reduce((s, r) => s + r.fp, 0);
    console.log(`  ${C.yellow}${name}${C.reset}  —  ${C.red}${totalFP} false positive(s)${C.reset}:`);
    for (const r of modelFPs) {
      for (const title of r.fpTitles) {
        console.log(`    ${C.red}•${C.reset} [${r.fixtureId}] "${title}"`);
      }
    }
  }

  console.log('');
  console.log(hr());
}

// ─── Save JSON ────────────────────────────────────────────────────────────

export function saveJson(results: ModelRunResult[], outDir: string): string {
  fs.mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(outDir, `llm-benchmark-${ts}.json`);
  // Strip rawResponse to keep the file manageable — preserve everything else
  const stripped = results.map(r => ({ ...r, rawResponse: undefined }));
  fs.writeFileSync(filePath, JSON.stringify(stripped, null, 2), 'utf8');
  return filePath;
}

// ─── Save CSV ─────────────────────────────────────────────────────────────

export function saveCsv(
  results: ModelRunResult[],
  models: string[],
  outDir: string
): string {
  fs.mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(outDir, `llm-summary-${ts}.csv`);

  // Per-run detail rows
  const perRunHeader = [
    'model', 'short_name', 'fixture', 'preset', 'run',
    'issues_found',
    'tp', 'tn', 'fp', 'fn',
    'precision', 'recall', 'specificity', 'npv',
    'f1', 'accuracy', 'balanced_accuracy', 'mcc',
    'response_ms', 'error',
  ];
  const rows: string[][] = [perRunHeader];

  for (const r of results) {
    rows.push([
      r.modelId,
      shortName(r.modelId),
      r.fixtureId,
      r.presetId,
      String(r.runIndex),
      String(r.issuesFound.length),
      String(r.tp),
      String(r.tn),
      String(r.fp),
      String(r.fn),
      r.precision.toFixed(4),
      r.recall.toFixed(4),
      r.specificity.toFixed(4),
      r.npv.toFixed(4),
      r.f1.toFixed(4),
      r.accuracy.toFixed(4),
      r.balancedAccuracy.toFixed(4),
      r.mcc.toFixed(4),
      String(r.responseTimeMs),
      r.errorOccurred ? 'true' : 'false',
    ]);
  }

  // Aggregate rows
  rows.push([]);
  rows.push(['# AGGREGATE BY MODEL']);
  rows.push([
    'model', 'short_name', 'preset',
    'total_tp', 'total_tn', 'total_fp', 'total_fn',
    'avg_precision', 'avg_recall', 'avg_specificity', 'avg_npv',
    'avg_f1', 'avg_accuracy', 'avg_balanced_accuracy', 'avg_mcc',
    'avg_issues_found',
    'avg_response_ms', 'p50_response_ms', 'p95_response_ms',
    'f1_std_dev', 'composite_score', 'errors',
  ]);

  const rawStats = models.map(m => aggregateByModel(results, m, results[0]?.presetId ?? 'balanced'));
  const stats = applyCompositeScores(rawStats).sort((a, b) => b.compositeScore - a.compositeScore);
  for (const s of stats) {
    rows.push([
      s.modelId,
      shortName(s.modelId),
      s.presetId,
      String(s.totalTP),
      String(s.totalTN),
      String(s.totalFP),
      String(s.totalFN),
      s.avgPrecision.toFixed(4),
      s.avgRecall.toFixed(4),
      s.avgSpecificity.toFixed(4),
      s.avgNPV.toFixed(4),
      s.avgF1.toFixed(4),
      s.avgAccuracy.toFixed(4),
      s.avgBalancedAccuracy.toFixed(4),
      s.avgMCC.toFixed(4),
      s.avgIssuesFound.toFixed(2),
      s.avgResponseMs.toFixed(0),
      s.p50ResponseMs.toFixed(0),
      s.p95ResponseMs.toFixed(0),
      s.f1StdDev.toFixed(4),
      s.compositeScore.toFixed(4),
      String(s.errorCount),
    ]);
  }

  const csv = rows
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  fs.writeFileSync(filePath, csv, 'utf8');
  return filePath;
}

// ─── Save plain-text report ───────────────────────────────────────────────

/** Strip ANSI escape codes so the text file is readable in any editor. */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Capture the console output of printReport() and save it as a .txt file
 * (ANSI codes stripped).  Returns the file path.
 */
export function saveReport(
  results: ModelRunResult[],
  models: string[],
  presetId: AnalysisPresetId,
  outDir: string
): string {
  fs.mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(outDir, `llm-report-${ts}.txt`);

  // Capture stdout
  const lines: string[] = [];
  const origWrite = process.stdout.write.bind(process.stdout);
  (process.stdout.write as any) = (chunk: string | Buffer) => {
    lines.push(typeof chunk === 'string' ? chunk : chunk.toString());
    return origWrite(chunk);   // still print to terminal
  };

  printReport(results, models, presetId);

  // Restore stdout
  (process.stdout.write as any) = origWrite;

  const text = stripAnsi(lines.join(''));
  fs.writeFileSync(filePath, text, 'utf8');
  return filePath;
}
