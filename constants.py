# constants.py

# Qdrant database configuration
QDRANT_URL: str = "http://localhost:6333"
COLLECTION_NAME: str = "my_documents"

# Embedding & LLM configuration
EMBEDDING_MODEL: str = "bge-m3:latest"
LLM_MODEL: str = "qwen3:4b"

# BGE-M3 dense embedding dimension size is 1024
VECTOR_DIMENSION: int = 1024
