import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import './tailwind.css';

// Components
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';

// Pages
import Dashboard from './pages/Dashboard';
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
  return (
    <Router>
      <Routes>
        {/* Auth Routes - No Sidebar/Navbar */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Routes - With Sidebar/Navbar */}
        <Route
          path="/dashboard"
          element={
            <ProtectedLayout>
              <Dashboard />
            </ProtectedLayout>
          }
        />
        <Route
          path="/services"
          element={
            <ProtectedLayout>
              <Services />
            </ProtectedLayout>
          }
        />
        <Route
          path="/services/:id"
          element={
            <ProtectedLayout>
              <ServiceDetails />
            </ProtectedLayout>
          }
        />
        <Route
          path="/deploy"
          element={
            <ProtectedLayout>
              <DeployService />
            </ProtectedLayout>
          }
        />
        <Route
          path="/deployments/:deploymentId/logs"
          element={
            <ProtectedLayout>
              <DeploymentLogs />
            </ProtectedLayout>
          }
        />
        <Route
          path="/projects"
          element={
            <ProtectedLayout>
              <Projects />
            </ProtectedLayout>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedLayout>
              <Settings />
            </ProtectedLayout>
          }
        />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;
