import React from 'react';
import { useNavigate } from 'react-router-dom';
import { HiArrowRight, HiOutlineInformationCircle } from 'react-icons/hi2';

const steps = [
  'Open Services and choose New Service',
  'Enter a public GitHub repository URL',
  'Configure build, start, and health commands',
  'Add environment variables if needed',
  'Deploy and follow the live log stream',
];

export default function GithubConnect() {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <p className="page-kicker">GitHub</p>
        <h1 className="page-title">Deploy public repositories.</h1>
        <p className="page-copy">Deploy can validate and launch public GitHub repos without an authentication token.</p>
      </div>

      <div className="surface flex items-start gap-4 p-6">
        <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-lg bg-teal-100 text-teal-800">
          <HiOutlineInformationCircle className="h-6 w-6" />
        </span>
        <div>
          <p className="text-lg font-black text-neutral-950">Public repositories only</p>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Enter the repository URL, select project settings, and Deploy will handle the build path from the deployment form.
          </p>
        </div>
      </div>

      <div className="surface p-7">
        <h2 className="text-2xl font-black text-neutral-950">How to deploy</h2>
        <ol className="mt-6 space-y-4">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-4">
              <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-neutral-950 text-sm font-black text-white">
                {index + 1}
              </span>
              <span className="pt-1 text-sm font-semibold text-stone-700">{step}</span>
            </li>
          ))}
        </ol>
        <button onClick={() => navigate('/deploy')} className="btn-primary mt-7">
          Start deploy
          <HiArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
