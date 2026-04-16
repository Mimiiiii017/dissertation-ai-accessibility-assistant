from pathlib import Path
from fastapi import FastAPI, Query
from pydantic import BaseModel
import chromadb
from chromadb.utils import embedding_functions
import re
import os
from transformers import AutoTokenizer
from rank_bm25 import BM25Okapi
import pickle

REPO_ROOT = Path(__file__).resolve().parents[2]
KB_PATHS = {
    "accessibility": REPO_ROOT / "knowledge-base" / "Accessibility-Analysis",
    "tlx": REPO_ROOT / "knowledge-base" / "NASA-TLX",
}
COLLECTION_NAMES = {
    "accessibility": "accessibility_docs",
    "tlx": "tlx_docs",
}

DB_DIR = Path(__file__).resolve().parent / "chroma_db"

app = FastAPI(title="AI Accessibility Assistant - RAG Service")

# ─── Embedding model (overridable via EMBED_MODEL env var) ───────────────────
# Supported values and their token limits:
#   all-MiniLM-L6-v2       → 256 tokens  (default)
#   all-mpnet-base-v2      → 512 tokens
#   nomic-ai/nomic-embed-text-v1  → 2048 tokens (practical: 1024)
EMBED_MODEL = os.environ.get("EMBED_MODEL", "all-MiniLM-L6-v2")

# HuggingFace model ID for tokenizer (may differ from sentence-transformers name)
_HF_TOKENIZER_MAP = {
    "all-MiniLM-L6-v2":  "sentence-transformers/all-MiniLM-L6-v2",
    "all-mpnet-base-v2": "sentence-transformers/all-mpnet-base-v2",
    "nomic-ai/nomic-embed-text-v1": "nomic-ai/nomic-embed-text-v1",
}
_tokenizer_id = _HF_TOKENIZER_MAP.get(EMBED_MODEL, EMBED_MODEL)

_embed_kwargs = {}
if "nomic" in EMBED_MODEL:
    _embed_kwargs["trust_remote_code"] = True
embed_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name=EMBED_MODEL, **_embed_kwargs
)
_tokenizer = AutoTokenizer.from_pretrained(_tokenizer_id)

client = chromadb.PersistentClient(path=str(DB_DIR))

# ─── BM25 Indexes (for hybrid keyword+semantic search) ──────────────────────
bm25_indexes = {}  # Stores BM25 index per collection: {collection_name: (corpus, bm25_obj)}

# ─── Chunking constants (overridable via MAX_CHUNK_TOKENS / OVERLAP_TOKENS) ──
MAX_CHUNK_TOKENS = int(os.environ.get("MAX_CHUNK_TOKENS", "128"))
OVERLAP_TOKENS   = int(os.environ.get("OVERLAP_TOKENS", str(max(1, MAX_CHUNK_TOKENS // 10))))
MIN_CHUNK_CHARS  = 80    # discard/merge chunks shorter than this

print(f"[RAG] EMBED_MODEL={EMBED_MODEL}  MAX_CHUNK_TOKENS={MAX_CHUNK_TOKENS}  OVERLAP_TOKENS={OVERLAP_TOKENS}")


class IndexResponse(BaseModel):
    indexed: int

class RetrieveRequest(BaseModel):
    query: str
    top_k: int = 3  # Reduced from 5 to avoid context overload
    kb_type: str = "accessibility"  # accessibility or tlx
    distance_threshold: float = 0.65  # cosine distance; chunks above this are too dissimilar
    use_hybrid: bool = True  # Use hybrid search (BM25 + embeddings)

class Chunk(BaseModel):
    id: str
    source: str
    text: str

class RetrieveResponse(BaseModel):
    chunks: list[Chunk]

# ─── Helpers ─────────────────────────────────────────────────────────────────

def iter_kb_files(kb_type: str):
    """Iterate over markdown and text files in the specified knowledge base."""
    if kb_type not in KB_PATHS:
        raise ValueError(f"Unknown kb_type: {kb_type}")
    kb_dir = KB_PATHS[kb_type]
    exts = {".md", ".txt"}
    for p in kb_dir.rglob("*"):
        if p.is_file() and p.suffix.lower() in exts:
            yield p

def count_tokens(text: str) -> int:
    return len(_tokenizer.encode(text, add_special_tokens=False))

def extract_file_metadata(text: str) -> dict:
    """
    Extract tags and language hints from the ## Tags section of a markdown file.
    Returns a dict with 'tags' (space-separated string) and 'languages'
    (space-separated list of: html, css, js, tsx found in the tags line).
    """
    tags: list[str] = []
    languages: list[str] = []

    tags_match = re.search(r"##\s+Tags\s*\n([^\n]+)", text)
    if tags_match:
        raw = tags_match.group(1)
        found = re.findall(r"#(\w[\w.-]*)", raw)
        tags = [t.lower() for t in found]
        for t in tags:
            if t == "html" and "html" not in languages:
                languages.append("html")
            elif t == "css" and "css" not in languages:
                languages.append("css")
            elif t in {"js", "javascript"} and "js" not in languages:
                languages.append("js")
            elif t in {"tsx", "typescript", "react"} and "tsx" not in languages:
                languages.append("tsx")

    return {
        "tags": " ".join(tags),
        "languages": " ".join(languages) if languages else "html",
    }

def _tail_overlap(parts: list[str]) -> tuple[list[str], int]:
    """Return the tail of `parts` whose total token count fits within OVERLAP_TOKENS."""
    result: list[str] = []
    total = 0
    for part in reversed(parts):
        t = count_tokens(part)
        if total + t <= OVERLAP_TOKENS:
            result.insert(0, part)
            total += t
        else:
            break
    return result, total

def _split_into_token_windows(body: str, heading_prefix: str = "") -> list[str]:
    """
    Split `body` text into overlapping windows of at most MAX_CHUNK_TOKENS tokens.
    Each window is prefixed with `heading_prefix` to keep it self-contained.
    Splitting prefers paragraph boundaries, then sentence boundaries.
    """
    paragraphs = [p.strip() for p in body.split("\n\n") if p.strip()]
    windows: list[str] = []
    buffer: list[str] = []
    buf_tokens = 0

    def flush():
        nonlocal buffer, buf_tokens
        if buffer:
            body_text = "\n\n".join(buffer)
            full = f"{heading_prefix}\n\n{body_text}".strip() if heading_prefix else body_text
            if len(full) >= MIN_CHUNK_CHARS:
                windows.append(full)
            overlap_buf, overlap_tok = _tail_overlap(buffer)
            buffer = overlap_buf
            buf_tokens = overlap_tok

    for para in paragraphs:
        para_tokens = count_tokens(para)

        if para_tokens > MAX_CHUNK_TOKENS:
            flush()
            # Split oversized paragraph at sentence boundaries
            sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+|\n", para) if s.strip()]
            for sent in sentences:
                sent_tok = count_tokens(sent)
                if buf_tokens + sent_tok > MAX_CHUNK_TOKENS:
                    flush()
                buffer.append(sent)
                buf_tokens += sent_tok
        else:
            if buf_tokens + para_tokens > MAX_CHUNK_TOKENS:
                flush()
            buffer.append(para)
            buf_tokens += para_tokens

    flush()
    return windows

def chunk_document(text: str, file_title: str = "") -> list[str]:
    """
    Chunk a markdown document into 128-200 token windows (well within the
    256-token limit of all-MiniLM-L6-v2).

    Strategy:
    1. Split on ## / ### headings → topic-coherent sections.
    2. For sections that fit within MAX_CHUNK_TOKENS → one chunk, prefixed with
       doc title + section heading for retrieval context.
    3. For sections exceeding MAX_CHUNK_TOKENS → split into overlapping sub-windows
       (OVERLAP_TOKENS overlap), each prefixed with the section heading.
    4. Merge tiny trailing chunks (< MIN_CHUNK_CHARS) into their predecessor.
    """
    title_match = re.match(r"^#\s+(.+)", text.strip())
    doc_title = title_match.group(1).strip() if title_match else file_title

    parts = re.split(r"\n(?=#{1,3} )", text)
    chunks: list[str] = []

    for part in parts:
        part = part.strip()
        if not part:
            continue
        if re.match(r"^# ", part) and "\n" not in part:
            continue  # top-level title line — already captured in doc_title

        heading_match = re.match(r"^(#{1,3} .+)", part)
        section_heading = heading_match.group(1).strip() if heading_match else ""

        # Skip pure metadata sections — they are used for metadata extraction only
        if re.match(r"#{1,3} Tags\b", section_heading):
            continue

        prefix = f"{doc_title} — {section_heading}" if doc_title and section_heading else (doc_title or section_heading)

        section_tokens = count_tokens(part)
        if section_tokens <= MAX_CHUNK_TOKENS:
            full = f"{prefix}\n\n{part}".strip() if prefix and not part.startswith(prefix) else part
            if len(full) >= MIN_CHUNK_CHARS:
                chunks.append(full)
            elif chunks:
                chunks[-1] += "\n\n" + full
        else:
            body_start = len(heading_match.group(0)) if heading_match else 0
            body = part[body_start:].strip()
            sub = _split_into_token_windows(body, heading_prefix=prefix)
            chunks.extend(sub)

    return chunks if chunks else [text.strip()]


# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.post("/index", response_model=IndexResponse)
def index_kb(kb_type: str = Query("accessibility")):
    """Index knowledge base files into ChromaDB collection and build BM25 index."""
    if kb_type not in KB_PATHS:
        raise ValueError(f"Unknown kb_type: {kb_type}")

    collection_name = COLLECTION_NAMES[kb_type]

    try:
        client.delete_collection(collection_name)
    except Exception:
        pass

    collection = client.get_or_create_collection(
        name=collection_name, embedding_function=embed_fn
    )

    indexed = 0
    corpus = []  # For BM25 indexing
    corpus_ids = []  # Map BM25 results back to docs
    
    for fpath in iter_kb_files(kb_type):
        text = fpath.read_text(encoding="utf-8", errors="ignore")
        file_meta = extract_file_metadata(text)
        chunks = chunk_document(text, file_title=fpath.stem)
        ids, docs, metas = [], [], []

        for i, c in enumerate(chunks):
            c = c.strip()
            if not c:
                continue
            cid = f"{fpath.as_posix()}::chunk{i}"
            ids.append(cid)
            docs.append(c)
            metas.append({
                "source": fpath.as_posix(),
                "chunk": i,
                "tags": file_meta["tags"],
                "languages": file_meta["languages"],
            })
            # Add to BM25 corpus
            corpus.append(c.lower().split())
            corpus_ids.append(cid)

        if docs:
            collection.add(ids=ids, documents=docs, metadatas=metas)
            indexed += len(docs)

    # Build BM25 index for this collection
    if corpus:
        bm25 = BM25Okapi(corpus)
        bm25_indexes[collection_name] = (corpus_ids, bm25)
        print(f"[RAG] Built BM25 index for {collection_name}: {len(corpus)} documents")

    return IndexResponse(indexed=indexed)

@app.post("/retrieve", response_model=RetrieveResponse)
def retrieve(req: RetrieveRequest):
    """
    Retrieve relevant chunks using hybrid search (BM25 keyword + embedding semantic).
    Results are deduplicated and sorted by combined score.
    """
    if req.kb_type not in COLLECTION_NAMES:
        raise ValueError(f"Unknown kb_type: {req.kb_type}")

    collection_name = COLLECTION_NAMES[req.kb_type]
    collection = client.get_or_create_collection(
        name=collection_name, embedding_function=embed_fn
    )

    # Normalize results into a dict: chunk_id -> {doc, meta, embedding_score, bm25_score}
    results_dict = {}

    # ─── 1. Semantic search (embeddings) ───────────────────────────────────────
    sem_res = collection.query(query_texts=[req.query], n_results=req.top_k,
                               include=["documents", "metadatas", "distances"])
    sem_ids = sem_res.get("ids", [[]])[0]
    sem_docs = sem_res.get("documents", [[]])[0]
    sem_metas = sem_res.get("metadatas", [[]])[0]
    sem_distances = sem_res.get("distances", [[]])[0]

    for cid, doc, meta, dist in zip(sem_ids, sem_docs, sem_metas, sem_distances):
        if dist <= req.distance_threshold:
            # Convert distance to similarity score (0-1, higher is better)
            sim_score = 1.0 - dist
            results_dict[cid] = {
                "doc": doc,
                "meta": meta,
                "embedding_score": sim_score,
                "bm25_score": 0.0,
            }

    # ─── 2. BM25 keyword search ───────────────────────────────────────────────
    if req.use_hybrid and collection_name in bm25_indexes:
        corpus_ids, bm25 = bm25_indexes[collection_name]
        query_tokens = req.query.lower().split()
        bm25_scores = bm25.get_scores(query_tokens)
        
        # Get top BM25 results
        top_bm25_indices = sorted(
            range(len(bm25_scores)), 
            key=lambda i: bm25_scores[i], 
            reverse=True
        )[:req.top_k]
        
        for idx in top_bm25_indices:
            cid = corpus_ids[idx]
            bm25_score = bm25_scores[idx]
            
            if bm25_score > 0:  # Only include positive scores
                if cid in results_dict:
                    # Merge: add BM25 score
                    results_dict[cid]["bm25_score"] = bm25_score
                else:
                    # New result from BM25; fetch from ChromaDB
                    try:
                        chrom_res = collection.get(ids=[cid], include=["documents", "metadatas"])
                        if chrom_res["documents"]:
                            results_dict[cid] = {
                                "doc": chrom_res["documents"][0],
                                "meta": chrom_res["metadatas"][0],
                                "embedding_score": 0.0,
                                "bm25_score": bm25_score,
                            }
                    except Exception:
                        pass

    # ─── 3. Sort by combined score and return top results ─────────────────────
    # Combined score: average of normalized scores
    for cid in results_dict:
        em_score = results_dict[cid]["embedding_score"]
        bm_score = results_dict[cid]["bm25_score"]
        # Normalize BM25 (rough): typical max score ~5-10, cap at 1.0
        bm_score_norm = min(1.0, bm_score / 5.0)
        combined = (em_score + bm_score_norm) / 2.0
        results_dict[cid]["combined_score"] = combined

    # Sort by combined score
    sorted_results = sorted(
        results_dict.items(),
        key=lambda x: x[1]["combined_score"],
        reverse=True
    )[:req.top_k]

    chunks = []
    for cid, info in sorted_results:
        chunks.append(
            Chunk(id=str(cid), source=str(info["meta"].get("source", "")), text=str(info["doc"]))
        )

    return RetrieveResponse(chunks=chunks)
