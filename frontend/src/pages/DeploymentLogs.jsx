import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { HiArrowLeft } from 'react-icons/hi2';
import { io } from 'socket.io-client';
import LogViewer from '../components/LogViewer';
import StatusBadge from '../components/StatusBadge';
import { deploymentAPI } from '../utils/api';

export default function DeploymentLogs() {
  const { deploymentId } = useParams();
  const navigate = useNavigate();
  const [deployment, setDeployment] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Initialize socket connection
    const socketUrl = process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:4000';
    const newSocket = io(socketUrl);

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
    });

    // Listen for live deployment logs
    newSocket.on('deployment:log', (data) => {
      if (data.deploymentId === deploymentId) {
        setLogs(prevLogs => [
          ...prevLogs,
          {
            message: data.log,
            type: data.log.includes('ERROR') ? 'error' : data.log.includes('success') ? 'success' : data.log.includes('WARNING') ? 'warning' : 'info',
            timestamp: new Date().toLocaleTimeString(),
          }
        ]);
      }
    });

    // Listen for deployment status updates
    newSocket.on('deployment:started', (data) => {
      if (data.deploymentId === deploymentId) {
        setDeployment(prev => prev ? { ...prev, status: data.status } : null);
      }
    });

    newSocket.on('deployment:completed', (data) => {
      if (data.deploymentId === deploymentId) {
        setDeployment(prev => prev ? { 
          ...prev, 
          status: data.status,
          deployedUrl: data.deployedUrl
        } : null);
      }
    });

    newSocket.on('deployment:failed', (data) => {
      if (data.deploymentId === deploymentId) {
        setDeployment(prev => prev ? { ...prev, status: data.status } : null);
        setError(data.error || 'Deployment failed');
      }
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    setSocket(newSocket);

    // Fetch initial deployment data
    fetchDeployment();
    fetchLogs();

    return () => {
      newSocket.disconnect();
    };
  }, [deploymentId]);

  const fetchDeployment = async () => {
    try {
      const response = await deploymentAPI.getById(deploymentId);
      setDeployment(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch deployment');
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await deploymentAPI.getLogs(deploymentId);
      const logLines = response.data.data || [];
      
      // Parse log lines into objects
      const parsedLogs = logLines.map((line) => {
        if (typeof line === 'string') {
          return {
            message: line,
            type: line.includes('ERROR') ? 'error' : line.includes('success') ? 'success' : 'info',
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
