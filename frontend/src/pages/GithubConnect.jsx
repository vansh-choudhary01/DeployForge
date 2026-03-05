import React, { useState, useEffect } from 'react';
import { HiOutlineExclamationCircle, HiCheck } from 'react-icons/hi2';
import RepoList from '../components/RepoList';
import api from '../utils/api';

export default function GithubConnect() {
  const [token, setToken] = useState('');
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [connected, setConnected] = useState(false);
  const [username, setUsername] = useState('');

  useEffect(() => {
    const storedUsername = localStorage.getItem('githubUsername');
    if (storedUsername) {
      setConnected(true);
      setUsername(storedUsername);
    }
  }, []);

  const handleConnect = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await api.post('/users/github/connect', { token });
      const { username: newUsername } = response.data;
      
      localStorage.setItem('githubToken', token);
      localStorage.setItem('githubUsername', newUsername);
      setConnected(true);
      setUsername(newUsername);
      setSuccess('GitHub connected successfully!');
      setToken('');
      
      // Fetch repos
      fetchRepos();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to connect GitHub');
    } finally {
      setLoading(false);
    }
  };

  const fetchRepos = async () => {
    setLoading(true);
    try {
      const response = await api.post('/users/github/repos', {
        token: localStorage.getItem('githubToken'),
      });
      setRepos(response.data.repositories || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch repositories');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRepo = (repo) => {
    // Store selected repo and navigate to deploy page
    localStorage.setItem('selectedRepo', JSON.stringify(repo));
    // This would typically navigate to a deploy page
    alert(`Selected repo: ${repo.name}`);
  };

  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Git Credentials</h1>
        <p className="text-slate-400 mt-2">
          Connect your GitHub account to deploy repositories
        </p>
      </div>

      {/* Connection Status */}
      {connected && (
        <div className="bg-green-900 border border-green-700 rounded-lg p-4 flex items-center gap-3">
          <HiCheck className="w-5 h-5 text-green-400" />
          <div>
            <p className="text-green-200 font-medium">Connected as @{username}</p>
            <p className="text-green-300 text-sm">You can deploy from your repositories</p>
          </div>
        </div>
      )}

      {/* Connect Form */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-8">
        <h2 className="text-xl font-semibold text-white mb-6">
          {connected ? 'Update Token' : 'Connect GitHub'}
        </h2>

        <form onSubmit={handleConnect} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">
              GitHub Personal Access Token
            </label>
            <textarea
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono text-sm"
              rows="3"
            />
            <p className="text-xs text-slate-400 mt-2">
              Create a token at github.com/settings/tokens with repo scope
            </p>
          </div>

          {error && (
            <div className="bg-red-900 border border-red-700 rounded-lg p-4 flex items-center gap-3">
              <HiOutlineExclamationCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-900 border border-green-700 rounded-lg p-4 flex items-center gap-3">
              <HiCheck className="w-5 h-5 text-green-400 flex-shrink-0" />
              <p className="text-green-200 text-sm">{success}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!token || loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors"
          >
            {loading ? 'Connecting...' : 'Connect GitHub'}
          </button>
        </form>
      </div>

      {/* Repositories List */}
      {connected && (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8">
          <h2 className="text-xl font-semibold text-white mb-6">Your Repositories</h2>
          <RepoList
            repos={repos}
            onSelectRepo={handleSelectRepo}
            loading={loading}
          />
        </div>
      )}
    </div>
  );
}
