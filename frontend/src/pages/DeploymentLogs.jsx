import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { HiArrowLeft } from 'react-icons/hi2';
import LogViewer from '../components/LogViewer';
import StatusBadge from '../components/StatusBadge';
import api from '../utils/api';

export default function DeploymentLogs() {
  const { deploymentId } = useParams();
  const navigate = useNavigate();
  const [deployment, setDeployment] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDeployment();
    fetchLogs();

    // Poll for updates every 2 seconds
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [deploymentId]);

  const fetchDeployment = async () => {
    try {
      const response = await api.get(`/deployments/${deploymentId}`);
      setDeployment(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch deployment');
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await api.get(`/deployments/${deploymentId}/logs`);
      const logLines = response.data.data || [];
      
      // Parse log lines into objects
      const parsedLogs = logLines.map((line) => {
        if (typeof line === 'string') {
          return {
            message: line,
            type: line.includes('error') ? 'error' : line.includes('success') ? 'success' : 'info',
            timestamp: new Date().toLocaleTimeString(),
          };
        }
        return line;
      });

      setLogs(parsedLogs);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
      >
        <HiArrowLeft className="w-5 h-5" />
        Back
      </button>

      {/* Deployment Info */}
      {deployment && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Deployment Logs</h1>
              <p className="text-slate-400 mt-1">
                {new Date(deployment.createdAt).toLocaleDateString()} {new Date(deployment.createdAt).toLocaleTimeString()}
              </p>
            </div>
            <StatusBadge status={deployment.status} />
          </div>

          {error && (
            <div className="bg-red-900 border border-red-700 rounded-lg p-4 text-red-200">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Logs Viewer */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-8">
        <h2 className="text-lg font-semibold text-white mb-4">Build Output</h2>
        <LogViewer logs={logs} isLoading={loading && logs.length === 0} />
      </div>

      {/* Log Stats */}
      {deployment && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8">
          <h2 className="text-lg font-semibold text-white mb-4">Deployment Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-slate-400 mb-1">Commit</p>
              <p className="text-white font-mono break-all">{deployment.commitHash}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400 mb-1">Branch</p>
              <p className="text-white">{deployment.branch || 'main'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400 mb-1">Status</p>
              <div className="mt-2">
                <StatusBadge status={deployment.status} />
              </div>
            </div>
            <div>
              <p className="text-sm text-slate-400 mb-1">Duration</p>
              <p className="text-white">
                {deployment.duration ? `${deployment.duration}s` : 'Still running...'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
