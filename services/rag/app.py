from pathlib import Path
from fastapi import FastAPI, Query
from pydantic import BaseModel
import chromadb
from chromadb.utils import embedding_functions

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

client = chromadb.PersistentClient(path=str(DB_DIR))

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

def iter_kb_files(kb_type: str):
    """Iterate over markdown and text files in the specified knowledge base."""
    if kb_type not in KB_PATHS:
        raise ValueError(f"Unknown kb_type: {kb_type}")
    kb_dir = KB_PATHS[kb_type]
    exts = {".md", ".txt"}
    for p in kb_dir.rglob("*"):
        if p.is_file() and p.suffix.lower() in exts:
            yield p

def chunk_by_sections(text: str, file_title: str = "", min_chars: int = 80) -> list[str]:
    """
    Split a markdown document on ## headings so each chunk = one violation/topic section.
    Short sections below min_chars are merged with the previous chunk.
    The file-level # title is prepended to every chunk for context.
    """
    import re
    # Extract the top-level # title if present
    title_match = re.match(r"^#\s+(.+)", text.strip())
    doc_title = title_match.group(1).strip() if title_match else file_title

    # Split on ## (and ###) headings, keeping the heading with its body
    parts = re.split(r"\n(?=#{1,3} )", text)
    chunks: list[str] = []

    for part in parts:
        part = part.strip()
        if not part:
            continue
        # Skip the top-level # heading-only line (already captured in doc_title)
        if re.match(r"^# ", part) and "\n" not in part:
            continue
        # Prepend doc title so every chunk is self-contained
        chunk = f"{doc_title}\n\n{part}" if doc_title and not part.startswith(doc_title) else part
        if len(chunk) < min_chars and chunks:
            # Merge tiny sections into the previous chunk
            chunks[-1] = chunks[-1] + "\n\n" + chunk
        else:
            chunks.append(chunk)

    return chunks if chunks else [text.strip()]


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
        chunks = chunk_by_sections(text, file_title=fpath.stem)
        ids, docs, metas = [], [], []

        for i, c in enumerate(chunks):
            c = c.strip()
            if not c:
                continue
            cid = f"{fpath.as_posix()}::sec{i}"
            ids.append(cid)
            docs.append(c)
            metas.append({"source": fpath.as_posix(), "section": i})

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
            # Chunk is too dissimilar to the query — skip to avoid noise
            continue
        chunks.append(
            Chunk(id=str(cid), source=str(meta.get("source", "")), text=str(doc))
        )
    return RetrieveResponse(chunks=chunks)
