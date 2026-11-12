from fastapi import FastAPI, HTTPException
from .rag import ingest, retrieve, generate_answer
from .schemas import IngestRequest, QueryRequest, QueryResponse

app = FastAPI(title="RepoMind ML Service", version="1.0.0")

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/ingest")
def ingest_repository(request: IngestRequest):
    try:
        chunks = ingest(request.repositoryId, request.documents)
        return {"status": "ready", "chunks": chunks}
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {error}") from error

@app.post("/query", response_model=QueryResponse)
async def query_repository(request: QueryRequest):
    try:
        contexts = retrieve(request.repositoryId, request.question)
        answer, sources = await generate_answer(request.question, contexts)
        return QueryResponse(answer=answer, sources=sources)
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Query failed: {error}") from error
