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
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  italic:  '\x1b[3m',
  green:   '\x1b[32m',
  bgreen:  '\x1b[92m',  // bright green
  yellow:  '\x1b[33m',
  byellow: '\x1b[93m',  // bright yellow
  red:     '\x1b[31m',
  bred:    '\x1b[91m',  // bright red
  cyan:    '\x1b[36m',
  bcyan:   '\x1b[96m',  // bright cyan
  magenta: '\x1b[35m',
  bmagenta:'\x1b[95m',
  white:   '\x1b[37m',
  bwhite:  '\x1b[97m',
  bg: {
    dark:  '\x1b[48;5;236m',
    green: '\x1b[48;5;22m',
    reset: '\x1b[49m',
  },
};

const W = 110; // report width

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

/** pad that accounts for invisible ANSI escape sequences */
function padAnsi(s: string, w: number, left = false): string {
  // eslint-disable-next-line no-control-regex
  const visible = s.replace(/\x1b\[[0-9;]*m/g, '').length;
  const diff = w - visible;
  if (diff <= 0) return s;
  return left ? s + ' '.repeat(diff) : ' '.repeat(diff) + s;
}

function hr(char = '─', width = W): string {
  return char.repeat(width);
}

/** Full-width section banner */
function section(title: string): void {
  console.log('');
  const inner = `  ${title}  `;
  const padW  = Math.max(0, W - inner.length);
  const left  = Math.floor(padW / 2);
  const right = padW - left;
  console.log(C.bold + C.bcyan + '▐' + '░'.repeat(left) + inner + '░'.repeat(right) + '▌' + C.reset);
  console.log('');
}

/** Thin rule with optional label */
function rule(label = '', char = '─'): void {
  if (!label) { console.log(C.dim + hr(char) + C.reset); return; }
  const side = Math.max(0, Math.floor((W - label.length - 2) / 2));
  console.log(C.dim + char.repeat(side) + ' ' + label + ' ' + char.repeat(W - side - label.length - 2) + C.reset);
}

const MEDALS = ['🥇', '🥈', '🥉'];
function medal(rank: number): string {
  return MEDALS[rank] ?? ` ${rank + 1}.`;
}

function scoreBar(score: number, width = 16): string {
  const filled = Math.round(score * width);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  const col = score >= 0.7 ? C.bgreen : score >= 0.5 ? C.byellow : C.bred;
  return col + bar + C.reset;
}

/** Draws a box around an array of pre-formatted lines */
function box(lines: string[], title = ''): void {
  const innerW = W - 4; // 2 border chars + 2 spaces padding each side
  const top = title
    ? `╔══ ${C.bold}${title}${C.reset}${C.dim} ${'═'.repeat(Math.max(0, innerW - title.length - 4))}╗${C.reset}`
    : C.dim + '╔' + '═'.repeat(innerW + 2) + '╗' + C.reset;
  console.log('  ' + top);
  for (const line of lines) {
    // eslint-disable-next-line no-control-regex
    const visLen = line.replace(/\x1b\[[0-9;]*m/g, '').length;
    const pad2   = Math.max(0, innerW - visLen);
    console.log('  ' + C.dim + '║' + C.reset + ' ' + line + ' '.repeat(pad2) + ' ' + C.dim + '║' + C.reset);
  }
  console.log('  ' + C.dim + '╚' + '═'.repeat(innerW + 2) + '╝' + C.reset);
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
  const runsPerCombo = results.filter(
    r => r.modelId === models[0] && r.fixtureId === results[0]?.fixtureId
  ).length;
  const now = new Date().toLocaleString();

  // ╔══════════════════════════════════════════════════════════╗
  // ║  HEADER                                                  ║
  // ╚══════════════════════════════════════════════════════════╝
  console.log('');
  console.log(C.bold + C.bcyan + '╔' + '═'.repeat(W - 2) + '╗' + C.reset);
  const title = 'Cloud-LLM-Preliminary  ·  Accessibility Auditing Quality';
  const titlePad = Math.max(0, W - 4 - title.length);
  console.log(C.bold + C.bcyan + '║' + C.reset + C.bold + C.bwhite + '  ' + title + ' '.repeat(titlePad) + '  ' + C.bcyan + '║' + C.reset);
  console.log(C.bold + C.bcyan + '╠' + '═'.repeat(W - 2) + '╣' + C.reset);

  const meta = [
    `${C.dim}Preset${C.reset}   ${C.cyan}${presetLabel}${C.reset}  ${C.dim}(fixed — only model differs)${C.reset}`,
    `${C.dim}Models${C.reset}   ${C.bwhite}${models.length}${C.reset}`,
    `${C.dim}Runs/combo${C.reset} ${C.bwhite}${runsPerCombo}${C.reset}`,
    `${C.dim}Scoring${C.reset}  ${C.bwhite}80% F1  +  20% speed${C.reset}  ${C.dim}(higher = better)${C.reset}`,
    `${C.dim}Run at${C.reset}   ${C.dim}${now}${C.reset}`,
  ];
  for (const line of meta) {
    // eslint-disable-next-line no-control-regex
    const vis = line.replace(/\x1b\[[0-9;]*m/g, '').length;
    console.log(C.bcyan + '║' + C.reset + '  ' + line + ' '.repeat(Math.max(0, W - 4 - vis)) + '  ' + C.bcyan + '║' + C.reset);
  }
  console.log(C.bold + C.bcyan + '╚' + '═'.repeat(W - 2) + '╝' + C.reset);

  // ╔══════════════════════════════════════════════════════════╗
  // ║  OVERALL RANKING                                         ║
  // ╚══════════════════════════════════════════════════════════╝
  section('① OVERALL RANKING');

  // column widths
  const COL = { rank: 4, name: 32, score: 7, bar: 16, f1: 7, prec: 7, rec: 8, tp: 4, fn: 4, fp: 4, time: 8, err: 4 };

  const hdr = [
    pad('',          COL.rank),
    pad('Model',     COL.name, true),
    pad('Score',     COL.score),
    pad('',          COL.bar),
    pad('F1',        COL.f1),
    pad('Prec',      COL.prec),
    pad('Recall',    COL.rec),
    pad('TP', COL.tp), pad('FN', COL.fn), pad('FP', COL.fp),
    pad('AvgTime',   COL.time),
    pad('Err', COL.err),
  ].join(' ');
  console.log('  ' + C.bold + hdr + C.reset);
  rule('', '─');
  console.log(`  ${C.dim}TP = correctly found issues  ·  FN = missed issues  ·  FP = hallucinated issues  ·  F1 = harmonic mean of Prec & Recall${C.reset}`);
  console.log('');

  for (let i = 0; i < ranked.length; i++) {
    const s   = ranked[i];
    const name = shortName(s.modelId);
    const rowBg  = i === 0 ? C.bg.dark : '';
    const f1Col  = s.avgF1 >= 0.7 ? C.bgreen : s.avgF1 >= 0.5 ? C.byellow : C.bred;
    const fpCol  = s.totalFP === 0 ? C.bgreen : s.totalFP <= 3 ? C.byellow : C.bred;
    const fnCol  = s.totalFN === 0 ? C.bgreen : s.totalFN <= 3 ? C.byellow : C.bred;
    const row = [
      pad(medal(i), COL.rank),
      padAnsi(C.bwhite + pad(name, COL.name, true) + C.reset, COL.name, true),
      pad(pct(s.compositeScore), COL.score),
      scoreBar(s.compositeScore, COL.bar),
      f1Col  + pad(pct(s.avgF1),        COL.f1)   + C.reset,
               pad(pct(s.avgPrecision), COL.prec),
               pad(pct(s.avgRecall),    COL.rec),
      C.bgreen + pad(s.totalTP, COL.tp) + C.reset,
      fnCol  + pad(s.totalFN, COL.fn) + C.reset,
      fpCol  + pad(s.totalFP, COL.fp) + C.reset,
               pad(ms(s.avgResponseMs), COL.time),
      s.errorCount > 0 ? C.bred + pad(s.errorCount, COL.err) + C.reset : C.dim + pad(0, COL.err) + C.reset,
    ].join(' ');
    console.log('  ' + rowBg + row + C.bg.reset);
    if (i === 2 && ranked.length > 3) console.log('  ' + C.dim + '·'.repeat(W - 2) + C.reset);
  }

  // ╔══════════════════════════════════════════════════════════╗
  // ║  HIGHLIGHTS                                              ║
  // ╚══════════════════════════════════════════════════════════╝
  const best        = ranked[0];
  const bestF1      = ranked.reduce((a, b) => a.avgF1       > b.avgF1       ? a : b);
  const bestAcc     = ranked.reduce((a, b) => a.avgAccuracy > b.avgAccuracy ? a : b);
  const bestMCC     = ranked.reduce((a, b) => a.avgMCC      > b.avgMCC      ? a : b);
  const bestSpeed   = ranked.filter(s => s.avgResponseMs > 0).reduce((a, b) => a.avgResponseMs < b.avgResponseMs ? a : b);
  const fewestFP    = ranked.reduce((a, b) => a.totalFP < b.totalFP ? a : b);
  const fewestFN    = ranked.reduce((a, b) => a.totalFN < b.totalFN ? a : b);
  const mostConsist = ranked.filter(s => s.f1StdDev >= 0).reduce((a, b) => a.f1StdDev < b.f1StdDev ? a : b);

  section('② HIGHLIGHTS');

  const hlLines = [
    `  🏆  ${C.bold}Best overall${C.reset}         ${C.bgreen}${shortName(best.modelId)}${C.reset}   composite=${C.bold}${pct(best.compositeScore)}${C.reset}`,
    `  🎯  ${C.bold}Best F1 (accuracy)${C.reset}   ${C.bcyan}${shortName(bestF1.modelId)}${C.reset}   F1=${pct(bestF1.avgF1)}`,
    `  📊  ${C.bold}Best overall Acc${C.reset}     ${C.bcyan}${shortName(bestAcc.modelId)}${C.reset}   Acc=${pct(bestAcc.avgAccuracy)}`,
    `  🔬  ${C.bold}Best MCC${C.reset}             ${C.bcyan}${shortName(bestMCC.modelId)}${C.reset}   MCC=${bestMCC.avgMCC.toFixed(3)}  ${C.dim}(Matthews Correlation Coefficient — closer to 1 is better)${C.reset}`,
    `  ⚡  ${C.bold}Fastest${C.reset}              ${C.bcyan}${shortName(bestSpeed.modelId)}${C.reset}   avg=${ms(bestSpeed.avgResponseMs)}  p95=${ms(bestSpeed.p95ResponseMs)}`,
    `  ✅  ${C.bold}Fewest hallucinations${C.reset} ${C.bcyan}${shortName(fewestFP.modelId)}${C.reset}   ${fewestFP.totalFP} false positive${fewestFP.totalFP !== 1 ? 's' : ''}`,
    `  🔍  ${C.bold}Fewest missed issues${C.reset} ${C.bcyan}${shortName(fewestFN.modelId)}${C.reset}   ${fewestFN.totalFN} false negative${fewestFN.totalFN !== 1 ? 's' : ''}`,
  ];
  if (mostConsist.f1StdDev > 0)
    hlLines.push(`  🎲  ${C.bold}Most consistent${C.reset}      ${C.bcyan}${shortName(mostConsist.modelId)}${C.reset}   F1 σ=${mostConsist.f1StdDev.toFixed(3)}`);

  box(hlLines, 'HIGHLIGHTS');

  // ╔══════════════════════════════════════════════════════════╗
  // ║  EXTENDED CONFUSION-MATRIX METRICS                      ║
  // ╚══════════════════════════════════════════════════════════╝
  section('③ EXTENDED METRICS  (confusion-matrix detail)');

  console.log(`  ${C.dim}TP = correctly found issues  ·  TN = correctly skipped non-issues  ·  FP = hallucinations  ·  FN = missed issues${C.reset}`);
  console.log(`  ${C.dim}Acc = overall accuracy  ·  BalAcc = (TPR+TNR)/2  ·  MCC = Matthews Correlation Coefficient (−1 worst · 0 random · +1 perfect)${C.reset}`);
  console.log(`  ${C.dim}Specif = specificity = TN/(TN+FP) i.e. how well the model avoids hallucinations  ·  NPV = TN/(TN+FN) i.e. how reliable a "no issue" verdict is${C.reset}`);
  console.log('');

  const EC = { rank: 4, name: 32, acc: 7, bal: 8, mcc: 7, spec: 8, npv: 7, tp: 5, tn: 6, fp: 5, fn: 5 };
  const ehdr = [
    pad('',          EC.rank),
    pad('Model',     EC.name, true),
    pad('Acc',       EC.acc),
    pad('BalAcc',    EC.bal),
    pad('MCC',       EC.mcc),
    pad('Specif',    EC.spec),
    pad('NPV',       EC.npv),
    pad('TP', EC.tp), pad('TN', EC.tn), pad('FP', EC.fp), pad('FN', EC.fn),
  ].join(' ');
  console.log('  ' + C.bold + ehdr + C.reset);
  rule('', '─');

  for (let i = 0; i < ranked.length; i++) {
    const s = ranked[i];
    const accCol = s.avgAccuracy >= 0.8 ? C.bgreen : s.avgAccuracy >= 0.6 ? C.byellow : C.bred;
    const mccCol = s.avgMCC     >= 0.6 ? C.bgreen : s.avgMCC     >= 0.3 ? C.byellow : C.bred;
    const fpCol  = s.totalFP === 0 ? C.bgreen : s.totalFP <= 3 ? C.byellow : C.bred;
    const fnCol  = s.totalFN === 0 ? C.bgreen : s.totalFN <= 3 ? C.byellow : C.bred;
    const erow = [
      pad(medal(i), EC.rank),
      padAnsi(C.bwhite + pad(shortName(s.modelId), EC.name, true) + C.reset, EC.name, true),
      accCol + pad(pct(s.avgAccuracy),       EC.acc)  + C.reset,
               pad(pct(s.avgBalancedAccuracy), EC.bal),
      mccCol + pad(s.avgMCC.toFixed(3),      EC.mcc)  + C.reset,
               pad(pct(s.avgSpecificity),    EC.spec),
               pad(pct(s.avgNPV),            EC.npv),
      C.bgreen + pad(s.totalTP, EC.tp) + C.reset,
      C.dim    + pad(s.totalTN, EC.tn) + C.reset,
      fpCol    + pad(s.totalFP, EC.fp) + C.reset,
      fnCol    + pad(s.totalFN, EC.fn) + C.reset,
    ].join(' ');
    console.log('  ' + erow);
  }

  // ╔══════════════════════════════════════════════════════════╗
  // ║  RESPONSE TIME ANALYSIS                                  ║
  // ╚══════════════════════════════════════════════════════════╝
  section('④ RESPONSE TIME');
  console.log(`  ${C.dim}Avg / Median (p50) / 95th-percentile across all successful runs${C.reset}`);
  console.log('');

  const TC = { rank: 4, name: 32, avg: 9, p50: 9, p95: 9, iss: 11 };
  const thdr = [
    pad('',         TC.rank),
    pad('Model',    TC.name, true),
    pad('Avg',      TC.avg),
    pad('p50',      TC.p50),
    pad('p95',      TC.p95),
    pad('Issues/run', TC.iss),
  ].join(' ');
  console.log('  ' + C.bold + thdr + C.reset);
  rule('', '─');

  const bySpeed = [...ranked].sort((a, b) => a.avgResponseMs - b.avgResponseMs);
  for (let i = 0; i < bySpeed.length; i++) {
    const s = bySpeed[i];
    const speedCol = i === 0 ? C.bgreen : i === bySpeed.length - 1 ? C.bred : C.reset;

    // Mini response-time bar (relative to slowest)
    const maxMs = bySpeed[bySpeed.length - 1].avgResponseMs || 1;
    const barW  = 12;
    const filled = Math.round((s.avgResponseMs / maxMs) * barW);
    const timeBar = (i === 0 ? C.bgreen : i === bySpeed.length - 1 ? C.bred : C.byellow)
      + '▓'.repeat(filled) + C.dim + '░'.repeat(barW - filled) + C.reset;

    const trow = [
      pad(` ${i + 1}.`, TC.rank),
      padAnsi(C.bwhite + pad(shortName(s.modelId), TC.name, true) + C.reset, TC.name, true),
      speedCol + pad(ms(s.avgResponseMs), TC.avg)  + C.reset,
               pad(ms(s.p50ResponseMs),  TC.p50),
               pad(ms(s.p95ResponseMs),  TC.p95),
               pad(s.avgIssuesFound.toFixed(1), TC.iss),
      timeBar,
    ].join(' ');
    console.log('  ' + trow);
  }

  // ╔══════════════════════════════════════════════════════════╗
  // ║  CONSISTENCY (only when runs > 1)                        ║
  // ╚══════════════════════════════════════════════════════════╝
  const hasMultipleRuns = results.some(
    r => results.filter(x => x.modelId === r.modelId && x.fixtureId === r.fixtureId).length > 1
  );
  if (hasMultipleRuns) {
    section('⑤ CONSISTENCY  (F1 across repeated runs)');
    console.log(`  ${C.dim}Lower σ = more reproducible.  Bar shows consistency: full █ = perfectly stable.${C.reset}`);
    console.log('');

    const CC = { rank: 4, name: 32, sd: 7, bar: 16, min: 8, max: 8 };
    const chdr = [pad('', CC.rank), pad('Model', CC.name, true), pad('F1 σ', CC.sd), pad('Consistency', CC.bar), pad('Min F1', CC.min), pad('Max F1', CC.max)].join(' ');
    console.log('  ' + C.bold + chdr + C.reset);
    rule('', '─');

    const byConsistency = [...ranked].sort((a, b) => a.f1StdDev - b.f1StdDev);
    for (let i = 0; i < byConsistency.length; i++) {
      const s    = byConsistency[i];
      const runs = results.filter(r => r.modelId === s.modelId && !r.errorOccurred);
      const f1s  = runs.map(r => r.f1);
      const minF1 = f1s.length ? Math.min(...f1s) : 0;
      const maxF1 = f1s.length ? Math.max(...f1s) : 0;
      const consistScore = 1 - Math.min(s.f1StdDev * 4, 1);
      const cCol = s.f1StdDev <= 0.05 ? C.bgreen : s.f1StdDev <= 0.15 ? C.byellow : C.bred;
      const crow = [
        pad(` ${i + 1}.`, CC.rank),
        padAnsi(C.bwhite + pad(shortName(s.modelId), CC.name, true) + C.reset, CC.name, true),
        cCol + pad(s.f1StdDev.toFixed(3), CC.sd) + C.reset,
        scoreBar(consistScore, CC.bar),
        pad(pct(minF1), CC.min),
        pad(pct(maxF1), CC.max),
      ].join(' ');
      console.log('  ' + crow);
    }
  }

  // ╔══════════════════════════════════════════════════════════╗
  // ║  DETAIL BY FIXTURE                                       ║
  // ╚══════════════════════════════════════════════════════════╝
  const sectionNum = hasMultipleRuns ? '⑥' : '⑤';
  section(`${sectionNum} DETAIL BY FIXTURE`);

  const fixtureIds = [...new Set(results.map(r => r.fixtureId))];

  for (const fixtureId of fixtureIds) {
    const fixResults = results.filter(r => r.fixtureId === fixtureId);
    const firstResult = fixResults[0];
    const isCleanFixture = firstResult && firstResult.missedIds.length === 0
      && firstResult.fn === 0 && !firstResult.issuesFound.length;

    const fixtureTag = isCleanFixture
      ? `  ${C.bold}${C.bcyan}${fixtureId}${C.reset}  ${C.bg.dark}${C.byellow} false-positive test — no real issues exist ${C.bg.reset}${C.reset}`
      : `  ${C.bold}${C.bcyan}${fixtureId}${C.reset}  ${C.dim}(issues-present fixture)${C.reset}`;
    console.log(fixtureTag);
    console.log('');

    const FC = { name: 30, found: 6, tp: 4, tn: 4, fp: 4, fn: 4, f1: 7, acc: 6, mcc: 6, time: 8 };
    const fHdr = [
      pad('Model',                FC.name, true),
      pad('Found',                FC.found),
      pad('TP✓',                  FC.tp),
      pad('TN✓',                  FC.tn),
      pad('FP✗',                  FC.fp),
      pad('FN✗',                  FC.fn),
      pad('F1%',                  FC.f1),
      pad('Acc%',                 FC.acc),
      pad('MCC',                  FC.mcc),
      pad('Time',                 FC.time),
      'Notes',
    ].join('  ');
    console.log('  ' + C.bold + fHdr + C.reset);
    console.log('  ' + C.dim + hr('─', 120) + C.reset);

    const modelOrder = models
      .map(m => {
        const runs = fixResults.filter(r => r.modelId === m);
        const avgF1 = runs.length ? runs.reduce((s, r) => s + r.f1, 0) / runs.length : 0;
        return { modelId: m, avgF1 };
      })
      .sort((a, b) => b.avgF1 - a.avgF1);

    for (const { modelId } of modelOrder) {
      const runs = fixResults.filter(r => r.modelId === modelId && !r.errorOccurred);
      if (runs.length === 0) {
        const errRun = fixResults.find(r => r.modelId === modelId && r.errorOccurred);
        const row = [
          pad(shortName(modelId), FC.name, true),
          pad('-', FC.found), pad('-', FC.tp), pad('-', FC.tn), pad('-', FC.fp), pad('-', FC.fn),
          C.bred + pad('ERR', FC.f1) + C.reset,
          pad('-', FC.acc), pad('-', FC.mcc), pad('-', FC.time),
          `${C.bred}✖ ERROR:${C.reset} ${errRun?.errorMessage ?? 'unknown'}`,
        ].join('  ');
        console.log('  ' + row);
        continue;
      }

      const avg = (key: keyof ModelRunResult) => runs.reduce((s, r) => s + (r[key] as number), 0) / runs.length;
      const avgF1   = avg('f1');
      const avgTP   = avg('tp');
      const avgTN   = avg('tn');
      const avgFN   = avg('fn');
      const avgFP   = avg('fp');
      const avgAcc  = avg('accuracy');
      const avgMCC  = avg('mcc');
      const avgMs   = avg('responseTimeMs');
      const found   = avg('issuesFound' as any);  // length handled below
      const foundN  = runs.reduce((s, r) => s + r.issuesFound.length, 0) / runs.length;

      const firstRun = runs[0];
      let notes: string;
      if (avgFN === 0 && avgFP === 0) {
        notes = `${C.bgreen}✓ PERFECT${C.reset}  ${C.dim}TP:${avgTP.toFixed(0)} correct finds  TN:${avgTN.toFixed(0)} correct skips${C.reset}`;
      } else {
        const parts: string[] = [];
        parts.push(`${C.bgreen}TP:${avgTP.toFixed(0)}✓${C.reset}`);
        parts.push(`${C.dim}TN:${avgTN.toFixed(0)}✓${C.reset}`);
        if (firstRun.fpTitles.length)
          parts.push(`${C.byellow}FP(hallucinated):${C.reset} ${firstRun.fpTitles.slice(0, 2).map(t => `"${t}"`).join(', ')}${firstRun.fpTitles.length > 2 ? ` +${firstRun.fpTitles.length - 2} more` : ''}`);
        if (firstRun.missedIds.length)
          parts.push(`${C.bred}FN(missed):${C.reset} [${firstRun.missedIds.join(', ')}]`);
        notes = parts.join('  ');
      }

      const f1Col  = avgF1  >= 0.8 ? C.bgreen : avgF1  >= 0.5 ? C.byellow : C.bred;
      const accCol = avgAcc >= 0.8 ? C.bgreen : avgAcc >= 0.6 ? C.byellow : C.bred;
      const mccCol = avgMCC >= 0.6 ? C.bgreen : avgMCC >= 0.3 ? C.byellow : C.bred;
      const fpCol  = avgFP  === 0  ? C.bgreen : avgFP  <= 2   ? C.byellow : C.bred;
      const fnCol  = avgFN  === 0  ? C.bgreen : avgFN  <= 2   ? C.byellow : C.bred;

      const row = [
        padAnsi(C.bwhite + pad(shortName(modelId), FC.name, true) + C.reset, FC.name, true),
        pad(Math.round(foundN),      FC.found),
        C.bgreen + pad(avgTP.toFixed(0), FC.tp) + C.reset,
        C.dim    + pad(avgTN.toFixed(0), FC.tn) + C.reset,
        fpCol    + pad(avgFP.toFixed(0), FC.fp) + C.reset,
        fnCol    + pad(avgFN.toFixed(0), FC.fn) + C.reset,
        f1Col    + pad(pct(avgF1),       FC.f1) + C.reset,
        accCol   + pad(pct(avgAcc),      FC.acc) + C.reset,
        mccCol   + pad(avgMCC.toFixed(2), FC.mcc) + C.reset,
        pad(ms(avgMs), FC.time),
        notes,
      ].join('  ');
      console.log('  ' + row);
    }
    console.log('');
  }

  // ╔══════════════════════════════════════════════════════════╗
  // ║  FALSE POSITIVE ANALYSIS                                 ║
  // ╚══════════════════════════════════════════════════════════╝
  const fpSectionNum = hasMultipleRuns ? '⑦' : '⑥';
  section(`${fpSectionNum} FALSE POSITIVE ANALYSIS  (hallucinations on clean files)`);
  console.log(`  ${C.dim}Every issue listed below was found by the model on a fixture that has NO real accessibility problems.${C.reset}`);
  console.log(`  ${C.dim}These are hallucinations — the model invented problems that don't exist.${C.reset}`);
  console.log('');

  const fpResults = results.filter(r => r.fp > 0 && !r.errorOccurred);
  let anyFP = false;
  for (const modelId of models) {
    const modelFPs = fpResults.filter(r => r.modelId === modelId);
    const name = shortName(modelId);
    if (modelFPs.length === 0) {
      console.log(`  ${C.bgreen}✓${C.reset}  ${name}`);
      continue;
    }
    anyFP = true;
    const totalFP = modelFPs.reduce((s, r) => s + r.fp, 0);
    console.log(`  ${C.bred}✖${C.reset}  ${C.bwhite}${name}${C.reset}  ${C.bred}${totalFP} hallucination${totalFP !== 1 ? 's' : ''}${C.reset}`);
    for (const r of modelFPs) {
      for (const title of r.fpTitles) {
        console.log(`      ${C.dim}[${r.fixtureId}]${C.reset}  ${C.yellow}"${title}"${C.reset}`);
      }
    }
  }
  if (!anyFP) {
    console.log('');
    console.log(`  ${C.bgreen}${C.bold}All models produced zero hallucinations on clean fixtures.${C.reset}`);
  }

  console.log('');
  console.log(C.dim + hr('═') + C.reset);
  console.log('');
}

// ─── Save JSON ────────────────────────────────────────────────────────────

export function saveJson(results: ModelRunResult[], outDir: string): string {
  fs.mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(outDir, `cloud-llm-preliminary-${ts}.json`);
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
  const filePath = path.join(outDir, `cloud-llm-preliminary-summary-${ts}.csv`);

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
  const filePath = path.join(outDir, `cloud-llm-preliminary-report-${ts}.txt`);

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
