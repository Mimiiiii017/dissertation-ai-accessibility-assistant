/**
 * run.ts  —  CLI entry point for the preset-tuning benchmark
 *
 * Tests gpt-oss:120b-cloud with 20 candidate configurations across all 8
 * fixtures to find the best settings for each of the 4 final extension
 * presets (quick / strict / balanced / thorough).
 *
 * Candidate groups:
 *   quick       (4) — GPT-OSS research settings, fast output
 *   strict      (4) — temp 0.2–0.25, fewest false positives
 *   balanced    (4) — temp 0.3–0.4, research sweet spot
 *   thorough    (4) — temp 0.4–0.5, maximum recall
 *   reasoning   (4) — temp 0.7, quality-focused for complex ARIA analysis
 *   performance (4) — top_k=100 speed hack, optimised for large files
 *   current     (4) — existing ollama.ts presets (comparison baseline)
 *
 * Usage:
 *   npx ts-node run.ts [options]
 *
 * Options:
 *   --candidates <csv>  Candidate IDs to test  (default: all 20)
 *   --profiles   <csv>  Run only candidates in these profiles
 *                       Choices: quick, strict, balanced, thorough, reasoning, performance, current
 *   --fixtures   <csv>  Fixture IDs to test    (default: all 8)
 *   --model      <id>   Ollama model           (default: gpt-oss:120b-cloud)
 *   --host       <url>  Ollama base URL        (default: http://localhost:11434)
 *   --runs       <n>    Repetitions per combo  (default: 1)
 *   --output     <dir>  Output directory       (default: ./results)
 *   --no-save           Skip writing output files
 *   --quiet             Suppress progress output
 *   --help
 *
 * Examples:
 *   npx ts-node run.ts                              # full run — all 20 candidates
 *   npx ts-node run.ts --profiles quick,strict       # only 8 candidates
 *   npx ts-node run.ts --profiles current            # baseline only
 *   npx ts-node run.ts --runs 2                      # two passes (better statistics)
 *   npx ts-node run.ts --candidates balanced-core,balanced-speed
 */

import * as path from 'path';

import { ALL_FIXTURES, FIXTURE_MAP } from '../preset-benchmark/ground-truth';
import {
  CANDIDATES,
  CANDIDATE_MAP,
  PROFILES,
  ProfileId,
  Candidate,
} from './candidates';
import { TuningConfig, runBenchmark } from './benchmark';
import { printReport, saveJson, saveCsv, saveReport } from './reporter';

const MODEL = 'gpt-oss:120b-cloud';

// ─── Argument parsing ─────────────────────────────────────────────────────

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
  --candidates <csv>  Specific candidate IDs (default: all ${CANDIDATES.length})
                      Available: ${CANDIDATES.map(c => c.id).join(', ')}
  --profiles   <csv>  Filter by profile (default: all 5)
                      Choices: ${PROFILES.join(', ')}
                      Use "current" to run only the baseline comparison
  --fixtures   <csv>  Fixture IDs (default: all ${ALL_FIXTURES.length})
                      Available: ${ALL_FIXTURES.map(f => f.fixtureId).join(', ')}
  --model      <id>   Ollama model (default: ${MODEL})
  --host       <url>  Ollama base URL (default: http://localhost:11434)
  --runs       <n>    Repetitions per combination (default: 1)
  --output     <dir>  Output directory (default: ./results)
  --no-save           Skip saving result files
  --quiet             Suppress progress output
  --help              Show this help
    `);
    process.exit(0);
  }

  // Candidates
  let candidates: Candidate[];
  const candidatesRaw = opt('--candidates');
  const profilesRaw   = opt('--profiles');

  if (candidatesRaw) {
    candidates = candidatesRaw.split(',').map(s => s.trim()).map(id => {
      const c = CANDIDATE_MAP.get(id);
      if (!c) {
        console.error(`Unknown candidate "${id}". Valid: ${CANDIDATES.map(c => c.id).join(', ')}`);
        process.exit(1);
      }
      return c!;
    });
  } else if (profilesRaw) {
    const profiles = profilesRaw.split(',').map(s => s.trim()) as ProfileId[];
    for (const p of profiles) {
      if (!PROFILES.includes(p)) {
        console.error(`Unknown profile "${p}". Valid: ${PROFILES.join(', ')}`);
        process.exit(1);
      }
    }
    candidates = CANDIDATES.filter(c => profiles.includes(c.profile));
  } else {
    candidates = CANDIDATES;
  }

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

  const runs = parseInt(opt('--runs') ?? '1', 10);
  if (isNaN(runs) || runs < 1) {
    console.error('--runs must be a positive integer');
    process.exit(1);
  }

  return {
    candidates,
    fixtureIds,
    model:     opt('--model')  ?? MODEL,
    host:      opt('--host')   ?? 'http://localhost:11434',
    runs,
    outputDir: opt('--output') ?? path.join(__dirname, 'results'),
    save:      !flag('--no-save'),
    quiet:     flag('--quiet'),
  };
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv);
  const fixtures = opts.fixtureIds.map(id => FIXTURE_MAP.get(id)!);
  const totalCalls = opts.candidates.length * fixtures.length * opts.runs;

  const config: TuningConfig = {
    ollamaHost:         opts.host,
    model:              opts.model,
    candidates:         opts.candidates,
    fixtures,
    runsPerCombination: opts.runs,
    verbose:            !opts.quiet,
  };

  if (!opts.quiet) {
    console.log('');
    console.log('  Preset Tuning Benchmark — starting');
    console.log(`  Ollama:     ${opts.host}`);
    console.log(`  Model:      ${opts.model}`);
    console.log(`  Candidates: ${opts.candidates.length}  →  ${opts.candidates.map(c => c.id).join(', ')}`);
    console.log(`  Fixtures:   ${opts.fixtureIds.length}  →  ${opts.fixtureIds.join(', ')}`);
    console.log(`  Runs:       ${opts.runs} per combination`);
    console.log(`  Total:      ${totalCalls} LLM calls`);
    console.log('');
    const estMins = Math.ceil(totalCalls * 0.5);  // ~30s per call for gpt-oss
    console.log(`  Estimated time: ~${estMins} min`);
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

  if (opts.save) {
    const jsonPath   = saveJson(results, opts.outputDir);
    const csvPath    = saveCsv(results, opts.candidates, opts.outputDir);
    const reportPath = saveReport(results, opts.candidates, opts.model, opts.outputDir);
    console.log(`  JSON   saved → ${jsonPath}`);
    console.log(`  CSV    saved → ${csvPath}`);
    console.log(`  Report saved → ${reportPath}`);
    console.log('');
  } else {
    printReport(results, opts.candidates, opts.model);
  }
}

main().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
