/**
 * reporter.ts  —  Preset-tuning reporter for gpt-oss:120b-cloud
 *
 * Sections:
 *   1. OVERALL RANKINGS      — all 20 candidates by F1
 *   2. PER-PROFILE BREAKDOWN — best candidate within each profile by F1,
 *                              precision, recall and speed
 *   3. PER-FIXTURE DETAIL    — how each candidate performed on each fixture
 *   4. FALSE POSITIVE TABLE  — FP counts on clean fixtures per candidate
 *   5. RECOMMENDED PRESETS   — the 4 winning tuning candidates printed as
 *                              ANALYSIS_PRESETS ready to paste, plus a
 *                              side-by-side comparison against the current
 *                              presets already in ollama.ts
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  TuningRunResult,
  CandidateAggregate,
  aggregateByCandidate,
} from './benchmark';
import {
  Candidate,
  CANDIDATES,
  PROFILES,
  ProfileId,
  candidatesForProfile,
} from './candidates';

// ─── ANSI helpers ─────────────────────────────────────────────────────────

const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
  cyan:    '\x1b[36m',
  magenta: '\x1b[35m',
};

function pct(n: number): string { return `${(n * 100).toFixed(1)}%`; }
function ms(n: number): string  { return n >= 1000 ? `${(n / 1000).toFixed(1)}s` : `${Math.round(n)}ms`; }

function pad(s: string | number, w: number, left = false): string {
  const str = String(s);
  const diff = w - str.length;
  if (diff <= 0) return str;
  return left ? str + ' '.repeat(diff) : ' '.repeat(diff) + str;
}

function hr(char = '─', w = 100): string { return char.repeat(w); }

function scoreBar(score: number, width = 16): string {
  const filled = Math.round(score * width);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  const col = score >= 0.7 ? C.green : score >= 0.5 ? C.yellow : C.red;
  return col + bar + C.reset;
}

const MEDALS = ['🥇', '🥈', '🥉'];
function medal(i: number): string { return MEDALS[i] ?? ` ${i + 1}.`; }

const PROFILE_LABELS: Record<ProfileId, string> = {
  quick:       'QUICK',
  strict:      'STRICT',
  balanced:    'BALANCED',
  thorough:    'THOROUGH',
  reasoning:   'REASONING',
  performance: 'PERFORMANCE',
  current:     'CURRENT (baseline)',
};

// ─── Main report ──────────────────────────────────────────────────────────

export function printReport(
  results: TuningRunResult[],
  candidates: Candidate[],
  model: string
): void {
  const allAgg = candidates.map(c => aggregateByCandidate(results, c));
  const ranked = [...allAgg].sort((a, b) => b.avgF1 - a.avgF1);

  // ── Header ────────────────────────────────────────────────────────────
  console.log('');
  console.log(C.bold + hr('═') + C.reset);
  console.log(C.bold + '  PRESET TUNING BENCHMARK — gpt-oss:120b-cloud' + C.reset);
  console.log(`  Model:      ${C.cyan}${model}${C.reset}`);
  const tuningCount = candidates.filter(c => c.profile !== 'current').length;
  const currentCount = candidates.filter(c => c.profile === 'current').length;
  console.log(`  Candidates: ${candidates.length}  (${tuningCount} GPT-OSS tuning + ${currentCount} current-preset baselines)`);
  const runsPerCombo = results.filter(
    r => r.candidateId === candidates[0]?.id && r.fixtureId === results[0]?.fixtureId
  ).length;
  console.log(`  Runs per combination: ${runsPerCombo}`);
  console.log(C.bold + hr('═') + C.reset);
  console.log('');

  // ── 1. Overall ranking ────────────────────────────────────────────────
  console.log(C.bold + `  1.  OVERALL RANKINGS  (all ${candidates.length} candidates by F1)` + C.reset);
  console.log('');

  const hdr = [
    pad('',         4),
    pad('Candidate',             26, true),
    pad('Profile',    9, true),
    pad('F1',         7),
    pad('',          16),  // bar
    pad('Prec',       7),
    pad('Recall',     8),
    pad('TP',  4), pad('FN',  4), pad('FP',  4),
    pad('AvgTime',    9),
    pad('p50',        7),
  ].join(' ');
  console.log('  ' + C.dim + hdr + C.reset);
  console.log('  ' + hr('─', hdr.length));

  for (let i = 0; i < ranked.length; i++) {
    const a = ranked[i];
    const f1Col = a.avgF1 >= 0.7 ? C.green : a.avgF1 >= 0.5 ? C.yellow : C.red;
    const row = [
      pad(medal(i), 4),
      pad(a.label,             26, true),
      C.dim + pad(a.profile,    9, true) + C.reset,
      f1Col + pad(pct(a.avgF1), 7) + C.reset,
      scoreBar(a.avgF1),
      pad(pct(a.avgPrecision), 7),
      pad(pct(a.avgRecall),    8),
      pad(a.totalTP, 4), pad(a.totalFN, 4), pad(a.totalFP, 4),
      pad(ms(a.avgResponseMs), 9),
      pad(ms(a.p50ResponseMs), 7),
    ].join(' ');
    console.log('  ' + row);
  }

  // ── 2. Per-profile breakdown ──────────────────────────────────────────
  console.log('');
  console.log(C.bold + '  2.  PER-PROFILE BREAKDOWN' + C.reset);
  console.log(`  ${C.dim}Best candidate within each profile across four criteria${C.reset}`);

  for (const profile of PROFILES) {
    const profileAgg = allAgg.filter(a => a.profile === profile);
    if (profileAgg.length === 0) continue;

    const bestF1    = profileAgg.reduce((a, b) => a.avgF1        > b.avgF1        ? a : b);
    const bestPrec  = profileAgg.reduce((a, b) => a.avgPrecision > b.avgPrecision ? a : b);
    const bestRec   = profileAgg.reduce((a, b) => a.avgRecall    > b.avgRecall    ? a : b);
    const fastest   = profileAgg.filter(a => a.avgResponseMs > 0)
                                 .reduce((a, b) => a.avgResponseMs < b.avgResponseMs ? a : b);
    const fewestFP  = profileAgg.reduce((a, b) => a.totalFP      < b.totalFP      ? a : b);

    console.log('');
    console.log(`  ${C.bold}${C.cyan}── ${PROFILE_LABELS[profile]} ──${C.reset}`);
    console.log(`  Best F1        : ${C.green}${bestF1.label}${C.reset}  [F1=${pct(bestF1.avgF1)}  P=${pct(bestF1.avgPrecision)}  R=${pct(bestF1.avgRecall)}]`);
    if (bestPrec.candidateId !== bestF1.candidateId)
      console.log(`  Best Precision : ${C.cyan}${bestPrec.label}${C.reset}  [P=${pct(bestPrec.avgPrecision)}  FP=${bestPrec.totalFP}]`);
    if (bestRec.candidateId !== bestF1.candidateId)
      console.log(`  Best Recall    : ${C.cyan}${bestRec.label}${C.reset}  [R=${pct(bestRec.avgRecall)}  FN=${bestRec.totalFN}]`);
    if (fastest.candidateId !== bestF1.candidateId)
      console.log(`  Fastest        : ${C.cyan}${fastest.label}${C.reset}  [avg=${ms(fastest.avgResponseMs)}  p50=${ms(fastest.p50ResponseMs)}]`);
    if (fewestFP.candidateId !== bestF1.candidateId)
      console.log(`  Fewest FP      : ${C.cyan}${fewestFP.label}${C.reset}  [${fewestFP.totalFP} FP]`);

    // Mini table for this profile
    const pAgg = profileAgg.sort((a, b) => b.avgF1 - a.avgF1);
    const pHdr = [
      pad('',  4),
      pad('Candidate',   26, true),
      pad('F1',  7),
      pad('Prec', 7),
      pad('Recall', 8),
      pad('TP', 4), pad('FN', 4), pad('FP', 4),
      pad('AvgTime', 9),
    ].join(' ');
    console.log('');
    console.log('    ' + C.dim + pHdr + C.reset);
    console.log('    ' + hr('─', pHdr.length));
    for (let i = 0; i < pAgg.length; i++) {
      const a = pAgg[i];
      const f1Col = a.avgF1 >= 0.7 ? C.green : a.avgF1 >= 0.5 ? C.yellow : C.red;
      const pRow = [
        pad(medal(i), 4),
        pad(a.label,             26, true),
        f1Col + pad(pct(a.avgF1), 7) + C.reset,
        pad(pct(a.avgPrecision), 7),
        pad(pct(a.avgRecall),    8),
        pad(a.totalTP, 4), pad(a.totalFN, 4), pad(a.totalFP, 4),
        pad(ms(a.avgResponseMs), 9),
      ].join(' ');
      console.log('    ' + pRow);
    }
  }

  // ── 3. Per-fixture detail ─────────────────────────────────────────────
  const fixtureIds = [...new Set(results.map(r => r.fixtureId))];
  console.log('');
  console.log(C.bold + '  3.  PER-FIXTURE DETAIL' + C.reset);

  for (const fixtureId of fixtureIds) {
    const fResults = results.filter(r => r.fixtureId === fixtureId);
    console.log('');
    console.log(`  ${C.cyan}${C.bold}${fixtureId}${C.reset}`);

    const fHdr = [
      pad('Profile',   9, true),
      pad('Candidate', 24, true),
      pad('Found',  6),
      pad('TP',  4), pad('FN',  4), pad('FP',  4),
      pad('F1%',  7),
      pad('Time',  9),
      'Notes',
    ].join('  ');
    console.log('  ' + C.dim + fHdr + C.reset);
    console.log('  ' + hr('─', 100));

    // Sort candidates by F1 on this fixture
    const sorted = [...candidates].sort((a, b) => {
      const runsA = fResults.filter(r => r.candidateId === a.id && !r.errorOccurred);
      const runsB = fResults.filter(r => r.candidateId === b.id && !r.errorOccurred);
      const f1A = runsA.length ? runsA.reduce((s, r) => s + r.f1, 0) / runsA.length : -1;
      const f1B = runsB.length ? runsB.reduce((s, r) => s + r.f1, 0) / runsB.length : -1;
      return f1B - f1A;
    });

    for (const cand of sorted) {
      const runs = fResults.filter(r => r.candidateId === cand.id && !r.errorOccurred);
      if (runs.length === 0) {
        const errRun = fResults.find(r => r.candidateId === cand.id && r.errorOccurred);
        console.log('  ' + [
          pad(cand.profile, 9, true), pad(cand.label, 24, true),
          pad('-', 6), pad('-', 4), pad('-', 4), pad('-', 4),
          C.red + pad('-', 7) + C.reset, pad('-', 9),
          `ERROR: ${errRun?.errorMessage ?? 'unknown'}`,
        ].join('  '));
        continue;
      }

      const n = runs.length;
      const avgF1  = runs.reduce((s, r) => s + r.f1, 0) / n;
      const avgTP  = runs.reduce((s, r) => s + r.tp, 0) / n;
      const avgFN  = runs.reduce((s, r) => s + r.fn, 0) / n;
      const avgFP  = runs.reduce((s, r) => s + r.fp, 0) / n;
      const avgMs  = runs.reduce((s, r) => s + r.responseTimeMs, 0) / n;
      const found  = runs.reduce((s, r) => s + r.issuesFound.length, 0) / n;
      const first  = runs[0];

      let notes = '';
      if (first.missedIds.length) notes += `MISS:[${first.missedIds.join(', ')}] `;
      if (first.fpTitles.length)  notes += `FP:[${first.fpTitles.slice(0, 2).join(' | ')}${first.fpTitles.length > 2 ? ` +${first.fpTitles.length - 2}` : ''}]`;
      if (!notes && avgFP === 0 && avgFN === 0) notes = `${C.green}✓ perfect${C.reset}`;

      const f1Col = avgF1 >= 0.8 ? C.green : avgF1 >= 0.5 ? C.yellow : C.red;
      console.log('  ' + [
        pad(cand.profile,           9, true),
        pad(cand.label,            24, true),
        pad(Math.round(found),      6),
        pad(avgTP.toFixed(1),       4),
        pad(avgFN.toFixed(1),       4),
        pad(avgFP.toFixed(1),       4),
        f1Col + pad(pct(avgF1), 7) + C.reset,
        pad(ms(avgMs),              9),
        notes,
      ].join('  '));
    }
  }

  // ── 4. False positive table on clean fixtures ────────────────────────
  console.log('');
  console.log(C.bold + '  4.  FALSE POSITIVES ON CLEAN FIXTURES' + C.reset);
  console.log(`  ${C.dim}Every issue raised on a clean file is a hallucination${C.reset}`);
  console.log('');

  const fpHdr = [
    pad('Profile',    9, true),
    pad('Candidate', 26, true),
    pad('Total FP',  10),
    'Top hallucinations',
  ].join('  ');
  console.log('  ' + C.dim + fpHdr + C.reset);
  console.log('  ' + hr('─', fpHdr.length));

  const cleanResults = results.filter(r => r.fp > 0 && !r.errorOccurred);
  const byCandidate = allAgg.sort((a, b) => a.totalFP - b.totalFP);

  for (const agg of byCandidate) {
    const cFPs = cleanResults.filter(r => r.candidateId === agg.candidateId);
    const fpTitles = cFPs.flatMap(r => r.fpTitles).slice(0, 3).join(' | ');
    const col = agg.totalFP === 0 ? C.green : agg.totalFP <= 3 ? C.yellow : C.red;
    console.log('  ' + [
      pad(agg.profile,   9, true),
      pad(agg.label,    26, true),
      col + pad(agg.totalFP, 10) + C.reset,
      agg.totalFP === 0 ? `${C.green}none${C.reset}` : fpTitles,
    ].join('  '));
  }

  // ── 5. Recommended presets ────────────────────────────────────────────
  console.log('');
  console.log(C.bold + '  5.  RECOMMENDED PRESET DEFINITIONS' + C.reset);
  console.log(`  ${C.dim}Best F1 winner per profile — paste into ollama.ts as ANALYSIS_PRESETS${C.reset}`);
  console.log('');

  const winners: Record<ProfileId, CandidateAggregate> = {} as any;
  for (const profile of PROFILES) {
    const profileAgg = allAgg.filter(a => a.profile === profile);
    if (profileAgg.length > 0) {
      winners[profile] = profileAgg.reduce((a, b) => a.avgF1 > b.avgF1 ? a : b);
    }
  }

  // Print the TypeScript snippet
  const lines: string[] = [];
  lines.push('export const ANALYSIS_PRESETS: Record<AnalysisPresetId, AnalysisPreset> = {');
  for (const profile of PROFILES) {
    const w = winners[profile];
    if (!w) continue;
    const cand = CANDIDATES.find(c => c.id === w.candidateId)!;
    const opt = cand.options;
    lines.push(`  ${profile}: {`);
    lines.push(`    label: "${profile.charAt(0).toUpperCase() + profile.slice(1)}",`);
    lines.push(`    description: "${cand.description}",`);
    lines.push('    options: {');
    lines.push(`      num_predict:    ${opt.num_predict},`);
    lines.push(`      num_ctx:        ${opt.num_ctx},`);
    lines.push(`      temperature:    ${opt.temperature},`);
    lines.push(`      top_p:          ${opt.top_p},`);
    lines.push(`      top_k:          ${opt.top_k},`);
    lines.push(`      repeat_penalty: ${opt.repeat_penalty},`);
    lines.push(`      repeat_last_n:  ${opt.repeat_last_n},`);
    lines.push(`      seed:           42,`);
    lines.push('    },');
    lines.push('  },');
  }
  lines.push('};');

  for (const line of lines) {
    console.log('  ' + line);
  }

  console.log('');
  console.log(hr());
}

// ─── Save JSON ────────────────────────────────────────────────────────────

export function saveJson(results: TuningRunResult[], outDir: string): string {
  fs.mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(outDir, `preset-tuning-${ts}.json`);
  fs.writeFileSync(filePath, JSON.stringify(results, null, 2), 'utf8');
  return filePath;
}

// ─── Save CSV ─────────────────────────────────────────────────────────────

export function saveCsv(
  results: TuningRunResult[],
  candidates: Candidate[],
  outDir: string
): string {
  fs.mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(outDir, `preset-tuning-${ts}.csv`);

  const rows: string[][] = [[
    'candidate_id', 'profile', 'label',
    'fixture', 'run',
    'issues_found', 'tp', 'fn', 'fp',
    'precision', 'recall', 'f1',
    'response_ms', 'error',
  ]];

  for (const r of results) {
    const cand = candidates.find(c => c.id === r.candidateId);
    rows.push([
      r.candidateId,
      r.profile,
      cand?.label ?? r.candidateId,
      r.fixtureId,
      String(r.runIndex),
      String(r.issuesFound.length),
      String(r.tp),
      String(r.fn),
      String(r.fp),
      r.precision.toFixed(4),
      r.recall.toFixed(4),
      r.f1.toFixed(4),
      String(r.responseTimeMs),
      r.errorOccurred ? 'true' : 'false',
    ]);
  }

  // Aggregate summary
  rows.push([]);
  rows.push(['# AGGREGATE BY CANDIDATE']);
  rows.push([
    'candidate_id', 'profile', 'label',
    'total_tp', 'total_fn', 'total_fp',
    'avg_precision', 'avg_recall', 'avg_f1',
    'avg_response_ms', 'p50_response_ms', 'errors',
  ]);

  const aggs = candidates
    .map(c => aggregateByCandidate(results, c))
    .sort((a, b) => b.avgF1 - a.avgF1);

  for (const a of aggs) {
    rows.push([
      a.candidateId, a.profile, a.label,
      String(a.totalTP), String(a.totalFN), String(a.totalFP),
      a.avgPrecision.toFixed(4),
      a.avgRecall.toFixed(4),
      a.avgF1.toFixed(4),
      a.avgResponseMs.toFixed(0),
      a.p50ResponseMs.toFixed(0),
      String(a.errorCount),
    ]);
  }

  const csv = rows
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  fs.writeFileSync(filePath, csv, 'utf8');
  return filePath;
}

// ─── Save plain-text report ───────────────────────────────────────────────

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

export function saveReport(
  results: TuningRunResult[],
  candidates: Candidate[],
  model: string,
  outDir: string
): string {
  fs.mkdirSync(outDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(outDir, `preset-tuning-report-${ts}.txt`);

  const lines: string[] = [];
  const origWrite = process.stdout.write.bind(process.stdout);
  (process.stdout.write as any) = (chunk: string | Buffer) => {
    lines.push(typeof chunk === 'string' ? chunk : chunk.toString());
    return origWrite(chunk);
  };

  printReport(results, candidates, model);

  (process.stdout.write as any) = origWrite;

  fs.writeFileSync(filePath, stripAnsi(lines.join('')), 'utf8');
  return filePath;
}
