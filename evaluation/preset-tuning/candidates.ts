/**
 * candidates.ts  —  Candidate preset configurations for gpt-oss:120b-cloud
 *
 * 40 candidates total (6 per tuning profile + 4 current baseline):
 *
 *   quick       (6) — vary top_k (40 vs 100), temperature (0.2/0.3/0.4),
 *                     top_p (0.9 vs 0.95), num_ctx (16k vs 32k)
 *   strict      (6) — vary temperature (0.15/0.20/0.25), top_k (40 vs 100),
 *                     repeat_penalty (1.1 vs 1.15), num_predict (18k vs 24k)
 *   balanced    (6) — vary temperature (0.25/0.30/0.35/0.40), top_k,
 *                     top_p (0.9 vs 0.95)
 *   thorough    (6) — vary temperature (0.40/0.45/0.50), top_k (40 vs 0),
 *                     top_p (0.9 vs 0.95), num_predict (28k vs 32k)
 *   reasoning   (6) — vary temperature (0.50/0.60/0.70/0.80),
 *                     top_k (40 vs 0 vs 100)
 *   performance (6) — top_k=100 always; vary temp (0.20/0.30/0.40),
 *                     num_predict (8k/10k/14k), num_ctx (16k vs 32k), top_p
 *   current     (4) — exact copies of the 4 original ollama.ts presets
 *                     (comparison baseline)
 *
 * Each candidate within a profile changes exactly ONE parameter from the
 * profile's "core" setting so you can isolate what actually moves the needle.
 *
 * Settings based on GPT-OSS community research:
 *   • Coding tasks:       temperature 0.2–0.5, top_p 0.9, top_k 40
 *   • Quality/reasoning:  temperature 0.7, top_p 0.95
 *   • top_k=100 speed hack: significant throughput boost on Apple Silicon
 *     and CUDA with negligible quality loss for short/medium outputs
 *   • repeat_penalty 1.1 prevents repetition loops
 *   • Context window: 32k for stability (65k+ causes dramatic slowdowns)
 *   • Flash attention is handled server-side by the Ollama runtime
 */

import type { OllamaOptions } from
  '../../extension/ai-accessibility-assistant/src/utils/llm/ollama';

// ─── Types ────────────────────────────────────────────────────────────────

export type ProfileId =
  | 'quick' | 'strict' | 'balanced' | 'thorough'
  | 'reasoning' | 'performance' | 'current';

export type Candidate = {
  id: string;
  profile: ProfileId;
  label: string;
  description: string;
  options: OllamaOptions;
};

// ─── Candidate definitions ────────────────────────────────────────────────

export const CANDIDATES: Candidate[] = [

  // ── QUICK  ───────────────────────────────────────────────────────────────
  // Core: temp=0.3, top_k=40, top_p=0.9, num_predict=8000, num_ctx=32768, rp=1.1
  // Each candidate changes ONE thing from the core to isolate its impact.
  {
    id: 'quick-core',
    profile: 'quick',
    label: 'Quick / Core',
    description: 'Core: temp=0.3, top_k=40, top_p=0.9, 8k tokens, 32k ctx.',
    options: { num_predict: 8000,  num_ctx: 32768, temperature: 0.3,  top_p: 0.9,  top_k: 40,  repeat_penalty: 1.1,  repeat_last_n: 96,  seed: 42 },
  },
  {
    id: 'quick-t02',
    profile: 'quick',
    label: 'Quick / temp=0.2',
    description: '↓ temperature 0.3→0.2. More deterministic, fewer FPs.',
    options: { num_predict: 8000,  num_ctx: 32768, temperature: 0.2,  top_p: 0.9,  top_k: 40,  repeat_penalty: 1.1,  repeat_last_n: 96,  seed: 42 },
  },
  {
    id: 'quick-t04',
    profile: 'quick',
    label: 'Quick / temp=0.4',
    description: '↑ temperature 0.3→0.4. More creative, broader coverage.',
    options: { num_predict: 8000,  num_ctx: 32768, temperature: 0.4,  top_p: 0.9,  top_k: 40,  repeat_penalty: 1.1,  repeat_last_n: 96,  seed: 42 },
  },
  {
    id: 'quick-k100',
    profile: 'quick',
    label: 'Quick / top_k=100',
    description: '↑ top_k 40→100 (GPT-OSS speed hack). Same quality, faster.',
    options: { num_predict: 8000,  num_ctx: 32768, temperature: 0.3,  top_p: 0.9,  top_k: 100, repeat_penalty: 1.1,  repeat_last_n: 96,  seed: 42 },
  },
  {
    id: 'quick-ctx16k',
    profile: 'quick',
    label: 'Quick / ctx=16k',
    description: '↓ num_ctx 32k→16k + top_k=100. Smallest context, absolute fastest.',
    options: { num_predict: 8000,  num_ctx: 16384, temperature: 0.3,  top_p: 0.9,  top_k: 100, repeat_penalty: 1.1,  repeat_last_n: 96,  seed: 42 },
  },
  {
    id: 'quick-p95',
    profile: 'quick',
    label: 'Quick / top_p=0.95',
    description: '↑ top_p 0.9→0.95. Wider nucleus sampling, same temp.',
    options: { num_predict: 8000,  num_ctx: 32768, temperature: 0.3,  top_p: 0.95, top_k: 40,  repeat_penalty: 1.1,  repeat_last_n: 96,  seed: 42 },
  },

  // ── STRICT  ──────────────────────────────────────────────────────────────
  // Core: temp=0.2, top_k=40, top_p=0.9, num_predict=18000, num_ctx=32768, rp=1.1
  // Each candidate changes ONE thing from the core.
  {
    id: 'strict-core',
    profile: 'strict',
    label: 'Strict / Core',
    description: 'Core: temp=0.2, top_k=40, rp=1.1, 18k tokens.',
    options: { num_predict: 18000, num_ctx: 32768, temperature: 0.2,  top_p: 0.9,  top_k: 40,  repeat_penalty: 1.1,  repeat_last_n: 192, seed: 42 },
  },
  {
    id: 'strict-t015',
    profile: 'strict',
    label: 'Strict / temp=0.15',
    description: '↓ temperature 0.2→0.15. More conservative than research minimum.',
    options: { num_predict: 18000, num_ctx: 32768, temperature: 0.15, top_p: 0.9,  top_k: 40,  repeat_penalty: 1.1,  repeat_last_n: 192, seed: 42 },
  },
  {
    id: 'strict-t025',
    profile: 'strict',
    label: 'Strict / temp=0.25',
    description: '↑ temperature 0.2→0.25. Slightly less rigid.',
    options: { num_predict: 18000, num_ctx: 32768, temperature: 0.25, top_p: 0.9,  top_k: 40,  repeat_penalty: 1.1,  repeat_last_n: 192, seed: 42 },
  },
  {
    id: 'strict-k100',
    profile: 'strict',
    label: 'Strict / top_k=100',
    description: '↑ top_k 40→100 speed hack. Same strict quality, faster response.',
    options: { num_predict: 18000, num_ctx: 32768, temperature: 0.2,  top_p: 0.9,  top_k: 100, repeat_penalty: 1.1,  repeat_last_n: 192, seed: 42 },
  },
  {
    id: 'strict-rp115',
    profile: 'strict',
    label: 'Strict / rp=1.15',
    description: '↑ repeat_penalty 1.1→1.15. Harder suppression of repetition.',
    options: { num_predict: 18000, num_ctx: 32768, temperature: 0.2,  top_p: 0.9,  top_k: 40,  repeat_penalty: 1.15, repeat_last_n: 192, seed: 42 },
  },
  {
    id: 'strict-24k',
    profile: 'strict',
    label: 'Strict / 24k tokens',
    description: '↑ num_predict 18k→24k. Strict settings but allows longer output.',
    options: { num_predict: 24000, num_ctx: 32768, temperature: 0.2,  top_p: 0.9,  top_k: 40,  repeat_penalty: 1.1,  repeat_last_n: 192, seed: 42 },
  },

  // ── BALANCED  ────────────────────────────────────────────────────────────
  // Core: temp=0.3, top_k=40, top_p=0.9, num_predict=20000, num_ctx=32768, rp=1.1
  // Each candidate changes ONE thing from the core.
  {
    id: 'balanced-core',
    profile: 'balanced',
    label: 'Balanced / Core',
    description: 'Core: temp=0.3, top_k=40, top_p=0.9, 20k tokens.',
    options: { num_predict: 20000, num_ctx: 32768, temperature: 0.3,  top_p: 0.9,  top_k: 40,  repeat_penalty: 1.1,  repeat_last_n: 128, seed: 42 },
  },
  {
    id: 'balanced-t025',
    profile: 'balanced',
    label: 'Balanced / temp=0.25',
    description: '↓ temperature 0.3→0.25. Closer to strict territory.',
    options: { num_predict: 20000, num_ctx: 32768, temperature: 0.25, top_p: 0.9,  top_k: 40,  repeat_penalty: 1.1,  repeat_last_n: 128, seed: 42 },
  },
  {
    id: 'balanced-t035',
    profile: 'balanced',
    label: 'Balanced / temp=0.35',
    description: '↑ temperature 0.3→0.35. Slightly more creative.',
    options: { num_predict: 20000, num_ctx: 32768, temperature: 0.35, top_p: 0.9,  top_k: 40,  repeat_penalty: 1.1,  repeat_last_n: 128, seed: 42 },
  },
  {
    id: 'balanced-t04',
    profile: 'balanced',
    label: 'Balanced / temp=0.4',
    description: '↑ temperature 0.3→0.4. Upper research range for balanced.',
    options: { num_predict: 20000, num_ctx: 32768, temperature: 0.4,  top_p: 0.9,  top_k: 40,  repeat_penalty: 1.1,  repeat_last_n: 128, seed: 42 },
  },
  {
    id: 'balanced-k100',
    profile: 'balanced',
    label: 'Balanced / top_k=100',
    description: '↑ top_k 40→100 speed hack. Good F1, faster.',
    options: { num_predict: 20000, num_ctx: 32768, temperature: 0.3,  top_p: 0.9,  top_k: 100, repeat_penalty: 1.1,  repeat_last_n: 128, seed: 42 },
  },
  {
    id: 'balanced-p95',
    profile: 'balanced',
    label: 'Balanced / top_p=0.95',
    description: '↑ top_p 0.9→0.95. Wider nucleus sampling.',
    options: { num_predict: 20000, num_ctx: 32768, temperature: 0.3,  top_p: 0.95, top_k: 40,  repeat_penalty: 1.1,  repeat_last_n: 128, seed: 42 },
  },

  // ── THOROUGH  ────────────────────────────────────────────────────────────
  // Core: temp=0.4, top_k=40, top_p=0.95, num_predict=28000, num_ctx=32768, rp=1.1
  // Each candidate changes ONE thing from the core.
  {
    id: 'thorough-core',
    profile: 'thorough',
    label: 'Thorough / Core',
    description: 'Core: temp=0.4, top_k=40, top_p=0.95, 28k tokens.',
    options: { num_predict: 28000, num_ctx: 32768, temperature: 0.4,  top_p: 0.95, top_k: 40,  repeat_penalty: 1.1,  repeat_last_n: 256, seed: 42 },
  },
  {
    id: 'thorough-t045',
    profile: 'thorough',
    label: 'Thorough / temp=0.45',
    description: '↑ temperature 0.4→0.45.',
    options: { num_predict: 28000, num_ctx: 32768, temperature: 0.45, top_p: 0.95, top_k: 40,  repeat_penalty: 1.1,  repeat_last_n: 256, seed: 42 },
  },
  {
    id: 'thorough-t05',
    profile: 'thorough',
    label: 'Thorough / temp=0.5',
    description: '↑ temperature 0.4→0.5. Research max for coding tasks.',
    options: { num_predict: 28000, num_ctx: 32768, temperature: 0.5,  top_p: 0.95, top_k: 40,  repeat_penalty: 1.1,  repeat_last_n: 256, seed: 42 },
  },
  {
    id: 'thorough-k0',
    profile: 'thorough',
    label: 'Thorough / top_k=0',
    description: '↓ top_k 40→0 (full vocab). Maximum token breadth.',
    options: { num_predict: 28000, num_ctx: 32768, temperature: 0.4,  top_p: 0.95, top_k: 0,   repeat_penalty: 1.1,  repeat_last_n: 256, seed: 42 },
  },
  {
    id: 'thorough-p09',
    profile: 'thorough',
    label: 'Thorough / top_p=0.9',
    description: '↓ top_p 0.95→0.9. Narrower nucleus at high temperature.',
    options: { num_predict: 28000, num_ctx: 32768, temperature: 0.4,  top_p: 0.9,  top_k: 40,  repeat_penalty: 1.1,  repeat_last_n: 256, seed: 42 },
  },
  {
    id: 'thorough-32k',
    profile: 'thorough',
    label: 'Thorough / 32k tokens',
    description: '↑ num_predict 28k→32k. Longest possible output.',
    options: { num_predict: 32000, num_ctx: 32768, temperature: 0.4,  top_p: 0.95, top_k: 40,  repeat_penalty: 1.1,  repeat_last_n: 256, seed: 42 },
  },

  // ── REASONING  ───────────────────────────────────────────────────────────
  // Core: temp=0.7, top_k=40, top_p=0.95, num_predict=30000, num_ctx=32768, rp=1.1
  // GPT-OSS community consensus for quality/complex reasoning tasks.
  // Each candidate changes ONE thing from the core.
  {
    id: 'reasoning-core',
    profile: 'reasoning',
    label: 'Reasoning / Core',
    description: 'Core: temp=0.7, top_k=40, top_p=0.95, 30k tokens.',
    options: { num_predict: 30000, num_ctx: 32768, temperature: 0.7,  top_p: 0.95, top_k: 40,  repeat_penalty: 1.1,  repeat_last_n: 256, seed: 42 },
  },
  {
    id: 'reasoning-t05',
    profile: 'reasoning',
    label: 'Reasoning / temp=0.5',
    description: '↓ temperature 0.7→0.5. Upper thorough range, lower reasoning end.',
    options: { num_predict: 30000, num_ctx: 32768, temperature: 0.5,  top_p: 0.95, top_k: 40,  repeat_penalty: 1.1,  repeat_last_n: 256, seed: 42 },
  },
  {
    id: 'reasoning-t06',
    profile: 'reasoning',
    label: 'Reasoning / temp=0.6',
    description: '↓ temperature 0.7→0.6. More stable output.',
    options: { num_predict: 30000, num_ctx: 32768, temperature: 0.6,  top_p: 0.95, top_k: 40,  repeat_penalty: 1.1,  repeat_last_n: 256, seed: 42 },
  },
  {
    id: 'reasoning-t08',
    profile: 'reasoning',
    label: 'Reasoning / temp=0.8',
    description: '↑ temperature 0.7→0.8. More creative, higher FP risk.',
    options: { num_predict: 30000, num_ctx: 32768, temperature: 0.8,  top_p: 0.95, top_k: 40,  repeat_penalty: 1.1,  repeat_last_n: 256, seed: 42 },
  },
  {
    id: 'reasoning-k0',
    profile: 'reasoning',
    label: 'Reasoning / top_k=0',
    description: '↓ top_k 40→0 (full vocab). Maximum reasoning breadth.',
    options: { num_predict: 30000, num_ctx: 32768, temperature: 0.7,  top_p: 0.95, top_k: 0,   repeat_penalty: 1.1,  repeat_last_n: 256, seed: 42 },
  },
  {
    id: 'reasoning-k100',
    profile: 'reasoning',
    label: 'Reasoning / top_k=100',
    description: '↑ top_k 40→100 speed hack. Reasoning quality, faster.',
    options: { num_predict: 30000, num_ctx: 32768, temperature: 0.7,  top_p: 0.95, top_k: 100, repeat_penalty: 1.1,  repeat_last_n: 256, seed: 42 },
  },

  // ── PERFORMANCE  ─────────────────────────────────────────────────────────
  // Core: top_k=100 (speed hack), temp=0.3, top_p=0.9, num_predict=10000, num_ctx=32768
  // Each candidate changes ONE thing from the core.
  {
    id: 'performance-core',
    profile: 'performance',
    label: 'Performance / Core',
    description: 'Core: top_k=100, temp=0.3, top_p=0.9, 10k tokens, 32k ctx.',
    options: { num_predict: 10000, num_ctx: 32768, temperature: 0.3,  top_p: 0.9,  top_k: 100, repeat_penalty: 1.1,  repeat_last_n: 96,  seed: 42 },
  },
  {
    id: 'performance-t02',
    profile: 'performance',
    label: 'Performance / temp=0.2',
    description: '↓ temperature 0.3→0.2. Fastest with fewest FPs.',
    options: { num_predict: 10000, num_ctx: 32768, temperature: 0.2,  top_p: 0.9,  top_k: 100, repeat_penalty: 1.1,  repeat_last_n: 96,  seed: 42 },
  },
  {
    id: 'performance-t04',
    profile: 'performance',
    label: 'Performance / temp=0.4',
    description: '↑ temperature 0.3→0.4. Broader coverage, still fast.',
    options: { num_predict: 10000, num_ctx: 32768, temperature: 0.4,  top_p: 0.9,  top_k: 100, repeat_penalty: 1.1,  repeat_last_n: 96,  seed: 42 },
  },
  {
    id: 'performance-14k',
    profile: 'performance',
    label: 'Performance / 14k tokens',
    description: '↑ num_predict 10k→14k. Speed hack + more coverage.',
    options: { num_predict: 14000, num_ctx: 32768, temperature: 0.3,  top_p: 0.9,  top_k: 100, repeat_penalty: 1.1,  repeat_last_n: 128, seed: 42 },
  },
  {
    id: 'performance-ctx16k',
    profile: 'performance',
    label: 'Performance / ctx=16k',
    description: '↓ num_ctx 32k→16k. Smallest context, absolute fastest.',
    options: { num_predict: 8000,  num_ctx: 16384, temperature: 0.3,  top_p: 0.9,  top_k: 100, repeat_penalty: 1.1,  repeat_last_n: 96,  seed: 42 },
  },
  {
    id: 'performance-p95',
    profile: 'performance',
    label: 'Performance / top_p=0.95',
    description: '↑ top_p 0.9→0.95. Wider nucleus + speed hack.',
    options: { num_predict: 10000, num_ctx: 32768, temperature: 0.3,  top_p: 0.95, top_k: 100, repeat_penalty: 1.1,  repeat_last_n: 96,  seed: 42 },
  },

  // ── CURRENT  ─────────────────────────────────────────────────────────────
  // The 4 presets currently defined in ollama.ts — included as a baseline
  // so results are directly comparable to new candidates.
  {
    id: 'current-balanced',
    profile: 'current',
    label: 'Current / Balanced',
    description: 'Existing balanced preset (temp=0.15, top_k=30).',
    options: { num_predict: 20000, num_ctx: 32768, temperature: 0.15, top_p: 0.85, top_k: 30,  repeat_penalty: 1.1,  repeat_last_n: 128, seed: 42 },
  },
  {
    id: 'current-strict',
    profile: 'current',
    label: 'Current / Strict',
    description: 'Existing strict preset (temp=0.05, top_k=20).',
    options: { num_predict: 18000, num_ctx: 32768, temperature: 0.05, top_p: 0.75, top_k: 20,  repeat_penalty: 1.15, repeat_last_n: 192, seed: 42 },
  },
  {
    id: 'current-thorough',
    profile: 'current',
    label: 'Current / Thorough',
    description: 'Existing thorough preset (temp=0.1, top_k=25).',
    options: { num_predict: 26000, num_ctx: 32768, temperature: 0.1,  top_p: 0.8,  top_k: 25,  repeat_penalty: 1.12, repeat_last_n: 256, seed: 42 },
  },
  {
    id: 'current-quick',
    profile: 'current',
    label: 'Current / Quick',
    description: 'Existing quick preset (temp=0.2, top_k=40, 8k tokens, 16k ctx).',
    options: { num_predict: 8000,  num_ctx: 16384, temperature: 0.2,  top_p: 0.9,  top_k: 40,  repeat_penalty: 1.05, repeat_last_n: 96,  seed: 42 },
  },
];

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export const CANDIDATE_MAP = new Map<string, Candidate>(
  CANDIDATES.map(c => [c.id, c])
);

/** All tuning profiles (excludes 'current' — that is always included automatically). */
export const TUNING_PROFILES: ProfileId[] = ['quick', 'strict', 'balanced', 'thorough', 'reasoning', 'performance'];

/** All profiles including the current-preset baseline. */
export const PROFILES: ProfileId[] = [...TUNING_PROFILES, 'current'];

export function candidatesForProfile(profile: ProfileId): Candidate[] {
  return CANDIDATES.filter(c => c.profile === profile);
}
