import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  HiOutlineSquares2X2,
  HiOutlineCog,
  HiOutlineCodeBracket,
  HiOutlineRocketLaunch,
  HiOutlineSparkles,
} from 'react-icons/hi2';

export default function Sidebar() {
  const location = useLocation();

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: HiOutlineSquares2X2 },
    { path: '/projects', label: 'Projects', icon: HiOutlineCodeBracket },
    { path: '/services', label: 'Services', icon: HiOutlineRocketLaunch },
    { path: '/deploy', label: 'Deploy', icon: HiOutlineSparkles },
    { path: '/settings', label: 'Settings', icon: HiOutlineCog },
  ];

  const isActive = (path) => {
    if (path === '/services') return location.pathname.startsWith('/services');
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <aside className="fixed left-0 top-0 z-30 hidden h-screen w-72 overflow-y-auto border-r border-white/10 bg-neutral-950 px-4 py-5 text-white shadow-2xl lg:block">
      <Link to="/" className="flex items-center gap-3 rounded-lg px-2 pb-5">
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-teal-300 text-neutral-950">
          <img src="/logo.svg" alt="Deploy Control Room" className="h-7 w-7" />
        </span>
        <span>
          <span className="block text-xl font-black tracking-tight">Deploy</span>
          <span className="block text-xs uppercase tracking-[0.24em] text-stone-400">Cloud desk</span>
        </span>
      </Link>

      <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.04] p-4">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-200">Workspace</p>
        <p className="mt-2 text-sm leading-5 text-stone-300">
          Deploy GitHub repos, group services by project, and watch releases move through the pipeline.
        </p>
      </div>

      <nav className="mt-5 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-bold transition ${
                active
                  ? 'bg-teal-300 text-neutral-950 shadow-lg shadow-teal-950/20'
                  : 'text-stone-300 hover:bg-white/[0.07] hover:text-white'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="absolute bottom-5 left-4 right-4 rounded-lg border border-white/10 bg-white/[0.04] p-4">
        <div className="flex items-center gap-3">
          <img src="/logo.svg" alt="Deploy Control Room" className="h-10 w-10 rounded-lg" />
          <div>
            <p className="text-sm font-bold text-white">Deploy stack</p>
            <p className="text-xs text-stone-400">Server and static hosting</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
