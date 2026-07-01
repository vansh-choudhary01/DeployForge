import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  HiArrowLeft,
  HiCheck,
  HiOutlineClipboardDocument,
  HiOutlineCodeBracketSquare,
  HiOutlineRocketLaunch,
  HiOutlineTrash,
  HiPlus,
  HiXMark,
  HiOutlineFolderPlus,
} from 'react-icons/hi2';
import { projectAPI, serviceAPI } from '../utils/api.js';

const GITHUB_URL_REGEX = /^https:\/\/github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+(?:\.git)?\/?$/;

export default function DeployService() {
  const navigate = useNavigate();
  const location = useLocation();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
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
    deploymentType: 'server',
    buildDirectory: 'build',
  });

  useEffect(() => {
    fetchProjects();

    const query = new URLSearchParams(location.search);
    const projectIdFromQuery = query.get('projectId');
    if (projectIdFromQuery) {
      setFormData((prev) => (
        prev.projectId === projectIdFromQuery ? prev : { ...prev, projectId: projectIdFromQuery }
      ));
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

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    setCreatingProject(true);
    try {
      const response = await projectAPI.create({ name: newProjectName.trim() });
      const created = response.data.project;
      // Add to list immediately so the select has the option before we set the value
      setProjects((prev) => [...prev, created]);
      setFormData((prev) => ({ ...prev, projectId: created._id }));
      setNewProjectName('');
      setShowNewProject(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create project');
    } finally {
      setCreatingProject(false);
    }
  };

  const handleValidateRepo = async () => {
    if (!formData.repo.trim()) {
      setError('Repository URL is required');
      setUrlFormatValid(false);
      return;
    }

    if (!GITHUB_URL_REGEX.test(formData.repo)) {
      setError('Invalid GitHub URL format. Expected: https://github.com/username/repo.git');
      setUrlFormatValid(false);
      return;
    }

    setValidating(true);
    setError('');
    setSuccess('');

    try {
      const response = await serviceAPI.validateRepo(formData.repo);

      if (response.status === 200) {
        setSuccess('Repository verified successfully');
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
      const isFormatValid = GITHUB_URL_REGEX.test(value);
      setUrlFormatValid(isFormatValid);

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
    const nextEnvVars = [...envVars];
    nextEnvVars[index][field] = value;
    setEnvVars(nextEnvVars);
  };

  const parseEnvFile = (content) => {
    const lines = content.split('\n');
    const parsed = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=');

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

    setEnvVars([...envVars, ...parsed]);
    alert(`${parsed.length} environment variable(s) added`);
  };

  const handleDeploy = async (e) => {
    e.preventDefault();
    setError('');
    if (showNewProject) {
      setError('Click "Create" to save the new project before deploying.');
      return;
    }
    if (!formData.projectId) {
      setError('Please select or create a project before deploying.');
      return;
    }
    setLoading(true);

    try {
      const deployData = {
        ...formData,
        startCommand: formData.deploymentType === 'server' ? formData.startCommand : undefined,
        environmentVariables: envVars,
      };

      const response = await serviceAPI.deploy(deployData);
      navigate(`/deployments/${response.data.deployment._id}/logs`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to deploy service');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <button onClick={() => navigate('/services')} className="btn-secondary px-3">
        <HiArrowLeft className="h-4 w-4" />
        Back to Services
      </button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[0.78fr_1.22fr]">
        <aside className="space-y-4">
          <div className="surface bg-neutral-950 p-6 text-white">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-teal-200">Deploy service</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight">Prepare a clean release.</h1>
            <p className="mt-4 text-sm leading-6 text-stone-300">
              Validate the GitHub repository first, then configure runtime commands, static build output, health checks,
              and environment variables.
            </p>
          </div>

          <div className="surface p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-stone-500">Flow</p>
            <div className="mt-4 space-y-3">
              {['Validate repository', 'Choose project', 'Tune commands', 'Stream live logs'].map((item, index) => (
                <div key={item} className="flex items-center gap-3">
                  <span className={`grid h-8 w-8 place-items-center rounded-lg text-xs font-black ${
                    index === 0 && repoValidated ? 'bg-teal-100 text-teal-800' : 'bg-stone-100 text-stone-500'
                  }`}>
                    {index + 1}
                  </span>
                  <p className="text-sm font-bold text-neutral-800">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="space-y-5">
          <section className="surface p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-teal-100 text-teal-800">
                <HiOutlineCodeBracketSquare className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-xl font-black text-neutral-950">Source Code</h2>
                <p className="text-sm text-stone-600">Format: https://github.com/username/repo.git</p>
              </div>
            </div>

            {(error || success) && (
              <div className="mt-5">
                {error && <div className="alert-error">{error}</div>}
                {success && <div className="alert-success">{success}</div>}
              </div>
            )}

            <div className="mt-5">
              <label className="field-label">Repository URL *</label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  type="text"
                  name="repo"
                  value={formData.repo}
                  onChange={handleInputChange}
                  disabled={repoValidated}
                  placeholder="https://github.com/username/repo.git"
                  className={`field-input font-mono ${
                    formData.repo === ''
                      ? ''
                      : urlFormatValid
                      ? 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-100'
                      : 'border-rose-400 focus:border-rose-500 focus:ring-rose-100'
                  }`}
                />
                <button
                  type="button"
                  onClick={handleValidateRepo}
                  disabled={validating || repoValidated || !formData.repo || !urlFormatValid}
                  className="btn-primary"
                >
                  {validating ? 'Checking...' : repoValidated ? 'Verified' : 'Validate'}
                </button>
              </div>

              {formData.repo && !repoValidated && (
                <div className={`mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${
                  urlFormatValid ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                }`}>
                  {urlFormatValid ? <HiCheck className="h-4 w-4" /> : <HiXMark className="h-4 w-4" />}
                  {urlFormatValid ? 'URL format is valid' : 'Invalid URL format'}
                </div>
              )}

              {repoValidated && (
                <button
                  type="button"
                  onClick={() => {
                    setRepoValidated(false);
                    setFormData({ ...formData, repo: '' });
                    setSuccess('');
                    setUrlFormatValid(false);
                  }}
                  className="mt-3 text-sm font-bold text-stone-600 hover:text-neutral-950"
                >
                  Change Repository
                </button>
              )}
            </div>
          </section>

          {repoValidated && (
            <form onSubmit={handleDeploy} className="space-y-5">
              <section className="surface p-6">
                <h2 className="text-xl font-black text-neutral-950">Configuration</h2>

                <div className="mt-5">
                  <div className="flex items-center justify-between gap-3">
                    <label className="field-label">Project *</label>
                    <button
                      type="button"
                      onClick={() => { setShowNewProject((v) => !v); setNewProjectName(''); setError(''); }}
                      className="mb-1 flex items-center gap-1 text-xs font-black text-teal-700 hover:text-teal-900"
                    >
                      {showNewProject ? <HiXMark className="h-4 w-4" /> : <HiOutlineFolderPlus className="h-4 w-4" />}
                      {showNewProject ? 'Cancel' : 'New project'}
                    </button>
                  </div>

                  {showNewProject ? (
                    <div className="grid grid-cols-[1fr_auto] gap-3">
                      <input
                        type="text"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleCreateProject())}
                        placeholder="my-project"
                        autoFocus
                        className="field-input"
                      />
                      <button
                        type="button"
                        onClick={handleCreateProject}
                        disabled={creatingProject || !newProjectName.trim()}
                        className="btn-primary"
                      >
                        {creatingProject ? 'Creating...' : 'Create'}
                      </button>
                    </div>
                  ) : (
                    <select
                      name="projectId"
                      value={formData.projectId}
                      onChange={handleInputChange}
                      required
                      className="field-input"
                    >
                      <option value="">Select a project</option>
                      {projects.map((project) => (
                        <option key={project._id} value={project._id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="field-label">Branch *</label>
                    <input
                      type="text"
                      name="branch"
                      value={formData.branch}
                      onChange={handleInputChange}
                      required
                      placeholder="main"
                      className="field-input"
                    />
                  </div>

                  <div>
                    <label className="field-label">Root Directory</label>
                    <input
                      type="text"
                      name="rootDirectory"
                      value={formData.rootDirectory}
                      onChange={handleInputChange}
                      placeholder="/"
                      className="field-input"
                    />
                  </div>
                </div>
              </section>

              <section className="surface p-6">
                <h2 className="text-xl font-black text-neutral-950">Build and Deploy</h2>
                <p className="mt-2 text-sm text-stone-600">
                  Commands run from <span className="font-mono font-bold text-neutral-950">{formData.rootDirectory || '/'}</span>.
                </p>

                <div className="mt-5 space-y-5">
                  <div>
                    <label className="field-label">Pre-Deploy Command *</label>
                    <input
                      type="text"
                      name="preDeployCommand"
                      value={formData.preDeployCommand}
                      onChange={handleInputChange}
                      placeholder="npm install"
                      className="field-input font-mono"
                    />
                    <p className="mt-2 font-mono text-xs text-stone-500">{formData.rootDirectory || '/'} $ {formData.preDeployCommand}</p>
                  </div>

                  <div>
                    <label className="field-label">Build Command</label>
                    <input
                      type="text"
                      name="buildCommand"
                      value={formData.buildCommand}
                      onChange={handleInputChange}
                      placeholder="npm run build"
                      className="field-input font-mono"
                    />
                    <p className="mt-2 font-mono text-xs text-stone-500">
                      {formData.rootDirectory || '/'} $ {formData.buildCommand || '<no build command>'}
                    </p>
                  </div>

                  <div>
                    <label className="field-label">Deployment Type *</label>
                    <select
                      name="deploymentType"
                      value={formData.deploymentType}
                      onChange={handleInputChange}
                      className="field-input"
                    >
                      <option value="server">Server workload</option>
                      <option value="static">Static site</option>
                    </select>
                  </div>

                  {formData.deploymentType === 'server' ? (
                    <div>
                      <label className="field-label">Start Command *</label>
                      <input
                        type="text"
                        name="startCommand"
                        value={formData.startCommand}
                        onChange={handleInputChange}
                        required
                        placeholder="npm start"
                        className="field-input font-mono"
                      />
                      <p className="mt-2 font-mono text-xs text-stone-500">{formData.rootDirectory || '/'} $ {formData.startCommand}</p>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
                      <p className="text-sm leading-6 text-teal-900">
                        For static sites, the build command runs first and the configured build directory is served.
                      </p>
                      <label className="field-label mt-4">Build Directory</label>
                      <input
                        type="text"
                        name="buildDirectory"
                        value={formData.buildDirectory}
                        onChange={handleInputChange}
                        placeholder="build"
                        className="field-input"
                      />
                    </div>
                  )}

                  <div>
                    <label className="field-label">Health Check Path *</label>
                    <input
                      type="text"
                      name="healthCheckPath"
                      value={formData.healthCheckPath}
                      onChange={handleInputChange}
                      placeholder="/"
                      className="field-input"
                    />
                  </div>
                </div>
              </section>

              <section className="surface p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-black text-neutral-950">Environment Variables</h2>
                    <p className="mt-1 text-sm text-stone-600">Paste a .env file or add variables one by one.</p>
                  </div>
                  <button type="button" onClick={handleAddEnvVar} className="btn-secondary">
                    <HiPlus className="h-4 w-4" />
                    Add Variable
                  </button>
                </div>

                <div className="mt-5 rounded-lg border border-black/10 bg-neutral-950 p-4 text-white">
                  <div className="flex items-center justify-between gap-4">
                    <label className="text-sm font-black text-white">Paste .env file</label>
                    <span className="text-xs font-semibold text-stone-400">Comments ignored</span>
                  </div>
                  <textarea
                    onPaste={handlePasteEnvFile}
                    placeholder={`# Example
REACT_APP_API_URL=http://localhost:4000/api
NODE_ENV=production`}
                    className="mt-3 h-32 w-full resize-none rounded-lg border border-white/10 bg-black px-4 py-3 font-mono text-xs text-stone-100 outline-none placeholder:text-stone-500 focus:border-teal-300"
                  />
                  <p className="mt-2 flex items-center gap-2 text-xs text-stone-400">
                    <HiOutlineClipboardDocument className="h-4 w-4" />
                    Paste content here and variables will be extracted automatically.
                  </p>
                </div>

                {envVars.length > 0 && (
                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between rounded-lg bg-stone-100 px-3 py-2">
                      <span className="text-sm font-bold text-stone-700">{envVars.length} variable(s) configured</span>
                      <button type="button" onClick={() => setEnvVars([])} className="text-xs font-black text-rose-600 hover:text-rose-800">
                        Clear All
                      </button>
                    </div>

                    {envVars.map((envVar, index) => (
                      <div key={index} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
                        <input
                          type="text"
                          placeholder="KEY"
                          value={envVar.key}
                          onChange={(e) => handleEnvVarChange(index, 'key', e.target.value)}
                          className="field-input font-mono"
                        />
                        <input
                          type="text"
                          placeholder="value"
                          value={envVar.value}
                          onChange={(e) => handleEnvVarChange(index, 'value', e.target.value)}
                          className="field-input font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveEnvVar(index)}
                          className="btn-danger px-3"
                          title="Remove variable"
                        >
                          <HiOutlineTrash className="h-5 w-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="submit" disabled={loading || showNewProject || !formData.projectId} className="btn-primary flex-1 py-3">
                  <HiOutlineRocketLaunch className="h-5 w-5" />
                  {loading ? 'Deploying...' : 'Deploy Service'}
                </button>
                <button type="button" onClick={() => navigate('/services')} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}
