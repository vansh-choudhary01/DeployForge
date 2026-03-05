import React, { useState } from 'react';
import { HiOutlineExclamationCircle } from 'react-icons/hi2';

export default function Settings() {
  const [formData, setFormData] = useState({
    email: 'user@example.com',
    gitHubUsername: '',
    notifications: true,
  });

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSave = (e) => {
    e.preventDefault();
    // TODO: Save settings to API
    alert('Settings saved!');
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 mt-2">Manage your account preferences</p>
      </div>

      <form onSubmit={handleSave} className="bg-slate-800 border border-slate-700 rounded-lg p-8 space-y-6">
        {/* Account Section */}
        <div className="space-y-4 pb-6 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Account</h2>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">GitHub Username</label>
            <input
              type="text"
              name="gitHubUsername"
              value={formData.gitHubUsername}
              onChange={handleChange}
              placeholder="@username"
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500"
            />
          </div>
        </div>

        {/* Notifications Section */}
        <div className="space-y-4 pb-6 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">Notifications</h2>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              name="notifications"
              checked={formData.notifications}
              onChange={handleChange}
              className="w-4 h-4 bg-slate-700 border border-slate-600 rounded"
            />
            <span className="text-white">Email notifications for deployments</span>
          </label>
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

        {/* Save Button */}
        <div className="flex gap-4 pt-6 border-t border-slate-700">
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
}
