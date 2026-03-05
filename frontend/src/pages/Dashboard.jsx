import React, { useEffect, useState } from 'react';
import { HiArrowRight } from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalServices: 0,
    activeDeployments: 0,
    totalDeployments: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [servicesRes] = await Promise.all([
        api.get('/services'),
      ]);

      const services = servicesRes.data.data || [];
      const activeDeployments = services.filter(
        (s) => s.status === 'deploying' || s.status === 'running'
      ).length;

      setStats({
        totalServices: services.length,
        activeDeployments,
        totalDeployments: services.length,
      });
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Services',
      value: stats.totalServices,
      color: 'from-blue-500 to-blue-600',
    },
    {
      title: 'Active Deployments',
      value: stats.activeDeployments,
      color: 'from-green-500 to-green-600',
    },
    {
      title: 'Total Deployments',
      value: stats.totalDeployments,
      color: 'from-purple-500 to-purple-600',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-slate-400 mt-2">Welcome back! Here's your deployment overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {statCards.map((card, index) => (
          <div
            key={index}
            className={`bg-gradient-to-br ${card.color} rounded-lg p-8 text-white relative overflow-hidden`}
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-white bg-opacity-10 rounded-full -mr-16 -mt-16" />
            <div className="relative z-10">
              <p className="text-white text-opacity-80 mb-2">{card.title}</p>
              <h3 className="text-4xl font-bold">{card.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-8">
        <h2 className="text-xl font-semibold text-white mb-6">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => navigate('/github')}
            className="flex items-center justify-between p-4 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors group"
          >
            <div className="text-left">
              <p className="font-medium text-white">Connect GitHub</p>
              <p className="text-sm text-slate-400">Add your GitHub account</p>
            </div>
            <HiArrowRight className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
          </button>

          <button
            onClick={() => navigate('/services')}
            className="flex items-center justify-between p-4 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors group"
          >
            <div className="text-left">
              <p className="font-medium text-white">View Services</p>
              <p className="text-sm text-slate-400">Manage your deployments</p>
            </div>
            <HiArrowRight className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
}
