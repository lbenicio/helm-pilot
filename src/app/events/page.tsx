'use client';

import { useEffect, useState, useRef } from 'react';
import { useApp } from '@/contexts/AppContext';
import { Activity, Terminal, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Event {
  id: string;
  timestamp: string;
  type: 'helm' | 'k8s';
  severity: 'info' | 'warning' | 'error' | 'success';
  category: string;
  message: string;
  user?: string;
}

function EventRow({ event }: { event: Event }) {
  const time = new Date(event.timestamp).toLocaleTimeString();
  const severityColor = {
    info: 'text-slate-400 dark:text-slate-500',
    warning: 'text-amber-500 dark:text-amber-400',
    error: 'text-rose-500 dark:text-rose-400',
    success: 'text-emerald-500 dark:text-emerald-400',
  }[event.severity];

  const severityBg = {
    info: 'bg-slate-100 dark:bg-slate-800',
    warning: 'bg-amber-50 dark:bg-amber-950/20',
    error: 'bg-rose-50 dark:bg-rose-950/20',
    success: 'bg-emerald-50 dark:bg-emerald-950/20',
  }[event.severity];

  return (
    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
      className={`flex items-start gap-3 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 ${severityBg} hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors`}>
      <span className={`text-[10px] font-mono shrink-0 mt-0.5 w-16 ${severityColor}`}>{time}</span>
      <span className={`text-[10px] font-bold uppercase shrink-0 w-16 ${severityColor}`}>{event.severity}</span>
      <span className="text-[10px] uppercase shrink-0 w-12 text-slate-400">{event.type}</span>
      <span className="text-[11px] text-slate-700 dark:text-slate-300 flex-1">{event.message}</span>
      <span className="text-[10px] text-slate-400 shrink-0 hidden lg:block">{event.user || '—'}</span>
    </motion.div>
  );
}

export default function EventsPage() {
  const { activeCluster } = useApp();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchEvents = async () => {
    try {
      const headers: any = {};
      if (activeCluster) {
        headers['x-k8s-api-url'] = activeCluster.apiUrl;
        if (activeCluster.token) headers['x-k8s-token'] = activeCluster.token;
        if (activeCluster.caCert) headers['x-k8s-ca-cert'] = activeCluster.caCert;
      }
      const res = await fetch('/api/k8s/activity', { headers });
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
        setError(null);
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Failed to fetch events');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, [activeCluster]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchEvents, 10000);
    return () => clearInterval(interval);
  }, [activeCluster, autoRefresh]);

  const errorCount = events.filter(e => e.severity === 'error').length;
  const warningCount = events.filter(e => e.severity === 'warning').length;
  const successCount = events.filter(e => e.severity === 'success').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" />Live Event Stream
          </h2>
          <p className="text-[10px] text-slate-400 mt-0.5">Real-time Kubernetes events and Helm operations</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1 text-emerald-500"><span className="w-2 h-2 rounded-full bg-emerald-500" />{successCount}</span>
            <span className="flex items-center gap-1 text-amber-500"><span className="w-2 h-2 rounded-full bg-amber-500" />{warningCount}</span>
            <span className="flex items-center gap-1 text-rose-500"><span className="w-2 h-2 rounded-full bg-rose-500" />{errorCount}</span>
          </div>
          <button onClick={() => setAutoRefresh(!autoRefresh)}
            className={`p-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${autoRefresh ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/30 text-blue-600 dark:text-blue-400' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400'}`}>
            {autoRefresh ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
          </button>
          <button onClick={fetchEvents} disabled={loading}
            className="p-1.5 bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-lg text-slate-500 hover:text-slate-700 transition cursor-pointer">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-xl p-6 text-center">
          <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
          <button onClick={fetchEvents} className="mt-2 px-3 py-1.5 bg-rose-100 dark:bg-rose-900/30 text-xs font-semibold text-rose-700 dark:text-rose-300 rounded-lg">Retry</button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <span className="w-16">Time</span>
            <span className="w-16">Level</span>
            <span className="w-12">Type</span>
            <span className="flex-1">Message</span>
            <span className="hidden lg:block">Source</span>
          </div>
          <div ref={containerRef} className="divide-y divide-slate-50 dark:divide-slate-800/50 max-h-[calc(100vh-280px)] overflow-y-auto">
            {loading && events.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading events...</div>
            ) : events.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No events found</div>
            ) : (
              <AnimatePresence>
                {events.map(e => <EventRow key={e.id} event={e} />)}
              </AnimatePresence>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
