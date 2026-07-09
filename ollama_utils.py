# ollama_utils.py
import os
import json
import httpx
import ollama
from ollama import AsyncClient
from typing import List, AsyncGenerator, Optional, Dict, Any
from constants import EMBEDDING_MODEL, LLM_MODEL, GROQ_API_KEY, GROQ_BASE_URL, GROQ_LLM_MODEL

GROQ_MODELS = [
    "llama-3.3-70b-versatile",
    "mixtral-8x7b-32768",
    "llama3-70b-8192",
    "gemma2-9b-it",
    "deepseek-r1-distill-llama-70b"
]

def is_groq_model(model_name: str) -> bool:
    if not model_name:
        return False
    return any(model_name.lower().startswith(m.lower()) for m in GROQ_MODELS)

def get_model_provider(model_name: str) -> str:
    name = model_name.lower()
    if name.startswith("gpt-"):
        return "openai"
    elif name.startswith("claude-"):
        return "anthropic"
    elif is_groq_model(model_name):
        return "groq"
    else:
        return "ollama"

def get_embedding(text: str) -> List[float]:
    try:
        response = ollama.embeddings(model=EMBEDDING_MODEL, prompt=text)
        return response["embedding"]
    except Exception as e:
        raise RuntimeError(
            f"Failed to generate embedding using model '{EMBEDDING_MODEL}'. "
            f"Ensure Ollama is running and the model is downloaded. Error: {e}"
        )

class BaseProvider:
    def generate(self, prompt: str, model: str, temp: float, tokens: int, api_key: Optional[str]) -> str:
        raise NotImplementedError

    async def generate_stream(self, prompt: str, model: str, temp: float, tokens: int, api_key: Optional[str]) -> AsyncGenerator[str, None]:
        raise NotImplementedError


class OpenAIProvider(BaseProvider):
    def __init__(self, base_url: str = "https://api.openai.com/v1", env_key_name: str = "OPENAI_API_KEY"):
        self.base_url = base_url
        self.env_key_name = env_key_name

    def _get_api_key(self, api_key: Optional[str]) -> str:
        return api_key or os.getenv(self.env_key_name, "")

    def _get_headers(self, api_key: str) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }

    def _get_payload(self, prompt: str, model: str, temp: float, tokens: int, stream: bool = False) -> Dict[str, Any]:
        return {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temp,
            "max_tokens": tokens,
            "stream": stream
        }

    def generate(self, prompt: str, model: str, temp: float, tokens: int, api_key: Optional[str]) -> str:
        key = self._get_api_key(api_key)
        if not key:
            return f"❌ Error: {self.env_key_name} is missing. Please set it in Settings."
        try:
            with httpx.Client() as client:
                response = client.post(
                    f"{self.base_url}/chat/completions",
                    headers=self._get_headers(key),
                    json=self._get_payload(prompt, model, temp, tokens),
                    timeout=30.0
                )
                response.raise_for_status()
                return response.json()["choices"][0]["message"]["content"]
        except Exception as e:
            return f"❌ Error: {e}"

    async def generate_stream(self, prompt: str, model: str, temp: float, tokens: int, api_key: Optional[str]) -> AsyncGenerator[str, None]:
        key = self._get_api_key(api_key)
        if not key:
            yield f"❌ Error: {self.env_key_name} is missing. Please set it in Settings."
            return
        try:
            async with httpx.AsyncClient() as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/chat/completions",
                    headers=self._get_headers(key),
                    json=self._get_payload(prompt, model, temp, tokens, stream=True),
                    timeout=30.0
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line or not line.startswith("data: "):
                            continue
                        data_str = line[6:].strip()
                        if data_str == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            content = data["choices"][0]["delta"].get("content", "")
                            if content:
                                yield content
                        except Exception:
                            continue
        except Exception as e:
            yield f"\n❌ Error streaming: {e}"


class AnthropicProvider(BaseProvider):
    def _get_api_key(self, api_key: Optional[str]) -> str:
        return api_key or os.getenv("ANTHROPIC_API_KEY", "")

    def _get_headers(self, api_key: str) -> Dict[str, str]:
        return {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }

    def _get_payload(self, prompt: str, model: str, temp: float, tokens: int, stream: bool = False) -> Dict[str, Any]:
        return {
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temp,
            "max_tokens": tokens,
            "stream": stream
        }

    def generate(self, prompt: str, model: str, temp: float, tokens: int, api_key: Optional[str]) -> str:
        key = self._get_api_key(api_key)
        if not key:
            return "❌ Error: Anthropic API Key is missing. Please set it in Settings."
        try:
            with httpx.Client() as client:
                response = client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers=self._get_headers(key),
                    json=self._get_payload(prompt, model, temp, tokens),
                    timeout=30.0
                )
                response.raise_for_status()
                return response.json()["content"][0]["text"]
        except Exception as e:
            return f"❌ Error from Anthropic: {e}"

    async def generate_stream(self, prompt: str, model: str, temp: float, tokens: int, api_key: Optional[str]) -> AsyncGenerator[str, None]:
        key = self._get_api_key(api_key)
        if not key:
            yield "❌ Error: Anthropic API Key is missing. Please set it in Settings."
            return
        try:
            async with httpx.AsyncClient() as client:
                async with client.stream(
                    "POST",
                    "https://api.anthropic.com/v1/messages",
                    headers=self._get_headers(key),
                    json=self._get_payload(prompt, model, temp, tokens, stream=True),
                    timeout=30.0
                ) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line or not line.startswith("data: "):
                            continue
                        data_str = line[6:].strip()
                        try:
                            data = json.loads(data_str)
                            if data.get("type") == "content_block_delta":
                                content = data["delta"].get("text", "")
                                if content:
                                    yield content
                        except Exception:
                            continue
        except Exception as e:
            yield f"\n❌ Error streaming from Anthropic: {e}"


class OllamaProvider(BaseProvider):
    def generate(self, prompt: str, model: str, temp: float, tokens: int, api_key: Optional[str]) -> str:
        try:
            options = {"temperature": temp}
            if tokens is not None:
                options["num_predict"] = tokens
            response = ollama.chat(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                options=options
            )
            return response["message"]["content"]
        except Exception as e:
            return f"❌ Error from Local Ollama ({model}): {e}"

    async def generate_stream(self, prompt: str, model: str, temp: float, tokens: int, api_key: Optional[str]) -> AsyncGenerator[str, None]:
        try:
            client = AsyncClient()
            options = {"temperature": temp}
            if tokens is not None:
                options["num_predict"] = tokens
            response_stream = await client.chat(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                options=options,
                stream=True
            )
            async for chunk in response_stream:
                content = chunk["message"]["content"]
                if content:
                    yield content
        except Exception as e:
            yield f"\n❌ Error streaming from Local Ollama ({model}): {e}"


PROVIDERS = {
    "openai": OpenAIProvider(),
    "anthropic": AnthropicProvider(),
    "groq": OpenAIProvider(base_url=GROQ_BASE_URL, env_key_name="GROQ_API_KEY"),
    "ollama": OllamaProvider()
}

def generate_llm_response(
    prompt: str,
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    api_key: Optional[str] = None
) -> str:
    selected_model = model or LLM_MODEL
    provider_name = get_model_provider(selected_model)
    provider = PROVIDERS.get(provider_name, PROVIDERS["ollama"])

    temp = 0.2 if temperature is None else temperature
    tokens = 2048 if max_tokens is None else max_tokens

    effective_key = api_key
    if not effective_key and provider_name == "groq":
        effective_key = GROQ_API_KEY

    return provider.generate(prompt, selected_model, temp, tokens, effective_key)

async def generate_llm_response_stream(
    prompt: str,
    model: Optional[str] = None,
    temperature: Optional[float] = None,
    max_tokens: Optional[int] = None,
    api_key: Optional[str] = None
) -> AsyncGenerator[str, None]:
    selected_model = model or LLM_MODEL
    provider_name = get_model_provider(selected_model)
    provider = PROVIDERS.get(provider_name, PROVIDERS["ollama"])

    temp = 0.2 if temperature is None else temperature
    tokens = 2048 if max_tokens is None else max_tokens

    effective_key = api_key
    if not effective_key and provider_name == "groq":
        effective_key = GROQ_API_KEY

    async for chunk in provider.generate_stream(prompt, selected_model, temp, tokens, effective_key):
        yield chunk
