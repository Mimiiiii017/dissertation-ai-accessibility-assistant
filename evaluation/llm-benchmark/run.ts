/**
 * run.ts  —  CLI entry point for the LLM model benchmark
 *
 * Usage:
 *   npx ts-node run.ts [options]
 *
 * Options:
 *   --models   <csv>  Comma-separated model IDs to test  (default: all 11 installed)
 *   --fixtures <csv>  Comma-separated fixture IDs        (default: all 8)
 *   --preset   <id>   Analysis preset to use             (default: balanced)
 *   --host     <url>  Ollama base URL                    (default: http://localhost:11434)
 *   --runs     <n>    Repetitions per model/fixture pair (default: 1)
 *   --output   <dir>  Directory for JSON/CSV output      (default: ./results)
 *   --no-save         Skip saving result files
 *   --quiet           Suppress progress output
 *   --help
 *
 * Examples:
 *   npx ts-node run.ts
 *   npx ts-node run.ts --models qwen3-coder-next:cloud,gpt-oss:120b-cloud
 *   npx ts-node run.ts --fixtures html-issues,tsx-issues --runs 2
 *   npx ts-node run.ts --preset strict --no-save
 */

import * as path from 'path';

import {
  ANALYSIS_PRESETS,
  AnalysisPresetId,
  DEFAULT_ANALYSIS_PRESET,
} from '../../extension/ai-accessibility-assistant/src/utils/llm/ollama';

import { ALL_FIXTURES, FIXTURE_MAP } from '../preset-benchmark/ground-truth';
import { ModelBenchmarkConfig, runBenchmark, shortName } from './benchmark';
import { printReport, saveJson, saveCsv, saveReport } from './reporter';

// ─── All installed models ──────────────────────────────────────────────────

const ALL_MODELS: string[] = [
  'gemma3:27b-cloud',
  'mistral-large-3:675b-cloud',
  'qwen3-coder:480b-cloud',
  'gpt-oss:120b-cloud',
  'deepseek-v3.2:cloud',
  'devstral-2:123b-cloud',
  'kimi-k2.5:cloud',
  'glm-5:cloud',
  'qwen3-vl:235b-cloud',
  'qwen3-coder-next:cloud',
  'qwen3.5:cloud',
];

// ─── Argument parsing ──────────────────────────────────────────────────────

function parseArgs(argv: string[]) {
  const args = argv.slice(2);

  const flag = (name: string) => args.includes(name);
  const opt  = (name: string) => {
    const i = args.indexOf(name);
    return i !== -1 ? args[i + 1] : undefined;
  };

  if (flag('--help') || flag('-h')) {
    console.log(`
Usage: npx ts-node run.ts [options]

Options:
  --models   <csv>  Models to test (default: all ${ALL_MODELS.length} installed)
             Available: ${ALL_MODELS.map(shortName).join(', ')}
  --fixtures <csv>  Fixtures to test (default: all 8)
             Available: ${ALL_FIXTURES.map(f => f.fixtureId).join(', ')}
  --preset   <id>   Fixed analysis preset (default: balanced)
             Choices: ${Object.keys(ANALYSIS_PRESETS).join(', ')}
  --host     <url>  Ollama base URL (default: http://localhost:11434)
  --runs     <n>    Repetitions per combination (default: 1)
  --output   <dir>  Output directory (default: ./results)
  --no-save         Skip writing JSON/CSV files
  --quiet           Suppress progress output
  --help            Show this help
    `);
    process.exit(0);
  }

  // Models
  const modelsRaw = opt('--models');
  const models = modelsRaw
    ? modelsRaw.split(',').map(s => s.trim())
    : ALL_MODELS;

  // Fixtures
  const fixturesRaw = opt('--fixtures');
  const fixtureIds = fixturesRaw
    ? fixturesRaw.split(',').map(s => s.trim())
    : ALL_FIXTURES.map(f => f.fixtureId);

  for (const id of fixtureIds) {
    if (!FIXTURE_MAP.has(id)) {
      console.error(`Unknown fixture "${id}". Valid: ${ALL_FIXTURES.map(f => f.fixtureId).join(', ')}`);
      process.exit(1);
    }
  }

  // Preset
  const presetRaw = opt('--preset') ?? DEFAULT_ANALYSIS_PRESET;
  if (!(presetRaw in ANALYSIS_PRESETS)) {
    console.error(`Unknown preset "${presetRaw}". Valid: ${Object.keys(ANALYSIS_PRESETS).join(', ')}`);
    process.exit(1);
  }

  const runs = parseInt(opt('--runs') ?? '1', 10);
  if (isNaN(runs) || runs < 1) {
    console.error('--runs must be a positive integer');
    process.exit(1);
  }

  return {
    models,
    fixtureIds,
    presetId: presetRaw as AnalysisPresetId,
    host:      opt('--host')   ?? 'http://localhost:11434',
    runs,
    outputDir: opt('--output') ?? path.join(__dirname, 'results'),
    save:      !flag('--no-save'),
    quiet:     flag('--quiet'),
  };
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv);
  const fixtures = opts.fixtureIds.map(id => FIXTURE_MAP.get(id)!);
  const totalCalls = opts.models.length * fixtures.length * opts.runs;

  const config: ModelBenchmarkConfig = {
    ollamaHost: opts.host,
    models:     opts.models,
    presetId:   opts.presetId,
    fixtures,
    runsPerCombination: opts.runs,
    verbose: !opts.quiet,
  };

  if (!opts.quiet) {
    console.log('');
    console.log('  LLM Model Benchmark — starting');
    console.log(`  Ollama:   ${opts.host}`);
    console.log(`  Preset:   ${opts.presetId}`);
    console.log(`  Models:   ${opts.models.length}  →  ${opts.models.map(shortName).join(', ')}`);
    console.log(`  Fixtures: ${opts.fixtureIds.length}  →  ${opts.fixtureIds.join(', ')}`);
    console.log(`  Runs:     ${opts.runs} per combination`);
    console.log(`  Total:    ${totalCalls} LLM calls`);
    console.log('');

    // Rough estimate: cloud models vary wildly; use a conservative 2 min/call
    const estMins = Math.ceil(totalCalls * 2);
    console.log(`  Estimated time: ~${estMins} min (varies significantly by model)`);
    console.log('');
    console.log('  Running… (Ctrl+C to abort)');
  }

  const t0 = Date.now();
  let results;
  try {
    results = await runBenchmark(config);
  } catch (err: any) {
    console.error('\nFatal error:', err.message ?? err);
    process.exit(1);
  }
  const elapsed = Date.now() - t0;

  if (!opts.quiet) {
    console.log(`  Completed ${results.length} runs in ${(elapsed / 1000).toFixed(1)}s`);
  }

  printReport(results, opts.models, opts.presetId);

  if (opts.save) {
    const jsonPath    = saveJson(results, opts.outputDir);
    const csvPath     = saveCsv(results, opts.models, opts.outputDir);
    const reportPath  = saveReport(results, opts.models, opts.presetId, opts.outputDir);
    console.log(`  JSON   saved → ${jsonPath}`);
    console.log(`  CSV    saved → ${csvPath}`);
    console.log(`  Report saved → ${reportPath}`);
    console.log('');
  }
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
