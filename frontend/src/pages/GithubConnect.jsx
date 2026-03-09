import React from 'react';
import { HiOutlineInformationCircle } from 'react-icons/hi2';

export default function GithubConnect() {
  return (
    <div className="max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Deploy Public Repositories</h1>
        <p className="text-slate-400 mt-2">
          Deploy your public GitHub repositories directly
        </p>
      </div>

      {/* Info Message */}
      <div className="bg-blue-900 border border-blue-700 rounded-lg p-6 flex items-start gap-4">
        <HiOutlineInformationCircle className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
        <div>
          <p className="text-blue-200 font-medium">Public Repositories Only</p>
          <p className="text-blue-300 text-sm mt-2">
            You can deploy any public GitHub repository by entering the repository owner, name, and branch details in the deployment form. No authentication token is required.
          </p>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-8">
        <h2 className="text-xl font-semibold text-white mb-6">How to Deploy</h2>
        <ol className="space-y-4 text-slate-300">
          <li className="flex gap-4">
            <span className="flex-shrink-0 bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold">1</span>
            <span>Navigate to Services and click "New Service"</span>
          </li>
          <li className="flex gap-4">
            <span className="flex-shrink-0 bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold">2</span>
            <span>Enter the repository details (owner, repo name, branch)</span>
          </li>
          <li className="flex gap-4">
            <span className="flex-shrink-0 bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold">3</span>
            <span>Configure build and start commands</span>
          </li>
          <li className="flex gap-4">
            <span className="flex-shrink-0 bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold">4</span>
            <span>Add environment variables if needed</span>
          </li>
          <li className="flex gap-4">
            <span className="flex-shrink-0 bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold">5</span>
            <span>Click Deploy to start the deployment</span>
          </li>
        </ol>
      </div>
    </div>
  );
}
