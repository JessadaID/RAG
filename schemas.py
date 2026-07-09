# schemas.py
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class IngestRequest(BaseModel):
    content: str = Field(..., min_length=1, description="Text content to be stored in the database")
    category: Optional[str] = Field("general", description="Optional category label for the document")

class IngestResponse(BaseModel):
    success: bool
    document_id: str
    message: str

class QueryRequest(BaseModel):
    query: str = Field(..., min_length=1, description="Question or search query for the RAG system")
    model: Optional[str] = Field(None, description="Optional LLM model name to override the default model")
    temperature: Optional[float] = Field(None, description="LLM generation temperature")
    max_tokens: Optional[int] = Field(None, description="LLM generation max tokens")
    top_k: Optional[int] = Field(None, description="Number of context documents to retrieve")
    api_key: Optional[str] = Field(None, description="Optional custom API key for cloud LLMs")

class QueryResponse(BaseModel):
    success: bool
    query: str
    answer: str
    sources: List[Dict[str, Any]]

class HealthResponse(BaseModel):
    status: str
    qdrant: str
    ollama: str
    redis: str
    available_models: List[str]

class DocumentInfo(BaseModel):
    filename: str
    size_bytes: int
    chunk_count: int

class DocumentListResponse(BaseModel):
    success: bool
    total: int
    documents: List[DocumentInfo]

class UploadResponse(BaseModel):
    success: bool
    filename: str
    job_id: str
    message: str

class DeleteResponse(BaseModel):
    success: bool
    filename: str
    deleted_chunks: int
    message: str

class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
