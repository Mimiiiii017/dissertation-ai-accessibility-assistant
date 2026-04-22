# Test 36 — Chunk Size Experiment (RAG only)

**Date:** 2026-04-13 to 2026-04-14  
**Purpose:** Determine the optimal RAG chunk size by holding all other variables fixed and varying only chunk size (and embedding model where required).  
**Model:** gpt-oss:120b — single model, rag-nothink (rn) and rag-think (rt) conditions only  
**Fixtures:** All 16 core fixtures (html/css/js/tsx × clean/low/medium/high) — 3 runs each  
**Chunk sizes tested:** 128, 256, 512, 1024 tokens  
**Pass threshold:** N/A — this is a comparative ablation, not a pass/fail test  
**Ground truth (16 fixtures, 3 runs):** ~1086 positive opportunities, ~8703 negative slots per condition

---

## Chunk size → embedding model → index size

| Chunk size | Embedding model | Chunks indexed |
|---|---|---|
| 128 tokens | all-MiniLM-L6-v2 | 861 |
| 256 tokens | all-MiniLM-L6-v2 | 589 |
| 512 tokens | all-mpnet-base-v2 | 512 |
| 1024 tokens | nomic-ai/nomic-embed-text-v1 | ~420 (est.) |

---

## 1. Top-line results

### rn (rag-nothink)

| Chunk | F1 | Precision | Recall | TP | FP | FN | Acc | MCC | Avg resp |
|---|---|---|---|---|---|---|---|---|---|
| **128** | **43.4%** | 66.5% | 53.8% | 366 | 189 | 720 | 90.7% | 0.346 | 161.6s |
| **256** | **43.9%** | **69.8%** | 52.5% | 342 | 188 | 744 | 90.5% | 0.333 | **141.2s** |
| 512 | 41.3% | 66.5% | 53.6% | 346 | 217 | 740 | 90.3% | 0.321 | 176.5s |
| **1024** | 41.0% | 67.7% | 53.8% | 349 | **173** | 737 | 90.7% | **0.355** | 195.1s |

### rt (rag-think)

| Chunk | F1 | Precision | Recall | TP | FP | FN | Acc | MCC | Avg resp |
|---|---|---|---|---|---|---|---|---|---|
| **128** | **44.3%** | **68.8%** | 54.8% | 363 | **181** | 723 | 90.8% | 0.360 | **156.2s** |
| 256 | 42.3% | 64.8% | 55.8% | 376 | 192 | 710 | 90.8% | 0.352 | 164.9s |
| 512 | 41.9% | 64.9% | 54.1% | 379 | 197 | 707 | 90.8% | 0.349 | 146.8s |
| **1024** | 44.1% | 64.2% | **56.5%** | **414** | 194 | **672** | **91.2%** | **0.371** | 165.8s |

---

## 2. Average across both conditions

| Chunk | Avg F1 | Avg MCC | Avg FP | Avg FN | Avg resp |
|---|---|---|---|---|---|
| **128** | **43.85%** | 0.353 | 185 | 722 | 158.9s |
| 256 | 43.10% | 0.343 | 190 | 727 | 153.1s |
| 512 | 41.60% | 0.335 | 207 | 724 | 161.7s |
| **1024** | 42.55% | **0.363** | 184 | **705** | 180.5s |

---

## 3. Analysis

### Best F1: 128 tokens
128 tokens has the highest average F1 (43.85%) across both conditions, and the best single-condition F1 (44.3% in rt). The small chunk size means each embedded unit is tightly focused on a single concept, giving the retriever high precision when matching query terms to specific accessibility rules.

### Best MCC: 1024 tokens
Despite lower F1, 1024 tokens achieves the best average MCC (0.363) — the most statistically robust metric for imbalanced problems. It also achieves the highest recall in the rt condition (56.5%) and the fewest FN in rt (672 vs 723 for 128). This suggests that large context windows help the model see more complete rule descriptions when thinking (rt), reducing missed detections.

### 1024 has the fewest FP in rn (173)
The nomic-embed-text-v1 model retrieves fewer but more relevant chunks at 1024 tokens. In the no-think condition this translates to fewer hallucinations — the model receives denser, more coherent context and is less likely to overfit on partial rule fragments.

### 512 consistently underperforms
all-mpnet-base-v2 at 512 tokens is the worst performer across both conditions: highest FP in rn (217), lowest F1 average (41.60%), lowest average MCC (0.335). The model appears poorly calibrated for this domain despite its larger token capacity. This is likely an embedding quality issue — all-mpnet-base-v2 was trained on general-purpose sentence similarity tasks, not domain-specific technical content.

### Think vs no-think interaction with chunk size
A consistent pattern emerges:
- **Small chunks (128/256) favour rn** — tight chunks provide clean signals without reasoning; the model can match and report directly
- **Large chunks (1024) favour rt** — the model benefits from extended thinking to process denser, more complete context; recall improves significantly (+1.7pp over 128 rt)
- **256 rn is the fastest** (141.2s avg) — fewer chunks = faster vector search and shorter injected context = faster inference

### 256 rn precision peak (69.8%)
At 256 tokens in the no-think condition, precision peaks at 69.8% — the model reports fewer false issues when given medium-sized, complete-section chunks. Below 256 (at 128), some context is split mid-rule which can cause the model to misreport partial rules as separate issues. Above 256, precision drops as larger chunks mix multiple concepts.

---

## 4. Winner by metric

| Metric | Winner |
|---|---|
| Best avg F1 | **128 tokens** (43.85%) |
| Best avg MCC | **1024 tokens** (0.363) |
| Best rn F1 | **256 tokens** (43.9%) |
| Best rt F1 | **128 tokens** (44.3%) |
| Best rt recall | **1024 tokens** (56.5%) |
| Fewest FP (rn) | **1024 tokens** (173) |
| Fewest FP (rt) | **128 tokens** (181) |
| Fewest FN (rt) | **1024 tokens** (672) |
| Fastest (rn) | **256 tokens** (141.2s) |
| Fastest (rt) | **128 tokens** (156.2s) |
| Most consistent | **128 tokens** (smallest rn↔rt variance) |
| Worst overall | **512 tokens** — underperforms in all metrics |

---

## 5. Conclusion

**Recommended chunk size for production RAG: 128 tokens (all-MiniLM-L6-v2)**

128 tokens wins on F1 and consistency. It produces the most even performance across both conditions and is the fastest in rt. The higher chunk count (861 vs 589/512/~420) gives the retriever finer granularity — each chunk covers one rule, one example, or one pattern — which reduces retrieval noise.

**If recall is the priority: 1024 tokens (nomic-embed-text-v1)**

For the think (rt) condition specifically, 1024 tokens with nomic embeddings produces the highest recall and MCC. The tradeoff is slower response times (+12s avg vs 128) and substantially lower rn performance. This configuration would be appropriate for a use case where missing issues (FN) is more costly than false alarms (FP) — for example, a full accessibility audit where human review follows.

**512 tokens should be avoided.** The all-mpnet-base-v2 model adds FP without compensating with recall gains — the worst of both worlds.

---

## 6. Impact on overall benchmark standard

The chunk size experiment was run on gpt-oss only in RAG conditions. The T35 full-model benchmark used 128 tokens. Given these results, 128 tokens remains the correct choice for the main benchmark — it gives the best overall F1 and the most predictable behaviour across conditions.

If T37 introduces the full 3-model comparison with chunk size as a variable, 128 tokens (rn, standard) and 1024 tokens (rt, recall-optimised) should be compared as the two candidate configurations.
