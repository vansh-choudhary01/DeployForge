import React from 'react';
import { Link } from 'react-router-dom';
import {
  HiArrowRight,
  HiCheckCircle,
  HiCommandLine,
  HiCubeTransparent,
  HiOutlineClock,
  HiOutlineCloudArrowUp,
  HiOutlineCpuChip,
  HiOutlineShieldCheck,
  HiServerStack,
} from 'react-icons/hi2';

const heroImage =
  'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=2400&q=82';

const features = [
  {
    icon: HiOutlineCloudArrowUp,
    title: 'Deploy from GitHub',
    text: 'Validate public repositories, choose a branch, and ship server or static workloads from one clean flow.',
  },
  {
    icon: HiServerStack,
    title: 'Service control',
    text: 'Track URLs, ports, regions, health checks, runtime commands, and project ownership without losing context.',
  },
  {
    icon: HiCommandLine,
    title: 'Live build logs',
    text: 'Follow deployment output in real time with Socket.IO streaming and deployment history for every service.',
  },
  {
    icon: HiOutlineShieldCheck,
    title: 'Cookie auth',
    text: 'Account sessions use HTTP-only cookies, with OTP verification for new users and protected API calls.',
  },
];

const workflow = [
  'Create a project workspace',
  'Validate a GitHub repository',
  'Tune commands and environment variables',
  'Watch the build stream to a live URL',
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <section
        className="relative min-h-[88vh] overflow-hidden bg-cover bg-center"
        style={{ backgroundImage: `url(${heroImage})` }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(7,7,7,0.92)_0%,rgba(7,7,7,0.72)_48%,rgba(7,7,7,0.38)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-neutral-950 to-transparent" />

        <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-white text-neutral-950 shadow-lg">
              <img src="/logo.svg" alt="Deploy Control Room" className="h-6 w-6" />
            </span>
            <span>
              <span className="block text-lg font-black tracking-tight">Deploy</span>
              <span className="block text-xs uppercase tracking-[0.28em] text-teal-200">Control room</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-stone-200 md:flex">
            <a href="#features" className="transition hover:text-white">Features</a>
            <a href="#workflow" className="transition hover:text-white">Workflow</a>
            <a href="#platform" className="transition hover:text-white">Platform</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/login" className="hidden text-sm font-semibold text-white transition hover:text-teal-200 sm:inline">
              Sign in
            </Link>
            <Link to="/register" className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-neutral-950 shadow-lg transition hover:-translate-y-0.5 hover:bg-teal-100">
              Start free
            </Link>
          </div>
        </header>

        <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 pb-20 pt-16 lg:grid-cols-[1.02fr_0.78fr] lg:px-8 lg:pt-24">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/[0.15] bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.22em] text-teal-100 backdrop-blur">
              <HiCubeTransparent className="h-4 w-4" />
              Ship apps without ceremony
            </p>
            <h1 className="mt-6 max-w-4xl text-5xl font-black tracking-tight text-white md:text-7xl">
              Deploy your repos from a beautiful command center.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-200">
              Deploy turns your GitHub repository into a managed service with projects, build commands,
              environment variables, health checks, live logs, and public URLs in one focused interface.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link to="/register" className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-300 px-6 py-3 text-sm font-black text-neutral-950 shadow-xl shadow-teal-950/30 transition hover:-translate-y-0.5 hover:bg-teal-200">
                Create account
                <HiArrowRight className="h-5 w-5" />
              </Link>
              <Link to="/login" className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/[0.18]">
                Open dashboard
              </Link>
            </div>

            <dl className="mt-12 grid max-w-2xl grid-cols-3 gap-4">
              {[
                ['2 modes', 'server + static'],
                ['Live', 'deployment logs'],
                ['OTP', 'email verify'],
              ].map(([value, label]) => (
                <div key={value} className="border-l border-white/20 pl-4">
                  <dt className="text-2xl font-black text-white">{value}</dt>
                  <dd className="mt-1 text-xs uppercase tracking-[0.18em] text-stone-300">{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative hidden self-end lg:block">
            <div className="rounded-lg border border-white/[0.16] bg-neutral-950/[0.78] p-4 shadow-2xl shadow-black/40 backdrop-blur">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-teal-200">Live pipeline</p>
                  <h2 className="mt-1 text-lg font-bold">workflow-test</h2>
                </div>
                <span className="rounded-full bg-emerald-400/[0.16] px-3 py-1 text-xs font-bold text-emerald-200">running</span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3">
                {['Validate', 'Build', 'Publish'].map((step, index) => (
                  <div key={step} className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
                    <div className="flex items-center gap-2 text-sm font-bold">
                      <HiCheckCircle className="h-4 w-4 text-teal-200" />
                      {step}
                    </div>
                    <p className="mt-2 text-xs text-stone-300">0{index + 1}: complete</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-lg bg-black p-4 font-mono text-xs leading-6 text-stone-300">
                <p><span className="text-teal-200">10:21:43</span> cloning repository</p>
                <p><span className="text-teal-200">10:22:11</span> npm install complete</p>
                <p><span className="text-teal-200">10:22:58</span> health check passed</p>
                <p><span className="text-emerald-300">10:23:02</span> success: service is live</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="bg-[#f8f7f2] text-neutral-950">
        <section id="features" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="max-w-2xl">
            <p className="page-kicker">Product details</p>
            <h2 className="page-title">Everything your current backend already knows, surfaced beautifully.</h2>
            <p className="page-copy">
              The interface is built around the project logic: users create projects, deploy services, manage env vars,
              redeploy when needed, and read logs while the worker does its job.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <article key={feature.title} className="surface p-6">
                  <span className="grid h-11 w-11 place-items-center rounded-lg bg-teal-100 text-teal-800">
                    <Icon className="h-6 w-6" />
                  </span>
                  <h3 className="mt-5 text-lg font-black text-neutral-950">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-stone-600">{feature.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="workflow" className="border-y border-black/10 bg-neutral-950 text-white">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 py-20 lg:grid-cols-[0.82fr_1fr] lg:px-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-200">Workflow</p>
              <h2 className="mt-3 text-4xl font-black tracking-tight">From repo URL to running service.</h2>
              <p className="mt-4 text-sm leading-6 text-stone-300">
                The deploy form validates GitHub URLs, separates server and static app settings, parses pasted
                .env files, and sends you straight into a live log stream after deployment starts.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {workflow.map((item, index) => (
                <div key={item} className="rounded-lg border border-white/[0.12] bg-white/[0.06] p-5">
                  <span className="text-xs font-black uppercase tracking-[0.24em] text-teal-200">Step {index + 1}</span>
                  <p className="mt-3 text-lg font-bold">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="platform" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="surface p-7 lg:col-span-2">
              <div className="flex items-center gap-3">
                <HiOutlineCpuChip className="h-7 w-7 text-teal-700" />
                <h2 className="text-2xl font-black">Built for repeatable deployments</h2>
              </div>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-stone-600">
                Manage runtime shape, branch, commands, root directory, build directory, service ports, public URLs,
                and health paths from the same place your team watches deployments.
              </p>
              <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
                {['Project grouping', 'Static hosting', 'Server workloads'].map((item) => (
                  <div key={item} className="surface-muted p-4 text-sm font-bold text-neutral-800">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="surface bg-teal-700 p-7 text-white">
              <HiOutlineClock className="h-8 w-8" />
              <h3 className="mt-6 text-2xl font-black">Ready to ship?</h3>
              <p className="mt-3 text-sm leading-6 text-teal-50">
                Start with a project, connect a repository, and let the dashboard become your deployment home base.
              </p>
              <Link to="/register" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-black text-teal-900 transition hover:bg-teal-50">
                Start deploying
                <HiArrowRight className="h-5 w-5" />
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
