import React, { useState } from 'react';
import { HiBell, HiOutlineMoon, HiOutlineSun, HiArrowRightOnRectangle } from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';

export default function Navbar() {
  const [isDark, setIsDark] = useState(true);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    navigate('/login');
  };

  return (
    <header className="fixed top-0 left-64 right-0 h-16 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-8">
      <div className="flex-1" />

      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button className="relative p-2 text-slate-400 hover:text-white transition-colors">
          <HiBell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={() => setIsDark(!isDark)}
          className="p-2 text-slate-400 hover:text-white transition-colors"
        >
          {isDark ? (
            <HiOutlineSun className="w-5 h-5" />
          ) : (
            <HiOutlineMoon className="w-5 h-5" />
          )}
        </button>

        {/* User Avatar */}
        <div className="flex items-center gap-3 pl-4 border-l border-slate-700">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600" />
          <button
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-white transition-colors"
            title="Logout"
          >
            <HiArrowRightOnRectangle className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
