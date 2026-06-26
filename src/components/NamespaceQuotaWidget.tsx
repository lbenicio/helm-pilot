import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cpu, HardDrive, Layers, Radio, Shield, RefreshCw, AlertCircle, Info, HelpCircle } from 'lucide-react';
import { K8sCluster } from '@/types/k8s-cluster.type';

interface QuotaItem {
  name: string;
  resource: string;
  limit: number;
  used: number;
  unit: string;
  percentage: number;
}

interface NamespaceQuotaWidgetProps {
  namespace: string;
  activeCluster: K8sCluster | null;
}

export default function NamespaceQuotaWidget({ namespace, activeCluster }: NamespaceQuotaWidgetProps) {
  const [quotas, setQuotas] = useState<QuotaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchQuotas = async () => {
    setLoading(true);
    setError(null);
    setIsRefreshing(true);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (activeCluster) {
      headers['x-k8s-api-url'] = activeCluster.apiUrl;
      if (activeCluster.token) headers['x-k8s-token'] = activeCluster.token;
      if (activeCluster.caCert) {
        headers['x-k8s-ca-cert'] = activeCluster.caCert;
      }
    }

    try {
      const targetNamespace = namespace || 'all';
      const res = await fetch(`/api/k8s/namespaces/${targetNamespace}/quota`, { headers });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to load namespace resource quotas.');
      }
      const data = await res.json();
      setQuotas(data.quotas || []);
    } catch (err: any) {
      console.error('[Quota Widget Error]:', err);
      setError(err.message || 'Failed to connect to cluster to fetch resource limits.');
    } finally {
      setLoading(false);
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  useEffect(() => {
    fetchQuotas();
  }, [namespace, activeCluster]);

  // Color helper based on percentage
  const getProgressColor = (percentage: number) => {
    if (percentage < 50) {
      return 'bg-emerald-500 dark:bg-emerald-400';
    } else if (percentage < 80) {
      return 'bg-amber-500 dark:bg-amber-400';
    } else {
      return 'bg-rose-500 dark:bg-rose-400';
    }
  };

  const getProgressBg = (percentage: number) => {
    if (percentage < 50) {
      return 'bg-emerald-500/10 dark:bg-emerald-500/20';
    } else if (percentage < 80) {
      return 'bg-amber-500/10 dark:bg-amber-500/20';
    } else {
      return 'bg-rose-500/10 dark:bg-rose-500/20';
    }
  };

  const getTextColorClass = (percentage: number) => {
    if (percentage < 50) {
      return 'text-emerald-600 dark:text-emerald-400';
    } else if (percentage < 80) {
      return 'text-amber-600 dark:text-amber-400';
    } else {
      return 'text-rose-600 dark:text-rose-400';
    }
  };

  const getIconForResource = (resource: string) => {
    const css = "w-4 h-4 shrink-0";
    if (resource.includes('cpu')) return <Cpu className={`${css} text-indigo-500`} />;
    if (resource.includes('memory')) return <HardDrive className={`${css} text-blue-500`} />;
    if (resource === 'pods') return <Layers className={`${css} text-violet-500`} />;
    if (resource === 'services') return <Radio className={`${css} text-teal-500`} />;
    return <Shield className={`${css} text-emerald-500`} />;
  };

  const formatValue = (val: number, resource: string) => {
    if (resource.includes('cpu')) {
      if (val >= 1000) {
        return `${(val / 1000).toFixed(1)} Cores`;
      }
      return `${val}m CPU`;
    }
    if (resource.includes('memory')) {
      if (val >= 1024) {
        return `${(val / 1024).toFixed(1)} GiB`;
      }
      return `${Math.round(val)} MiB`;
    }
    return val.toString();
  };

  return (
    <div 
      id="namespace-quota-widget-container" 
      className="bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-800 rounded-xl p-5 shadow-sm transition-colors duration-200"
    >
      <div className="flex items-center justify-between mb-4.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg text-blue-600 dark:text-blue-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider">
              Namespace Quota Limits
            </h3>
            <p className="text-[10px] text-slate-400">
              Active boundaries for: <span className="font-semibold text-slate-600 dark:text-slate-300 capitalize">{namespace || 'all namespaces'}</span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchQuotas}
          disabled={loading || isRefreshing}
          className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-500 dark:text-slate-400 rounded-lg transition disabled:opacity-50 cursor-pointer"
          title="Refresh Quota Metrics"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <AnimatePresence mode="wait">
        {loading && !isRefreshing ? (
          <motion.div 
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3.5 py-2"
          >
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-1.5 animate-pulse">
                <div className="flex justify-between">
                  <div className="h-3 w-28 bg-slate-100 dark:bg-slate-800 rounded" />
                  <div className="h-3 w-16 bg-slate-100 dark:bg-slate-800 rounded" />
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full" />
              </div>
            ))}
          </motion.div>
        ) : error ? (
          <motion.div 
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-3.5 bg-rose-50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30 rounded-lg text-rose-600 dark:text-rose-400 flex items-start gap-2 text-[11px] leading-normal"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold mb-1">Could not fetch quotas</p>
              <p className="text-rose-500/80 mb-2">{error}</p>
              <button
                onClick={fetchQuotas}
                className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 rounded-md font-semibold text-[10px] hover:bg-rose-100/30 transition cursor-pointer"
              >
                Retry Connection
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3.5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5">
              {quotas.map((quota) => (
                <div key={quota.resource} className="space-y-1.5 group">
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      {getIconForResource(quota.resource)}
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {quota.name}
                      </span>
                    </div>
                    <span className="font-mono text-slate-500 dark:text-slate-400 text-[10px]">
                      {formatValue(quota.used, quota.resource)}
                      <span className="text-slate-300 dark:text-slate-600 mx-1">/</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {formatValue(quota.limit, quota.resource)}
                      </span>
                    </span>
                  </div>

                  {/* Progress Bar with state-based color transition and Framer Motion spring */}
                  <div className={`h-2.5 w-full rounded-full overflow-hidden relative ${getProgressBg(quota.percentage)}`}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(quota.percentage, 100)}%` }}
                      transition={{ type: 'spring', damping: 20, stiffness: 100 }}
                      className={`h-full rounded-full transition-colors duration-500 ${getProgressColor(quota.percentage)}`}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[9px]">
                    <span className="text-slate-400 font-mono">
                      {quota.resource}
                    </span>
                    <span className={`font-mono font-bold ${getTextColorClass(quota.percentage)}`}>
                      {quota.percentage}% used
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Explanatory footer info */}
            <div className="mt-1 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-start gap-1.5 text-[9px] text-slate-400">
              <Info className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />
              <p className="leading-normal">
                Quotas set CPU, memory, and controller capacities allowed in the <span className="font-semibold text-slate-600 dark:text-slate-300 capitalize">"{namespace || 'all'}"</span> namespace context. Green means well within limits, turning to orange as resources get tight.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
