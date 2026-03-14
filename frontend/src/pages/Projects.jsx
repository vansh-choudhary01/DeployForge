import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { projectAPI } from '../utils/api.js';

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '' });
  const [submitting, setSubmitting] = useState(false);
  const [expandedProjectId, setExpandedProjectId] = useState(null);

  // Fetch projects on component mount
  const location = useLocation();

  useEffect(() => {
    fetchProjects();

    const query = new URLSearchParams(location.search);
    const expandId = query.get('expand');
    if (expandId) {
      setExpandedProjectId(expandId);
    }
  }, [location.search]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await projectAPI.getAll();
      setProjects(response.data.projects || []);
      setError(null);
    } catch (err) {
      setError('Failed to load projects');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Project name is required');
      return;
    }

    try {
      setSubmitting(true);
      await projectAPI.create({ name: formData.name });
      setFormData({ name: '' });
      setShowForm(false);
      await fetchProjects();
    } catch (err) {
      setError('Failed to create project');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProject = async (projectId) => {
    if (!window.confirm('Are you sure you want to delete this project?')) return;

    try {
      await projectAPI.delete(projectId);
      await fetchProjects();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete project');
      console.error(err);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Projects</h1>
        <p className="text-slate-400 mt-2">Organize your services into projects</p>
      </div>

      {error && (
        <div className="bg-red-900 border border-red-700 rounded-lg p-4 text-red-200">
          {error}
        </div>
      )}

      <button
        onClick={() => setShowForm(!showForm)}
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg"
      >
        {showForm ? 'Cancel' : '+ New Project'}
      </button>

      {showForm && (
        <form onSubmit={handleCreateProject} className="bg-slate-800 border border-slate-700 rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-slate-300 font-medium mb-2">Project Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ name: e.target.value })}
              placeholder="Enter project name"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white font-semibold py-2 px-4 rounded-lg"
          >
            {submitting ? 'Creating...' : 'Create Project'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center">
          <p className="text-slate-400">Loading projects...</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-12 text-center">
          <p className="text-slate-400 mb-4">No projects yet</p>
          <p className="text-slate-500 text-sm">Create your first project to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div key={project._id} className="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:border-slate-600 transition">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">{project.name}</h3>
                  <p className="text-slate-400 text-sm">ID: {project.projectId}</p>
                  <p className="text-slate-500 text-xs">Services: {project.services?.length || 0}</p>
                </div>
                <div className="space-y-2 text-right">
                  <button
                    onClick={() => setExpandedProjectId(expandedProjectId === project._id ? null : project._id)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-1 px-3 rounded-lg"
                  >
                    {expandedProjectId === project._id ? 'Collapse' : 'View Services'}
                  </button>
                  <button
                    onClick={() => handleDeleteProject(project.projectId)}
                    disabled={(project.services?.length || 0) > 0}
                    className={`text-xs font-semibold py-1 px-3 rounded-lg ${
                      (project.services?.length || 0) > 0
                        ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                        : 'bg-red-900 hover:bg-red-800 text-red-200'
                    }`}
                  >
                    Delete
                  </button>
                  {(project.services?.length || 0) > 0 && (
                    <p className="text-xs text-slate-400 mt-1">Delete disabled: remove services first.</p>
                  )}
                </div>
              </div>

              {expandedProjectId === project._id && (
                <div className="mt-4 bg-slate-900 border border-slate-700 rounded-lg p-4">
                  <h4 className="text-sm text-slate-200 font-semibold mb-3">Services in project</h4>
                  {project.services?.length === 0 ? (
                    <p className="text-slate-400 text-sm">No services added yet.</p>
                  ) : (
                    <ul className="space-y-3">
                      {project.services.map((service) => (
                        <li key={service._id} className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">{service.name}</p>
                              <p className="text-xs text-slate-400">Branch: {service.gitBranch || 'main'}</p>
                              <p className="text-xs text-slate-400">Status: {service.status || 'pending'}</p>
                            </div>
                            <button
                              onClick={() => navigate(`/services/${service._id}`)}
                              className="text-blue-400 hover:text-blue-300 text-xs"
                            >
                              View Service
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  <button
                    onClick={() => navigate(`/deploy?projectId=${project._id}`)}
                    className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2 rounded-lg"
                  >
                    + Deploy New Service in this Project
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
