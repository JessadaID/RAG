// src/api.ts — API client for RAG Backend
const API_BASE = 'http://localhost:8000';

// --- Types ---
export interface DocumentInfo {
  filename: string;
  size_bytes: number;
  chunk_count: number;
}

export interface UploadResponse {
  success: boolean;
  filename: string;
  job_id: string;
  message: string;
}

export interface DeleteResponse {
  success: boolean;
  filename: string;
  deleted_chunks: number;
  message: string;
}

export interface JobStatus {
  job_id: string;
  status: 'queued' | 'started' | 'finished' | 'failed';
  result: Record<string, unknown> | null;
  error: string | null;
}

export interface HealthStatus {
  status: string;
  qdrant: string;
  ollama: string;
  redis: string;
  available_models: string[];
}

export interface Source {
  id: string;
  content: string;
  category: string;
  page?: number;
  similarity: number;
}

// --- Chat API (SSE Streaming) ---
export async function queryRAG(
  query: string,
  onSources: (sources: Source[]) => void,
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (error: string) => void,
  model?: string,
  temperature?: number,
  maxTokens?: number,
  topK?: number,
  apiKey?: string,
): Promise<void> {
  const response = await fetch(`${API_BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      query, 
      model, 
      temperature, 
      max_tokens: maxTokens, 
      top_k: topK, 
      api_key: apiKey 
    }),
  });

  if (!response.ok || !response.body) {
    onError(`HTTP Error: ${response.status}`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      try {
        const json = JSON.parse(line.slice(6));
        switch (json.event) {
          case 'sources':
            onSources(json.data);
            break;
          case 'token':
            onToken(json.data);
            break;
          case 'done':
            onDone();
            break;
          case 'error':
            onError(json.data);
            break;
        }
      } catch {
        // skip malformed JSON
      }
    }
  }
}

// --- Document Management API ---
export async function listDocuments(): Promise<DocumentInfo[]> {
  const res = await fetch(`${API_BASE}/documents`);
  const data = await res.json();
  return data.documents;
}

export async function uploadDocument(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Upload failed');
  }
  return res.json();
}

export async function deleteDocument(filename: string): Promise<DeleteResponse> {
  const res = await fetch(`${API_BASE}/documents/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Delete failed');
  }
  return res.json();
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const res = await fetch(`${API_BASE}/documents/jobs/${jobId}`);
  return res.json();
}

export function pollJobStatus(
  jobId: string,
  onUpdate: (job: JobStatus) => void,
  intervalMs = 2000,
): () => void {
  const timer = setInterval(async () => {
    try {
      const job = await getJobStatus(jobId);
      onUpdate(job);
      if (job.status === 'finished' || job.status === 'failed') {
        clearInterval(timer);
      }
    } catch {
      clearInterval(timer);
    }
  }, intervalMs);
  return () => clearInterval(timer);
}

// --- Health API ---
export async function getHealth(): Promise<HealthStatus> {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}
