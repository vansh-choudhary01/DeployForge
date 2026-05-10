import React from 'react';
import { HiOutlineArrowRight } from 'react-icons/hi2';

export default function RepoList({ repos, onSelectRepo, loading = false }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-white/70" />
        ))}
      </div>
    );
  }

  if (!repos || repos.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm font-semibold text-stone-500">No repositories found</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {repos.map((repo) => (
        <div
          key={repo.id}
          className="group flex cursor-pointer items-center justify-between rounded-lg border border-black/10 bg-white p-4 transition hover:-translate-y-0.5 hover:border-teal-300 hover:bg-teal-50"
          onClick={() => onSelectRepo(repo)}
        >
          <div className="flex-1">
            <h4 className="font-black text-neutral-950">{repo.name}</h4>
            <p className="mt-1 text-sm text-stone-500">{repo.description || 'No description'}</p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelectRepo(repo);
            }}
            className="rounded-lg p-2 opacity-0 transition group-hover:bg-white group-hover:opacity-100"
          >
            <HiOutlineArrowRight className="h-5 w-5 text-teal-700" />
          </button>
        </div>
      ))}
    </div>
  );
}
