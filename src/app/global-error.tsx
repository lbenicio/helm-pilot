'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Unhandled error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-[#F4F5F7] dark:bg-slate-900 flex items-center justify-center p-4">
          <div className="text-center space-y-4 max-w-md">
            <AlertTriangle className="w-16 h-16 text-rose-300 dark:text-rose-600 mx-auto" />
            <h1 className="text-6xl font-black text-slate-200 dark:text-slate-700">500</h1>
            <h2 className="text-lg font-bold text-slate-700 dark:text-slate-300">Something went wrong</h2>
            <p className="text-sm text-slate-400">An unexpected error occurred. Please try again.</p>
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-sm font-semibold text-white rounded-lg transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
