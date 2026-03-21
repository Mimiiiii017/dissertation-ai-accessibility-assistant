/**
 * benchmark.ts  —  Cloud-LLM-Preliminary
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
import { CLOUD_BENCHMARK_OPTIONS, CLOUD_SAFE_OPTIONS } from './benchmark-params';
import {
  BENCHMARK_SYSTEM_PROMPT as SYSTEM_PROMPT,
  buildAiPrompt,
} from './benchmark-prompt';
import {
  parseTextResponse,
  deduplicateIssues,
} from '../../extension/ai-accessibility-assistant/src/utils/analysis/parser';
import type { AiIssue } from '../../extension/ai-accessibility-assistant/src/utils/types';
import { ragRetrieve, formatRagContext } from '../../extension/ai-accessibility-assistant/src/utils/rag/rag';
import { buildRagQuery } from '../../extension/ai-accessibility-assistant/src/utils/rag/ragQueryBuilder';

import { FixtureGroundTruth } from '../preset-benchmark/ground-truth';
import { scoreRun } from '../preset-benchmark/benchmark';

// Re-export so reporter/run can use without importing preset-benchmark directly
export type { IssueConcept, FixtureGroundTruth } from '../preset-benchmark/ground-truth';

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Extract complexity tier from fixture ID (e.g., 'html-low' → 'low') */
export function getComplexityTier(fixtureId: string): ComplexityTier {
  if (fixtureId.includes('-low')) return 'low';
  if (fixtureId.includes('-medium')) return 'medium';
  if (fixtureId.includes('-high')) return 'high';
  // Default if not found
  return 'medium';
}

// ─── Types ───────────────────────────────────────────────────────────────

export type ComplexityTier = 'low' | 'medium' | 'high';

/**
 * Streaming quality metrics captured at different token percentages.
 * Shows how F1/Precision/Recall evolve as more tokens are generated.
 */
export type StreamingQualityMetrics = {
  /** Metrics at 25% of final token count */
  at25percent?: { f1: number; precision: number; recall: number; tokenCount: number };
  /** Metrics at 50% of final token count */
  at50percent?: { f1: number; precision: number; recall: number; tokenCount: number };
  /** Metrics at 75% of final token count */
  at75percent?: { f1: number; precision: number; recall: number; tokenCount: number };
  /** Metrics at final response (100%) */
  at100percent: { f1: number; precision: number; recall: number; tokenCount: number };
  /** Maximum F1 achieved before 100% (indicates potential early-stopping point) */
  maxF1Before100?: number;
};

/**
 * Pareto frontier analysis: identifies models that form the optimal tradeoff curve.
 * A model is on the Pareto frontier if no other model has both better F1 AND
 * equal/better latency (or vice versa).
 */
export type ParetoClassification = {
  modelId: string;
  f1: number;
  latencyMs: number;
  /** true if on Pareto frontier (no model dominates it) */
  isParetoOptimal: boolean;
  /** Reason for classification (if not optimal) */
  dominatedBy?: string[]; // array of model IDs that dominate this one
};

export type ModelRunResult = {
  modelId: string;
  fixtureId: string;
  complexityTier?: ComplexityTier;  // Optional for compatibility with tests
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
  /** Optional streaming quality metrics (when streaming capture is enabled) */
  streamingMetrics?: StreamingQualityMetrics;
};

export type ModelBenchmarkConfig = {
  ollamaHost: string;
  /** RAG service endpoint — defaults to http://127.0.0.1:8000 */
  ragEndpoint?: string;
  /** Models to compare (Ollama model ids) */
  models: string[];
  /** Fixed preset applied to all models */
  presetId: AnalysisPresetId;
  fixtures: FixtureGroundTruth[];
  runsPerCombination: number;
  verbose: boolean;
  /**
   * Max number of fixture calls to run in parallel per model.
   * Set > 1 for cloud models (remote endpoints tolerate concurrency).
   * Defaults to 1 (fully sequential, original behaviour).
   */
  concurrency?: number;
  /**
   * When true, skip RAG retrieval and pass '(no RAG context)' to the prompt.
   * Use for ablation testing: compare RAG vs no-RAG F1 on the same fixtures.
   */
  noRag?: boolean;
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

/**
 * Simple token counter: splits on whitespace and punctuation.
 * Not perfect (e.g. contractions) but good enough for streaming % calculation.
 */
function countTokensApprox(text: string): number {
  return text
    .split(/\s+/)
    .filter(t => t.length > 0)
    .length;
}

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
  const rawOptions = ANALYSIS_PRESETS[presetId].options;
  // Cloud-routed models reject local Ollama options (num_ctx, seed, mirostat,
  // top_k, repeat_* etc.) and return HTTP 500.  For cloud models we send only
  // the three cloud-safe fields derived from CLOUD_BENCHMARK_OPTIONS.  Local
  // models receive the full CLOUD_BENCHMARK_OPTIONS so all params are exercised.
  // Neither path touches the extension's ANALYSIS_PRESETS.
  const isCloudModel = model.endsWith(':cloud') || model.includes(':cloud');
  const options = isCloudModel ? CLOUD_SAFE_OPTIONS : CLOUD_BENCHMARK_OPTIONS;

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

/**
 * Scores a partial response and returns F1/Precision/Recall metrics.
 * Used for streaming quality analysis.
 */
function scorePartialResponse(
  responseText: string,
  fixture: FixtureGroundTruth,
  allConceptIds: string[] = []
): { f1: number; precision: number; recall: number } {
  if (!responseText.trim()) {
    return { f1: 0, precision: 0, recall: 0 };
  }

  const rawIssues = parseTextResponse(responseText);
  const issues = deduplicateIssues(rawIssues);
  const scored = scoreRun(fixture, issues);

  return {
    f1: scored.f1,
    precision: scored.precision,
    recall: scored.recall,
  };
}

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

  // ── RAG context retrieval ───────────────────────────────────────────────
  let contextBlock = '(no RAG context)';
  if (!config.noRag) {
    const ragEndpoint = config.ragEndpoint ?? 'http://127.0.0.1:8000';
    try {
      const ragQuery = buildRagQuery(fixture.languageId, code);
      const ragResult = await ragRetrieve(ragEndpoint, ragQuery, 6, 'accessibility');
      if (ragResult.chunks.length > 0) {
        contextBlock = formatRagContext(ragResult.chunks);
      }
    } catch {
      // RAG service not running — fall back to no context (benchmark still works)
    }
  }

  const userPrompt = buildAiPrompt(
    fixture.languageId,
    code,
    contextBlock
  );

  const t0 = Date.now();
  let rawResponse = '';

  // Retry up to 2 times on transient "terminated" errors from the cloud relay.
  const MAX_RETRIES = 2;
  let lastErr: Error | undefined;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      rawResponse = await streamOllama(
        config.ollamaHost,
        modelId,
        SYSTEM_PROMPT,
        userPrompt,
        config.presetId
      );
      lastErr = undefined;
      break;
    } catch (e: any) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      const isTerminated = lastErr.message.includes('terminated');
      if (isTerminated && attempt < MAX_RETRIES) {
        // Exponential back-off: 2 s, 4 s
        await new Promise(r => setTimeout(r, 2_000 * (attempt + 1)));
        continue;
      }
      break;
    }
  }

  if (lastErr) {
    const fnCount = fixture.expectedIssues.length;
    return {
      modelId,
      fixtureId: fixture.fixtureId,
      complexityTier: getComplexityTier(fixture.fixtureId),
      presetId: config.presetId,
      runIndex,
      issuesFound: [],
      tp: 0,
      tn: negativeSpaceSize,
      fn: fnCount,
      fp: 0,
      precision: 0,
      recall: 0,
      specificity: negativeSpaceSize > 0 ? 1 : 0,
      npv: (negativeSpaceSize + fnCount) > 0 ? negativeSpaceSize / (negativeSpaceSize + fnCount) : 0,
      f1: 0,
      accuracy: (negativeSpaceSize + fnCount) > 0
        ? negativeSpaceSize / (negativeSpaceSize + fnCount)
        : 0,
      balancedAccuracy: negativeSpaceSize > 0 ? 0.5 : 0,
      mcc: 0,
      responseTimeMs: Date.now() - t0,
      errorOccurred: true,
      errorMessage: lastErr.message,
      rawResponse: '',
      missedIds: fixture.expectedIssues.map(c => c.id),
      fpTitles: [],
      streamingMetrics: {
        at100percent: { f1: 0, precision: 0, recall: 0, tokenCount: 0 },
      },
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

  // ── Capture streaming quality metrics (at intermediate token %s) ───────────
  const streamingMetrics: StreamingQualityMetrics = {
    at100percent: {
      f1: scored.f1,
      precision: scored.precision,
      recall: scored.recall,
      tokenCount: countTokensApprox(rawResponse),
    },
  };

  // Calculate intermediate snapshots at 25%, 50%, 75% token count
  const totalTokens = countTokensApprox(rawResponse);
  if (totalTokens > 50) {
    // Only compute if response is substantial enough
    const tokens25 = Math.floor(totalTokens * 0.25);
    const tokens50 = Math.floor(totalTokens * 0.50);
    const tokens75 = Math.floor(totalTokens * 0.75);

    // Truncate response at token percentages
    const words = rawResponse.split(/\s+/).filter(w => w.length > 0);
    const resp25 = words.slice(0, tokens25).join(' ');
    const resp50 = words.slice(0, tokens50).join(' ');
    const resp75 = words.slice(0, tokens75).join(' ');

    if (resp25.length > 10) {
      const metrics25 = scorePartialResponse(resp25, fixture, allConceptIds);
      streamingMetrics.at25percent = { ...metrics25, tokenCount: tokens25 };
    }
    if (resp50.length > 10) {
      const metrics50 = scorePartialResponse(resp50, fixture, allConceptIds);
      streamingMetrics.at50percent = { ...metrics50, tokenCount: tokens50 };
    }
    if (resp75.length > 10) {
      const metrics75 = scorePartialResponse(resp75, fixture, allConceptIds);
      streamingMetrics.at75percent = { ...metrics75, tokenCount: tokens75 };
    }

    // Calculate max F1 before 100%
    const preF1s = [
      streamingMetrics.at25percent?.f1,
      streamingMetrics.at50percent?.f1,
      streamingMetrics.at75percent?.f1,
    ].filter(f => f !== undefined) as number[];
    if (preF1s.length > 0) {
      streamingMetrics.maxF1Before100 = Math.max(...preF1s);
    }
  }

  return {
    modelId,
    fixtureId: fixture.fixtureId,
    complexityTier: getComplexityTier(fixture.fixtureId),
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
    streamingMetrics,
  };
}

// ─── Full benchmark ───────────────────────────────────────────────────────

/** Run at most `limit` async tasks concurrently. */
async function runConcurrent<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (next < tasks.length) {
      const idx = next++;
      results[idx] = await tasks[idx]();
    }
  }
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function runBenchmark(
  config: ModelBenchmarkConfig
): Promise<ModelRunResult[]> {
  const concurrency = Math.max(1, config.concurrency ?? 1);
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

  const allResults: ModelRunResult[] = [];

  for (const modelId of config.models) {
    // Build a flat list of tasks for this model across all fixtures × runs.
    const tasks: (() => Promise<ModelRunResult>)[] = [];
    for (const fixture of config.fixtures) {
      for (let run = 0; run < config.runsPerCombination; run++) {
        const capturedFixture = fixture;
        const capturedRun = run;
        tasks.push(async () => {
          if (config.verbose) {
            const pct = Math.round((done / total) * 100);
            process.stdout.write(
              `\r[${pct.toString().padStart(3)}%] model=${shortName(modelId).padEnd(28)}  fixture=${capturedFixture.fixtureId.padEnd(14)}  run=${capturedRun + 1}/${config.runsPerCombination}   `
            );
          }
          const result = await runOnce(config, modelId, capturedFixture, capturedRun, allConceptIds);
          done++;
          if (config.verbose && result.errorOccurred) {
            console.error(`\n  ERROR (${shortName(modelId)} / ${capturedFixture.fixtureId}): ${result.errorMessage}`);
          }
          return result;
        });
      }
    }
    const modelResults = await runConcurrent(tasks, concurrency);
    allResults.push(...modelResults);
  }

  if (config.verbose) process.stdout.write('\r' + ' '.repeat(100) + '\r');

  return allResults;
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
/** Approximate parameter-count label shown beside each model in all output. */
const MODEL_SIZE_LABELS: Record<string, string> = {
  // ── Smaller / faster (<30 B) ──────────────────────────────────────────
  'gemma3:4b-cloud':            '~4B',
  'ministral-3:3b-cloud':       '~3B',
  'ministral-3:14b-cloud':      '~14B',
  'gpt-oss:20b-cloud':          '~20B',
  'devstral-small-2:24b-cloud': '~24B',
  'nemotron-3-nano:30b-cloud':  '~30B',
  // ── Mid-range (30–200 B) ──────────────────────────────────────────────
  'gemma3:27b-cloud':               '~27B',
  'gemini-3-flash-preview:cloud':   '~?B',
  'minimax-m2:cloud':               '~456B MoE',
  'minimax-m2.5:cloud':             '~456B MoE',
  'nemotron-3-super:cloud':         '~253B',
  'deepseek-v3.2:cloud':            '~671B MoE',
  // ── Large (100–700 B) ─────────────────────────────────────────────────
  'devstral-2:123b-cloud':      '~123B',
  'gpt-oss:120b-cloud':         '~120B',
  'cogito-2.1:671b-cloud':      '~671B',
  'mistral-large-3:675b-cloud': '~675B',
  // ── Very large / undisclosed ──────────────────────────────────────────
  'qwen3.5:397b-cloud':         '~397B',
  'qwen3-coder:480b-cloud':     '~480B',
  'qwen3-vl:235b-cloud':        '~235B',
  'qwen3.5:cloud':              '~397B',
  'qwen3-coder-next:cloud':     '~?B',
  'kimi-k2.5:cloud':            '~?B',
  'glm-5:cloud':                '~?B',
};

// ─── Vulnerability Analysis (Step 6) ──────────────────────────────────────

/**
 * Vulnerability profile: tracks which violation patterns a model catches/misses.
 * Used to identify "blind spots" — accessibility issues the model consistently
 * fails to detect.
 */
export type VulnerabilityProfile = {
  modelId: string;
  violation: string;           // e.g., "no-accessible-name", "missing-label"
  category: string;            // e.g., "button", "form", "image"
  totalFixtures: number;       // how many fixtures test this violation
  detectionCount: number;      // how many it actually caught
  detectionRate: number;       // 0-1, = detectionCount / totalFixtures
  /** Typical blind spot if < 0.5; consistent weakness if 0.25-0.5; good if >= 0.75 */
  blindSpot: 'critical' | 'weak' | 'fair' | 'good';
};

export type VulnerabilityAnalysis = {
  modelId: string;
  totalViolationTypes: number;
  criticalBlindSpots: number;     // violations with < 25% detection
  weakAreas: number;               // violations with 25%-75% detection
  strongAreas: number;             // violations with >= 75% detection
  profiles: VulnerabilityProfile[];
};

/**
 * Compute vulnerability analysis for a model using adversarial fixtures.
 * Identifies which specific violation patterns it struggles with.
 */
export function computeVulnerabilityAnalysis(
  modelId: string,
  results: ModelRunResult[]
): VulnerabilityAnalysis {
  // Group results by violation pattern
  const byViolation = new Map<
    string,
    { category: string; fixtureCaught: string[]; fixtureTotal: string[] }
  >();

  for (const result of results) {
    if (!result.fixtureId.startsWith('button-') && 
        !result.fixtureId.startsWith('input-') &&
        !result.fixtureId.startsWith('form-') &&
        !result.fixtureId.startsWith('image-') &&
        !result.fixtureId.startsWith('heading-') &&
        !result.fixtureId.startsWith('link-') &&
        !result.fixtureId.startsWith('aria-') &&
        !result.fixtureId.startsWith('complex-')) {
      continue; // Skip non-adversarial fixtures
    }

    // Extract violation from fixture ID (e.g., 'button-no-name' → 'button', 'no-name')
    const parts = result.fixtureId.split('-');
    const category = parts[0];
    const violation = parts.slice(1).join('-');
    const key = `${category}/${violation}`;

    if (!byViolation.has(key)) {
      byViolation.set(key, {
        category,
        fixtureCaught: [],
        fixtureTotal: [],
      });
    }

    const entry = byViolation.get(key)!;
    entry.fixtureTotal.push(result.fixtureId);

    // Consider it "caught" if it had > 0 TP or at least detected something
    if (result.tp > 0 || result.issuesFound.length > 0) {
      entry.fixtureCaught.push(result.fixtureId);
    }
  }

  // Generate profiles
  const profiles: VulnerabilityProfile[] = Array.from(
    byViolation.entries()
  ).map(([key, data]) => {
    const detectionRate = data.fixtureTotal.length > 0 
      ? data.fixtureCaught.length / data.fixtureTotal.length 
      : 0;

    let blindSpot: 'critical' | 'weak' | 'fair' | 'good';
    if (detectionRate < 0.25) blindSpot = 'critical';
    else if (detectionRate < 0.75) blindSpot = 'weak';
    else if (detectionRate < 1.0) blindSpot = 'fair';
    else blindSpot = 'good';

    return {
      modelId,
      violation: key.split('/')[1] || key,
      category: data.category,
      totalFixtures: data.fixtureTotal.length,
      detectionCount: data.fixtureCaught.length,
      detectionRate,
      blindSpot,
    };
  });

  // Count by category
  const criticalBlindSpots = profiles.filter(p => p.blindSpot === 'critical').length;
  const weakAreas = profiles.filter(p => p.blindSpot === 'weak').length;
  const strongAreas = profiles.filter(p => p.blindSpot === 'good').length;

  return {
    modelId,
    totalViolationTypes: profiles.length,
    criticalBlindSpots,
    weakAreas,
    strongAreas,
    profiles: profiles.sort((a, b) => a.detectionRate - b.detectionRate),
  };
}

/**
 * Compute Pareto frontier for F1 vs. latency tradeoff.
 * A model is Pareto-optimal if no other model has both:
 *   - Higher F1 AND equal/better latency
 *   - Equal/better latency AND higher F1
 */
export function computeParetoFrontier(
  stats: ModelAggregateStats[]
): ParetoClassification[] {
  const classified: ParetoClassification[] = stats.map(s => ({
    modelId: s.modelId,
    f1: s.avgF1,
    latencyMs: s.avgResponseMs,
    isParetoOptimal: true,
    dominatedBy: [],
  }));

  // Check each model against all others
  for (let i = 0; i < classified.length; i++) {
    const current = classified[i];
    for (let j = 0; j < classified.length; j++) {
      if (i === j) continue;
      const other = classified[j];

      // Check if 'other' dominates 'current' (better F1 AND faster or equal latency)
      if (other.f1 > current.f1 && other.latencyMs <= current.latencyMs) {
        current.isParetoOptimal = false;
        if (!current.dominatedBy!.includes(other.modelId)) {
          current.dominatedBy!.push(other.modelId);
        }
      }
    }
  }

  return classified;
}

export function shortName(modelId: string): string {
  const base = modelId
    .replace(/:cloud$/, '')
    .replace(/-cloud$/, '')
    .replace(/:latest$/, '');
  const sizeLabel = MODEL_SIZE_LABELS[modelId];
  return sizeLabel ? `${base} (${sizeLabel})` : base;
}
