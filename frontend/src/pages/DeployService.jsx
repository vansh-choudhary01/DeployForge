import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { HiArrowLeft, HiPlus, HiOutlineTrash } from 'react-icons/hi2';
import api from '../utils/api';

export default function DeployService() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [envVars, setEnvVars] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    repo: '',
    owner: '',
    branch: 'main',
    buildCommand: 'npm run build',
    startCommand: 'npm start',
    private: false,
  });

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleAddEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }]);
  };

  const handleRemoveEnvVar = (index) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  const handleEnvVarChange = (index, field, value) => {
    const newEnvVars = [...envVars];
    newEnvVars[index][field] = value;
    setEnvVars(newEnvVars);
  };

  const handleDeploy = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const deployPayload = {
        ...formData,
        environmentVariables: envVars.reduce((acc, { key, value }) => {
          if (key) acc[key] = value;
          return acc;
        }, {}),
      };

      const response = await api.post('/services/deploy', deployPayload);
      navigate(`/services/${response.data.data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to deploy service');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-8">
      {/* Header */}
      <button
        onClick={() => navigate('/services')}
        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
      >
        <HiArrowLeft className="w-5 h-5" />
        Back to Services
      </button>

      {/* Form */}
      <form onSubmit={handleDeploy} className="bg-slate-800 border border-slate-700 rounded-lg p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Deploy New Service</h1>
          <p className="text-slate-400 mt-2">Configure and deploy a new service from your repository</p>
        </div>

        {error && (
          <div className="bg-red-900 border border-red-700 rounded-lg p-4 text-red-200">
            {error}
          </div>
        )}

        {/* Basic Info */}
        <div className="space-y-4 pt-6 border-t border-slate-700">
          <h2 className="text-lg font-semibold text-white">Service Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Service Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                placeholder="my-app"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Owner *
              </label>
              <input
                type="text"
                name="owner"
                value={formData.owner}
                onChange={handleInputChange}
                required
                placeholder="github-username"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Repository *
              </label>
              <input
                type="text"
                name="repo"
                value={formData.repo}
                onChange={handleInputChange}
                required
                placeholder="my-repository"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Branch
              </label>
              <input
                type="text"
                name="branch"
                value={formData.branch}
                onChange={handleInputChange}
                placeholder="main"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="private"
              checked={formData.private}
              onChange={handleInputChange}
              className="w-4 h-4 bg-slate-700 border border-slate-600 rounded"
            />
            <span className="text-white">Private Repository</span>
          </label>
        </div>

        {/* Build Config */}
        <div className="space-y-4 pt-6 border-t border-slate-700">
          <h2 className="text-lg font-semibold text-white">Build Configuration</h2>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Build Command
            </label>
            <input
              type="text"
              name="buildCommand"
              value={formData.buildCommand}
              onChange={handleInputChange}
              placeholder="npm run build"
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Start Command
            </label>
            <input
              type="text"
              name="startCommand"
              value={formData.startCommand}
              onChange={handleInputChange}
              placeholder="npm start"
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-sm"
            />
          </div>
        </div>

        {/* Environment Variables */}
        <div className="space-y-4 pt-6 border-t border-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Environment Variables</h2>
            <button
              type="button"
              onClick={handleAddEnvVar}
              className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm"
            >
              <HiPlus className="w-4 h-4" />
              Add Variable
            </button>
          </div>

          <div className="space-y-3">
            {envVars.map((envVar, index) => (
              <div key={index} className="flex gap-3">
                <input
                  type="text"
                  placeholder="KEY"
                  value={envVar.key}
                  onChange={(e) => handleEnvVarChange(index, 'key', e.target.value)}
                  className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-sm"
                />
                <input
                  type="text"
                  placeholder="value"
                  value={envVar.value}
                  onChange={(e) => handleEnvVarChange(index, 'value', e.target.value)}
                  className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveEnvVar(index)}
                  className="p-2 hover:bg-slate-700 rounded transition-colors text-red-400"
                >
                  <HiOutlineTrash className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4 pt-6 border-t border-slate-700">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-medium py-3 rounded-lg transition-colors"
          >
            {loading ? 'Deploying...' : 'Deploy Service'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/services')}
            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
