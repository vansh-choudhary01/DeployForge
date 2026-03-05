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
        className="h-96 bg-slate-950 border border-slate-700 rounded-lg p-4 overflow-y-auto font-mono text-sm space-y-1"
      >
        {logs && logs.length > 0 ? (
          logs.map((log, index) => (
            <div
              key={index}
              className={`${
                log.type === 'error'
                  ? 'text-red-400'
                  : log.type === 'success'
                  ? 'text-green-400'
                  : log.type === 'warning'
                  ? 'text-yellow-400'
                  : 'text-slate-300'
              }`}
            >
              <span className="text-slate-500">{log.timestamp || ''}</span> {log.message}
            </div>
          ))
        ) : isLoading ? (
          <div className="text-slate-500">Waiting for logs...</div>
        ) : (
          <div className="text-slate-500">No logs available</div>
        )}
      </div>
    </div>
  );
}
