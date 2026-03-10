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
  tp: number;
  fn: number;
  fp: number;
  precision: number;
  recall: number;
  f1: number;
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
  totalTP: number;
  totalFN: number;
  totalFP: number;
  avgPrecision: number;
  avgRecall: number;
  avgF1: number;
  avgResponseMs: number;
  errorCount: number;
  /**
   * Composite score 0-1:
   *   80 % F1  +  20 % speed score
   * Speed score = 1 - (thisTime - fastest) / (slowest - fastest)
   * Calculated after all models are known; set to avgF1 until then.
   */
  compositeScore: number;
};

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
  runIndex: number
): Promise<ModelRunResult> {
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
    return {
      modelId,
      fixtureId: fixture.fixtureId,
      presetId: config.presetId,
      runIndex,
      issuesFound: [],
      tp: 0,
      fn: fixture.expectedIssues.length,
      fp: 0,
      precision: 0,
      recall: 0,
      f1: 0,
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

  const fpTitles = [
    ...scored.fpIssues.map(x => x.issue.title ?? ''),
    ...scored.unexpectedIssues
      .filter(() => fixture.isClean)   // only count unexpected as FP on clean fixtures
      .map(x => x.title ?? ''),
  ].filter(Boolean);

  return {
    modelId,
    fixtureId: fixture.fixtureId,
    presetId: config.presetId,
    runIndex,
    issuesFound: issues,
    tp: scored.tp,
    fn: scored.fn,
    fp: scored.fp,
    precision: scored.precision,
    recall: scored.recall,
    f1: scored.f1,
    responseTimeMs: elapsed,
    errorOccurred: false,
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

  for (const modelId of config.models) {
    for (const fixture of config.fixtures) {
      for (let run = 0; run < config.runsPerCombination; run++) {
        if (config.verbose) {
          const pct = Math.round((done / total) * 100);
          process.stdout.write(
            `\r[${pct.toString().padStart(3)}%] model=${shortName(modelId).padEnd(28)}  fixture=${fixture.fixtureId.padEnd(14)}  run=${run + 1}/${config.runsPerCombination}   `
          );
        }

        const result = await runOnce(config, modelId, fixture, run);
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

  if (ok.length === 0) {
    return {
      modelId,
      presetId,
      fixtureIds: [],
      totalRuns: err.length,
      totalTP: 0,
      totalFN: results.filter(r => r.modelId === modelId).reduce((s, r) => s + r.fn, 0),
      totalFP: 0,
      avgPrecision: 0,
      avgRecall: 0,
      avgF1: 0,
      avgResponseMs: 0,
      errorCount: err.length,
      compositeScore: 0,
    };
  }

  return {
    modelId,
    presetId,
    fixtureIds: [...new Set(ok.map(r => r.fixtureId))],
    totalRuns: ok.length + err.length,
    totalTP:   ok.reduce((s, r) => s + r.tp, 0),
    totalFN:   ok.reduce((s, r) => s + r.fn, 0),
    totalFP:   ok.reduce((s, r) => s + r.fp, 0),
    avgPrecision:   ok.reduce((s, r) => s + r.precision,   0) / ok.length,
    avgRecall:      ok.reduce((s, r) => s + r.recall,      0) / ok.length,
    avgF1:          ok.reduce((s, r) => s + r.f1,          0) / ok.length,
    avgResponseMs:  ok.reduce((s, r) => s + r.responseTimeMs, 0) / ok.length,
    errorCount: err.length,
    compositeScore: ok.reduce((s, r) => s + r.f1, 0) / ok.length, // placeholder; recalculated in reporter
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
