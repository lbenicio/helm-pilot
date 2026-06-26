import { ArrowLeft, ShieldAlert } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#F4F5F7] dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="text-center space-y-4 max-w-md">
        <ShieldAlert className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto" />
        <h1 className="text-6xl font-black text-slate-200 dark:text-slate-700">404</h1>
        <h2 className="text-lg font-bold text-slate-700 dark:text-slate-300">Page not found</h2>
        <p className="text-sm text-slate-400">The resource you&apos;re looking for doesn&apos;t exist or has been moved.</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-sm font-semibold text-white rounded-lg transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
