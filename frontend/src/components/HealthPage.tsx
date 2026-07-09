// src/components/HealthPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { getHealth, type HealthStatus } from '../api';

export default function HealthPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await getHealth();
      setHealth(data);
      setLastChecked(new Date());
      setError(false);
    } catch {
      setError(true);
      setHealth(null);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, [refresh]);

  const StatusCard = ({ name, status }: { name: string; status: string }) => {
    const isHealthy = status === 'healthy';
    
    // Choose SVG based on service name
    const serviceIcon = name.includes('Qdrant') ? (
      <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
      </svg>
    ) : name.includes('Ollama') ? (
      <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ) : (
      <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
      </svg>
    );

    return (
      <div className="glass rounded-2xl p-5 flex items-center gap-4 animate-fade-in">
        <div className="flex shrink-0 w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center p-2.5">{serviceIcon}</div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-slate-300">{name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`w-2.5 h-2.5 rounded-full ${isHealthy ? 'bg-green-400' : 'bg-red-400 animate-pulse'}`} />
            <span className={`text-sm ${isHealthy ? 'text-green-400' : 'text-red-400'}`}>
              {isHealthy ? 'Healthy' : 'Unhealthy'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">System Health</h1>
        <button
          onClick={refresh}
          className="text-xs text-slate-400 hover:text-slate-300 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg transition-all"
          id="health-refresh-btn"
        >
          รีเฟรช
        </button>
      </div>

      {/* Overall Status */}
      {error ? (
        <div className="glass rounded-2xl p-6 text-center">
          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-3">
            <span className="w-3 h-3 rounded-full bg-red-500" />
          </div>
          <p className="text-red-400 font-medium">ไม่สามารถเชื่อมต่อ Backend ได้</p>
          <p className="text-slate-500 text-sm mt-1">ตรวจสอบว่า FastAPI server ทำงานอยู่ที่ localhost:8000</p>
        </div>
      ) : health ? (
        <>
          {/* Overall Badge */}
          <div className={`glass rounded-2xl p-5 flex items-center gap-4 ${
            health.status === 'healthy' ? 'border-green-500/20' : 'border-red-500/20'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              health.status === 'healthy' ? 'bg-green-500/20' : 'bg-amber-500/20'
            }`}>
              <span className={`w-3 h-3 rounded-full ${
                health.status === 'healthy' ? 'bg-green-400' : 'bg-amber-400'
              }`} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-200">
                {health.status === 'healthy' ? 'ระบบทำงานปกติ' : 'ระบบทำงานบางส่วน'}
              </h2>
              {lastChecked && (
                <p className="text-xs text-slate-500 mt-0.5">
                  ตรวจล่าสุด: {lastChecked.toLocaleTimeString('th-TH')} (auto-refresh ทุก 30 วินาที)
                </p>
              )}
            </div>
          </div>

          {/* Service Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatusCard name="Qdrant (Vector DB)" status={health.qdrant} />
            <StatusCard name="Ollama (AI Models)" status={health.ollama} />
            <StatusCard name="Redis (Job Queue)" status={health.redis} />
          </div>

          {/* Available Models */}
          {health.available_models.length > 0 && (
            <div className="glass rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">โมเดลที่พร้อมใช้งาน</h3>
              <div className="flex flex-wrap gap-2">
                {health.available_models.map(model => (
                  <span
                    key={model}
                    className="text-xs bg-primary-600/20 text-primary-300 px-3 py-1.5 rounded-full"
                  >
                    {model}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="glass rounded-2xl p-8 text-center">
          <div className="inline-block w-8 h-8 border-2 border-primary-400/30 border-t-primary-400 rounded-full animate-spin" />
          <p className="text-slate-400 mt-3">กำลังตรวจสอบ...</p>
        </div>
      )}
    </div>
  );
}
