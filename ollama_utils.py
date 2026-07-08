# ollama_utils.py
import ollama
from ollama import AsyncClient
from typing import List, AsyncGenerator
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

async def generate_llm_response_stream(prompt: str) -> AsyncGenerator[str, None]:
    """
    Calls the local Ollama chat endpoint as a stream of response chunks.
    Disables thinking mode (qwen3) to avoid empty/hidden thinking tokens.
    """
    try:
        client = AsyncClient()
        response_stream = await client.chat(
            model=LLM_MODEL,
            messages=[{"role": "user", "content": prompt}],
            options={"temperature": 0.2},
            stream=True,
            think=False
        )
        async for chunk in response_stream:
            content = chunk["message"]["content"]
            # Only yield non-empty content tokens
            if content:
                yield content
    except Exception as e:
        yield f"\n❌ Error generating response stream from LLM: {e}"
