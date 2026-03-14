/**
 * benchmark.ts  —  Preset-tuning benchmark for gpt-oss:120b-cloud
 *
 * For each (candidate × fixture × run):
 *   1. Read the fixture file
 *   2. Build the prompt (same as the extension)
 *   3. Stream a response from Ollama using the candidate's options
 *   4. Parse into AiIssue objects
 *   5. Score TP / FN / FP against ground truth
 *
 * Reuses the evaluation/preset-benchmark ground-truth and scoring so
 * results are directly comparable to the llm-benchmark.
 */

import * as fs from 'fs';

import {
  SYSTEM_PROMPT,
  buildAiPrompt,
} from '../../extension/ai-accessibility-assistant/src/utils/prompts/prompt';
import {
  parseTextResponse,
  deduplicateIssues,
} from '../../extension/ai-accessibility-assistant/src/utils/analysis/parser';
import type { AiIssue } from
  '../../extension/ai-accessibility-assistant/src/utils/types';

import { FixtureGroundTruth } from '../preset-benchmark/ground-truth';
import { scoreRun } from '../preset-benchmark/benchmark';

import { Candidate, ProfileId } from './candidates';

// ─── Types ────────────────────────────────────────────────────────────────

export type TuningRunResult = {
  candidateId: string;
  profile: ProfileId;
  fixtureId: string;
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
  missedIds: string[];
  fpTitles: string[];
};

export type TuningConfig = {
  ollamaHost: string;
  model: string;
  candidates: Candidate[];
  fixtures: FixtureGroundTruth[];
  runsPerCombination: number;
  verbose: boolean;
};

export type CandidateAggregate = {
  candidateId: string;
  profile: ProfileId;
  label: string;
  totalRuns: number;
  totalTP: number;
  totalFN: number;
  totalFP: number;
  avgPrecision: number;
  avgRecall: number;
  avgF1: number;
  avgResponseMs: number;
  p50ResponseMs: number;
  errorCount: number;
};

// ─── Ollama streaming call ────────────────────────────────────────────────

const TIMEOUT_MS = 8 * 60_000;

async function streamOllama(
  host: string,
  model: string,
  candidate: Candidate,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const url = `${host.replace(/\/$/, '')}/api/chat`;

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
        options: candidate.options,
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
  config: TuningConfig,
  candidate: Candidate,
  fixture: FixtureGroundTruth,
  runIndex: number
): Promise<TuningRunResult> {
  const code = fs.readFileSync(fixture.filePath, 'utf8');
  const userPrompt = buildAiPrompt(
    fixture.languageId,
    code,
    '(no RAG context — preset-tuning mode)'
  );

  const t0 = Date.now();
  let rawResponse = '';

  try {
    rawResponse = await streamOllama(
      config.ollamaHost,
      config.model,
      candidate,
      SYSTEM_PROMPT,
      userPrompt
    );
  } catch (err: any) {
    return {
      candidateId: candidate.id,
      profile: candidate.profile,
      fixtureId: fixture.fixtureId,
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

  const fpTitles = scored.unexpectedIssues.map(x => x.title ?? '').filter(Boolean);

  return {
    candidateId: candidate.id,
    profile: candidate.profile,
    fixtureId: fixture.fixtureId,
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
    missedIds,
    fpTitles,
  };
}

// ─── Full benchmark ───────────────────────────────────────────────────────

export async function runBenchmark(
  config: TuningConfig
): Promise<TuningRunResult[]> {
  const results: TuningRunResult[] = [];
  const total =
    config.candidates.length *
    config.fixtures.length *
    config.runsPerCombination;
  let done = 0;

  for (const candidate of config.candidates) {
    for (const fixture of config.fixtures) {
      for (let run = 0; run < config.runsPerCombination; run++) {
        if (config.verbose) {
          const pct = Math.round((done / total) * 100);
          process.stdout.write(
            `\r[${pct.toString().padStart(3)}%] ` +
            `candidate=${candidate.id.padEnd(24)}  ` +
            `fixture=${fixture.fixtureId.padEnd(14)}  ` +
            `run=${run + 1}/${config.runsPerCombination}   `
          );
        }

        const result = await runOnce(config, candidate, fixture, run);
        results.push(result);

        if (config.verbose && result.errorOccurred) {
          console.error(
            `\n  ERROR (${candidate.id} / ${fixture.fixtureId}): ${result.errorMessage}`
          );
        }

        done++;
      }
    }
  }

  if (config.verbose) process.stdout.write('\r' + ' '.repeat(110) + '\r');

  return results;
}

// ─── Aggregate ────────────────────────────────────────────────────────────

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function aggregateByCandidate(
  results: TuningRunResult[],
  candidate: Candidate
): CandidateAggregate {
  const ok  = results.filter(r => r.candidateId === candidate.id && !r.errorOccurred);
  const err = results.filter(r => r.candidateId === candidate.id &&  r.errorOccurred);

  if (ok.length === 0) {
    return {
      candidateId: candidate.id,
      profile: candidate.profile,
      label: candidate.label,
      totalRuns: err.length,
      totalTP: 0,
      totalFN: results.filter(r => r.candidateId === candidate.id).reduce((s, r) => s + r.fn, 0),
      totalFP: 0,
      avgPrecision: 0,
      avgRecall: 0,
      avgF1: 0,
      avgResponseMs: 0,
      p50ResponseMs: 0,
      errorCount: err.length,
    };
  }

  const n = ok.length;
  const times = ok.map(r => r.responseTimeMs);

  return {
    candidateId: candidate.id,
    profile: candidate.profile,
    label: candidate.label,
    totalRuns: ok.length + err.length,
    totalTP:   ok.reduce((s, r) => s + r.tp, 0),
    totalFN:   ok.reduce((s, r) => s + r.fn, 0),
    totalFP:   ok.reduce((s, r) => s + r.fp, 0),
    avgPrecision:  ok.reduce((s, r) => s + r.precision, 0) / n,
    avgRecall:     ok.reduce((s, r) => s + r.recall,    0) / n,
    avgF1:         ok.reduce((s, r) => s + r.f1,        0) / n,
    avgResponseMs: ok.reduce((s, r) => s + r.responseTimeMs, 0) / n,
    p50ResponseMs: percentile(times, 50),
    errorCount: err.length,
  };
}
