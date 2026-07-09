// src/components/SettingsPage.tsx
import { useState, useEffect } from 'react';

export default function SettingsPage() {
  const [model, setModel] = useState('llama-3.3-70b-versatile');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(2048);
  const [topK, setTopK] = useState(5);
  const [chunkSize, setChunkSize] = useState(512);
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const storedModel = localStorage.getItem('rag_model') || 'llama-3.3-70b-versatile';
    const storedTemp = parseFloat(localStorage.getItem('rag_temp') || '0.7');
    const storedMaxTokens = parseInt(localStorage.getItem('rag_max_tokens') || '2048', 10);
    const storedTopK = parseInt(localStorage.getItem('rag_top_k') || '5', 10);
    const storedChunkSize = parseInt(localStorage.getItem('rag_chunk_size') || '512', 10);
    const storedApiKey = localStorage.getItem('rag_api_key') || '';

    setModel(storedModel);
    setTemperature(storedTemp);
    setMaxTokens(storedMaxTokens);
    setTopK(storedTopK);
    setChunkSize(storedChunkSize);
    setApiKey(storedApiKey);
  }, []);

  const handleSave = () => {
    localStorage.setItem('rag_model', model);
    localStorage.setItem('rag_temp', temperature.toString());
    localStorage.setItem('rag_max_tokens', maxTokens.toString());
    localStorage.setItem('rag_top_k', topK.toString());
    localStorage.setItem('rag_chunk_size', chunkSize.toString());
    localStorage.setItem('rag_api_key', apiKey);

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const modelOptions = [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      tag: 'แนะนำ',
      tagColor: 'bg-primary-600/10 text-primary-400 border border-primary-500/20',
      description: 'OpenAI • 128K context'
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      tag: 'เร็ว',
      tagColor: 'bg-green-500/10 text-green-400 border border-green-500/20',
      description: 'OpenAI • 128K context'
    },
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude Sonnet 4.6',
      tag: 'ใหม่',
      tagColor: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
      description: 'Anthropic • 200K context'
    },
    {
      id: 'claude-3-5-haiku-20241022',
      name: 'Claude Haiku 4.5',
      tag: 'ประหยัด',
      tagColor: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
      description: 'Anthropic • 200K context'
    },
    {
      id: 'llama-3.3-70b-versatile',
      name: 'Llama 3.3 70B',
      tag: '',
      tagColor: '',
      description: 'Meta / Local • 128K context'
    },
    {
      id: 'qwen3:4b',
      name: 'Qwen3 4B',
      tag: 'Local',
      tagColor: 'bg-slate-700/30 text-slate-400 border border-slate-700/50',
      description: 'Local / Ollama • 32K context'
    }
  ];

  return (
    <div className="h-full overflow-y-auto px-6 py-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100">การตั้งค่าโมเดล</h1>
        <p className="text-xs text-slate-500 mt-1">LLM • Embedding • RAG Parameters</p>
      </div>

      {/* Model Selection */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-400 flex items-center gap-2">
          <span>เลือกโมเดล LLM</span>
        </h2>
        <div className="space-y-2">
          {modelOptions.map((opt) => (
            <label
              key={opt.id}
              onClick={() => setModel(opt.id)}
              className={`w-full flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all border ${model === opt.id
                  ? 'bg-primary-950/20 border-primary-500/40 text-slate-200'
                  : 'bg-surface-800/40 border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-350'
                }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center shrink-0">
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${model === opt.id ? 'border-primary-500' : 'border-slate-700'
                    }`}>
                    {model === opt.id && <div className="w-2.5 h-2.5 rounded-full bg-primary-500" />}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{opt.name}</span>
                  {opt.tag && (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${opt.tagColor}`}>
                      {opt.tag}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs opacity-60 font-mono">{opt.description}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Generation Parameters */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-400 flex items-center gap-2 pt-2">
          <span>พารามิเตอร์การสร้างข้อความ</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-surface-800/40 border border-slate-800 p-4 rounded-xl space-y-3">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
              <span>Temperature</span>
              <span className="bg-slate-800 px-2 py-0.5 rounded font-mono text-slate-200">{temperature.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary-500"
            />
            <div className="flex justify-between text-[10px] text-slate-600 font-mono">
              <span>0 (แม่นยำ/คงเส้นคงวา)</span>
              <span>2 (คิดสร้างสรรค์)</span>
            </div>
          </div>

          <div className="bg-surface-800/40 border border-slate-800 p-4 rounded-xl space-y-3">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
              <span>Max Tokens</span>
              <span className="bg-slate-800 px-2 py-0.5 rounded font-mono text-slate-200">{maxTokens.toLocaleString()}</span>
            </div>
            <input
              type="range"
              min="256"
              max="8192"
              step="256"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value, 10))}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary-500"
            />
            <div className="flex justify-between text-[10px] text-slate-600 font-mono">
              <span>256</span>
              <span>8,192</span>
            </div>
          </div>
        </div>
      </div>

      {/* RAG Parameters */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-400 flex items-center gap-2 pt-2">
          <span>พารามิเตอร์ RAG</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-surface-800/40 border border-slate-800 p-4 rounded-xl space-y-3">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
              <span>Top-K Documents</span>
              <span className="bg-slate-800 px-2 py-0.5 rounded font-mono text-slate-200">{topK} docs</span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={topK}
              onChange={(e) => setTopK(parseInt(e.target.value, 10))}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary-500"
            />
            <div className="flex justify-between text-[10px] text-slate-600 font-mono">
              <span>1 doc</span>
              <span>20 docs</span>
            </div>
          </div>

          <div className="bg-surface-800/40 border border-slate-800 p-4 rounded-xl space-y-3">
            <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
              <span>Chunk Size (tokens)</span>
              <span className="bg-slate-800 px-2 py-0.5 rounded font-mono text-slate-200">{chunkSize}</span>
            </div>
            <input
              type="range"
              min="128"
              max="2048"
              step="64"
              value={chunkSize}
              onChange={(e) => setChunkSize(parseInt(e.target.value, 10))}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary-500"
            />
            <div className="flex justify-between text-[10px] text-slate-600 font-mono">
              <span>128</span>
              <span>2,048</span>
            </div>
          </div>
        </div>
      </div>

      {/* API Key */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-400 flex items-center gap-2 pt-2">
          <span>API KEY</span>
        </h2>
        <div className="bg-surface-800/40 border border-slate-800 p-4 rounded-xl space-y-2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="ป้อน API KEY ของผู้ให้บริการ LLM (OpenAI, Anthropic, หรือ Groq)"
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20 transition-all"
          />
          <p className="text-[10px] text-slate-550">
            เก็บไว้ในเครื่องของคุณเท่านั้น ไม่มีการส่งข้อมูลไปยังเซิร์ฟเวอร์ภายนอก
          </p>
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-4 flex items-center gap-4">
        <button
          onClick={handleSave}
          className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-3 rounded-xl transition-all shadow-md active:scale-98 text-center text-sm"
        >
          บันทึกการตั้งค่า
        </button>
        {saved && (
          <span className="text-sm text-green-400 font-medium animate-fade-in shrink-0">
            บันทึกการตั้งค่าสำเร็จ!
          </span>
        )}
      </div>
    </div>
  );
}
