import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import './tailwind.css';
import { AuthContext, AuthProvider } from './contexts/AuthContext';

// Components
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Seo from './components/Seo';

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
import Landing from './pages/Landing';

function ProtectedLayout({ children }) {
  const { isAuthenticated, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f8f7f2] text-neutral-950">
        <div className="surface px-6 py-5 text-sm font-semibold">Opening your workspace...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-[#f8f7f2]">
      <Sidebar />
      <div className="lg:pl-72">
        <Navbar />
        <main className="min-h-screen px-4 pb-12 pt-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Seo />
        <Routes>
          <Route path="/" element={<Landing />} />

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
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
    </AuthProvider>
  );
}

export default App;
