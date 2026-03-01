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
    top_k: int = 6
    kb_type: str = "accessibility"  # accessibility or tlx

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

def chunk_text(text: str, chunk_size: int = 900, overlap: int = 120):
    chunks = []
    i = 0
    while i < len(text):
        chunks.append(text[i : i + chunk_size])
        i += chunk_size - overlap
    return chunks

@app.post("/index", response_model=IndexResponse)
def index_kb(kb_type: str = Query("accessibility")):
    """Index knowledge base files into ChromaDB collection."""
    if kb_type not in KB_PATHS:
        raise ValueError(f"Unknown kb_type: {kb_type}")
    
    collection_name = COLLECTION_NAMES[kb_type]
    
    # Delete and recreate collection for this kb_type
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
        chunks = chunk_text(text)
        ids, docs, metas = [], [], []

        for i, c in enumerate(chunks):
            c = c.strip()
            if not c:
                continue
            cid = f"{fpath.as_posix()}::chunk{i}"
            ids.append(cid)
            docs.append(c)
            metas.append({"source": fpath.as_posix()})

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
    
    res = collection.query(query_texts=[req.query], n_results=req.top_k)
    ids = res.get("ids", [[]])[0]
    docs = res.get("documents", [[]])[0]
    metas = res.get("metadatas", [[]])[0]

    chunks = []
    for cid, doc, meta in zip(ids, docs, metas):
        chunks.append(
            Chunk(id=str(cid), source=str(meta.get("source", "")), text=str(doc))
        )
    return RetrieveResponse(chunks=chunks)
