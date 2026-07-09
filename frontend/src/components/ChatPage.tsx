// src/components/ChatPage.tsx
import { useState, useRef, useEffect } from 'react';
import { queryRAG, listDocuments, type Source } from '../api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  isStreaming?: boolean;
  timestamp?: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [docCount, setDocCount] = useState(0);
  const [currentModel, setCurrentModel] = useState('llama-3.3-70b-versatile');
  const [activeSource, setActiveSource] = useState<Source | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load document count and selected model on mount & focus
  const syncSettings = () => {
    listDocuments()
      .then(docs => setDocCount(docs.filter(d => d.chunk_count > 0).length))
      .catch(() => { });

    const storedModel = localStorage.getItem('rag_model') || 'llama-3.3-70b-versatile';
    setCurrentModel(storedModel);
  };

  useEffect(() => {
    syncSettings();
    window.addEventListener('focus', syncSettings);
    return () => window.removeEventListener('focus', syncSettings);
  }, []);

  const handleSend = async () => {
    const query = input.trim();
    if (!query || loading) return;

    setInput('');
    setLoading(true);

    const currentTime = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

    // Add user message
    const userMsg: Message = {
      role: 'user',
      content: query,
      timestamp: currentTime
    };
    setMessages(prev => [...prev, userMsg]);

    // Read latest settings from localStorage
    const model = localStorage.getItem('rag_model') || 'llama-3.3-70b-versatile';
    const temp = parseFloat(localStorage.getItem('rag_temp') || '0.7');
    const maxTokens = parseInt(localStorage.getItem('rag_max_tokens') || '2048', 10);
    const topK = parseInt(localStorage.getItem('rag_top_k') || '5', 10);
    const apiKey = localStorage.getItem('rag_api_key') || '';

    // Add empty assistant message
    const assistantIdx = messages.length + 1;
    setMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        content: '',
        isStreaming: true,
        timestamp: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
      }
    ]);

    try {
      await queryRAG(
        query,
        (sources) => {
          setMessages(prev => {
            const updated = [...prev];
            updated[assistantIdx] = { ...updated[assistantIdx], sources };
            return updated;
          });
        },
        (token) => {
          setMessages(prev => {
            const updated = [...prev];
            updated[assistantIdx] = {
              ...updated[assistantIdx],
              content: updated[assistantIdx].content + token,
            };
            return updated;
          });
        },
        () => {
          setMessages(prev => {
            const updated = [...prev];
            updated[assistantIdx] = { ...updated[assistantIdx], isStreaming: false };
            return updated;
          });
          setLoading(false);
          inputRef.current?.focus();
        },
        (error) => {
          setMessages(prev => {
            const updated = [...prev];
            updated[assistantIdx] = {
              ...updated[assistantIdx],
              content: `Error: ${error}`,
              isStreaming: false,
            };
            return updated;
          });
          setLoading(false);
        },
        model,
        temp,
        maxTokens,
        topK,
        apiKey
      );
    } catch (e) {
      setMessages(prev => {
        const updated = [...prev];
        updated[assistantIdx] = {
          ...updated[assistantIdx],
          content: `ไม่สามารถเชื่อมต่อ Backend ได้ — ตรวจสอบว่า server ทำงานอยู่`,
          isStreaming: false,
        };
        return updated;
      });
      setLoading(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setInput('');
  };

  const getModelDisplayName = (modelId: string) => {
    const names: Record<string, string> = {
      'gpt-4o': 'GPT-4o',
      'gpt-4o-mini': 'GPT-4o Mini',
      'claude-3-5-sonnet-20241022': 'Claude Sonnet 4.6',
      'claude-3-5-haiku-20241022': 'Claude Haiku 4.5',
      'llama-3.3-70b-versatile': 'Llama 3.3 70B',
      'qwen3:4b': 'Qwen3 4B',
    };
    return names[modelId] || modelId;
  };

  return (
    <div className="flex flex-col h-full bg-surface-900">
      {/* Header */}
      <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-sm font-bold text-slate-100 leading-none">บทสนทนา</h1>
          <p className="text-[10px] text-slate-500 mt-1">
            {docCount} เอกสาร • {getModelDisplayName(currentModel)}
          </p>
        </div>
        <button
          onClick={handleNewChat}
          className="text-xs text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 px-3 py-1.5 rounded-lg transition-all active:scale-95 flex items-center gap-1.5 font-medium"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          แชทใหม่
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-50">
            <svg className="w-16 h-16 text-slate-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
            <h2 className="text-xl font-semibold text-slate-300">Local RAG Knowledge Base</h2>
            <p className="text-slate-550 mt-2 max-w-md text-sm leading-relaxed">
              ถามคำถามเกี่ยวกับเอกสาร PDF ที่นำเข้าระบบ — AI จะค้นหาข้อมูลและตอบคำถามให้
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className="w-full">
            {msg.role === 'user' ? (
              /* User Bubble (Right) */
              <div className="flex justify-end items-start gap-3 w-full max-w-3xl mx-auto">
                <div className="flex flex-col items-end">
                  <div className="bg-surface-800/50 border border-slate-800 text-slate-200 rounded-2xl rounded-tr-md px-4 py-3 text-sm leading-relaxed max-w-xl whitespace-pre-wrap">
                    {msg.content}
                  </div>
                  <span className="text-[9px] text-slate-600 mt-1 mr-1">{msg.timestamp}</span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700/50">
                  <svg className="w-4.5 h-4.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
            ) : (
              /* Assistant Bubble (Left) */
              <div className="flex justify-start items-start gap-3 w-full max-w-3xl mx-auto">
                <div className="w-8 h-8 rounded-lg bg-primary-950/20 border border-primary-500/20 flex items-center justify-center shrink-0">
                  <svg className="w-4.5 h-4.5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="flex flex-col items-start min-w-0">
                  <div className="bg-surface-800/40 border border-slate-800/80 text-slate-200 rounded-2xl rounded-tl-md px-4 py-3 text-sm leading-relaxed max-w-xl whitespace-pre-wrap">
                    {msg.content || (msg.isStreaming ? '' : '')}

                    {msg.isStreaming && !msg.content && (
                      <span className="flex gap-1 py-1 items-center h-4">
                        {[0, 1, 2].map(j => (
                          <span
                            key={j}
                            className="w-1.5 h-1.5 bg-primary-400 rounded-full inline-block animate-bounce"
                            style={{ animationDelay: `${j * 0.15}s` }}
                          />
                        ))}
                      </span>
                    )}
                  </div>

                  {/* Sources tag list */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2 max-w-xl">
                      {msg.sources.map((src, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActiveSource(src)}
                          className="text-[10px] bg-slate-800/50 hover:bg-slate-805 border border-slate-800 text-slate-400 hover:text-slate-300 px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all active:scale-95 text-left font-medium cursor-pointer"
                          title="คลิกเพื่อดูเนื้อหาที่อ้างอิง"
                        >
                          <svg className="w-3 h-3 text-slate-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <span>{src.category}{src.page ? ` - p. ${src.page}` : ''}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <span className="text-[9px] text-slate-600 mt-1 ml-1">{msg.timestamp}</span>
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input Bar */}
      <div className="border-t border-slate-800/60 p-4 shrink-0">
        <div className="max-w-3xl mx-auto flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder="ถามเกี่ยวกับเอกสารของคุณ..."
            disabled={loading}
            className="flex-1 bg-surface-800 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 placeholder:text-slate-600 text-sm focus:outline-none focus:border-primary-500 transition-all disabled:opacity-50"
            id="chat-input"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="bg-primary-600 hover:bg-primary-500 disabled:opacity-40 disabled:hover:bg-primary-600 text-white px-5 py-3 rounded-xl font-medium transition-all active:scale-95 flex items-center justify-center min-w-[60px]"
            id="chat-send-btn"
          >
            {loading ? (
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4 transform rotate-90" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
              </svg>
            )}
          </button>
        </div>
        <p className="text-[10px] text-center text-slate-600 mt-2">
          Enter ส่ง • Shift+Enter ขึ้นบรรทัดใหม่
        </p>
      </div>

      {/* Source Reference Modal */}
      {activeSource && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-primary-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <h3 className="text-sm font-bold text-slate-200 truncate max-w-[280px]" title={activeSource.category}>
                  {activeSource.category}
                </h3>
                {activeSource.page && (
                  <span className="text-[10px] bg-primary-600/10 border border-primary-500/20 text-primary-400 px-1.5 py-0.5 rounded font-mono">
                    p. {activeSource.page}
                  </span>
                )}
              </div>
              <button
                onClick={() => setActiveSource(null)}
                className="text-slate-500 hover:text-slate-350 p-1 hover:bg-slate-800 rounded-lg transition-all cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 max-h-[300px] overflow-y-auto text-xs text-slate-350 leading-relaxed whitespace-pre-wrap font-sans bg-slate-950/40">
              {activeSource.content}
            </div>
            <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/20 flex justify-end">
              <button
                onClick={() => setActiveSource(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2 rounded-xl transition-all cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
