import React, { useEffect, useState } from 'react';
import { HiOutlineExclamationCircle } from 'react-icons/hi2';
import { userAPI } from '../utils/api.js';

export default function Settings() {
  const [user, setUser] = useState({
    id: '',
    fullName: '',
    email: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const getUserData = async () => {
    try {
      const response = await userAPI.getCurrent();
      console.log('User data:', response.data);
      setUser(response.data);
      setError('');
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || 'Failed to fetch user data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getUserData();
  }, []);

  if (loading) {
    return (
      <div className="max-w-2xl space-y-8">
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 mt-2">Loading user info...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 mt-2">Manage your account preferences</p>
      </div>

      {error && (
        <div className="p-4 text-red-100 bg-red-700 rounded-lg">{error}</div>
      )}

      <form className="bg-slate-800 border border-slate-700 rounded-lg p-8 space-y-6">
        {/* Account Section */}
        <div className="space-y-4 pb-6 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Account</h2>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Full Name</label>
            <input
              type="text"
              name="fullName"
              disabled
              value={user.fullName}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Email</label>
            <input
              type="email"
              name="email"
              disabled
              value={user.email}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
            />
          </div>
        </div>

        {/* Danger Zone */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-red-400 flex items-center gap-2">
            <HiOutlineExclamationCircle className="w-5 h-5" />
            Danger Zone
          </h2>

          <button
            type="button"
            className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Delete Account
          </button>
        </div>
      </form>
    </div>
  );
}
