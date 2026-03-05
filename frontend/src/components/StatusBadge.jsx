import React from 'react';

const statusConfig = {
  running: {
    bg: 'bg-green-900',
    text: 'text-green-200',
    dot: 'bg-green-500',
    label: 'Running',
  },
  deploying: {
    bg: 'bg-blue-900',
    text: 'text-blue-200',
    dot: 'bg-blue-500',
    label: 'Deploying',
  },
  failed: {
    bg: 'bg-red-900',
    text: 'text-red-200',
    dot: 'bg-red-500',
    label: 'Failed',
  },
  idle: {
    bg: 'bg-slate-800',
    text: 'text-slate-300',
    dot: 'bg-slate-500',
    label: 'Idle',
  },
  stopped: {
    bg: 'bg-slate-800',
    text: 'text-slate-300',
    dot: 'bg-slate-500',
    label: 'Stopped',
  },
};

export default function StatusBadge({ status = 'idle' }) {
  const config = statusConfig[status] || statusConfig.idle;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${config.bg}`}>
      <div className={`w-2 h-2 rounded-full ${config.dot} animate-pulse`} />
      <span className={`text-sm font-medium ${config.text}`}>
        {config.label}
      </span>
    </div>
  );
}
