# tasks.py
"""
Background job functions for Redis Queue (rq).
These functions are executed by the rq worker process, NOT the FastAPI server.
"""
import os
import httpx
from typing import Dict, Any, Optional
from pdf_utils import extract_text_from_pdf, extract_pages_from_pdf
from chunk_utils import split_text
from rag import RAG

UPLOAD_DIR: str = "upload"


def _send_webhook(callback_url: str, payload: Dict[str, Any]) -> None:
    """
    Send a webhook POST to the callback URL with the job result.
    Similar to how Google OAuth calls back to your app after login completes.
    Silently ignores errors — webhook delivery is best-effort.
    """
    try:
        with httpx.Client(timeout=10.0) as client:
            client.post(
                callback_url,
                json=payload,
                headers={"Content-Type": "application/json"},
            )
    except Exception:
        pass


def process_pdf_upload(
    filename: str,
    callback_url: Optional[str] = None,
    chunk_size: int = 500,
    chunk_overlap: int = 50,
) -> Dict[str, Any]:
    """
    Background task: Extract text from a PDF, chunk it, embed each chunk,
    and ingest all chunks into Qdrant.

    This function runs inside the rq worker process.
    When callback_url is provided, sends a webhook POST with the result
    (similar to Google OAuth callback pattern).

    Returns a summary dict with processing results.
    """
    filepath = os.path.join(UPLOAD_DIR, filename)
    result: Dict[str, Any] = {}

    try:
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"PDF file not found: {filepath}")

        pages = extract_pages_from_pdf(filepath)
        if not pages:
            result = {
                "event": "document.processed",
                "filename": filename,
                "status": "skipped",
                "message": "PDF contained no extractable text.",
                "chunk_count": 0,
            }
            if callback_url:
                _send_webhook(callback_url, result)
            return result

        rag = RAG()
        category = filename
        success_count = 0
        total_text_length = 0
        
        for p in pages:
            page_text = p["text"]
            total_text_length += len(page_text)
            chunks = split_text(page_text, chunk_size=chunk_size, chunk_overlap=chunk_overlap)
            for chunk in chunks:
                rag.ingest_chunk(chunk, category=category, metadata={"page": p["page_num"]})
                success_count += 1

        result = {
            "event": "document.processed",
            "filename": filename,
            "status": "completed",
            "message": f"Successfully ingested {success_count} chunks from '{filename}'.",
            "chunk_count": success_count,
            "text_length": total_text_length,
        }

    except Exception as e:
        result = {
            "event": "document.processed",
            "filename": filename,
            "status": "failed",
            "message": str(e),
            "chunk_count": 0,
        }

    if callback_url:
        _send_webhook(callback_url, result)

    if result.get("status") == "failed":
        raise RuntimeError(result["message"])

    return result
