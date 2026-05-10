import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  HiArrowRight,
  HiChevronDown,
  HiChevronUp,
  HiOutlineFolderPlus,
  HiPlus,
  HiTrash,
} from 'react-icons/hi2';
import StatusBadge from '../components/StatusBadge';
import { projectAPI } from '../utils/api.js';

export default function Projects() {
  const navigate = useNavigate();
  const location = useLocation();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '' });
  const [submitting, setSubmitting] = useState(false);
  const [expandedProjectId, setExpandedProjectId] = useState(null);

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
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="page-kicker">Projects</p>
          <h1 className="page-title">Organize services by product, client, or idea.</h1>
          <p className="page-copy">Projects keep related services together and make it easier to deploy into the right workspace.</p>
        </div>
        <button onClick={() => setShowForm((value) => !value)} className="btn-primary">
          {showForm ? (
            'Cancel'
          ) : (
            <>
              <HiPlus className="h-5 w-5" />
              New Project
            </>
          )}
        </button>
      </div>

      {error && <div className="alert-error">{error}</div>}

      {showForm && (
        <form onSubmit={handleCreateProject} className="surface p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <label className="field-label">Project Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ name: e.target.value })}
                placeholder="customer-portal"
                className="field-input"
              />
            </div>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, index) => (
            <div key={index} className="h-52 animate-pulse rounded-lg bg-white/70" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="surface p-12 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-teal-100 text-teal-800">
            <HiOutlineFolderPlus className="h-8 w-8" />
          </span>
          <h2 className="mt-5 text-2xl font-black text-neutral-950">No projects yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-600">
            Create a project first, then deploy services into it from GitHub repositories.
          </p>
          <button onClick={() => setShowForm(true)} className="btn-primary mt-6">
            <HiPlus className="h-5 w-5" />
            Create first project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {projects.map((project) => {
            const isExpanded = expandedProjectId === project._id;
            const servicesCount = project.services?.length || 0;

            return (
              <article key={project._id} className="surface p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">Project</p>
                    <h3 className="mt-2 truncate text-2xl font-black text-neutral-950">{project.name}</h3>
                    <p className="mt-2 font-mono text-xs text-stone-500">ID: {project.projectId}</p>
                  </div>

                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <button
                      onClick={() => setExpandedProjectId(isExpanded ? null : project._id)}
                      className="btn-secondary px-3"
                    >
                      {isExpanded ? <HiChevronUp className="h-4 w-4" /> : <HiChevronDown className="h-4 w-4" />}
                      {isExpanded ? 'Collapse' : 'View Services'}
                    </button>
                    <button
                      onClick={() => handleDeleteProject(project.projectId)}
                      disabled={servicesCount > 0}
                      className="btn-danger px-3"
                      title={servicesCount > 0 ? 'Remove services first' : 'Delete project'}
                    >
                      <HiTrash className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="surface-muted p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">Services</p>
                    <p className="mt-2 text-3xl font-black text-neutral-950">{servicesCount}</p>
                  </div>
                  <div className="surface-muted p-4">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-stone-500">State</p>
                    <p className="mt-2 text-sm font-black text-neutral-950">
                      {servicesCount > 0 ? 'Active workspace' : 'Ready for first service'}
                    </p>
                  </div>
                </div>

                {servicesCount > 0 && (
                  <p className="mt-4 text-xs font-semibold text-stone-500">Delete disabled until all services are removed.</p>
                )}

                {isExpanded && (
                  <div className="mt-6 border-t border-stone-200 pt-5">
                    <div className="flex items-center justify-between gap-4">
                      <h4 className="text-sm font-black uppercase tracking-[0.16em] text-neutral-700">Services in project</h4>
                      <button onClick={() => navigate(`/deploy?projectId=${project._id}`)} className="btn-primary px-3 py-2">
                        <HiPlus className="h-4 w-4" />
                        Deploy here
                      </button>
                    </div>

                    {servicesCount === 0 ? (
                      <p className="mt-4 rounded-lg border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-600">
                        No services added yet.
                      </p>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {project.services.map((service) => (
                          <button
                            key={service._id}
                            onClick={() => navigate(`/services/${service._id}`)}
                            className="flex w-full items-center justify-between gap-4 rounded-lg border border-black/10 bg-white p-4 text-left transition hover:border-teal-300 hover:bg-teal-50"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-neutral-950">{service.name}</p>
                              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                                Branch: {service.gitBranch || 'main'}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <StatusBadge status={service.status || 'pending'} />
                              <HiArrowRight className="h-4 w-4 text-teal-700" />
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
