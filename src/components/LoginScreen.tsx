import { ArrowRight, Key, Shield, ShieldCheck, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import React, { useEffect, useState } from 'react';

interface LoginScreenProps {
  onLoginSuccess: () => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [authUrl, setAuthUrl] = useState<string>('');
  const [authType, setAuthType] = useState<'oidc' | 'demo' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/url')
      .then((res) => res.json())
      .then((data) => {
        setAuthUrl(data.url);
        setAuthType(data.type);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to get auth URL:', err);
        setLoading(false);
      });
  }, []);

  const handleLogin = () => {
    if (!authUrl) return;
    window.location.href = authUrl;
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate origin to be safe
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        return;
      }

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        onLoginSuccess();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onLoginSuccess]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F5F7] dark:bg-slate-950 p-4 font-sans select-none relative overflow-hidden transition-colors duration-200">
      {/* Decorative subtle background shapes - animated drift */}
      <motion.div
        animate={{
          scale: [1, 1.1, 0.95, 1],
          x: [0, 30, -20, 0],
          y: [0, -20, 30, 0],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-100 dark:bg-blue-900/20 rounded-full blur-3xl transition-colors duration-200"
      />
      <motion.div
        animate={{
          scale: [1, 0.9, 1.1, 1],
          x: [0, -30, 20, 0],
          y: [0, 30, -20, 0],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-sky-100/50 dark:bg-sky-900/20 rounded-full blur-3xl transition-colors duration-200"
      />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 100 }}
        className="max-w-md w-full bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-800 p-8 rounded-xl shadow-md z-10"
      >
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            whileHover={{ rotate: 10 }}
            transition={{ type: 'spring', damping: 10 }}
            className="inline-flex p-3 bg-blue-50 dark:bg-slate-800 rounded-xl border border-blue-100 dark:border-slate-700 text-blue-600 dark:text-blue-400 mb-4 shadow-inner cursor-pointer"
          >
            <Shield className="w-8 h-8" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mb-2 font-sans"
          >
            Helm Pilot Portal
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="text-sm text-slate-500 dark:text-slate-400"
          >
            A secure full-stack dashboard to browse repositories, track releases, and manage live clusters.
          </motion.p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-3">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-slate-400">Checking auth status...</p>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="space-y-6">
            {authType === 'oidc' ? (
              <motion.button
                id="btn-login-oidc"
                onClick={handleLogin}
                whileHover={{ scale: 1.02, backgroundColor: '#1d4ed8' }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition duration-200 shadow-sm cursor-pointer"
              >
                <Key className="w-5 h-5" />
                Sign in with OIDC Identity
              </motion.button>
            ) : (
              <div className="space-y-4">
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-200 text-xs rounded-xl p-4 leading-relaxed transition-colors duration-200">
                  <div className="flex items-center gap-2 mb-1.5 font-semibold text-amber-900 dark:text-amber-300">
                    <ShieldCheck className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                    Identity Provider Required
                  </div>
                  OIDC identity provider is not configured. Please define OIDC_CLIENT_ID and OIDC_CLIENT_SECRET in the environment variables
                  to continue.
                </div>
              </div>
            )}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
