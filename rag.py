# rag.py
import uuid
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct
from typing import List, Dict, Any
import ollama_utils
from constants import QDRANT_URL, COLLECTION_NAME, VECTOR_DIMENSION

class RAG:
    def __init__(self) -> None:
        """
        Initialize the Qdrant client and verify/create collection setup.
        """
        self.client = QdrantClient(url=QDRANT_URL)
        self.init_db()

    def init_db(self) -> None:
        """
        Ensure Qdrant collection exists for storing embeddings.
        """
        try:
            if not self.client.collection_exists(collection_name=COLLECTION_NAME):
                self.client.create_collection(
                    collection_name=COLLECTION_NAME,
                    vectors_config=VectorParams(
                        size=VECTOR_DIMENSION, 
                        distance=Distance.COSINE
                    )
                )
        except Exception as e:
            print(f"Warning: Could not connect to Qdrant at {QDRANT_URL}: {e}")

    def clear_db(self) -> None:
        """
        Deletes and recreates the collection, effectively clearing all data.
        """
        try:
            if self.client.collection_exists(collection_name=COLLECTION_NAME):
                self.client.delete_collection(collection_name=COLLECTION_NAME)
            self.client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=VectorParams(
                    size=VECTOR_DIMENSION, 
                    distance=Distance.COSINE
                )
            )
            print(f"🧹 ล้างข้อมูลเดิมใน Collection '{COLLECTION_NAME}' เรียบร้อยแล้ว!")
        except Exception as e:
            raise RuntimeError(f"Failed to clear database collection: {e}")

    def ingest_chunk(self, content: str, category: str = "general") -> str:
        """
        Convert text content to vector embedding using ollama_utils and save it to Qdrant.
        Returns the inserted point UUID string.
        """
        embedding = ollama_utils.get_embedding(content)
        point_id = str(uuid.uuid4())
        
        self.client.upsert(
            collection_name=COLLECTION_NAME,
            points=[
                PointStruct(
                    id=point_id,
                    vector=embedding,
                    payload={
                        "content": content,
                        "category": category
                    }
                )
            ]
        )
        return point_id

    def get_relevant_documents(self, query: str, limit: int = 3) -> List[Dict[str, Any]]:
        """
        Retrieve context documents from Qdrant using similarity search.
        """
        query_vector = ollama_utils.get_embedding(query)
        
        search_results = self.client.query_points(
            collection_name=COLLECTION_NAME,
            query=query_vector,
            limit=limit
        )
        
        results = []
        for hit in search_results.points:
            results.append({
                "id": hit.id,
                "content": hit.payload.get("content", ""),
                "category": hit.payload.get("category", "general"),
                "similarity": float(hit.score)
            })
        return results

    def ask(self, query: str) -> str:
        """
        Augment user query with database context and generate answer from local LLM.
        """
        # 1. Retrieve context chunks
        context_docs = self.get_relevant_documents(query, limit=3)
        
        if not context_docs:
            context_text = "No relevant context found in database."
        else:
            context_text = "\n\n".join([doc["content"] for doc in context_docs])
            
        # 2. Build the system prompt
        prompt = f"""
        You are a knowledgeable and precise AI assistant. Answer the user's question using ONLY the provided context information.
        If the answer cannot be determined from the context, say "I don't know".
        Do not mention "context" or "retrieved documents" in your final answer.

        CONTEXT INFORMATION:
        {context_text}

        USER QUESTION:
        {query}
        """
        
        # 3. Call local LLM (Qwen) via ollama_utils
        return ollama_utils.generate_llm_response(prompt)
