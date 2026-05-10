import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { HiArrowLeft, HiArrowTopRightOnSquare, HiCommandLine } from 'react-icons/hi2';
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

  const formatLogEntry = (message) => ({
    message,
    type: message.includes('ERROR')
      ? 'error'
      : message.includes('success')
      ? 'success'
      : message.includes('WARNING')
      ? 'warning'
      : 'info',
    timestamp: new Date().toLocaleTimeString(),
  });

  const appendLog = (entry) => {
    setLogs((prevLogs) => {
      const exists = prevLogs.some((log) => log.message === entry.message);
      if (exists) return prevLogs;
      return [...prevLogs, entry];
    });
  };

  const addLogEntries = (newMessages) => {
    setLogs((prevLogs) => {
      const keyCache = new Set(prevLogs.map((log) => log.message));
      const merged = [...prevLogs];
      newMessages.forEach((msg) => {
        const log = typeof msg === 'string' ? formatLogEntry(msg) : msg;
        const key = log.message;
        if (!keyCache.has(key)) {
          keyCache.add(key);
          merged.push(log);
        }
      });
      return merged;
    });
  };

  useEffect(() => {
    const socketUrl = process.env.REACT_APP_SOCKET_URL || 'http://localhost:4000';
    const newSocket = io(socketUrl, {
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 20000,
    });

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      newSocket.emit('deployment:subscribe', { deploymentId });
    });

    newSocket.on('connect_error', (err) => {
      console.error('Socket connect error:', err.message || err);
    });

    newSocket.on('reconnect_attempt', (attempt) => {
      console.log(`Socket reconnect attempt ${attempt}`);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('Socket reconnection failed after max attempts');
    });

    newSocket.on('reconnect', (attempt) => {
      console.log(`Socket reconnected after ${attempt} attempts`);
      newSocket.emit('deployment:subscribe', { deploymentId });
    });

    newSocket.on('deployment:previous-logs', (data) => {
      if (data.deploymentId === deploymentId && Array.isArray(data.logs)) {
        addLogEntries(data.logs);
        setLoading(false);
      }
    });

    newSocket.on('deployment:log', (data) => {
      if (data.deploymentId === deploymentId) {
        appendLog(formatLogEntry(data.log));
      }
    });

    newSocket.on('deployment:started', (data) => {
      if (data.deploymentId === deploymentId) {
        setDeployment((prev) => (prev ? { ...prev, status: data.status } : null));
      }
    });

    newSocket.on('deployment:completed', (data) => {
      if (data.deploymentId === deploymentId) {
        setDeployment((prev) =>
          prev
            ? {
                ...prev,
                status: data.status,
                deployedUrl: data.deployedUrl,
              }
            : null
        );
        fetchDeployment();
      }
    });

    newSocket.on('deployment:failed', (data) => {
      if (data.deploymentId === deploymentId) {
        setDeployment((prev) => (prev ? { ...prev, status: data.status } : null));
        setError(data.error || 'Deployment failed');
      }
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    setSocket(newSocket);

    fetchDeployment();
    fetchLogs();

    return () => {
      newSocket.disconnect();
    };
    // The socket subscription should be recreated only when the deployment id changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      const parsedLogs = logLines.map((line) => {
        if (typeof line === 'string') {
          return {
            message: line,
            type: line.includes('ERROR') ? 'error' : line.includes('success') ? 'success' : line.includes('WARNING') ? 'warning' : 'info',
            timestamp: new Date().toLocaleTimeString(),
          };
        }
        return line;
      });

      addLogEntries(parsedLogs);
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
      setLoading(false);
    }
  };

  const isSocketConnected = socket?.connected;

  return (
    <div className="space-y-8">
      <button onClick={() => navigate(-1)} className="btn-secondary px-3">
        <HiArrowLeft className="h-4 w-4" />
        Back
      </button>

      {deployment && (
        <section className="surface overflow-hidden">
          <div className="bg-neutral-950 p-7 text-white">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-teal-200">Deployment logs</p>
                <h1 className="mt-3 text-4xl font-black tracking-tight">Build output stream</h1>
                <p className="mt-3 text-sm text-stone-300">
                  {new Date(deployment.createdAt).toLocaleDateString()} {new Date(deployment.createdAt).toLocaleTimeString()}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${
                  isSocketConnected ? 'bg-emerald-400/[0.18] text-emerald-100' : 'bg-amber-400/[0.18] text-amber-100'
                }`}>
                  {isSocketConnected ? 'socket live' : 'socket reconnecting'}
                </span>
                <StatusBadge status={deployment.status} />
              </div>
            </div>
          </div>

          <div className="p-7">
            {deployment.service && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="surface-muted p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-stone-500">Service</p>
                  <p className="mt-2 font-black text-neutral-950">{deployment.service.name}</p>
                </div>
                <div className="surface-muted p-4 md:col-span-2">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-stone-500">Repo</p>
                  <p className="mt-2 break-all font-mono text-sm font-bold text-neutral-950">{deployment.service.gitRepositoryUrl}</p>
                </div>
                {deployment.service.publicUrl && (
                  <a
                    href={deployment.service.publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg bg-teal-50 px-4 py-3 text-sm font-black text-teal-800 hover:bg-teal-100 md:col-span-3"
                  >
                    Open public URL
                    <HiArrowTopRightOnSquare className="h-5 w-5" />
                  </a>
                )}
              </div>
            )}

            {error && <div className="alert-error mt-5">{error}</div>}
          </div>
        </section>
      )}

      <section className="surface p-7">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-neutral-950 text-teal-200">
            <HiCommandLine className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">Console</p>
            <h2 className="text-2xl font-black text-neutral-950">Build Output</h2>
          </div>
        </div>
        <LogViewer logs={logs} isLoading={loading && logs.length === 0} />
      </section>

      {deployment && (
        <section className="surface p-7">
          <div>
            <p className="page-kicker">Deployment details</p>
            <h2 className="mt-2 text-2xl font-black text-neutral-950">Release metadata</h2>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[
              ['Commit', deployment.commitHash || 'N/A'],
              ['Branch', deployment.branch || deployment.service?.gitBranch || 'main'],
              ['Duration', deployment.duration ? `${deployment.duration}s` : 'Still running...'],
              ['Service Start', deployment.service?.startCommand || 'N/A'],
              ['Health Check', deployment.service?.healthCheckPath || 'N/A'],
            ].map(([label, value]) => (
              <div key={label} className="surface-muted p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-stone-500">{label}</p>
                <p className="mt-2 break-all font-mono text-sm font-bold text-neutral-950">{value}</p>
              </div>
            ))}
            <div className="surface-muted p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-stone-500">Status</p>
              <div className="mt-2">
                <StatusBadge status={deployment.status || 'pending'} />
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
