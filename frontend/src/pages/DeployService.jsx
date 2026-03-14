import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { HiArrowLeft, HiPlus, HiOutlineTrash, HiCheck, HiXMark } from 'react-icons/hi2';
import { serviceAPI, projectAPI } from '../utils/api.js';

// GitHub URL regex pattern: https://github.com/username/repo or https://github.com/username/repo.git
const GITHUB_URL_REGEX = /^https:\/\/github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+(?:\.git)?\/?$/;

export default function DeployService() {
  const navigate = useNavigate();
  const location = useLocation();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [repoValidated, setRepoValidated] = useState(false);
  const [urlFormatValid, setUrlFormatValid] = useState(false);
  const [envVars, setEnvVars] = useState([]);
  const [formData, setFormData] = useState({
    repo: '',
    branch: 'main',
    projectId: '',
    rootDirectory: '/',
    buildCommand: 'npm run build',
    preDeployCommand: 'npm install',
    startCommand: 'npm start',
    healthCheckPath: '/',
  });

  useEffect(() => {
    fetchProjects();

    const query = new URLSearchParams(location.search);
    const projectIdFromQuery = query.get('projectId');
    if (projectIdFromQuery && formData.projectId !== projectIdFromQuery) {
      setFormData((prev) => ({ ...prev, projectId: projectIdFromQuery }));
    }
  }, [location.search]);

  const fetchProjects = async () => {
    try {
      const response = await projectAPI.getAll();
      setProjects(response.data.projects || []);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    }
  };

  const handleValidateRepo = async () => {
    if (!formData.repo.trim()) {
      setError('Repository URL is required');
      setUrlFormatValid(false);
      return;
    }

    // Check regex format first
    if (!GITHUB_URL_REGEX.test(formData.repo)) {
      setError('Invalid GitHub URL format. Expected: https://github.com/username/repo.git');
      setUrlFormatValid(false);
      return;
    }

    setValidating(true);
    setError('');
    setSuccess('');

    try {
      // Call backend to verify the repository actually exists
      const response = await serviceAPI.validateRepo(formData.repo);
      
      if (response.status === 200) {
        setSuccess(`✓ Repository verified successfully`);
        setRepoValidated(true);
        setUrlFormatValid(true);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Repository not found or is not public';
      setError(errorMsg);
      setUrlFormatValid(false);
    } finally {
      setValidating(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'repo') {
      // Real-time validation as user types
      const isFormatValid = GITHUB_URL_REGEX.test(value);
      setUrlFormatValid(isFormatValid);
      
      // Clear validation states when user modifies URL
      if (repoValidated) {
        setRepoValidated(false);
        setSuccess('');
      }
      
      setError('');
    }

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

  const parseEnvFile = (content) => {
    const lines = content.split('\n');
    const parsed = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Split by first = sign
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('='); // In case value contains =

      if (key.trim()) {
        parsed.push({
          key: key.trim(),
          value: value.trim(),
        });
      }
    }

    return parsed;
  };

  const handlePasteEnvFile = (e) => {
    e.preventDefault();
    const pastedContent = e.clipboardData.getData('text');
    
    if (!pastedContent.trim()) {
      alert('No content pasted');
      return;
    }

    const parsed = parseEnvFile(pastedContent);

    if (parsed.length === 0) {
      alert('No valid environment variables found in pasted content');
      return;
    }

    // Add parsed variables to existing ones
    setEnvVars([...envVars, ...parsed]);
    alert(`${parsed.length} environment variable(s) added`);
  };

  const handleDeploy = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const deployData = {
        ...formData,
        environmentVariables: envVars,
      };
      
      const response = await serviceAPI.deploy(deployData);
      // Navigate to deployment logs to show live progress
      navigate(`/deployments/${response.data.deployment._id}/logs`);
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

      {/* Title */}
      <div>
        <h1 className="text-3xl font-bold text-white">Deploy New Service</h1>
        <p className="text-slate-400 mt-2">Configure and deploy a new service from your repository</p>
      </div>

      {/* Step 1: Repository Validation */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 space-y-4">
        <h2 className="text-lg font-semibold text-white">Source Code</h2>
        
        {error && (
          <div className="bg-red-900 border border-red-700 rounded-lg p-4 text-red-200 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-900 border border-green-700 rounded-lg p-4 text-green-200 text-sm">
            ✓ {success}
          </div>
        )}

        <div className="space-y-3">
          <label className="block text-sm font-medium text-white">Repository URL *</label>
          <p className="text-xs text-slate-400">Format: https://github.com/username/repo.git</p>
          
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                name="repo"
                value={formData.repo}
                onChange={handleInputChange}
                disabled={repoValidated}
                placeholder="https://github.com/vansh-choudhary01/Workflow-test.git"
                className={`flex-1 px-4 py-2 bg-slate-700 border rounded-lg text-white placeholder-slate-500 focus:outline-none font-mono text-sm transition-colors ${
                  formData.repo === '' 
                    ? 'border-slate-600' 
                    : urlFormatValid 
                    ? 'border-green-500 focus:border-green-400' 
                    : 'border-red-500 focus:border-red-400'
                } ${repoValidated ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
              <button
                type="button"
                onClick={handleValidateRepo}
                disabled={validating || repoValidated || !formData.repo || !urlFormatValid}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed flex items-center gap-2"
              >
                {validating ? 'Checking...' : repoValidated ? 'Verified ✓' : 'Validate'}
              </button>
            </div>
            
            {/* Real-time format validation feedback */}
            {formData.repo && !repoValidated && (
              <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded ${
                urlFormatValid 
                  ? 'bg-green-900 bg-opacity-30 text-green-300' 
                  : 'bg-red-900 bg-opacity-30 text-red-300'
              }`}>
                {urlFormatValid ? (
                  <>
                    <HiCheck className="w-4 h-4" />
                    <span>URL format is valid</span>
                  </>
                ) : (
                  <>
                    <HiXMark className="w-4 h-4" />
                    <span>Invalid URL format</span>
                  </>
                )}
              </div>
            )}
            
            {/* Validation status messages */}
            {error && (
              <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded-lg p-3 text-red-300 text-sm flex items-center gap-2">
                <HiXMark className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-900 bg-opacity-30 border border-green-700 rounded-lg p-3 text-green-300 text-sm flex items-center gap-2">
                <HiCheck className="w-4 h-4 flex-shrink-0" />
                {success}
              </div>
            )}
          </div>
          
          {repoValidated && (
            <button
              type="button"
              onClick={() => {
                setRepoValidated(false);
                setFormData({ ...formData, repo: '' });
                setSuccess('');
                setUrlFormatValid(false);
              }}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              ↻ Change Repository
            </button>
          )}
        </div>
      </div>

      {/* Step 2: Configuration (shown only after validation) */}
      {repoValidated && (
      <form onSubmit={handleDeploy} className="bg-slate-800 border border-slate-700 rounded-lg p-8 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4 pb-6 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">Configuration</h2>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Project *
              </label>
              <select
                name="projectId"
                value={formData.projectId}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Select a project</option>
                {projects.map((project) => (
                  <option key={project._id} value={project._id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Branch *
                </label>
                <input
                  type="text"
                  name="branch"
                  value={formData.branch}
                  onChange={handleInputChange}
                  required
                  placeholder="main"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  Root Directory
                </label>
                <input
                  type="text"
                  name="rootDirectory"
                  value={formData.rootDirectory}
                  onChange={handleInputChange}
                  placeholder="/"
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Build Commands */}
          <div className="space-y-4 pb-6 border-b border-slate-700">
            <h2 className="text-lg font-semibold text-white">Build & Deploy</h2>

            <div className="text-xs text-slate-400">
              Commands below will run from: <span className="text-white font-mono">{formData.rootDirectory || '/'}</span>
            </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">
              Pre-Deploy Command *
            </label>
            <input
              type="text"
              name="preDeployCommand"
              value={formData.preDeployCommand}
              onChange={handleInputChange}
              required
              placeholder="npm install"
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-sm"
            />
            <p className="text-xs text-slate-400 mt-1">
              {formData.rootDirectory || '/'} <span className="text-slate-200">$</span> {formData.preDeployCommand}
            </p>
            </div>

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
              <p className="text-xs text-slate-400 mt-1">
                {formData.rootDirectory || '/'} <span className="text-slate-200">$</span> {formData.buildCommand || '<no build command>'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Start Command *
              </label>
              <input
                type="text"
                name="startCommand"
                value={formData.startCommand}
                onChange={handleInputChange}
                required
                placeholder="npm start"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-sm"
              />
              <p className="text-xs text-slate-400 mt-1">
                {formData.rootDirectory || '/'} <span className="text-slate-200">$</span> {formData.startCommand}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Health Check Path *
              </label>
              <input
                type="text"
                name="healthCheckPath"
                value={formData.healthCheckPath}
                onChange={handleInputChange}
                required
                placeholder="/"
                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Environment Variables */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Environment Variables</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddEnvVar}
                  className="flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm"
                >
                  <HiPlus className="w-4 h-4" />
                  Add Variable
                </button>
              </div>
            </div>

            {/* Paste .env file section */}
            <div className="bg-slate-700 bg-opacity-50 border border-slate-600 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-300">Paste .env file</label>
                <span className="text-xs text-slate-400">Comments will be ignored</span>
              </div>
              <textarea
                onPaste={handlePasteEnvFile}
                placeholder={`# Example environment variables
# Copy and paste your .env file here
REACT_APP_API_URL=http://localhost:4000/api
REACT_APP_ENVIRONMENT=development
# REACT_APP_DEBUG=true`}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono text-xs h-32 resize-none"
              />
              <p className="text-xs text-slate-400">Simply paste your .env file content here and variables will be extracted automatically (comments and empty lines are ignored)</p>
            </div>

            <div className="space-y-3">
              {envVars.length > 0 && (
                <div className="flex items-center justify-between px-3 py-2 bg-slate-700 bg-opacity-30 rounded">
                  <span className="text-sm text-slate-300">{envVars.length} variable(s) configured</span>
                  {envVars.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setEnvVars([])}
                      className="text-xs text-red-400 hover:text-red-300"
                    >
                      Clear All
                    </button>
                  )}
                </div>
              )}
              
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
      )}
    </div>
  );
}
