import React, { useContext } from 'react';
import {
  HiArrowRightOnRectangle,
  HiBell,
  HiOutlineCodeBracket,
  HiOutlineRocketLaunch,
  HiOutlineSquares2X2,
} from 'react-icons/hi2';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useContext(AuthContext);

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: HiOutlineSquares2X2 },
    { path: '/projects', label: 'Projects', icon: HiOutlineCodeBracket },
    { path: '/services', label: 'Services', icon: HiOutlineRocketLaunch },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const initials = user?.fullName
    ? user.fullName
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'D';

  return (
    <header className="fixed left-0 right-0 top-0 z-20 border-b border-black/10 bg-[#f8f7f2]/[0.86] px-4 py-3 backdrop-blur-xl lg:left-72 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-700">Deployment console</p>
          <p className="truncate text-sm font-semibold text-stone-600">
            {location.pathname === '/dashboard'
              ? 'Overview'
              : location.pathname.split('/').filter(Boolean).join(' / ') || 'Workspace'}
          </p>
        </div>

        <nav className="hidden items-center gap-1 rounded-lg border border-black/10 bg-white/80 p-1 shadow-sm md:flex lg:hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                title={item.label}
                className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
                  active ? 'bg-neutral-950 text-white' : 'text-stone-600 hover:bg-stone-100 hover:text-neutral-950'
                }`}
              >
                <Icon className="h-5 w-5" />
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <Link to="/deploy" className="btn-primary hidden sm:inline-flex">
            <HiOutlineRocketLaunch className="h-5 w-5" />
            New service
          </Link>

          <button title="Notifications" className="relative grid h-10 w-10 place-items-center rounded-lg border border-black/10 bg-white text-stone-700 shadow-sm transition hover:border-teal-300 hover:text-neutral-950">
            <HiBell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" />
          </button>

          <div className="hidden items-center gap-3 rounded-lg border border-black/10 bg-white px-3 py-2 shadow-sm sm:flex">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-neutral-950 text-xs font-black text-white">
              {initials}
            </div>
            <div className="max-w-32">
              <p className="truncate text-sm font-bold text-neutral-950">{user?.fullName || 'Deploy user'}</p>
              <p className="truncate text-xs text-stone-500">{user?.email || 'Signed in'}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="grid h-10 w-10 place-items-center rounded-lg border border-black/10 bg-white text-stone-700 shadow-sm transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
            title="Logout"
          >
            <HiArrowRightOnRectangle className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
