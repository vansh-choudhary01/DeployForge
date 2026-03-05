import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import './tailwind.css';

// Components
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';

// Pages
import Dashboard from './pages/Dashboard';
import GithubConnect from './pages/GithubConnect';
import Services from './pages/Services';
import ServiceDetails from './pages/ServiceDetails';
import DeploymentLogs from './pages/DeploymentLogs';
import DeployService from './pages/DeployService';
import Projects from './pages/Projects';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';

function ProtectedLayout({ children }) {
  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 ml-64">
        <Navbar />
        <main className="mt-16 p-8 bg-slate-900 min-h-screen">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is authenticated
    const token = localStorage.getItem('authToken');
    setIsAuthenticated(!!token);
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-slate-700 border-t-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Auth Routes */}
        <Route
          path="/login"
          element={
            isAuthenticated ? <Navigate to="/dashboard" /> : <Login />
          }
        />
        <Route
          path="/register"
          element={
            isAuthenticated ? <Navigate to="/dashboard" /> : <Register />
          }
        />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            isAuthenticated ? (
              <ProtectedLayout>
                <Dashboard />
              </ProtectedLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/github"
          element={
            isAuthenticated ? (
              <ProtectedLayout>
                <GithubConnect />
              </ProtectedLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/services"
          element={
            isAuthenticated ? (
              <ProtectedLayout>
                <Services />
              </ProtectedLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/services/:id"
          element={
            isAuthenticated ? (
              <ProtectedLayout>
                <ServiceDetails />
              </ProtectedLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/deploy"
          element={
            isAuthenticated ? (
              <ProtectedLayout>
                <DeployService />
              </ProtectedLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/deployments/:deploymentId/logs"
          element={
            isAuthenticated ? (
              <ProtectedLayout>
                <DeploymentLogs />
              </ProtectedLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/projects"
          element={
            isAuthenticated ? (
              <ProtectedLayout>
                <Projects />
              </ProtectedLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />
        <Route
          path="/settings"
          element={
            isAuthenticated ? (
              <ProtectedLayout>
                <Settings />
              </ProtectedLayout>
            ) : (
              <Navigate to="/login" />
            )
          }
        />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route path="*" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} />} />
      </Routes>
    </Router>
  );
}

export default App;
