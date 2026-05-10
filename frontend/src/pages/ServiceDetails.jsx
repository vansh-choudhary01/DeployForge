import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  HiArrowLeft,
  HiArrowPathRoundedSquare,
  HiArrowTopRightOnSquare,
  HiCommandLine,
  HiOutlineTrash,
  HiPencilSquare,
} from 'react-icons/hi2';
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
  const [editMode, setEditMode] = useState(false);
  const [branchValue, setBranchValue] = useState('');
  const [buildCommandValue, setBuildCommandValue] = useState('');
  const [startCommandValue, setStartCommandValue] = useState('');
  const [preDeployCommandValue, setPreDeployCommandValue] = useState('');
  const [rootDirectoryValue, setRootDirectoryValue] = useState('');
  const [healthCheckPathValue, setHealthCheckPathValue] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [envKey, setEnvKey] = useState('');
  const [envValue, setEnvValue] = useState('');
  const [envStatus, setEnvStatus] = useState('');
  const [envBulkText, setEnvBulkText] = useState('');
  const [envBulkStatus, setEnvBulkStatus] = useState('');

  useEffect(() => {
    fetchService();
    // Service reloads are keyed by route id; other state updates happen inside fetchService.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchService = async () => {
    try {
      const response = await api.get(`/services/${id}`);
      const returnedService = response.data.service;
      setService(returnedService);
      setDeployments(response.data.deployments || []);

      if (returnedService?.environmentVariables) {
        const lines = returnedService.environmentVariables.map((ev) => `${ev.key}=${ev.value}`);
        setEnvBulkText(lines.join('\n'));
      } else {
        setEnvBulkText('');
      }
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
      const response = await api.post(`/services/${id}/redeploy`);
      setError('');

      const deploymentId = response.data?.deployment?._id;
      if (deploymentId) {
        navigate(`/deployments/${deploymentId}/logs`);
        return;
      }

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

  const handleEdit = () => {
    if (!service) return;
    setBranchValue(service.gitBranch || '');
    setBuildCommandValue(service.buildCommand || '');
    setStartCommandValue(service.startCommand || '');
    setPreDeployCommandValue(service.preDeployCommand || '');
    setRootDirectoryValue(service.rootDirectory || '');
    setHealthCheckPathValue(service.healthCheckPath || '');
    setEditStatus('');
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditStatus('');
  };

  const handleSaveEdit = async () => {
    try {
      const updateData = {
        gitBranch: branchValue,
        buildCommand: buildCommandValue,
        startCommand: startCommandValue,
        preDeployCommand: preDeployCommandValue,
        rootDirectory: rootDirectoryValue,
        healthCheckPath: healthCheckPathValue,
      };

      await serviceAPI.update(id, updateData);
      setEditStatus('Service details updated successfully.');
      setEditMode(false);
      await fetchService();
    } catch (err) {
      setEditStatus(err.response?.data?.message || 'Failed to update service details');
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

  const parseDotEnv = (text) => {
    const entries = {};
    const lines = text.split('\n');

    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('#')) continue;

      const equalsIndex = line.indexOf('=');
      if (equalsIndex < 0) continue;

      const key = line.slice(0, equalsIndex).trim();
      let value = line.slice(equalsIndex + 1).trim();

      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      if (key) {
        entries[key] = value;
      }
    }

    return entries;
  };

  const handleApplyEnvBulk = async () => {
    const parsed = parseDotEnv(envBulkText);
    const newKeys = Object.keys(parsed);
    const existingKeys = service?.environmentVariables?.map((ev) => ev.key) || [];
    const keysToDelete = existingKeys.filter((key) => !newKeys.includes(key));

    if (!newKeys.length && !keysToDelete.length) {
      setEnvBulkStatus('No changes detected');
      return;
    }

    try {
      const setRequests = newKeys.map((key) => serviceAPI.setEnv(id, { key, value: parsed[key] }));
      await Promise.all(setRequests);

      const deleteRequests = keysToDelete.map((key) => serviceAPI.deleteEnv(id, key));
      await Promise.all(deleteRequests);

      const ops = [];
      if (newKeys.length) ops.push(`${newKeys.length} applied`);
      if (keysToDelete.length) ops.push(`${keysToDelete.length} removed`);

      setEnvBulkStatus(`Bulk sync complete: ${ops.join(', ')}`);
      setEnvStatus('');
      setEnvKey('');
      setEnvValue('');
      await fetchService();
    } catch (err) {
      setEnvBulkStatus(err.response?.data?.message || 'Failed to bulk sync env');
    }
  };

  const handleDeleteEnvBulk = async () => {
    const parsed = parseDotEnv(envBulkText);
    const keys = Object.keys(parsed);

    if (!keys.length) {
      setEnvBulkStatus('No valid env vars found in input');
      return;
    }

    try {
      const requests = keys.map((key) => serviceAPI.deleteEnv(id, key));
      await Promise.all(requests);

      setEnvBulkStatus(`Deleted ${keys.length} env vars successfully`);
      setEnvStatus('');
      setEnvKey('');
      setEnvValue('');
      setEnvBulkText('');
      await fetchService();
    } catch (err) {
      setEnvBulkStatus(err.response?.data?.message || 'Failed to delete bulk env');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-48 animate-pulse rounded-lg bg-white/70" />
        <div className="h-80 animate-pulse rounded-lg bg-white/70" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="surface p-12 text-center">
        <p className="text-lg font-black text-neutral-950">Service not found</p>
        <button onClick={() => navigate('/services')} className="btn-primary mt-5">
          Back to Services
        </button>
      </div>
    );
  }

  const detailItems = [
    ['Branch', service.gitBranch || 'main'],
    ['Build Command', service.buildCommand || 'npm run build'],
    ['Start Command', service.startCommand || 'npm start'],
    ['Root Directory', service.rootDirectory || '/'],
    ['Healthcheck Path', service.healthCheckPath || '/'],
    ['Port', service.port ?? 'N/A'],
    ['Region', service.region || 'us-east-1'],
    [
      'Instance',
      `${service.instanceType?.type || 'free'} - ${service.instanceType?.cpus || 0.1} CPUs / ${service.instanceType?.memory || 512}${service.instanceType?.memoryType || 'MB'}`,
    ],
  ];

  return (
    <div className="space-y-8">
      <button onClick={() => navigate('/services')} className="btn-secondary px-3">
        <HiArrowLeft className="h-4 w-4" />
        Back to Services
      </button>

      <section className="surface overflow-hidden">
        <div className="bg-neutral-950 p-7 text-white">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-teal-200">Service details</p>
              <h1 className="mt-3 truncate text-4xl font-black tracking-tight">{service.name}</h1>
              <p className="mt-3 break-all font-mono text-sm text-stone-300">{service.gitRepositoryUrl}</p>
              {service.project?.name && (
                <button
                  onClick={() => navigate(`/projects?expand=${service.project._id}`)}
                  className="mt-4 rounded-full bg-teal-300 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-neutral-950"
                >
                  {service.project.name} | {service.project.projectId}
                </button>
              )}
            </div>
            <StatusBadge status={service.status || 'idle'} />
          </div>
        </div>

        <div className="p-7">
          {error && <div className="alert-error mb-6">{error}</div>}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {detailItems.map(([label, value]) => (
              <div key={label} className="surface-muted p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-stone-500">{label}</p>
                <p className="mt-2 break-all font-mono text-sm font-bold text-neutral-950">{value}</p>
              </div>
            ))}
          </div>

          {service.publicUrl && (
            <a
              href={service.publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-teal-50 px-4 py-3 text-sm font-black text-teal-800 hover:bg-teal-100"
            >
              Open public URL
              <HiArrowTopRightOnSquare className="h-5 w-5" />
            </a>
          )}

          <div className="mt-7 flex flex-col gap-3 border-t border-stone-200 pt-6 sm:flex-row">
            <button onClick={handleRedeploy} disabled={redeploying} className="btn-primary">
              <HiArrowPathRoundedSquare className="h-5 w-5" />
              {redeploying ? 'Redeploying...' : 'Redeploy'}
            </button>
            <button
              onClick={() => deployments.length > 0 && navigate(`/deployments/${deployments[0]._id}/logs`)}
              disabled={deployments.length === 0}
              className="btn-secondary"
            >
              <HiCommandLine className="h-5 w-5" />
              View Logs
            </button>
            <button onClick={handleEdit} className="btn-secondary">
              <HiPencilSquare className="h-5 w-5" />
              Edit
            </button>
            <button onClick={handleDelete} className="btn-danger sm:ml-auto">
              <HiOutlineTrash className="h-5 w-5" />
              Delete
            </button>
          </div>

          {editMode && (
            <div className="mt-6 rounded-lg border border-black/10 bg-stone-50 p-5">
              <h3 className="text-lg font-black text-neutral-950">Edit Service Details</h3>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                {[
                  ['Branch', branchValue, setBranchValue],
                  ['Build Command', buildCommandValue, setBuildCommandValue],
                  ['Start Command', startCommandValue, setStartCommandValue],
                  ['Pre-deploy Command', preDeployCommandValue, setPreDeployCommandValue],
                  ['Root Directory', rootDirectoryValue, setRootDirectoryValue],
                  ['Health Check Path', healthCheckPathValue, setHealthCheckPathValue],
                ].map(([label, value, setter]) => (
                  <div key={label}>
                    <label className="field-label">{label}</label>
                    <input type="text" value={value} onChange={(e) => setter(e.target.value)} className="field-input" />
                  </div>
                ))}
              </div>

              {editStatus && <p className="mt-4 text-sm font-semibold text-stone-700">{editStatus}</p>}

              <div className="mt-5 flex gap-2">
                <button onClick={handleSaveEdit} className="btn-primary">Save</button>
                <button onClick={handleCancelEdit} className="btn-secondary">Cancel</button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="surface p-7">
        <div>
          <p className="page-kicker">Environment</p>
          <h2 className="mt-2 text-2xl font-black text-neutral-950">Environment Variables</h2>
          <p className="page-copy">Add individual keys or sync a full .env block into the service.</p>
        </div>

        <form onSubmit={handleAddOrUpdateEnv} className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input
            type="text"
            placeholder="KEY"
            value={envKey}
            onChange={(e) => setEnvKey(e.target.value)}
            className="field-input font-mono"
          />
          <input
            type="text"
            placeholder="value"
            value={envValue}
            onChange={(e) => setEnvValue(e.target.value)}
            className="field-input font-mono"
          />
          <button type="submit" className="btn-primary">Add / Update</button>
        </form>

        <div className="mt-5">
          <label className="field-label">Bulk .env editor</label>
          <textarea
            value={envBulkText}
            onChange={(e) => setEnvBulkText(e.target.value)}
            placeholder={'KEY=VALUE\nOTHER=VALUE'}
            rows={6}
            className="mono-box w-full resize-y"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={handleApplyEnvBulk} className="btn-primary">
              Apply .env
            </button>
            <button type="button" onClick={handleDeleteEnvBulk} className="btn-danger">
              Bulk Delete
            </button>
            <button type="button" onClick={() => setEnvBulkText('')} className="btn-secondary">
              Clear
            </button>
          </div>
          {envBulkStatus && <p className="mt-3 text-sm font-semibold text-stone-700">{envBulkStatus}</p>}
        </div>

        {envStatus && <p className="mt-4 text-sm font-semibold text-stone-700">{envStatus}</p>}

        {service.environmentVariables && service.environmentVariables.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
            {service.environmentVariables.map((env, idx) => (
              <div key={idx} className="rounded-lg border border-black/10 bg-neutral-950 p-4 text-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black uppercase tracking-[0.16em] text-teal-200">{env.key}</p>
                    <p className="mt-2 break-all font-mono text-sm text-stone-200">{env.value}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEnvKey(env.key);
                        setEnvValue(env.value);
                      }}
                      className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-black text-white hover:bg-white/[0.15]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteEnv(env.key)}
                      className="rounded-lg bg-rose-500/20 px-3 py-1.5 text-xs font-black text-rose-100 hover:bg-rose-500/30"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-6 rounded-lg border border-dashed border-stone-300 bg-stone-50 p-5 text-sm font-semibold text-stone-600">
            No environment variables yet. Add one above.
          </p>
        )}
      </section>

      <section className="surface p-7">
        <div>
          <p className="page-kicker">History</p>
          <h2 className="mt-2 text-2xl font-black text-neutral-950">Deployment History</h2>
        </div>

        {deployments.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-stone-300 bg-stone-50 p-5 text-sm font-semibold text-stone-600">
            No deployments yet.
          </p>
        ) : (
          <div className="mt-6 divide-y divide-stone-200">
            {deployments.slice(0, 10).map((deployment) => (
              <button
                key={deployment._id}
                className="flex w-full items-center justify-between gap-4 py-4 text-left transition hover:bg-stone-50"
                onClick={() => navigate(`/deployments/${deployment._id}/logs`)}
              >
                <div>
                  <p className="font-black text-neutral-950">
                    {new Date(deployment.createdAt).toLocaleDateString()} {new Date(deployment.createdAt).toLocaleTimeString()}
                  </p>
                  <p className="mt-1 font-mono text-xs text-stone-500">Commit: {deployment.commitHash?.substring(0, 7) || 'N/A'}</p>
                </div>
                <StatusBadge status={deployment.status || 'idle'} />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
