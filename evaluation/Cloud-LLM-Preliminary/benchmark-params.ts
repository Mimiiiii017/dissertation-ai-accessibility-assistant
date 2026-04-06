/**
 * benchmark-params.ts  —  Cloud-LLM-Preliminary
 *
 * Inference parameters for the benchmark, kept separate from the extension's
 * ANALYSIS_PRESETS so benchmark tuning never affects user-facing behaviour.
 *
 * !! IMPORTANT — CLOUD vs LOCAL PARAMS !!
 * Cloud-routed models (model IDs ending in ':cloud') can only receive three
 * parameters from Ollama's /api/chat options object:
 *
 *   num_predict  — max output tokens
 *   temperature  — sampling temperature
 *   top_p        — nucleus sampling cutoff
 *
 * All other options (num_ctx, top_k, repeat_penalty, seed, mirostat etc.) cause
 * the cloud gateway to return HTTP 500 and are therefore stripped before the
 * request is sent.  They DO apply to local Ollama models.
 *
 * Parameter values below are tuned for accessibility auditing specifically:
 * this is a structured detection task (find real issues, skip non-issues),
 * not creative text generation.  That means:
 *   - Low temperature: determinism beats variety for fact-finding
 *   - Tighter top_p: reduce stochastic noise on structured JSON output
 *   - Mild repeat penalty: ARIA attributes and WCAG references legitimately repeat
 *
 * Literature references:
 * [1] A. Holtzman et al., "Neural Text Degeneration", ICLR 2020 — top_p
 * [2] A. Fan et al., "Hierarchical Neural Story Generation", ACL 2018 — top_k
 * [3] M. Renze & E. Guven, "Effect of Sampling Temperature", EMNLP 2024 — temperature
 * [4] C. Meister et al., "Locally Typical Sampling", TACL 2023 — repeat params
 * [5] S. Welleck et al., "Unlikelihood Training", ICLR 2020 — penalty=0 for technical vocab
 * [6] M. Chen et al., "Evaluating LLMs on Code", arXiv:2107.03374 — num_predict ceiling
 * [7] J. Pineau et al., "Reproducibility in ML", JMLR 2021 — seed
 */

export interface CloudBenchmarkOptions {
  // ── Output length ────────────────────────────────────────────────────────
  /** Max tokens the model may generate. CLOUD: applies. */
  num_predict: number;
  /** Context window size. LOCAL ONLY — ignored by cloud APIs. */
  num_ctx: number;
  // ── Sampling — CLOUD: temperature and top_p apply; top_k is LOCAL ONLY ──
  /** Randomness: 0 = deterministic, higher = more creative. CLOUD: applies. */
  temperature: number;
  /** Nucleus sampling — cumulative probability cutoff. CLOUD: applies. */
  top_p: number;
  /** Top-K sampling. LOCAL ONLY — cloud gateway rejects this field (HTTP 500). */
  top_k: number;
  // ── Repetition control — LOCAL ONLY (all fields below) ──────────────────
  /** Penalise repeated tokens. LOCAL ONLY. */
  repeat_penalty: number;
  /** How many tokens back to check for repetition. LOCAL ONLY. */
  repeat_last_n: number;
  /** Penalise tokens proportional to frequency. LOCAL ONLY. */
  frequency_penalty: number;
  /** Penalise any token that has appeared. LOCAL ONLY. */
  presence_penalty: number;
  // ── Reproducibility — LOCAL ONLY ─────────────────────────────────────────
  /** Random seed. LOCAL ONLY — cloud models use server-side seeding. */
  seed: number;
  /** Mirostat adaptive sampling. LOCAL ONLY. */
  mirostat: number;
}

export const CLOUD_BENCHMARK_OPTIONS: CloudBenchmarkOptions = {
  // ── CLOUD-APPLICABLE params ───────────────────────────────────────────────
  num_predict:       32000,  // [6] Must be high — 51-issue fixture produces verbose structured output;
                             //     pilot runs showed truncation below 20k tokens
  temperature:       0.1,    // [3] Accessibility detection is fact-finding, not generation;
                             //     lower temp = more deterministic issue identification;
                             //     0.1 preferred over 0.2 for structured extraction tasks
  top_p:             0.9,    // [1] Tightened from 0.95 — nucleus at 0.9 reduces stochastic noise
                             //     on structured JSON output without cutting off valid phrasings
  // ── LOCAL ONLY params — not sent to cloud models ──────────────────────────
  num_ctx:           32768,  // Local Ollama only
  top_k:             40,     // [2] Local Ollama only
  repeat_penalty:    1.05,   // [4] Mild — ARIA attributes and WCAG criterion numbers legitimately
                             //     repeat across issues; 1.1 over-penalises correct technical vocab
  repeat_last_n:     64,     // [4] Shorter lookback than default (128) — 64 tokens avoids treating
                             //     structured issue blocks as repetition of each other
  frequency_penalty: 0.0,    // [5] Zero — non-zero suppresses correct high-freq WCAG/ARIA terms
  presence_penalty:  0.0,    // [5] Zero — same reasoning as frequency_penalty
  seed:              42,     // [7] Fixed seed for reproducible local runs
  mirostat:          0,      // Off — local Ollama only
};

/**
 * The subset of CLOUD_BENCHMARK_OPTIONS that cloud-routed Ollama models
 * actually accept.  Sending unsupported fields (num_ctx, seed, mirostat,
 * top_k, repeat_*, frequency_*, presence_*) causes HTTP 500 from the
 * cloud gateway — so we strip them here.
 */
export const CLOUD_SAFE_OPTIONS = {
  num_predict: CLOUD_BENCHMARK_OPTIONS.num_predict,
  temperature: CLOUD_BENCHMARK_OPTIONS.temperature,
  top_p:       CLOUD_BENCHMARK_OPTIONS.top_p,
} as const;

export interface CloudSafeOptions {
  num_predict: number;
  temperature: number;
  top_p: number;
}

export interface ModelParamOverride {
  /** Options to apply when thinking is enabled (default CoT mode). */
  think?: Partial<CloudSafeOptions>;
  /** Options to apply when /no_think directive is in use. */
  noThink?: Partial<CloudSafeOptions>;
}

/**
 * Per-model parameter overrides for cloud-routed models.
 * Key is matched as a case-insensitive substring of the model ID.
 * Falls back to CLOUD_SAFE_OPTIONS when no match is found.
 *
 * Sources:
 *   GPT-OSS class  — OpenAI Platform docs, Prompt Engineering guide:
 *                    temperature=0 for deterministic / structured-output tasks
 *   Kimi-K2.5      — Moonshot AI API docs: temperature=0.6 for extended-thinking
 *                    (aligned with Qwen3/DeepSeek-R1 CoT community consensus)
 *   Qwen3 series   — Alibaba Qwen3 model card (HuggingFace)
 *                    https://huggingface.co/Qwen/Qwen3-235B-A22B
 *   DeepSeek-V3    — DeepSeek API docs, parameter settings guide
 *                    https://api-docs.deepseek.com/quick_start/parameter_settings
 *   GLM-5          — Zhipu AI API docs: lower temperature for structured/factual tasks
 *   Gemini         — Google AI API docs: temperature=0 for factual/precise/structured tasks
 *   Mistral Large  — Mistral AI docs + cookbook: temperature=0.3 for focused analytical tasks
 */
export const MODEL_CLOUD_OVERRIDES: Record<string, ModelParamOverride> = {
  // ── GPT-OSS class (gpt-oss:120b) ────────────────────────────────────────
  // OpenAI-style architecture. temperature=0 / top_p=1 for deterministic
  // structured extraction per OpenAI API guidance.
  // T16 finding: think=0.0 caused 12 FP in rag-think (all "table header missing
  // scope" — deterministic hallucination on clean fixture at zero temperature).
  // Think mode raised to 0.1 to allow slight sampling variation that breaks the
  // locked hallucination cycle while remaining low enough for structured output.
  'gpt-oss': {
    think:   { temperature: 0.1, top_p: 1.0 },
    noThink: { temperature: 0.0, top_p: 1.0 },
  },
  // ── Kimi-K2.5 (Moonshot AI) ──────────────────────────────────────────────
  // Extended-thinking model. Moonshot AI recommends temperature=0.6 in reasoning
  // mode — consistent with Qwen3 and DeepSeek-R1 CoT model community consensus.
  // No-think mode gets tighter temperature for deterministic structured output.
  'kimi': {
    think:   { temperature: 0.6, top_p: 0.95 },
    noThink: { temperature: 0.3, top_p: 0.9  },
  },
  // ── Qwen3 family (qwen3.5:397b) ─────────────────────────────────────────
  // Manufacturer recommended: temp 0.6/top_p 0.95 for think, temp 0.7/top_p 0.8 for no-think.
  'qwen3': {
    think:   { temperature: 0.6, top_p: 0.95 },
    noThink: { temperature: 0.7, top_p: 0.8  },
  },
  // ── DeepSeek-V3 ─────────────────────────────────────────────────────────
  // Manufacturer recommended: temperature=0.0 for deterministic/structured output.
  // DeepSeek-V3 is sensitive to temperature; even 0.2 introduces variation that
  // compounds across the 51-issue fixture.
  'deepseek': {
    think:   { temperature: 0.0, top_p: 1.0 },
    noThink: { temperature: 0.0, top_p: 1.0 },
  },
  // ── GLM-5 (Zhipu AI) ─────────────────────────────────────────────────────
  // GLM family default is 0.95; Zhipu's API guide recommends lower values for
  // structured/factual tasks. GLM-5 has no dedicated thinking mode.
  'glm': {
    think:   { temperature: 0.2, top_p: 0.9 },
    noThink: { temperature: 0.2, top_p: 0.9 },
  },
  // ── Gemini (Google) ──────────────────────────────────────────────────────
  // Google AI API docs explicitly recommend temperature=0 for factual, precise,
  // and structured-output tasks. top_p=1.0 avoids nucleus truncation side-effects
  // at such low temperature (distribution is already very peaked).
  // T21 finding: temperature=0.0 in think mode causes pathological under-reporting
  // on TSX/HTML — gemini reasons itself out of reporting obvious violations (2 TP
  // on tsx-rt vs 7 TP in no-think). Raising think temperature to 0.15 restores
  // stochastic sweep coverage across 3 runs without inflating precision loss.
  'gemini': {
    think:   { temperature: 0.15, top_p: 0.95 },
    noThink: { temperature: 0.0, top_p: 1.0 },
  },
  // ── Mistral Large ────────────────────────────────────────────────────────
  // Mistral AI docs and cookbook examples recommend temperature=0.3 for focused
  // analytical tasks and structured extraction workflows.
  'mistral': {
    think:   { temperature: 0.3, top_p: 0.9 },
    noThink: { temperature: 0.3, top_p: 0.9 },
  },
};

/**
 * Returns the cloud-safe options for a given model and think/no-think condition.
 * Applies per-model overrides from MODEL_CLOUD_OVERRIDES when available;
 * otherwise falls back to the uniform CLOUD_SAFE_OPTIONS baseline.
 */
export function getCloudOptions(model: string, noThink: boolean): CloudSafeOptions {
  const base: CloudSafeOptions = {
    num_predict: CLOUD_BENCHMARK_OPTIONS.num_predict,
    temperature: CLOUD_BENCHMARK_OPTIONS.temperature,
    top_p:       CLOUD_BENCHMARK_OPTIONS.top_p,
  };
  const modelLower = model.toLowerCase();
  for (const [key, override] of Object.entries(MODEL_CLOUD_OVERRIDES)) {
    if (modelLower.includes(key.toLowerCase())) {
      const mode = noThink ? override.noThink : override.think;
      return mode ? { ...base, ...mode } : base;
    }
  }
  return base;
}
