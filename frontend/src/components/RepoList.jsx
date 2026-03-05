import React from 'react';
import { HiLockClosed, HiOutlineArrowRight } from 'react-icons/hi2';

export default function RepoList({ repos, onSelectRepo, loading = false }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 bg-slate-700 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!repos || repos.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400">No repositories found</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {repos.map((repo) => (
        <div
          key={repo.id}
          className="flex items-center justify-between p-4 bg-slate-800 border border-slate-700 rounded-lg hover:border-slate-600 transition-colors group cursor-pointer"
          onClick={() => onSelectRepo(repo)}
        >
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-white font-medium">{repo.name}</h4>
              {repo.private && (
                <HiLockClosed className="w-4 h-4 text-slate-400" />
              )}
            </div>
            <p className="text-sm text-slate-400 mt-1">{repo.description || 'No description'}</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelectRepo(repo);
            }}
            className="p-2 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <HiOutlineArrowRight className="w-5 h-5 text-blue-400" />
          </button>
        </div>
      ))}
    </div>
  );
}
