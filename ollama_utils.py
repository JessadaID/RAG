# ollama_utils.py
import ollama
from typing import List
from constants import EMBEDDING_MODEL, LLM_MODEL

def get_embedding(text: str) -> List[float]:
    """
    Calls the local Ollama embeddings endpoint to generate vector values.
    """
    try:
        response = ollama.embeddings(model=EMBEDDING_MODEL, prompt=text)
        return response["embedding"]
    except Exception as e:
        raise RuntimeError(
            f"Failed to generate embedding using model '{EMBEDDING_MODEL}'. "
            f"Ensure Ollama is running and the model is downloaded. Error: {e}"
        )

def generate_llm_response(prompt: str) -> str:
    """
    Calls the local Ollama chat endpoint to generate response based on system prompt.
    """
    try:
        response = ollama.chat(
            model=LLM_MODEL,
            messages=[{"role": "user", "content": prompt}],
            options={"temperature": 0.2}
        )
        return response["message"]["content"]
    except Exception as e:
        return (
            f"❌ Error generating response from LLM model '{LLM_MODEL}'. "
            f"Please ensure the model is pulled using 'ollama pull {LLM_MODEL}' and Ollama is running. "
            f"Details: {e}"
        )
