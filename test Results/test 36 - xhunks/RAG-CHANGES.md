# RAG System Changes — Mentor Feedback Implementation

**Date:** April 2026  
**Context:** Changes made to the RAG service (`services/rag/app.py`) and knowledge base in response to mentor feedback before T36 testing.

---

## 1. Token-aware chunking (complete rewrite of `app.py`)

**Previous behaviour:** Used `chunk_by_sections()` — split documents at section headings only, no token limit. Some chunks silently exceeded the 256-token hard limit of the embedding model, causing truncation and degraded embeddings.

**Change:** Replaced with a fully token-aware `chunk_document()` function using `AutoTokenizer` from `sentence-transformers/all-MiniLM-L6-v2` to count tokens accurately.

- `MAX_CHUNK_TOKENS` — enforced upper bound per chunk
- `_split_into_token_windows()` — splits oversized sections at paragraph then sentence boundaries
- `_tail_overlap()` — carries overlap tokens from the previous window into the next

---

## 2. Chunk size (128 tokens default)

**Previous behaviour:** No token control — chunks were section-sized (often 300–800 tokens, silently truncated).

**Change:** Default set to `MAX_CHUNK_TOKENS = 128`. Each chunk covers approximately one rule, one pattern, or one example — tight enough for the embedding model to produce a focused vector.

**Why 128:** T36 chunk size experiment compared 128, 256, 512, and 1024 tokens. 128 tokens produced the best average F1 (43.85%) and the most consistent rn↔rt performance. See `RESULTS.md` for full comparison.

---

## 3. Overlap between chunks (~10%)

**Previous behaviour:** Zero overlap — each section was independent.

**Change:** `OVERLAP_TOKENS = MAX_CHUNK_TOKENS // 10` (13 tokens at 128-token chunks). The tail of each chunk is prepended to the next, so context is not lost at chunk boundaries. This is especially important for multi-paragraph rules where the context of the heading ties together the following bullets.

**Mentor target:** 10–20%. Current setting: ~10%.

---

## 4. Language metadata tags in ChromaDB

**Previous behaviour:** All chunks stored without language metadata — the retriever had no way to prefer HTML-specific rules for HTML queries over generic ones.

**Change:** Added `extract_file_metadata()` which reads a `## Tags` section from each knowledge base file and stores `tags` and `languages` fields in ChromaDB metadata per chunk.

Example stored metadata per chunk:
```json
{ "source": "...", "chunk": 3, "tags": "html css forms labels", "languages": "html css" }
```

---

## 5. Multi-language examples added to KB files

**Previous behaviour:** Knowledge base detection-rules files had examples in HTML only.

**Change:** Added `## Tags` and `## Multi-language examples` sections to 7 detection-rules files covering CSS, JavaScript, and TSX (React/TypeScript):

| File | Languages |
|---|---|
| `forms/forms-detection-rules.md` | html, css, js, tsx |
| `aria/aria-detection-rules.md` | html, js, tsx |
| `controls/controls-detection-rules.md` | html, js, tsx |
| `navigation/navigation-detection-rules.md` | html, js, tsx |
| `tables/tables-detection-rules.md` | html, tsx |
| `images/images-detection-rules.md` | html, tsx |
| `visual/css-accessibility-detection-rules.md` | css, html, js, tsx |

Each section includes FIRES / DOES NOT FIRE code examples in the applicable languages.

---

## 6. Configurable embedding model (env vars)

**Previous behaviour:** Model and chunk size were hardcoded — changing them required editing `app.py`.

**Change:** Both are now configurable at startup via environment variables, allowing the chunk size experiment to be run without code changes:

```bash
# Default (128 tokens, all-MiniLM-L6-v2)
uvicorn app:app --host 0.0.0.0 --port 8000

# 512 tokens with all-mpnet-base-v2
EMBED_MODEL=all-mpnet-base-v2 MAX_CHUNK_TOKENS=512 uvicorn app:app --host 0.0.0.0 --port 8000

# 1024 tokens with nomic-embed-text-v1
EMBED_MODEL=nomic-ai/nomic-embed-text-v1 MAX_CHUNK_TOKENS=1024 uvicorn app:app --host 0.0.0.0 --port 8000
```

Supported models and their token limits:

| Model | Max tokens |
|---|---|
| `all-MiniLM-L6-v2` | 256 |
| `all-mpnet-base-v2` | 512 |
| `nomic-ai/nomic-embed-text-v1` | 2048 (practical: 1024) |

---

## 7. Index size after each change

| Configuration | Chunks indexed |
|---|---|
| Before changes (section-based) | 526 |
| After changes (128 tokens) | 861 |
| 256 tokens | 589 |
| 512 tokens | 512 |
| 1024 tokens | ~420 |

The increase from 526 → 861 at 128 tokens reflects both finer splitting of large sections and the addition of multi-language example content to 7 KB files.
