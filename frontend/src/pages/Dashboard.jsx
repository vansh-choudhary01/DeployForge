import React, { useEffect, useState } from 'react';
import {
  HiArrowRight,
  HiOutlineBolt,
  HiOutlineCodeBracketSquare,
  HiOutlineRocketLaunch,
  HiOutlineSquares2X2,
} from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import api from '../utils/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalProjects: 0,
    totalServices: 0,
    activeServices: 0,
  });
  const [recentServices, setRecentServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [projectsRes, servicesRes] = await Promise.all([
        api.get('/projects'),
        api.get('/services'),
      ]);

      const projects = projectsRes.data.projects || [];
      const services = servicesRes.data.services || [];
      const activeServices = services.filter(
        (s) => s.status === 'deploying' || s.status === 'running' || s.status === 'building'
      ).length;

      setStats({
        totalProjects: projects.length,
        totalServices: services.length,
        activeServices,
      });

      setRecentServices(
        services
          .slice()
          .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
          .slice(0, 5)
      );
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Projects',
      value: stats.totalProjects,
      detail: 'organized workspaces',
      icon: HiOutlineSquares2X2,
    },
    {
      title: 'Total Services',
      value: stats.totalServices,
      detail: 'connected repositories',
      icon: HiOutlineCodeBracketSquare,
    },
    {
      title: 'Active Services',
      value: stats.activeServices,
      detail: 'running or deploying',
      icon: HiOutlineRocketLaunch,
    },
  ];

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-lg border border-black/10 bg-neutral-950 p-8 text-white shadow-2xl shadow-stone-300/40">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[linear-gradient(120deg,transparent,rgba(45,212,191,0.18))] lg:block" />
        <div className="relative max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-teal-200">Dashboard</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight md:text-5xl">Your deployments, at a glance.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-300">
            Monitor projects, services, and the release activity that matters most. Start a new service or jump back
            into recent deployments from this workspace.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button onClick={() => navigate('/deploy')} className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-300 px-5 py-3 text-sm font-black text-neutral-950 transition hover:-translate-y-0.5 hover:bg-teal-200">
              <HiOutlineRocketLaunch className="h-5 w-5" />
              Deploy service
            </button>
            <button onClick={() => navigate('/projects')} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/[0.15] bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.15]">
              Manage projects
              <HiArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.title} className="surface p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-stone-500">{card.title}</p>
                  <h3 className="mt-3 text-4xl font-black tracking-tight text-neutral-950">{card.value}</h3>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-teal-700">{card.detail}</p>
                </div>
                <span className="grid h-12 w-12 place-items-center rounded-lg bg-teal-100 text-teal-800">
                  <Icon className="h-6 w-6" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_0.78fr]">
        <section className="surface p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="page-kicker">Recent activity</p>
              <h2 className="mt-2 text-2xl font-black text-neutral-950">Latest services</h2>
            </div>
            <button onClick={() => navigate('/services')} className="btn-secondary">
              View all
              <HiArrowRight className="h-4 w-4" />
            </button>
          </div>

          {loading ? (
            <div className="mt-6 space-y-3">
              {[...Array(4)].map((_, index) => (
                <div key={index} className="h-16 animate-pulse rounded-lg bg-stone-100" />
              ))}
            </div>
          ) : recentServices.length === 0 ? (
            <div className="mt-6 rounded-lg border border-dashed border-stone-300 bg-stone-50 p-10 text-center">
              <HiOutlineBolt className="mx-auto h-9 w-9 text-teal-700" />
              <p className="mt-4 text-sm font-semibold text-stone-700">No services yet. Deploy one to get started.</p>
              <button onClick={() => navigate('/deploy')} className="btn-primary mt-5">
                Deploy first service
              </button>
            </div>
          ) : (
            <div className="mt-6 divide-y divide-stone-200">
              {recentServices.map((service) => (
                <button
                  key={service._id}
                  onClick={() => navigate(`/services/${service._id}`)}
                  className="flex w-full items-center justify-between gap-4 py-4 text-left transition hover:bg-stone-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-base font-black text-neutral-950">{service.name}</p>
                    <p className="mt-1 truncate text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                      {service.gitBranch || 'main'} | port {service.port || 'pending'}
                    </p>
                  </div>
                  <StatusBadge status={service.status || 'pending'} />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="surface p-6">
          <p className="page-kicker">Quick actions</p>
          <h2 className="mt-2 text-2xl font-black text-neutral-950">Keep moving</h2>
          <div className="mt-6 space-y-3">
            <button
              onClick={() => navigate('/deploy')}
              className="flex w-full items-center justify-between rounded-lg border border-black/10 bg-neutral-950 p-4 text-left text-white transition hover:-translate-y-0.5 hover:bg-neutral-800"
            >
              <div>
                <p className="font-black">Deploy Service</p>
                <p className="mt-1 text-sm text-stone-300">Configure a new GitHub repo release</p>
              </div>
              <HiArrowRight className="h-5 w-5 text-teal-200" />
            </button>

            <button
              onClick={() => navigate('/projects')}
              className="flex w-full items-center justify-between rounded-lg border border-black/10 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-teal-300 hover:bg-teal-50"
            >
              <div>
                <p className="font-black text-neutral-950">Manage Projects</p>
                <p className="mt-1 text-sm text-stone-600">Organize services and launch from a project</p>
              </div>
              <HiArrowRight className="h-5 w-5 text-teal-700" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
