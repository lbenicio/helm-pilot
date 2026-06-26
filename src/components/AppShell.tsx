'use client';

import { useEffect } from 'react';

import { useApp } from '@/contexts/AppContext';

import Header from './Header';
import LoginScreen from './LoginScreen';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { session, loadingSession, checkSession } = useApp();

  useEffect(() => {
    checkSession();
  }, []);

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-[#F4F5F7] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Starting...</p>
      </div>
    );
  }

  if (!session || !session.authenticated) {
    return <LoginScreen onLoginSuccess={checkSession} />;
  }

  return (
    <div className="min-h-screen bg-[#F4F5F7] dark:bg-slate-900 text-[#1A1A1A] dark:text-slate-200 flex flex-col font-sans select-none pb-12 transition-colors duration-200">
      <Header />
      <main className="px-6 md:px-8 mt-8 w-full flex-1">{children}</main>
    </div>
  );
}
