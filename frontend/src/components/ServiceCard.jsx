import React from 'react';
import { Link } from 'react-router-dom';
import { HiArrowTopRightOnSquare, HiEllipsisVertical } from 'react-icons/hi2';
import StatusBadge from './StatusBadge';

export default function ServiceCard({ service }) {
  return (
    <Link
      to={`/services/${service._id}`}
      className="block bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition-colors"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white">{service.name}</h3>
          <p className="text-sm text-slate-400 mt-1">{service.repo}</p>
        </div>
        <button className="p-2 hover:bg-slate-700 rounded transition-colors">
          <HiEllipsisVertical className="w-5 h-5 text-slate-400" />
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">Status</span>
          <StatusBadge status={service.status || 'idle'} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-400">Branch</span>
          <span className="text-sm text-white font-mono">{service.branch || 'main'}</span>
        </div>

        {service.url && (
          <div className="flex items-center justify-between pt-3 border-t border-slate-700">
            <span className="text-sm text-slate-400">URL</span>
            <a
              href={service.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 text-sm"
              onClick={(e) => e.stopPropagation()}
            >
              Visit
              <HiArrowTopRightOnSquare className="w-4 h-4" />
            </a>
          </div>
        )}
      </div>
    </Link>
  );
}
