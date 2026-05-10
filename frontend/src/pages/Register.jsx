import React, { useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  HiArrowLeft,
  HiArrowRight,
  HiCheckCircle,
  HiOutlineEnvelope,
  HiOutlineSparkles,
} from 'react-icons/hi2';
import { AuthContext } from '../contexts/AuthContext';
import api from '../utils/api';

const authImage =
  'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1400&q=80';

const steps = ['Account', 'Profile', 'Verify'];

export default function Register() {
  const navigate = useNavigate();
  const { login } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    otp: '',
  });

  const handleResendOTP = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await api.post('/users/register', {
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
      });

      setSuccess('New OTP sent to your email.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (step === 1) {
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      setLoading(true);

      try {
        await api.post('/users/register', {
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
        });

        setSuccess('OTP sent to your email. Please check your inbox.');
        setStep(3);
      } catch (err) {
        setError(err.response?.data?.message || 'Registration failed');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (step === 3) {
      if (!formData.otp || formData.otp.length !== 6) {
        setError('Please enter a valid 6-digit OTP');
        return;
      }

      setLoading(true);

      try {
        const response = await api.post('/users/verify', {
          email: formData.email,
          otp: formData.otp,
        });

        setSuccess('Account created and logged in successfully. Redirecting to dashboard...');
        if (response.data.user) {
          login(response.data.user);
        }
        setTimeout(() => navigate('/dashboard'), 1200);
      } catch (err) {
        setError(err.response?.data?.message || 'OTP verification failed');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 bg-[#f8f7f2] lg:grid-cols-[1.05fr_0.95fr]">
      <main className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-lg">
          <Link to="/" className="mb-10 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-neutral-950 text-white">
              <HiOutlineSparkles className="h-5 w-5" />
            </span>
            <span className="text-lg font-black text-neutral-950">Deploy</span>
          </Link>

          <div>
            <p className="page-kicker">Create account</p>
            <h1 className="page-title">
              {step === 1 ? 'Start your deploy workspace.' : step === 2 ? 'Finish your profile.' : 'Verify your email.'}
            </h1>
            <p className="page-copy">Three quick steps and you are ready to launch services from GitHub.</p>
          </div>

          <div className="mt-7 grid grid-cols-3 gap-2">
            {steps.map((label, index) => {
              const active = step === index + 1;
              const complete = step > index + 1;
              return (
                <div
                  key={label}
                  className={`rounded-lg border px-3 py-2 text-xs font-black uppercase tracking-[0.14em] ${
                    active || complete
                      ? 'border-teal-300 bg-teal-50 text-teal-800'
                      : 'border-stone-200 bg-white text-stone-400'
                  }`}
                >
                  {complete ? 'Done' : label}
                </div>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} className="surface mt-5 p-6">
            {error && <div className="alert-error mb-5">{error}</div>}
            {success && <div className="alert-success mb-5">{success}</div>}

            {step === 1 ? (
              <>
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

                <div className="mt-5">
                  <label className="field-label">Confirm Password</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    placeholder="********"
                    className="field-input"
                  />
                </div>
              </>
            ) : step === 2 ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label className="field-label">First Name</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="Ada"
                    className="field-input"
                  />
                </div>

                <div>
                  <label className="field-label">Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Lovelace"
                    className="field-input"
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 text-center">
                  <HiOutlineEnvelope className="mx-auto h-7 w-7 text-teal-700" />
                  <p className="mt-3 text-sm font-semibold text-stone-700">We sent a 6-digit code to</p>
                  <p className="mt-1 font-black text-teal-800">{formData.email}</p>
                </div>

                <div className="mt-5">
                  <label className="field-label">Verification Code</label>
                  <input
                    type="text"
                    name="otp"
                    value={formData.otp}
                    onChange={handleChange}
                    required
                    placeholder="123456"
                    maxLength="6"
                    className="field-input text-center text-lg font-black tracking-[0.4em]"
                  />
                </div>
              </>
            )}

            <button type="submit" disabled={loading} className="btn-primary mt-6 w-full">
              {step === 3 ? <HiCheckCircle className="h-5 w-5" /> : <HiArrowRight className="h-5 w-5" />}
              {loading
                ? step === 2
                  ? 'Sending...'
                  : step === 3
                  ? 'Verifying...'
                  : 'Creating...'
                : step === 1
                ? 'Continue'
                : step === 2
                ? 'Send Verification Code'
                : 'Verify and Create Account'}
            </button>

            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="btn-secondary mt-3 w-full"
              >
                <HiArrowLeft className="h-4 w-4" />
                Back
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                onClick={handleResendOTP}
                disabled={loading}
                className="mt-3 w-full rounded-lg border border-transparent px-5 py-2.5 text-sm font-bold text-stone-600 transition hover:bg-stone-100 hover:text-neutral-950 disabled:text-stone-400"
              >
                Resend Code
              </button>
            )}

            <p className="mt-6 text-center text-sm text-stone-600">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="font-black text-teal-700 hover:text-teal-900"
              >
                Sign in
              </button>
            </p>
          </form>
        </div>
      </main>

      <section
        className="relative hidden overflow-hidden bg-cover bg-center lg:block"
        style={{ backgroundImage: `url(${authImage})` }}
      >
        <div className="absolute inset-0 bg-neutral-950/[0.66]" />
        <div className="relative flex h-full flex-col justify-end p-10 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-100">Your deploy stack</p>
          <h2 className="mt-4 max-w-xl text-5xl font-black tracking-tight">Projects, services, logs, and env vars in one lovely place.</h2>
          <p className="mt-5 max-w-md text-sm leading-6 text-stone-200">
            The dashboard is built for the product you already have: repo validation, build commands, static or server deploys, and live release logs.
          </p>
        </div>
      </section>
    </div>
  );
}
