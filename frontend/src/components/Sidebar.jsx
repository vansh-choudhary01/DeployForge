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
    { path: '/settings', label: 'Settings', icon: HiOutlineCog },
  ];

  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <aside className="fixed left-0 top-0 w-64 h-screen bg-slate-900 border-r border-slate-700 overflow-y-auto">
      {/* Logo */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <HiOutlineSparkles className="w-6 h-6 text-blue-500" />
          <h1 className="text-xl font-bold text-white">Deploy</h1>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
