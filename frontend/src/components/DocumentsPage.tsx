// src/components/DocumentsPage.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  listDocuments,
  uploadDocument,
  deleteDocument,
  pollJobStatus,
  type DocumentInfo,
} from '../api';

interface ProcessingJob {
  jobId: string;
  filename: string;
  status: string;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const docs = await listDocuments();
      setDocuments(docs);
    } catch {
      showToast('ไม่สามารถเชื่อมต่อ Backend ได้');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        showToast(`${file.name} ไม่ใช่ไฟล์ PDF`);
        continue;
      }

      setUploading(true);
      try {
        const res = await uploadDocument(file);
        showToast(res.message);

        // Add to processing jobs and poll
        const newJob: ProcessingJob = {
          jobId: res.job_id,
          filename: res.filename,
          status: 'queued',
        };
        setJobs(prev => [...prev, newJob]);

        pollJobStatus(res.job_id, (job) => {
          setJobs(prev =>
            prev.map(j => j.jobId === res.job_id ? { ...j, status: job.status } : j)
          );

          if (job.status === 'finished') {
            showToast(`${res.filename} ประมวลผลเสร็จสมบูรณ์!`);
            refresh();
            setTimeout(() => {
              setJobs(prev => prev.filter(j => j.jobId !== res.job_id));
            }, 3000);
          } else if (job.status === 'failed') {
            showToast(`${res.filename} ประมวลผลล้มเหลว`);
            setTimeout(() => {
              setJobs(prev => prev.filter(j => j.jobId !== res.job_id));
            }, 5000);
          }
        });
      } catch (e) {
        showToast(`อัปโหลดล้มเหลว: ${e instanceof Error ? e.message : 'Unknown error'}`);
      } finally {
        setUploading(false);
      }
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`ต้องการลบ "${filename}" ออกจากระบบ?\nข้อมูล vectors ใน Qdrant จะถูกลบด้วย`)) return;
    try {
      const res = await deleteDocument(filename);
      showToast(res.message);
      refresh();
    } catch (e) {
      showToast(`ลบล้มเหลว: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Filtered documents
  const filteredDocs = documents.filter(doc =>
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const readyCount = documents.filter(d => d.chunk_count > 0).length;
  const totalCount = documents.length;

  return (
    <div className="h-full overflow-y-auto p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">จัดการเอกสาร</h1>
          <p className="text-xs text-slate-500 mt-1">
            {readyCount} / {totalCount} เอกสารพร้อมใช้งาน
          </p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded-xl transition-all shadow-md active:scale-95 text-xs flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          อัปโหลด PDF
        </button>
      </div>

      {/* Upload Zone */}
      <div
        className={`glass rounded-2xl p-8 text-center border border-dashed transition-all cursor-pointer ${dragOver ? 'border-primary-500 bg-primary-950/10' : 'border-slate-800 hover:border-slate-700'
          }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
        id="upload-zone"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
          id="file-input"
        />
        <div className="mb-4">
          {uploading ? (
            <svg className="w-10 h-10 mx-auto text-primary-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-10 h-10 mx-auto text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
            </svg>
          )}
        </div>
        <p className="text-slate-300 font-medium text-sm">
          {uploading ? 'กำลังอัปโหลด...' : 'ลากและวางไฟล์ PDF'}
        </p>
        <p className="text-slate-650 text-xs mt-1">หรือ คลิกเพื่อเลือกไฟล์ • รองรับเฉพาะ .pdf</p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-600">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="ค้นหาเอกสาร..."
          className="w-full bg-surface-800/40 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-primary-500 transition-all font-medium"
        />
      </div>

      {/* Document cards list */}
      <div className="space-y-3">
        {/* Processing Jobs */}
        {jobs.map(job => (
          <div key={job.jobId} className="bg-surface-800/20 border border-amber-500/10 rounded-xl p-4 flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-amber-500 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-350">{job.filename}</h3>
                <p className="text-[10px] text-slate-600 mt-1">กำลังประมวลผลเข้าคลังเวกเตอร์ Qdrant...</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              {job.status === 'queued' ? 'คิวงาน' : 'กำลังประมวลผล'}
            </div>
          </div>
        ))}

        {/* Existing Documents */}
        {filteredDocs.length === 0 && jobs.length === 0 ? (
          <div className="text-center py-12 text-slate-600 text-xs">
            ไม่พบเอกสารในระบบ — อัปโหลด PDF เพื่อเริ่มต้น
          </div>
        ) : (
          filteredDocs.map(doc => (
            <div key={doc.filename} className="bg-surface-800/20 border border-slate-800/60 rounded-xl p-4 flex items-center justify-between transition-all hover:border-slate-800 hover:bg-surface-800/35">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700/50">
                  <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-200 truncate">{doc.filename}</h3>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {formatSize(doc.size_bytes)} • {doc.chunk_count} chunks • 9 ก.ค. 2569
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-1.5 text-xs text-green-400 font-semibold bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-lg">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  พร้อม
                </div>
                <button
                  onClick={() => handleDelete(doc.filename)}
                  className="text-slate-500 hover:text-red-400 p-2 hover:bg-red-500/10 rounded-xl transition-all"
                  id={`delete-${doc.filename}`}
                  title="ลบเอกสาร"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 glass rounded-xl px-5 py-3 text-sm text-slate-200 animate-fade-in z-50 shadow-xl shadow-black/30">
          {toast}
        </div>
      )}
    </div>
  );
}
