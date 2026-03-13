import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiPlus, HiArrowPath, HiTrash } from 'react-icons/hi2';
import StatusBadge from '../components/StatusBadge';
import { serviceAPI } from '../utils/api.js';

export default function Services() {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedService, setSelectedService] = useState(null);
  const [showEnvForm, setShowEnvForm] = useState(false);
  const [envData, setEnvData] = useState({ key: '', value: '' });
  const [actionLoading, setActionLoading] = useState({});

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const response = await serviceAPI.getAll();
      setServices(response.data.services || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch services');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeploy = async (serviceId) => {
    try {
      setActionLoading({ ...actionLoading, [serviceId]: 'redeploy' });
      await serviceAPI.redeploy(serviceId);
      setError('');
      // Refresh service if implemented
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to redeploy service');
    } finally {
      setActionLoading({ ...actionLoading, [serviceId]: null });
    }
  };

  const handleDeleteService = async (serviceId) => {
    if (!window.confirm('Are you sure you want to delete this service?')) return;

    try {
      setActionLoading({ ...actionLoading, [serviceId]: 'delete' });
      await serviceAPI.delete(serviceId);
      setServices(services.filter(s => s._id !== serviceId));
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete service');
    } finally {
      setActionLoading({ ...actionLoading, [serviceId]: null });
    }
  };

  const handleAddEnv = async (serviceId) => {
    if (!envData.key.trim() || !envData.value.trim()) {
      setError('Key and value are required');
      return;
    }

    try {
      await serviceAPI.setEnv(serviceId, { key: envData.key, value: envData.value });
      setEnvData({ key: '', value: '' });
      setShowEnvForm(false);
      setError('');
      // Refresh service if implemented
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to set environment variable');
    }
  };

  const handleDeleteEnv = async (serviceId, key) => {
    if (!window.confirm(`Delete environment variable "${key}"?`)) return;

    try {
      await serviceAPI.deleteEnv(serviceId, key);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete environment variable');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Services</h1>
          <p className="text-slate-400 mt-2">Manage all your deployed services</p>
        </div>
        <button
          onClick={() => navigate('/deploy')}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg transition-colors"
        >
          <HiPlus className="w-5 h-5" />
          New Service
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900 border border-red-700 rounded-lg p-4 text-red-200">
          {error}
        </div>
      )}

      {/* Services Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-64 bg-slate-700 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : services.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center">
          <p className="text-slate-400 mb-4">No services deployed yet</p>
          <button
            onClick={() => navigate('/deploy')}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-lg transition-colors"
          >
            <HiPlus className="w-5 h-5" />
            Deploy Your First Service
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service) => (
            <div
              key={service._id}
              onClick={() => navigate(`/services/${service._id}`)}
              className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition cursor-pointer"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">{service.name}</h3>
                  <p className="text-sm text-slate-400 mt-1">{service.gitBranch}</p>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Status</span>
                  <StatusBadge status={service.status || 'pending'} />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-400">Port</span>
                  <span className="text-sm text-white font-mono">{service.port}</span>
                </div>
              </div>

              {/* Environment Variables */}
              {service.environmentVariables && service.environmentVariables.length > 0 && (
                <div className="mb-4 p-3 bg-slate-700 rounded border border-slate-600">
                  <p className="text-xs text-slate-300 font-medium mb-2">Env Variables</p>
                  {service.environmentVariables.map((env, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span>{env.key}</span>
                      <button
                        onClick={() => handleDeleteEnv(service._id, env.key)}
                        className="text-red-400 hover:text-red-300 transition"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => handleRedeploy(service._id)}
                  disabled={actionLoading[service._id] === 'redeploy'}
                  className="flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:bg-slate-600 text-white text-sm font-medium py-2 px-3 rounded flex items-center justify-center gap-2 transition"
                >
                  <HiArrowPath className="w-4 h-4" />
                  {actionLoading[service._id] === 'redeploy' ? 'Redeploying...' : 'Redeploy'}
                </button>
                <button
                  onClick={() => handleDeleteService(service._id)}
                  disabled={actionLoading[service._id] === 'delete'}
                  className="flex-1 bg-red-900 hover:bg-red-800 disabled:bg-slate-600 text-red-200 text-sm font-medium py-2 px-3 rounded flex items-center justify-center gap-2 transition"
                >
                  <HiTrash className="w-4 h-4" />
                  {actionLoading[service._id] === 'delete' ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
