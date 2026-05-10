import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { HiArrowRight, HiOutlineLockClosed, HiOutlineSparkles } from 'react-icons/hi2';
import { AuthContext } from '../contexts/AuthContext';
import api from '../utils/api';

const authImage =
  'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1400&q=80';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/users/login', formData);
      if (response.data.user) {
        login(response.data.user);
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 bg-[#f8f7f2] lg:grid-cols-[0.95fr_1.05fr]">
      <section
        className="relative hidden overflow-hidden bg-cover bg-center lg:block"
        style={{ backgroundImage: `url(${authImage})` }}
      >
        <div className="absolute inset-0 bg-neutral-950/[0.72]" />
        <div className="relative flex h-full flex-col justify-between p-10 text-white">
          <Link to="/" className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-lg bg-teal-300 text-neutral-950">
              <HiOutlineSparkles className="h-6 w-6" />
            </span>
            <span>
              <span className="block text-xl font-black">Deploy</span>
              <span className="block text-xs uppercase tracking-[0.24em] text-teal-100">Control room</span>
            </span>
          </Link>

          <div className="max-w-lg">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-100">Welcome back</p>
            <h1 className="mt-4 text-5xl font-black tracking-tight">Ship the next release from your command center.</h1>
            <p className="mt-5 text-sm leading-6 text-stone-200">
              Sign in to manage projects, deploy services, and watch every build stream live.
            </p>
          </div>
        </div>
      </section>

      <main className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-neutral-950 text-white">
              <HiOutlineSparkles className="h-5 w-5" />
            </span>
            <span className="text-lg font-black text-neutral-950">Deploy</span>
          </Link>

          <div>
            <p className="page-kicker">Sign in</p>
            <h2 className="page-title">Open your workspace.</h2>
            <p className="page-copy">Use the account connected to your deployment projects.</p>
          </div>

          <form onSubmit={handleSubmit} className="surface mt-8 p-6">
            {error && <div className="alert-error mb-5">{error}</div>}

            <div>
              <label className="field-label">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="you@example.com"
                className="field-input"
              />
            </div>

            <div className="mt-5">
              <label className="field-label">Password</label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="********"
                className="field-input"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary mt-6 w-full">
              <HiOutlineLockClosed className="h-5 w-5" />
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <p className="mt-6 text-center text-sm text-stone-600">
              Need an account?{' '}
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="font-black text-teal-700 hover:text-teal-900"
              >
                Create one
              </button>
            </p>
          </form>

          <Link to="/" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-stone-600 hover:text-neutral-950">
            Back to landing
            <HiArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}
