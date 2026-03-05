import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { HiArrowLeft, HiOutlineTrash, HiArrowPathRoundedSquare } from 'react-icons/hi2';
import StatusBadge from '../components/StatusBadge';
import api from '../utils/api';

export default function ServiceDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [service, setService] = useState(null);
  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [redeploying, setRedeploying] = useState(false);

  useEffect(() => {
    fetchService();
    fetchDeployments();
  }, [id]);

  const fetchService = async () => {
    try {
      const response = await api.get(`/services/${id}`);
      setService(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch service');
    } finally {
      setLoading(false);
    }
  };

  const fetchDeployments = async () => {
    try {
      const response = await api.get(`/deployments/${id}`);
      setDeployments(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch deployments:', err);
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
      await fetchDeployments();
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
            <p className="text-slate-400 mt-2">{service.repo}</p>
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
            <p className="text-white font-mono">{service.branch || 'main'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400 mb-1">Build Command</p>
            <p className="text-white font-mono text-sm">{service.buildCommand || 'npm run build'}</p>
          </div>
          <div>
            <p className="text-sm text-slate-400 mb-1">Start Command</p>
            <p className="text-white font-mono text-sm">{service.startCommand || 'npm start'}</p>
          </div>
          {service.url && (
            <div>
              <p className="text-sm text-slate-400 mb-1">URL</p>
              <a
                href={service.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 break-all"
              >
                {service.url}
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
            onClick={() => navigate(`/deployments/${service.lastDeploymentId}/logs`)}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
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
