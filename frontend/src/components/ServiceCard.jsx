import React from 'react';
import { Link } from 'react-router-dom';
import { HiArrowTopRightOnSquare, HiEllipsisVertical } from 'react-icons/hi2';
import StatusBadge from './StatusBadge';

export default function ServiceCard({ service }) {
  return (
    <Link
      to={`/services/${service._id}`}
      className="surface block p-6 transition hover:-translate-y-1 hover:border-teal-300"
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-black text-neutral-950">{service.name}</h3>
          <p className="mt-1 text-sm text-stone-500">{service.repo}</p>
        </div>
        <button className="rounded-lg p-2 text-stone-500 transition hover:bg-stone-100 hover:text-neutral-950">
          <HiEllipsisVertical className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-stone-500">Status</span>
          <StatusBadge status={service.status || 'idle'} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-stone-500">Branch</span>
          <span className="font-mono text-sm font-bold text-neutral-950">{service.branch || 'main'}</span>
        </div>

        {service.url && (
          <div className="flex items-center justify-between border-t border-stone-200 pt-3">
            <span className="text-sm font-semibold text-stone-500">URL</span>
            <a
              href={service.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-bold text-teal-700 hover:text-teal-900"
              onClick={(e) => e.stopPropagation()}
            >
              Visit
              <HiArrowTopRightOnSquare className="h-4 w-4" />
            </a>
          </div>
        )}
      </div>
    </Link>
  );
}
