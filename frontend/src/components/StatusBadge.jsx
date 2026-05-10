import React from 'react';

const statusConfig = {
  running: {
    bg: 'bg-emerald-50 border-emerald-200',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    label: 'Running',
  },
  deploying: {
    bg: 'bg-sky-50 border-sky-200',
    text: 'text-sky-700',
    dot: 'bg-sky-500',
    label: 'Deploying',
  },
  building: {
    bg: 'bg-cyan-50 border-cyan-200',
    text: 'text-cyan-700',
    dot: 'bg-cyan-500',
    label: 'Building',
  },
  pending: {
    bg: 'bg-amber-50 border-amber-200',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    label: 'Pending',
  },
  failed: {
    bg: 'bg-rose-50 border-rose-200',
    text: 'text-rose-700',
    dot: 'bg-rose-500',
    label: 'Failed',
  },
  idle: {
    bg: 'bg-stone-100 border-stone-200',
    text: 'text-stone-600',
    dot: 'bg-stone-400',
    label: 'Idle',
  },
  stopped: {
    bg: 'bg-stone-100 border-stone-200',
    text: 'text-stone-600',
    dot: 'bg-stone-400',
    label: 'Stopped',
  },
  sleeping: {
    bg: 'bg-orange-50 border-orange-200',
    text: 'text-orange-700',
    dot: 'bg-orange-500',
    label: 'Sleeping',
  },
  waking: {
    bg: 'bg-teal-50 border-teal-200',
    text: 'text-teal-700',
    dot: 'bg-teal-500',
    label: 'Waking',
  },
};

export default function StatusBadge({ status = 'idle' }) {
  const config = statusConfig[status] || statusConfig.idle;

  return (
    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${config.bg}`}>
      <div className={`h-2 w-2 rounded-full ${config.dot} animate-pulse`} />
      <span className={`text-xs font-black uppercase tracking-[0.14em] ${config.text}`}>
        {config.label}
      </span>
    </div>
  );
}
