# main.py
from fastapi import FastAPI, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
import json
import httpx
import ollama
from typing import List, Optional, Dict, Any
from rag import RAG
from constants import QDRANT_URL

# FastAPI Setup
app = FastAPI(
    title="Local RAG API Backend (Qdrant)",
    description="Backend API for local RAG utilizing Qdrant and Ollama",
    version="1.0.0"
)

# Instantiate the RAG controller
rag_service = RAG()

# --- PYDANTIC SCHEMAS ---
class IngestRequest(BaseModel):
    content: str = Field(..., min_length=1, description="Text content to be stored in the database")
    category: Optional[str] = Field("general", description="Optional category label for the document")

class IngestResponse(BaseModel):
    success: bool
    document_id: str
    message: str

class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1, description="Question or search query for the RAG system")

class QueryResponse(BaseModel):
    success: bool
    query: str
    answer: str
    sources: List[Dict[str, Any]]

class HealthResponse(BaseModel):
    status: str
    qdrant: str
    ollama: str
    available_models: List[str]


# --- API ENDPOINTS ---
@app.post("/ingest", response_model=IngestResponse, status_code=status.HTTP_201_CREATED)
async def ingest_document(payload: IngestRequest):
    """
    Ingest a document chunk: converts text to vector embedding using Ollama bge-m3 
    and stores it in the Qdrant database.
    """
    try:
        doc_id = rag_service.ingest_chunk(payload.content, payload.category)
        return IngestResponse(
            success=True,
            document_id=doc_id,
            message="Document content ingested successfully."
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ingestion failed: {e}"
        )

@app.post("/query")
async def query_rag(payload: QueryRequest):
    """
    Query the RAG system: performs semantic search on Qdrant and streams
    the answer from local LLM (qwen3-vl:8b) using SSE (Server-Sent Events).
    """
    try:
        # Get source documents ONCE (avoids duplicate embedding call)
        sources = rag_service.get_relevant_documents(payload.query, limit=3)
        formatted_sources = [
            {"id": s["id"], "content": s["content"], "category": s["category"], "similarity": s["similarity"]}
            for s in sources
        ]

        async def event_generator():
            # 1. Send sources immediately
            yield f"data: {json.dumps({'event': 'sources', 'data': formatted_sources}, ensure_ascii=False)}\n\n"
            
            # 2. Stream LLM response (reuse already-fetched sources to avoid re-embedding)
            try:
                async for token in rag_service.ask_stream(payload.query, context_docs=sources):
                    # Skip empty tokens (e.g. qwen3 thinking tokens)
                    if not token:
                        continue
                    yield f"data: {json.dumps({'event': 'token', 'data': token}, ensure_ascii=False)}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'event': 'error', 'data': str(e)}, ensure_ascii=False)}\n\n"
            
            # 3. Send done event
            yield "data: {\"event\": \"done\"}\n\n"

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
                "Connection": "keep-alive",
            }
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Query streaming setup failed: {e}"
        )

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint to inspect Qdrant and Ollama connectivity status.
    """
    qdrant_status = "healthy"
    ollama_status = "healthy"
    models = []

    # Check Qdrant via HTTP health endpoint
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{QDRANT_URL}/healthz", timeout=2.0)
            if resp.status_code != 200:
                qdrant_status = "unhealthy"
    except Exception:
        qdrant_status = "unhealthy"

    # Check Ollama
    try:
        list_resp = ollama.list()
        models = [m["model"] for m in list_resp.get("models", [])]
    except Exception:
        ollama_status = "unhealthy"

    overall_status = "healthy" if qdrant_status == "healthy" and ollama_status == "healthy" else "degraded"

    return HealthResponse(
        status=overall_status,
        qdrant=qdrant_status,
        ollama=ollama_status,
        available_models=models
    )
