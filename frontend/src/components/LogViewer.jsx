import React, { useEffect, useRef } from 'react';

export default function LogViewer({ logs = [], isLoading = false }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="h-96 overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-950 p-4 font-mono text-sm shadow-inner shadow-black/40"
      >
        {logs && logs.length > 0 ? (
          logs.map((log, index) => (
            <div
              key={index}
              className={`border-b border-white/[0.04] py-1 ${
                log.type === 'error'
                  ? 'text-rose-300'
                  : log.type === 'success'
                  ? 'text-emerald-300'
                  : log.type === 'warning'
                  ? 'text-amber-300'
                  : 'text-stone-300'
              }`}
            >
              <span className="text-teal-300/70">{log.timestamp || ''}</span> {log.message}
            </div>
          ))
        ) : isLoading ? (
          <div className="text-stone-500">Waiting for logs...</div>
        ) : (
          <div className="text-stone-500">No logs available</div>
        )}
      </div>
    </div>
  );
}
