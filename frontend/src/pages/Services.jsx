import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HiArrowPath,
  HiArrowTopRightOnSquare,
  HiPlus,
  HiTrash,
  HiOutlineRocketLaunch,
} from 'react-icons/hi2';
import StatusBadge from '../components/StatusBadge';
import { serviceAPI } from '../utils/api.js';

export default function Services() {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
      setActionLoading((prev) => ({ ...prev, [serviceId]: 'redeploy' }));
      const response = await serviceAPI.redeploy(serviceId);
      setError('');
      const deploymentId = response.data?.deployment?._id;
      if (deploymentId) {
        navigate(`/deployments/${deploymentId}/logs`);
        return;
      }
      await fetchServices();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to redeploy service');
    } finally {
      setActionLoading((prev) => ({ ...prev, [serviceId]: null }));
    }
  };

  const handleDeleteService = async (serviceId) => {
    if (!window.confirm('Are you sure you want to delete this service?')) return;

    try {
      setActionLoading((prev) => ({ ...prev, [serviceId]: 'delete' }));
      await serviceAPI.delete(serviceId);
      setServices((current) => current.filter((service) => service._id !== serviceId));
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete service');
    } finally {
      setActionLoading((prev) => ({ ...prev, [serviceId]: null }));
    }
  };

  const handleDeleteEnv = async (serviceId, key) => {
    if (!window.confirm(`Delete environment variable "${key}"?`)) return;

    try {
      await serviceAPI.deleteEnv(serviceId, key);
      setError('');
      await fetchServices();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete environment variable');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="page-kicker">Services</p>
          <h1 className="page-title">Every deployed workload in one place.</h1>
          <p className="page-copy">Inspect status, branch, project ownership, ports, env vars, and launch redeploys.</p>
        </div>
        <button onClick={() => navigate('/deploy')} className="btn-primary">
          <HiPlus className="h-5 w-5" />
          New Service
        </button>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-lg bg-white/70" />
          ))}
        </div>
      ) : services.length === 0 ? (
        <div className="surface p-12 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-teal-100 text-teal-800">
            <HiOutlineRocketLaunch className="h-8 w-8" />
          </span>
          <h2 className="mt-5 text-2xl font-black text-neutral-950">No services deployed yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-600">
            Deploy your first GitHub repository and the service will appear here with logs, commands, and runtime details.
          </p>
          <button onClick={() => navigate('/deploy')} className="btn-primary mt-6">
            <HiPlus className="h-5 w-5" />
            Deploy Your First Service
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {services.map((service) => (
            <article
              key={service._id}
              onClick={() => navigate(`/services/${service._id}`)}
              className="surface group flex min-h-[17rem] cursor-pointer flex-col p-6 transition hover:-translate-y-1 hover:border-teal-300"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="truncate text-xl font-black text-neutral-950">{service.name}</h3>
                  <p className="mt-1 truncate text-xs font-bold uppercase tracking-[0.16em] text-stone-500">
                    {service.gitBranch || 'main'} branch
                  </p>
                </div>
                <StatusBadge status={service.status || 'pending'} />
              </div>

              {service.project?.name && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/projects?expand=${service.project._id}`);
                  }}
                  className="mt-4 w-fit rounded-full bg-teal-50 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-teal-800"
                >
                  {service.project.name}
                </button>
              )}

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="surface-muted p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">Port</p>
                  <p className="mt-2 font-mono text-sm font-black text-neutral-950">{service.port || 'pending'}</p>
                </div>
                <div className="surface-muted p-3">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">Type</p>
                  <p className="mt-2 text-sm font-black capitalize text-neutral-950">{service.deploymentType || 'server'}</p>
                </div>
              </div>

              {service.publicUrl && (
                <a
                  href={service.publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-teal-700 hover:text-teal-900"
                >
                  Visit service
                  <HiArrowTopRightOnSquare className="h-4 w-4" />
                </a>
              )}

              {service.environmentVariables && service.environmentVariables.length > 0 && (
                <div className="mt-4 rounded-lg border border-black/10 bg-neutral-950 p-3 text-white">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-200">
                    {service.environmentVariables.length} env variable(s)
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {service.environmentVariables.slice(0, 4).map((env, idx) => (
                      <button
                        key={`${env.key}-${idx}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteEnv(service._id, env.key);
                        }}
                        className="rounded-full bg-white/10 px-2 py-1 text-xs font-semibold text-stone-200 hover:bg-rose-500/20 hover:text-rose-100"
                        title="Click to delete"
                      >
                        {env.key}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-auto flex gap-2 pt-5" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => handleRedeploy(service._id)}
                  disabled={actionLoading[service._id] === 'redeploy'}
                  className="btn-secondary flex-1 px-3"
                >
                  <HiArrowPath className="h-4 w-4" />
                  {actionLoading[service._id] === 'redeploy' ? 'Redeploying...' : 'Redeploy'}
                </button>
                <button
                  onClick={() => handleDeleteService(service._id)}
                  disabled={actionLoading[service._id] === 'delete'}
                  className="btn-danger px-3"
                  title="Delete service"
                >
                  <HiTrash className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
