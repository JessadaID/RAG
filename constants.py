# constants.py
import os
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

# Qdrant database configuration
QDRANT_URL: str = "http://localhost:6333"
COLLECTION_NAME: str = "my_documents"

# Embedding & LLM configuration
EMBEDDING_MODEL: str = "bge-m3:latest"
LLM_MODEL: str = "qwen3:4b"

# BGE-M3 dense embedding dimension size is 1024
VECTOR_DIMENSION: int = 1024

# Redis configuration (for background job queue)
REDIS_URL: str = "redis://localhost:6379"

# Groq API configuration
GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
GROQ_LLM_MODEL: str = "llama-3.3-70b-versatile"

