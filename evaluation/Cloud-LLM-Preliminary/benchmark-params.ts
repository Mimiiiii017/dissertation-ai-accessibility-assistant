/**
 * benchmark-params.ts  —  Cloud-LLM-Preliminary
 *
 * Inference parameters for the benchmark, kept separate from the extension's
 * ANALYSIS_PRESETS so benchmark tuning never affects user-facing behaviour.
 *
 * Parameter choices are grounded in the following literature (IEEE):
 *
 * [1] A. Holtzman, J. Buys, L. Du, M. Forbes, and Y. Choi, "The Curious Case
 *     of Neural Text Degeneration," in Proc. ICLR, 2020.
 *     arXiv:1904.09751  →  top_p = 0.95
 *
 * [2] A. Fan, M. Lewis, and Y. Dauphin, "Hierarchical Neural Story
 *     Generation," in Proc. ACL, 2018, pp. 889–898.
 *     doi:10.18653/v1/P18-1082  →  top_k = 40
 *
 * [3] M. Renze and E. Guven, "The Effect of Sampling Temperature on Problem
 *     Solving in Large Language Models," in Findings EMNLP, 2024,
 *     pp. 7346–7356. doi:10.18653/v1/2024.findings-emnlp.432  →  temperature = 0.2
 *
 * [4] C. Meister, T. Pimentel, G. Wiher, and R. Cotterell, "Locally Typical
 *     Sampling," TACL, vol. 11, pp. 102–121, 2023.
 *     doi:10.1162/tacl_a_00536  →  repeat_penalty, frequency_penalty, presence_penalty
 *
 * [5] S. Welleck et al., "Neural Text Generation with Unlikelihood Training,"
 *     in Proc. ICLR, 2020. arXiv:1908.04319
 *     →  frequency_penalty = 0, presence_penalty = 0
 *
 * [6] M. Chen et al., "Evaluating Large Language Models Trained on Code,"
 *     arXiv:2107.03374, 2021.  →  top_p = 0.95, num_predict ceiling
 *
 * [7] J. Pineau et al., "Improving Reproducibility in Machine Learning
 *     Research," JMLR, vol. 22, no. 164, 2021. arXiv:2003.12206  →  seed = 42
 */

export interface CloudBenchmarkOptions {
  // ── Output length ────────────────────────────────────────────────────────
  /** Max tokens the model may generate. */
  num_predict: number;
  /** Context window size (local Ollama only — ignored by cloud APIs). */
  num_ctx: number;
  // ── Sampling ─────────────────────────────────────────────────────────────
  /** Randomness: 0 = deterministic, higher = more creative. */
  temperature: number;
  /** Nucleus sampling — cumulative probability cutoff. */
  top_p: number;
  /** Top-K sampling — sample from the K most likely next tokens. */
  top_k: number;
  // ── Repetition control ───────────────────────────────────────────────────
  /** Penalise repeated tokens (higher = less repetition). */
  repeat_penalty: number;
  /** How many tokens back to check for repetition. */
  repeat_last_n: number;
  /** Penalise tokens proportional to how often they have appeared. */
  frequency_penalty: number;
  /** Penalise any token that has appeared at all. */
  presence_penalty: number;
  // ── Reproducibility ──────────────────────────────────────────────────────
  /** Random seed — gives deterministic results for local Ollama models. */
  seed: number;
  /** Mirostat adaptive sampling (0 = off, 1 = v1, 2 = v2). */
  mirostat: number;
}

/**
 * The single set of inference parameters applied to every model in the
 * Cloud-LLM-Preliminary benchmark.  All models receive exactly these values —
 * no model-specific overrides — so that only model quality differs.
 */
export const CLOUD_BENCHMARK_OPTIONS: CloudBenchmarkOptions = {
  num_predict:       32000,  // [6] Chen et al. — complete output required for valid scoring; pilot run showed truncation at 20k
  num_ctx:           32768,  // local Ollama only
  temperature:       0.2,    // [3] Renze & Guven — no sig. accuracy effect 0.0–1.0; 0.2 for slight determinism
  top_p:             0.95,   // [1] Holtzman et al. — canonical nucleus threshold; also used in [6]
  top_k:             40,     // [2] Fan et al. — community standard for focused/non-creative generation
  repeat_penalty:    1.1,    // [4][5] Meister et al. + Welleck et al. — mild deterrent to degenerate repetition
  repeat_last_n:     128,    // [4] spans ~2-3 issue blocks; avoids penalising recurrent ARIA/WCAG terms
  frequency_penalty: 0.0,    // [5] Welleck et al. — non-zero suppresses correct high-freq technical vocab
  presence_penalty:  0.0,    // [5] same reasoning as frequency_penalty
  seed:              42,     // [7] Pineau et al. — fixed seed required for reproducible ML evaluation
  mirostat:          0,      // off (local Ollama only)
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
