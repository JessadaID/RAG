# main.py
import os
import json
import httpx
import ollama
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from redis import Redis
from schemas import (
    IngestRequest, IngestResponse, QueryRequest, QueryResponse,
    HealthResponse, DocumentInfo, DocumentListResponse,
    UploadResponse, DeleteResponse, JobStatusResponse
)
from rq import Queue
from rq.job import Job
from rag import RAG
from tasks import process_pdf_upload
from constants import QDRANT_URL, REDIS_URL

UPLOAD_DIR: str = "upload"

app = FastAPI(
    title="Local RAG API Backend (Qdrant)",
    description="Backend API for local RAG utilizing Qdrant and Ollama with PDF management",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

rag_service = RAG()
redis_conn = Redis.from_url(REDIS_URL)
task_queue = Queue(connection=redis_conn)



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
        sources = rag_service.get_relevant_documents(payload.query, limit=payload.top_k or 3)
        formatted_sources = [
            {
                "id": s["id"], 
                "content": s["content"], 
                "category": s["category"], 
                "page": s.get("page"), 
                "similarity": s["similarity"]
            }
            for s in sources
        ]

        async def event_generator():
            yield f"data: {json.dumps({'event': 'sources', 'data': formatted_sources}, ensure_ascii=False)}\n\n"
            
            try:
                async for token in rag_service.ask_stream(
                    payload.query, 
                    context_docs=sources, 
                    model=payload.model,
                    temperature=payload.temperature,
                    max_tokens=payload.max_tokens,
                    api_key=payload.api_key
                ):
                    if not token:
                        continue
                    yield f"data: {json.dumps({'event': 'token', 'data': token}, ensure_ascii=False)}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'event': 'error', 'data': str(e)}, ensure_ascii=False)}\n\n"
            
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

# --- DOCUMENT MANAGEMENT ENDPOINTS ---
@app.post("/documents/upload", response_model=UploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    file: UploadFile = File(...),
    callback_url: Optional[str] = Form(None, description="Webhook URL — system will POST result here when processing completes (like Google OAuth callback)"),
):
    """
    Upload a PDF file to update the RAG knowledge base.
    The file is saved to upload/ and processing is queued as a background job via Redis.
    If a file with the same name already exists, old vectors are removed before re-processing.
    """
    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are accepted. Please upload a .pdf file."
        )

    filename = file.filename
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filepath = os.path.join(UPLOAD_DIR, filename)

    # If the same filename already exists, remove old vectors from Qdrant first
    replaced = False
    try:
        old_count = rag_service.count_by_category(filename)
        if old_count > 0:
            rag_service.delete_by_category(filename)
            replaced = True
    except Exception:
        pass  # Collection may not exist yet on first upload

    # Save the uploaded file to disk
    try:
        content = await file.read()
        with open(filepath, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save file: {e}"
        )

    # Enqueue background processing job via Redis Queue
    try:
        job = task_queue.enqueue(process_pdf_upload, filename, callback_url=callback_url)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Failed to enqueue processing job. Is Redis running? Error: {e}"
        )

    action = "replaced" if replaced else "uploaded"
    return UploadResponse(
        success=True,
        filename=filename,
        job_id=job.id,
        message=f"PDF '{filename}' {action} successfully. Processing queued (job: {job.id})."
    )


@app.delete("/documents/{filename}", response_model=DeleteResponse)
async def delete_document(filename: str):
    """
    Delete a PDF document: removes all associated vectors from Qdrant 
    and deletes the file from the upload/ directory.
    """
    filepath = os.path.join(UPLOAD_DIR, filename)

    # Delete vectors from Qdrant
    try:
        deleted_count = rag_service.delete_by_category(filename)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete vectors from Qdrant: {e}"
        )

    # Delete file from disk
    if os.path.exists(filepath):
        try:
            os.remove(filepath)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Vectors deleted but failed to remove file: {e}"
            )
    elif deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document '{filename}' not found in database or upload folder."
        )

    return DeleteResponse(
        success=True,
        filename=filename,
        deleted_chunks=deleted_count,
        message=f"Document '{filename}' deleted. Removed {deleted_count} chunks from Qdrant."
    )


@app.get("/documents", response_model=DocumentListResponse)
async def list_documents():
    """
    List all PDF documents currently in the upload/ directory,
    along with their chunk counts from Qdrant.
    """
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    documents: List[DocumentInfo] = []

    for fname in sorted(os.listdir(UPLOAD_DIR)):
        if not fname.lower().endswith(".pdf"):
            continue
        fpath = os.path.join(UPLOAD_DIR, fname)
        size = os.path.getsize(fpath)

        try:
            chunk_count = rag_service.count_by_category(fname)
        except Exception:
            chunk_count = 0

        documents.append(DocumentInfo(
            filename=fname,
            size_bytes=size,
            chunk_count=chunk_count,
        ))

    return DocumentListResponse(
        success=True,
        total=len(documents),
        documents=documents,
    )


@app.get("/documents/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """
    Check the status of a background PDF processing job.
    Statuses: queued, started, finished, failed.
    """
    try:
        job = Job.fetch(job_id, connection=redis_conn)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found."
        )

    job_status = job.get_status()
    result = None
    error = None

    if job_status == "finished":
        result = job.result
    elif job_status == "failed":
        error = str(job.exc_info) if job.exc_info else "Unknown error"

    return JobStatusResponse(
        job_id=job_id,
        status=job_status,
        result=result,
        error=error,
    )


# --- HEALTH CHECK ---
@app.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint to inspect Qdrant, Ollama, and Redis connectivity status.
    """
    qdrant_status = "healthy"
    ollama_status = "healthy"
    redis_status = "healthy"
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

    # Check Redis
    try:
        redis_conn.ping()
    except Exception:
        redis_status = "unhealthy"

    all_healthy = all(s == "healthy" for s in [qdrant_status, ollama_status, redis_status])
    overall_status = "healthy" if all_healthy else "degraded"

    return HealthResponse(
        status=overall_status,
        qdrant=qdrant_status,
        ollama=ollama_status,
        redis=redis_status,
        available_models=models,
    )
