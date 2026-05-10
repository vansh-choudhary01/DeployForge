import React, { useEffect, useState } from 'react';
import { HiOutlineExclamationCircle, HiOutlineUserCircle } from 'react-icons/hi2';
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
      <div className="max-w-3xl space-y-6">
        <div>
          <p className="page-kicker">Settings</p>
          <h1 className="page-title">Loading account...</h1>
        </div>
        <div className="h-72 animate-pulse rounded-lg bg-white/70" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <p className="page-kicker">Settings</p>
        <h1 className="page-title">Account preferences.</h1>
        <p className="page-copy">View the account profile currently connected to this deployment workspace.</p>
      </div>

      {error && <div className="alert-error">{error}</div>}

      <section className="surface overflow-hidden">
        <div className="bg-neutral-950 p-7 text-white">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-lg bg-teal-300 text-neutral-950">
              <HiOutlineUserCircle className="h-8 w-8" />
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-teal-200">Profile</p>
              <h2 className="mt-1 text-2xl font-black">{user.fullName || 'Deploy user'}</h2>
            </div>
          </div>
        </div>

        <form className="p-7">
          <div className="space-y-5 border-b border-stone-200 pb-7">
            <div>
              <label className="field-label">Full Name</label>
              <input type="text" name="fullName" disabled value={user.fullName || ''} className="field-input" />
            </div>

            <div>
              <label className="field-label">Email</label>
              <input type="email" name="email" disabled value={user.email || ''} className="field-input" />
            </div>
          </div>

          <div className="mt-7 rounded-lg border border-rose-200 bg-rose-50 p-5">
            <h2 className="flex items-center gap-2 text-lg font-black text-rose-700">
              <HiOutlineExclamationCircle className="h-5 w-5" />
              Danger Zone
            </h2>
            <p className="mt-2 text-sm leading-6 text-rose-700/80">
              Account deletion is presented here for the future account lifecycle flow.
            </p>
            <button type="button" className="btn-danger mt-4 w-full">
              Delete Account
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
