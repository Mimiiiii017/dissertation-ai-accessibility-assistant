/**
 * benchmark.ts  —  LLM Model Benchmark
 *
 * For each (model × fixture × run):
 *   1. Read the fixture file
 *   2. Build the prompt (same as the extension)
 *   3. Stream a response from Ollama
 *   4. Parse into AiIssue objects
 *   5. Score TP / FN / FP against ground truth
 *
 * Uses a single fixed analysis preset for all models so that model quality
 * is the only variable.  Defaults to "balanced"; pass --preset to override.
 *
 * Reuses scoreRun from the preset-benchmark so scoring logic is identical.
 */

import * as fs from 'fs';

import {
  ANALYSIS_PRESETS,
  AnalysisPresetId,
  DEFAULT_ANALYSIS_PRESET,
} from '../../extension/ai-accessibility-assistant/src/utils/llm/ollama';
import {
  SYSTEM_PROMPT,
  buildAiPrompt,
} from '../../extension/ai-accessibility-assistant/src/utils/prompts/prompt';
import {
  parseTextResponse,
  deduplicateIssues,
} from '../../extension/ai-accessibility-assistant/src/utils/analysis/parser';
import type { AiIssue } from '../../extension/ai-accessibility-assistant/src/utils/types';

import { FixtureGroundTruth } from '../preset-benchmark/ground-truth';
import { scoreRun } from '../preset-benchmark/benchmark';

// Re-export so reporter/run can use without importing preset-benchmark directly
export type { IssueConcept, FixtureGroundTruth } from '../preset-benchmark/ground-truth';

// ─── Types ───────────────────────────────────────────────────────────────

export type ModelRunResult = {
  modelId: string;
  fixtureId: string;
  presetId: AnalysisPresetId;
  runIndex: number;
  issuesFound: AiIssue[];
  // ── Core confusion matrix ────────────────────────────────────────
  tp: number;
  tn: number;  /** True negatives: concept-pool entries not expected here and correctly not found */
  fn: number;
  fp: number;
  // ── Primary rates ────────────────────────────────────────────────
  precision: number;    // TP / (TP + FP)
  recall: number;       // TP / (TP + FN)  — also Sensitivity / TPR
  specificity: number;  // TN / (TN + FP)  — True Negative Rate
  npv: number;          // TN / (TN + FN)  — Negative Predictive Value
  // ── Composite ───────────────────────────────────────────────────
  f1: number;            // 2 * P * R / (P + R)
  accuracy: number;      // (TP + TN) / (TP + TN + FP + FN)
  balancedAccuracy: number; // (recall + specificity) / 2
  mcc: number;           // Matthews Correlation Coefficient
  // ── Timing & errors ─────────────────────────────────────────────
  responseTimeMs: number;
  errorOccurred: boolean;
  errorMessage?: string;
  rawResponse: string;
  /** Missed expected concept IDs */
  missedIds: string[];
  /** FP title strings */
  fpTitles: string[];
};

export type ModelBenchmarkConfig = {
  ollamaHost: string;
  /** Models to compare (Ollama model ids) */
  models: string[];
  /** Fixed preset applied to all models */
  presetId: AnalysisPresetId;
  fixtures: FixtureGroundTruth[];
  runsPerCombination: number;
  verbose: boolean;
};

export type ModelAggregateStats = {
  modelId: string;
  presetId: AnalysisPresetId;
  fixtureIds: string[];
  totalRuns: number;
  // ── Totals ───────────────────────────────────────────────────────
  totalTP: number;
  totalTN: number;
  totalFN: number;
  totalFP: number;
  // ── Averaged rates ───────────────────────────────────────────────
  avgPrecision: number;
  avgRecall: number;
  avgSpecificity: number;
  avgNPV: number;
  avgF1: number;
  avgAccuracy: number;
  avgBalancedAccuracy: number;
  avgMCC: number;
  avgIssuesFound: number;
  // ── Response time distribution ───────────────────────────────────
  avgResponseMs: number;
  p50ResponseMs: number;  /** Median response time */
  p95ResponseMs: number;  /** 95th percentile response time */
  // ── Consistency & errors ─────────────────────────────────────────
  f1StdDev: number;       /** Std-dev of F1 across all runs — lower = more consistent */
  errorCount: number;
  /**
   * Composite score 0-1:
   *   80 % F1  +  20 % speed score
   * Speed score = 1 - (thisTime - fastest) / (slowest - fastest)
   * Calculated after all models are known; set to avgF1 until then.
   */
  compositeScore: number;
};

// ─── Maths helpers ───────────────────────────────────────────────────────

/** Percentile of a numeric array (0–100). Array need not be pre-sorted. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo  = Math.floor(idx);
  const hi  = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/** Population standard deviation. */
function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** Matthews Correlation Coefficient. Returns 0 when denominator is 0. */
function mcc(tp: number, tn: number, fp: number, fn: number): number {
  const denom = Math.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn));
  return denom === 0 ? 0 : (tp * tn - fp * fn) / denom;
}

// ─── Ollama streaming call ────────────────────────────────────────────────

const TIMEOUT_MS = 7 * 60_000;

async function streamOllama(
  ollamaHost: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  presetId: AnalysisPresetId
): Promise<string> {
  const url = `${ollamaHost.replace(/\/$/, '')}/api/chat`;
  const options = ANALYSIS_PRESETS[presetId].options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
        stream: true,
        options,
      }),
      signal: controller.signal,
    });
  } catch (e: any) {
    clearTimeout(timer);
    if (e?.name === 'AbortError') {
      throw new Error(`Ollama timed out after ${TIMEOUT_MS / 1000}s`);
    }
    throw new Error(`Ollama connection failed: ${e?.message ?? e}`);
  }
  clearTimeout(timer);

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Ollama HTTP ${res.status}: ${body || res.statusText}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response body from Ollama');

  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const data = JSON.parse(line) as {
          response?: string;
          message?: { content?: string };
          error?: string;
        };
        if (data.error) throw new Error(`Ollama error: ${data.error}`);
        full += data.response ?? data.message?.content ?? '';
      } catch (parseErr: any) {
        if (parseErr.message?.startsWith('Ollama error:')) throw parseErr;
      }
    }
  }

  return full;
}

// ─── Single run ───────────────────────────────────────────────────────────

export async function runOnce(
  config: ModelBenchmarkConfig,
  modelId: string,
  fixture: FixtureGroundTruth,
  runIndex: number,
  /** All unique concept IDs across the entire fixture pool — used to compute TN. */
  allConceptIds: string[] = []
): Promise<ModelRunResult> {
  // Build the negative concept space for this fixture once.
  // TN = concepts from the global pool that are NOT expected in this fixture
  // and were correctly NOT emitted by the model (hallucinated FPs don't match
  // concept IDs so they don't consume the negative space).
  const expectedConceptIds = new Set(fixture.expectedIssues.map(c => c.id));
  const negativeSpaceSize = allConceptIds.filter(id => !expectedConceptIds.has(id)).length;
  const code = fs.readFileSync(fixture.filePath, 'utf8');
  const userPrompt = buildAiPrompt(
    fixture.languageId,
    code,
    '(no RAG context — llm-benchmark mode)'
  );

  const t0 = Date.now();
  let rawResponse = '';

  try {
    rawResponse = await streamOllama(
      config.ollamaHost,
      modelId,
      SYSTEM_PROMPT,
      userPrompt,
      config.presetId
    );
  } catch (err: any) {
    const fnCount = fixture.expectedIssues.length;
    return {
      modelId,
      fixtureId: fixture.fixtureId,
      presetId: config.presetId,
      runIndex,
      issuesFound: [],
      tp: 0,
      tn: negativeSpaceSize,
      fn: fnCount,
      fp: 0,
      precision: 0,
      recall: 0,
      specificity: negativeSpaceSize > 0 ? 1 : 0, // nothing found → no FPs → perfect specificity
      npv: (negativeSpaceSize + fnCount) > 0 ? negativeSpaceSize / (negativeSpaceSize + fnCount) : 0,
      f1: 0,
      accuracy: (negativeSpaceSize + fnCount) > 0
        ? negativeSpaceSize / (negativeSpaceSize + fnCount)
        : 0,
      balancedAccuracy: negativeSpaceSize > 0 ? 0.5 : 0,
      mcc: 0,
      responseTimeMs: Date.now() - t0,
      errorOccurred: true,
      errorMessage: String(err?.message ?? err),
      rawResponse: '',
      missedIds: fixture.expectedIssues.map(c => c.id),
      fpTitles: [],
    };
  }

  const elapsed = Date.now() - t0;
  const rawIssues = parseTextResponse(rawResponse);
  const issues = deduplicateIssues(rawIssues);
  const scored = scoreRun(fixture, issues);

  const missedIds = scored.conceptMatches
    .filter(cm => cm.matchedBy === null)
    .map(cm => cm.concept.id);

  // fpIssues already wraps unexpectedIssues — use one source to avoid duplicates
  const fpTitles = scored.unexpectedIssues
    .map(x => x.title ?? '')
    .filter(Boolean);

  // ── Derive extended confusion-matrix metrics ─────────────────────────────
  const tn = negativeSpaceSize;
  const { tp, fn, fp } = scored;

  const total = tp + tn + fp + fn;
  const specificityVal  = (tn + fp) > 0 ? tn / (tn + fp) : 1;
  const npvVal          = (tn + fn) > 0 ? tn / (tn + fn) : 1;
  const accuracyVal     = total > 0 ? (tp + tn) / total : 0;
  const balAccVal       = (scored.recall + specificityVal) / 2;
  const mccVal          = mcc(tp, tn, fp, fn);

  return {
    modelId,
    fixtureId: fixture.fixtureId,
    presetId: config.presetId,
    runIndex,
    issuesFound: issues,
    tp,
    tn,
    fn,
    fp,
    precision:       scored.precision,
    recall:          scored.recall,
    specificity:     specificityVal,
    npv:             npvVal,
    f1:              scored.f1,
    accuracy:        accuracyVal,
    balancedAccuracy: balAccVal,
    mcc:             mccVal,
    responseTimeMs:  elapsed,
    errorOccurred:   false,
    rawResponse,
    missedIds,
    fpTitles,
  };
}

// ─── Full benchmark ───────────────────────────────────────────────────────

export async function runBenchmark(
  config: ModelBenchmarkConfig
): Promise<ModelRunResult[]> {
  const results: ModelRunResult[] = [];
  const total =
    config.models.length *
    config.fixtures.length *
    config.runsPerCombination;
  let done = 0;

  // Build the global concept pool once — union of all expected concept IDs
  // across every fixture. Used to calculate true-negative counts.
  const allConceptIds = [
    ...new Set(config.fixtures.flatMap(f => f.expectedIssues.map(c => c.id))),
  ];

  for (const modelId of config.models) {
    for (const fixture of config.fixtures) {
      for (let run = 0; run < config.runsPerCombination; run++) {
        if (config.verbose) {
          const pct = Math.round((done / total) * 100);
          process.stdout.write(
            `\r[${pct.toString().padStart(3)}%] model=${shortName(modelId).padEnd(28)}  fixture=${fixture.fixtureId.padEnd(14)}  run=${run + 1}/${config.runsPerCombination}   `
          );
        }

        const result = await runOnce(config, modelId, fixture, run, allConceptIds);
        results.push(result);

        if (config.verbose && result.errorOccurred) {
          console.error(`\n  ERROR (${shortName(modelId)} / ${fixture.fixtureId}): ${result.errorMessage}`);
        }

        done++;
      }
    }
  }

  if (config.verbose) process.stdout.write('\r' + ' '.repeat(100) + '\r');

  return results;
}

// ─── Aggregate ────────────────────────────────────────────────────────────

export function aggregateByModel(
  results: ModelRunResult[],
  modelId: string,
  presetId: AnalysisPresetId
): ModelAggregateStats {
  const ok  = results.filter(r => r.modelId === modelId && !r.errorOccurred);
  const err = results.filter(r => r.modelId === modelId &&  r.errorOccurred);
  const all = results.filter(r => r.modelId === modelId);

  const zero: ModelAggregateStats = {
    modelId,
    presetId,
    fixtureIds: [],
    totalRuns: all.length,
    totalTP: 0,
    totalTN: all.reduce((s, r) => s + r.tn, 0),
    totalFN: all.reduce((s, r) => s + r.fn, 0),
    totalFP: 0,
    avgPrecision: 0,
    avgRecall: 0,
    avgSpecificity: 0,
    avgNPV: 0,
    avgF1: 0,
    avgAccuracy: 0,
    avgBalancedAccuracy: 0,
    avgMCC: 0,
    avgIssuesFound: 0,
    avgResponseMs: 0,
    p50ResponseMs: 0,
    p95ResponseMs: 0,
    f1StdDev: 0,
    errorCount: err.length,
    compositeScore: 0,
  };

  if (ok.length === 0) return zero;

  const n = ok.length;
  const responseTimes = ok.map(r => r.responseTimeMs);
  const f1Values      = ok.map(r => r.f1);

  return {
    modelId,
    presetId,
    fixtureIds:          [...new Set(ok.map(r => r.fixtureId))],
    totalRuns:           ok.length + err.length,
    totalTP:             ok.reduce((s, r) => s + r.tp, 0),
    totalTN:             ok.reduce((s, r) => s + r.tn, 0),
    totalFN:             ok.reduce((s, r) => s + r.fn, 0),
    totalFP:             ok.reduce((s, r) => s + r.fp, 0),
    avgPrecision:        ok.reduce((s, r) => s + r.precision,        0) / n,
    avgRecall:           ok.reduce((s, r) => s + r.recall,           0) / n,
    avgSpecificity:      ok.reduce((s, r) => s + r.specificity,      0) / n,
    avgNPV:              ok.reduce((s, r) => s + r.npv,              0) / n,
    avgF1:               ok.reduce((s, r) => s + r.f1,               0) / n,
    avgAccuracy:         ok.reduce((s, r) => s + r.accuracy,         0) / n,
    avgBalancedAccuracy: ok.reduce((s, r) => s + r.balancedAccuracy, 0) / n,
    avgMCC:              ok.reduce((s, r) => s + r.mcc,              0) / n,
    avgIssuesFound:      ok.reduce((s, r) => s + r.issuesFound.length, 0) / n,
    avgResponseMs:       ok.reduce((s, r) => s + r.responseTimeMs,   0) / n,
    p50ResponseMs:       percentile(responseTimes, 50),
    p95ResponseMs:       percentile(responseTimes, 95),
    f1StdDev:            stdDev(f1Values),
    errorCount:          err.length,
    compositeScore:      ok.reduce((s, r) => s + r.f1, 0) / n, // placeholder; recalculated in reporter
  };
}

/**
 * Recalculate composite scores now that all model timings are known.
 * composite = 0.8 * F1  +  0.2 * speedScore
 * speedScore = 1 if fastest, 0 if slowest (linear normalisation).
 */
export function applyCompositeScores(stats: ModelAggregateStats[]): ModelAggregateStats[] {
  const times = stats.filter(s => s.avgResponseMs > 0).map(s => s.avgResponseMs);
  const fastest = Math.min(...times);
  const slowest = Math.max(...times);
  const range = slowest - fastest || 1;

  return stats.map(s => {
    const speedScore = s.avgResponseMs > 0
      ? 1 - (s.avgResponseMs - fastest) / range
      : 0;
    return {
      ...s,
      compositeScore: 0.8 * s.avgF1 + 0.2 * speedScore,
    };
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Strip `:cloud` / `:latest` suffixes for display */
export function shortName(modelId: string): string {
  return modelId
    .replace(/:cloud$/, '')
    .replace(/:latest$/, '');
}
