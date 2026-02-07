from pathlib import Path
from fastapi import FastAPI
from pydantic import BaseModel
import chromadb
from chromadb.utils import embedding_functions

REPO_ROOT = Path(__file__).resolve().parents[2]
KB_DIR = REPO_ROOT / "knowledge-base"

DB_DIR = Path(__file__).resolve().parent / "chroma_db"
COLLECTION_NAME = "kb_docs"

app = FastAPI(title="AI Accessibility Assistant - RAG Service")

embed_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)

client = chromadb.PersistentClient(path=str(DB_DIR))
collection = client.get_or_create_collection(
    name=COLLECTION_NAME, embedding_function=embed_fn
)

class IndexResponse(BaseModel):
    indexed: int

class RetrieveRequest(BaseModel):
    query: str
    top_k: int = 6

class Chunk(BaseModel):
    id: str
    source: str
    text: str

class RetrieveResponse(BaseModel):
    chunks: list[Chunk]

def iter_kb_files():
    exts = {".md", ".txt"}
    for p in KB_DIR.rglob("*"):
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
def index_kb():
    # rebuild index (simple v1)
    try:
        client.delete_collection(COLLECTION_NAME)
    except Exception:
        pass

    global collection
    collection = client.get_or_create_collection(
        name=COLLECTION_NAME, embedding_function=embed_fn
    )

    indexed = 0
    for fpath in iter_kb_files():
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
