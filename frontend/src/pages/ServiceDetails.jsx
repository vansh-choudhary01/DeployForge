import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { HiArrowLeft, HiOutlineTrash, HiArrowPathRoundedSquare } from 'react-icons/hi2';
import StatusBadge from '../components/StatusBadge';
import api, { serviceAPI } from '../utils/api';

export default function ServiceDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState(null);
  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [redeploying, setRedeploying] = useState(false);
  const [envKey, setEnvKey] = useState('');
  const [envValue, setEnvValue] = useState('');
  const [envStatus, setEnvStatus] = useState('');

  useEffect(() => {
    fetchService();
  }, [id]);

  const fetchService = async () => {
    try {
      const response = await api.get(`/services/${id}`);
      setService(response.data.service);
      setDeployments(response.data.deployments || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch service');
    } finally {
      setLoading(false);
    }
  };

  const handleRedeploy = async () => {
    if (!window.confirm('Are you sure you want to redeploy this service?')) return;

    setRedeploying(true);
    try {
      await api.post(`/services/${id}/redeploy`);
      setError('');
      // Refresh service and deployments
      await fetchService();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to redeploy service');
    } finally {
      setRedeploying(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this service? This action cannot be undone.')) return;

    try {
      await api.delete(`/services/${id}`);
      navigate('/services');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete service');
    }
  };

  const handleAddOrUpdateEnv = async (e) => {
    e.preventDefault();
    if (!envKey.trim() || !envValue.trim()) {
      setEnvStatus('Key and value are required');
      return;
    }

    try {
      await serviceAPI.setEnv(id, { key: envKey.trim(), value: envValue.trim() });
      setEnvStatus(`Saved ${envKey.trim()}`);
      setEnvKey('');
      setEnvValue('');
      await fetchService();
    } catch (err) {
      setEnvStatus(err.response?.data?.message || 'Failed to save env');
    }
  };

  const handleDeleteEnv = async (key) => {
    if (!window.confirm(`Delete environment variable ${key}?`)) return;
    try {
      await serviceAPI.deleteEnv(id, key);
      setEnvStatus(`Deleted ${key}`);
      await fetchService();
    } catch (err) {
      setEnvStatus(err.response?.data?.message || 'Failed to delete env');
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-8">
        <div className="h-12 bg-slate-700 rounded-lg w-48" />
        <div className="h-80 bg-slate-700 rounded-lg" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-400 mb-4">Service not found</p>
        <button
          onClick={() => navigate('/services')}
          className="text-blue-400 hover:text-blue-300"
        >
          Back to Services
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <button
        onClick={() => navigate('/services')}
        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
      >
        <HiArrowLeft className="w-5 h-5" />
        Back to Services
      </button>

      {/* Service Info */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">{service.name}</h1>
            <p className="text-slate-400 mt-2">{service.gitRepositoryUrl}</p>
            {service.project?.name && (
              <button
                onClick={() => navigate('/projects')}
                className="mt-2 text-blue-400 hover:text-blue-300 text-sm"
              >
                Project: {service.project.name} (ID: {service.project.projectId})
              </button>
            )}
          </div>
          <StatusBadge status={service.status || 'idle'} />
        </div>

        {error && (
          <div className="bg-red-900 border border-red-700 rounded-lg p-4 mb-6 text-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-sm text-slate-400 mb-1">Branch</p>
            <p className="text-white font-mono">{service.gitBranch || 'main'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400 mb-1">Build Command</p>
            <p className="text-white font-mono text-sm">{service.buildCommand || 'npm run build'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400 mb-1">Start Command</p>
            <p className="text-white font-mono text-sm">{service.startCommand || 'npm start'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400 mb-1">Root Directory</p>
            <p className="text-white font-mono text-sm">{service.rootDirectory || '/'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400 mb-1">Healthcheck Path</p>
            <p className="text-white font-mono text-sm">{service.healthCheckPath || '/'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400 mb-1">Port</p>
            <p className="text-white font-mono text-sm">{service.port ?? 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400 mb-1">Region</p>
            <p className="text-white font-mono text-sm">{service.region || 'us-east-1'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400 mb-1">Instance</p>
            <p className="text-white font-mono text-sm">{service.instanceType?.type || 'free'} - {service.instanceType?.cpus || 0.1} CPUs / {service.instanceType?.memory || 512}{service.instanceType?.memoryType || 'MB'}</p>
          </div>
          {service.publicUrl && (
            <div>
              <p className="text-sm text-slate-400 mb-1">Public URL</p>
              <a
                href={service.publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 break-all"
              >
                {service.publicUrl}
              </a>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-4 pt-6 border-t border-slate-700">
          <button
            onClick={handleRedeploy}
            disabled={redeploying}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-medium px-6 py-2 rounded-lg transition-colors"
          >
            <HiArrowPathRoundedSquare className="w-5 h-5" />
            {redeploying ? 'Redeploying...' : 'Redeploy'}
          </button>
          <button
            onClick={() => deployments.length > 0 && navigate(`/deployments/${deployments[0]._id}/logs`)}
            disabled={deployments.length === 0}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-600 text-white rounded-lg transition-colors"
          >
            View Logs
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 ml-auto px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            <HiOutlineTrash className="w-5 h-5" />
            Delete
          </button>
        </div>
      </div>

      {/* Environment Variables */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-8">
        <h2 className="text-xl font-semibold text-white mb-6">Environment Variables</h2>

        <form onSubmit={handleAddOrUpdateEnv} className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <input
            type="text"
            placeholder="Key"
            value={envKey}
            onChange={(e) => setEnvKey(e.target.value)}
            className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none"
          />
          <input
            type="text"
            placeholder="Value"
            value={envValue}
            onChange={(e) => setEnvValue(e.target.value)}
            className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold"
          >
            Add / Update
          </button>
        </form>

        {envStatus && (
          <p className="text-sm text-slate-300 mb-4">{envStatus}</p>
        )}

        {service.environmentVariables && service.environmentVariables.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {service.environmentVariables.map((env, idx) => (
              <div key={idx} className="bg-slate-900 border border-slate-700 rounded-lg p-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-400">{env.key}</p>
                  <p className="text-white text-sm font-mono break-all">{env.value}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEnvKey(env.key);
                      setEnvValue(env.value);
                    }}
                    className="text-xs bg-yellow-600 text-white px-2 py-1 rounded hover:bg-yellow-500"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteEnv(env.key)}
                    className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-500"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-400">No environment variables yet. Add one above.</p>
        )}
      </div>

      {/* Deployment History */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-8">
        <h2 className="text-xl font-semibold text-white mb-6">Deployment History</h2>
        {deployments.length === 0 ? (
          <p className="text-slate-400">No deployments yet</p>
        ) : (
          <div className="space-y-4">
            {deployments.slice(0, 10).map((deployment) => (
              <div
                key={deployment._id}
                className="flex items-center justify-between p-4 bg-slate-700 rounded-lg cursor-pointer hover:bg-slate-600 transition-colors"
                onClick={() =>
                  navigate(`/deployments/${deployment._id}/logs`)
                }
              >
                <div>
                  <p className="text-white font-medium">
                    {new Date(deployment.createdAt).toLocaleDateString()} {new Date(deployment.createdAt).toLocaleTimeString()}
                  </p>
                  <p className="text-sm text-slate-400">Commit: {deployment.commitHash?.substring(0, 7)}</p>
                </div>
                <StatusBadge status={deployment.status || 'idle'} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
