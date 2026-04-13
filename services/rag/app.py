from pathlib import Path
from fastapi import FastAPI, Query
from pydantic import BaseModel
import chromadb
from chromadb.utils import embedding_functions
import re
from transformers import AutoTokenizer

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

embed_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)
# Tokenizer matching the embedding model — gives accurate token counts.
# all-MiniLM-L6-v2 has a 256-token limit; we target 200 tokens per chunk.
_tokenizer = AutoTokenizer.from_pretrained("sentence-transformers/all-MiniLM-L6-v2")

client = chromadb.PersistentClient(path=str(DB_DIR))

# ─── Chunking constants ───────────────────────────────────────────────────────
MAX_CHUNK_TOKENS = 200   # upper bound; keeps every chunk well within the 256-token embedding limit
OVERLAP_TOKENS   = 32    # overlap between consecutive sub-windows for continuity
MIN_CHUNK_CHARS  = 80    # discard/merge chunks shorter than this


class IndexResponse(BaseModel):
    indexed: int

class RetrieveRequest(BaseModel):
    query: str
    top_k: int = 3
    kb_type: str = "accessibility"  # accessibility or tlx
    distance_threshold: float = 0.65  # cosine distance; chunks above this are too dissimilar

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
    """Index knowledge base files into ChromaDB collection."""
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

        if docs:
            collection.add(ids=ids, documents=docs, metadatas=metas)
            indexed += len(docs)

    return IndexResponse(indexed=indexed)

@app.post("/retrieve", response_model=RetrieveResponse)
def retrieve(req: RetrieveRequest):
    """Retrieve relevant chunks from the specified knowledge base collection."""
    if req.kb_type not in COLLECTION_NAMES:
        raise ValueError(f"Unknown kb_type: {req.kb_type}")

    collection_name = COLLECTION_NAMES[req.kb_type]
    collection = client.get_or_create_collection(
        name=collection_name, embedding_function=embed_fn
    )

    res = collection.query(query_texts=[req.query], n_results=req.top_k,
                           include=["documents", "metadatas", "distances"])
    ids = res.get("ids", [[]])[0]
    docs = res.get("documents", [[]])[0]
    metas = res.get("metadatas", [[]])[0]
    distances = res.get("distances", [[]])[0]

    chunks = []
    for cid, doc, meta, dist in zip(ids, docs, metas, distances):
        if dist > req.distance_threshold:
            continue
        chunks.append(
            Chunk(id=str(cid), source=str(meta.get("source", "")), text=str(doc))
        )
    return RetrieveResponse(chunks=chunks)
