import React, { useEffect, useState } from 'react';
import { K8sCluster } from '@/types/k8s-cluster.type';
import { HelmRelease } from '@/types/helm-release.type';
import { X, RefreshCw, ChevronLeft, Calendar, Layers, Shield, ShieldCheck, Trash2, RotateCcw, Save, AlertCircle, CheckCircle2, Terminal, Search, ChevronDown, ChevronUp, Info, Clock, Tag, FileText, Code } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ResourceUsageChart from './ResourceUsageChart';
import AntivirusScanner from './AntivirusScanner';

interface ReleaseDetailsProps {
  name: string;
  namespace: string;
  activeCluster: K8sCluster | null;
  onClose: () => void;
  onRefresh: () => void;
}

export default function ReleaseDetails({
  name,
  namespace,
  activeCluster,
  onClose,
  onRefresh,
}: ReleaseDetailsProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'values' | 'manifest' | 'security'>('overview');
  const [release, setRelease] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Revision history timeline and search state
  const [expandedRevision, setExpandedRevision] = useState<number | null>(null);
  const [expandedTab, setExpandedTab] = useState<'metadata' | 'values' | 'notes' | 'manifest'>('metadata');
  const [historySearch, setHistorySearch] = useState('');
  const [historySort, setHistorySort] = useState<'desc' | 'asc'>('desc');

  // Edit / Upgrade values
  const [valuesYaml, setValuesYaml] = useState('');
  const [upgrading, setUpgrading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    fetchReleaseDetail();
  }, [name, namespace]);

  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      fetchReleaseDetail(true);
    }, 30000); // 30-second polling for resources & status

    return () => clearInterval(interval);
  }, [name, namespace, autoRefresh]);

  const fetchReleaseDetail = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    if (!silent) {
      setActionSuccess(null);
      setActionError(null);
    }

    const headers: any = {};
    if (activeCluster) {
      headers['x-k8s-api-url'] = activeCluster.apiUrl;
      if (activeCluster.token) headers['x-k8s-token'] = activeCluster.token;
      if (activeCluster.caCert) headers['x-k8s-ca-cert'] = activeCluster.caCert;
    }

    try {
      const res = await fetch(`/api/k8s/releases/${namespace}/${name}`, { headers });
      const data = await res.json();
      if (res.ok) {
        setRelease(data);
        setValuesYaml(prev => prev === '' ? (data.values || '') : prev);
      } else {
        setError(data.error || 'Failed to load release detail.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error loading release.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleRollback = async (revision: number) => {
    if (!confirm(`Are you sure you want to roll back "${name}" to revision v${revision}?`)) return;

    setActionSuccess(null);
    setActionError(null);

    const headers: any = { 'Content-Type': 'application/json' };
    if (activeCluster) {
      headers['x-k8s-api-url'] = activeCluster.apiUrl;
      if (activeCluster.token) headers['x-k8s-token'] = activeCluster.token;
      if (activeCluster.caCert) headers['x-k8s-ca-cert'] = activeCluster.caCert;
    }

    try {
      const res = await fetch(`/api/k8s/releases/${namespace}/${name}/rollback`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ revision }),
      });
      const data = await res.json();

      if (res.ok) {
        setActionSuccess(data.message || `Successfully rolled back to v${revision}`);
        onRefresh();
        fetchReleaseDetail();
      } else {
        setActionError(data.error || 'Rollback failed.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Connection error.');
    }
  };

  const handleUninstall = async () => {
    if (!confirm(`CRITICAL ACTION: Are you sure you want to completely uninstall and delete "${name}"? This deletes all history and resources.`)) return;

    setActionSuccess(null);
    setActionError(null);

    const headers: any = {};
    if (activeCluster) {
      headers['x-k8s-api-url'] = activeCluster.apiUrl;
      if (activeCluster.token) headers['x-k8s-token'] = activeCluster.token;
      if (activeCluster.caCert) headers['x-k8s-ca-cert'] = activeCluster.caCert;
    }

    try {
      const res = await fetch(`/api/k8s/releases/${namespace}/${name}/uninstall`, {
        method: 'POST',
        headers,
      });
      const data = await res.json();

      if (res.ok) {
        setActionSuccess(data.message || 'Release uninstalled successfully.');
        setTimeout(() => {
          onRefresh();
          onClose();
        }, 1500);
      } else {
        setActionError(data.error || 'Uninstall failed.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Connection error.');
    }
  };

  const handleUpgradeValues = async () => {
    setUpgrading(true);
    setActionSuccess(null);
    setActionError(null);

    const headers: any = { 'Content-Type': 'application/json' };
    if (activeCluster) {
      headers['x-k8s-api-url'] = activeCluster.apiUrl;
      if (activeCluster.token) headers['x-k8s-token'] = activeCluster.token;
      if (activeCluster.caCert) headers['x-k8s-ca-cert'] = activeCluster.caCert;
    }

    try {
      const res = await fetch('/api/k8s/releases/install', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name,
          namespace,
          chartName: release.chartName,
          chartVersion: release.chartVersion,
          valuesYaml,
          isUpgrade: true,
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setActionSuccess(data.message || 'Release upgraded successfully.');
        onRefresh();
        fetchReleaseDetail();
      } else {
        setActionError(data.error || 'Failed to upgrade values.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Network error updating values.');
    } finally {
      setUpgrading(false);
    }
  };

  const handleRestart = async () => {
    if (!confirm(`Restart all pods for "${name}"? This will trigger a rolling restart.`)) return;

    setActionSuccess(null);
    setActionError(null);

    const headers: any = {};
    if (activeCluster) {
      headers['x-k8s-api-url'] = activeCluster.apiUrl;
      if (activeCluster.token) headers['x-k8s-token'] = activeCluster.token;
      if (activeCluster.caCert) headers['x-k8s-ca-cert'] = activeCluster.caCert;
    }

    try {
      const res = await fetch(`/api/k8s/releases/${namespace}/${name}/restart`, { method: 'POST', headers });
      const data = await res.json();
      if (res.ok) {
        setActionSuccess(data.message || 'Restart triggered.');
        fetchReleaseDetail();
      } else {
        setActionError(data.error || 'Restart failed.');
      }
    } catch (err: any) {
      setActionError(err.message || 'Connection error.');
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-xl p-20 flex flex-col items-center justify-center space-y-4 shadow-sm">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-slate-400">Querying release database & logs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-xl p-10 text-center space-y-4 shadow-sm">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <h3 className="font-semibold text-slate-900 dark:text-white">Failed to Load Release</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">{error}</p>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
        >
          Back to List
        </button>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98, y: 15 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 220 }}
      className="bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-xl overflow-hidden flex flex-col font-sans select-none shadow-sm text-[#1A1A1A] dark:text-slate-100"
    >
      {/* Title Header */}
      <div className="p-6 border-b border-[#E1E4E8] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer md:hidden"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white capitalize">{release.name}</h2>
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                release.status === 'deployed'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-rose-100 text-rose-800'
              }`}>
                {release.status}
              </span>

              {/* K8s Workload Status Badge */}
              <span 
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase transition border ${
                  release.k8sStatus === 'healthy'
                    ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30'
                    : release.k8sStatus === 'warning'
                    ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-900/30'
                    : 'bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900/30'
                }`}
                title={release.k8sStatusReason || 'Kubernetes workload health'}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${
                  release.k8sStatus === 'healthy'
                    ? 'bg-emerald-500'
                    : release.k8sStatus === 'warning'
                    ? 'bg-rose-500 animate-pulse'
                    : 'bg-amber-500 animate-pulse'
                }`} />
                K8s: {release.k8sStatus || 'healthy'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Namespace: <b className="text-slate-700 dark:text-slate-200">{release.namespace}</b> &bull; Chart: <b className="text-slate-700 dark:text-slate-200">{release.chartName}-{release.chartVersion}</b>
              {release.k8sStatusReason && (
                <span className="block mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                  Status: <span className="font-semibold text-slate-600 dark:text-slate-300">{release.k8sStatusReason}</span>
                  {release.podCounts && release.podCounts.total > 0 && (
                    <span className="ml-1 text-slate-400">
                      ({release.podCounts.running}/{release.podCounts.total} pods ready)
                    </span>
                  )}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition cursor-pointer shadow-sm ${
              autoRefresh 
                ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30 text-blue-600 dark:text-blue-400 font-bold' 
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
            title={autoRefresh ? 'Click to disable 30-second auto-refresh' : 'Click to enable 30-second auto-refresh'}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-blue-500 animate-ping' : 'bg-slate-400'}`} />
            {autoRefresh ? 'Auto-Refresh (30s)' : 'Auto-Refresh Off'}
          </button>

          <button
            onClick={() => fetchReleaseDetail(false)}
            className="p-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg border border-[#E1E4E8] dark:border-slate-700 transition cursor-pointer shadow-sm"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleUninstall}
            className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 hover:text-rose-800 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Uninstall
          </button>
          <button
            onClick={handleRestart}
            className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 hover:text-amber-800 text-xs font-semibold rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Restart
          </button>
          <button
            onClick={onClose}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-200 text-xs font-semibold rounded-lg transition hidden md:block cursor-pointer shadow-sm"
          >
            Back
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E1E4E8] dark:border-slate-700 px-6 bg-slate-50 dark:bg-slate-800/50 overflow-x-auto">
        {(['overview', 'history', 'values', 'manifest', 'security'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`py-3.5 px-4 text-xs font-bold capitalize border-b-2 -mb-px transition cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {tab === 'security' && <Shield className={`w-3.5 h-3.5 ${activeTab === 'security' ? 'text-blue-600 dark:text-blue-400 animate-pulse' : 'text-slate-400'}`} />}
            <span>
              {tab === 'values' ? 'values.yaml' : tab === 'security' ? 'Antivírus Scan' : tab}
            </span>
          </button>
        ))}
      </div>

      {/* Action alerts */}
      {actionSuccess && (
        <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 rounded-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 rounded-lg">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Tab Panels */}
      <div className="p-6 overflow-y-auto max-h-[60vh]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Notes and Specs */}
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 font-bold text-xs text-slate-700 dark:text-slate-200 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 pb-2">
                <Terminal className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                Release Notes (NOTES.txt)
              </div>
              <pre className="text-xs text-slate-700 dark:text-slate-200 font-mono whitespace-pre-wrap leading-relaxed select-text">
                {release.notes || 'No deployment notes available for this chart.'}
              </pre>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 rounded-lg text-center">
                <span className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold mb-1">Active Revision</span>
                <span className="text-xl font-bold text-slate-900 dark:text-white font-mono">v{release.revision}</span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 rounded-lg text-center">
                <span className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold mb-1">App Version</span>
                <span className="text-xl font-bold text-slate-700 dark:text-slate-200 font-mono">{release.appVersion || 'N/A'}</span>
              </div>
            </div>

            {/* Recharts live CPU/Memory utilization chart */}
            <ResourceUsageChart name={name} namespace={namespace} activeCluster={activeCluster} />

          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            {/* Timeline header and filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-500" />
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Revision History Timeline
                </h3>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold">
                  {(release.history || []).length} total
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search input */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Search past revisions..."
                    className="pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-44 transition"
                  />
                </div>

                {/* Sort toggle */}
                <button
                  onClick={() => setHistorySort(prev => prev === 'desc' ? 'asc' : 'desc')}
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 transition flex items-center gap-1 cursor-pointer"
                  title={historySort === 'desc' ? 'Showing Newest First' : 'Showing Oldest First'}
                >
                  <Clock className="w-3.5 h-3.5" />
                  {historySort === 'desc' ? 'Newest First' : 'Oldest First'}
                </button>
              </div>
            </div>

            {/* Empty state when filtering */}
            {(() => {
              const filteredHistory = (release?.history || [])
                .filter((rev: any) => {
                  if (!historySearch) return true;
                  const query = historySearch.toLowerCase();
                  return (
                    `v${rev.revision}`.includes(query) ||
                    rev.revision.toString().includes(query) ||
                    rev.status.toLowerCase().includes(query) ||
                    (rev.chart && rev.chart.toLowerCase().includes(query)) ||
                    (rev.chartName && rev.chartName.toLowerCase().includes(query)) ||
                    (rev.description && rev.description.toLowerCase().includes(query))
                  );
                })
                .sort((a: any, b: any) => {
                  return historySort === 'desc' 
                    ? b.revision - a.revision 
                    : a.revision - b.revision;
                });

              if (filteredHistory.length === 0) {
                return (
                  <div className="text-center py-12 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                    <AlertCircle className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
                    <p className="text-xs text-slate-500 dark:text-slate-400">No revisions found matching "{historySearch}"</p>
                    <button
                      onClick={() => setHistorySearch('')}
                      className="text-xs text-blue-600 font-semibold hover:underline"
                    >
                      Clear search filter
                    </button>
                  </div>
                );
              }

              return (
                <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-3 pl-6 space-y-6 py-2">
                  {filteredHistory.map((rev: any) => {
                    const isCurrentActive = rev.revision === release.revision;
                    const isExpanded = expandedRevision === rev.revision;

                    return (
                      <div key={rev.revision} className="relative group">
                        {/* Timeline Bullet */}
                        <div className={`absolute -left-[31px] top-4 w-3.5 h-3.5 rounded-full border-2 transition-all ${
                          isCurrentActive
                            ? 'bg-blue-600 border-blue-600 ring-4 ring-blue-100 dark:ring-blue-950 scale-110'
                            : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700'
                        }`} />

                        {/* Revision Card */}
                        <div className={`border rounded-xl shadow-sm transition overflow-hidden bg-white dark:bg-slate-900 ${
                          isCurrentActive
                            ? 'border-blue-300 dark:border-blue-900/60'
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}>
                          {/* Card Header */}
                          <div 
                            onClick={() => {
                              if (isExpanded) {
                                setExpandedRevision(null);
                              } else {
                                setExpandedRevision(rev.revision);
                                setExpandedTab('metadata');
                              }
                            }}
                            className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                  Revision v{rev.revision}
                                </span>
                                {isCurrentActive && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40 uppercase tracking-wider">
                                    Current Active
                                  </span>
                                )}
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wider ${
                                  rev.status === 'deployed'
                                    ? 'bg-emerald-50 border-emerald-100 text-emerald-700 dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400'
                                    : rev.status === 'superseded'
                                    ? 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-800/30 dark:border-slate-700 dark:text-slate-400'
                                    : 'bg-rose-50 border-rose-100 text-rose-700 dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-400'
                                }`}>
                                  {rev.status}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                                {rev.description || 'No description provided.'}
                              </p>
                              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(rev.updated).toLocaleString()}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end md:self-auto">
                              {!isCurrentActive && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRollback(rev.revision);
                                  }}
                                  className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white text-[10px] font-semibold rounded-lg transition flex items-center gap-1 cursor-pointer shadow-sm"
                                  title={`Rollback to revision v${rev.revision}`}
                                >
                                  <RotateCcw className="w-3 h-3 text-blue-600" />
                                  Rollback
                                </button>
                              )}
                              <span className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded">
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </span>
                            </div>
                          </div>

                          {/* Card Expanded Detail Panels */}
                          {isExpanded && (
                            <div className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20">
                              {/* Expanded Tabs */}
                              <div className="flex border-b border-slate-200 dark:border-slate-800/80 px-4">
                                {([
                                  { id: 'metadata', label: 'Metadata', icon: Info },
                                  { id: 'values', label: 'values.yaml', icon: FileText },
                                  { id: 'notes', label: 'NOTES.txt', icon: Terminal },
                                  { id: 'manifest', label: 'Manifest', icon: Code },
                                ] as const).map((subTab) => {
                                  const Icon = subTab.icon;
                                  return (
                                    <button
                                      key={subTab.id}
                                      onClick={() => setExpandedTab(subTab.id)}
                                      className={`py-2.5 px-3.5 text-[11px] font-bold border-b-2 -mb-px transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                                        expandedTab === subTab.id
                                          ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                                          : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                                      }`}
                                    >
                                      <Icon className="w-3.5 h-3.5" />
                                      {subTab.label}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Expanded Tab Content */}
                              <div className="p-4">
                                {expandedTab === 'metadata' && (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                    <div className="space-y-3 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                                      <h4 className="font-bold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider">
                                        Release Specifications
                                      </h4>
                                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                                        <div className="text-slate-400">Chart Name</div>
                                        <div className="font-semibold text-slate-700 dark:text-slate-200 font-mono flex items-center gap-1">
                                          <Tag className="w-3 h-3 text-slate-400" />
                                          {rev.chartName || 'N/A'}
                                        </div>

                                        <div className="text-slate-400">Chart Version</div>
                                        <div className="font-semibold text-slate-700 dark:text-slate-200 font-mono">
                                          v{rev.chartVersion || 'N/A'}
                                        </div>

                                        <div className="text-slate-400">App Version</div>
                                        <div className="font-semibold text-slate-700 dark:text-slate-200 font-mono">
                                          {rev.appVersion || 'N/A'}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="space-y-3 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                                      <h4 className="font-bold text-slate-500 dark:text-slate-400 text-[10px] uppercase tracking-wider">
                                        Deployment Transaction
                                      </h4>
                                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                                        <div className="text-slate-400">Revision Number</div>
                                        <div className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                                          v{rev.revision}
                                        </div>

                                        <div className="text-slate-400">Transaction Status</div>
                                        <div>
                                          <span className="font-semibold text-slate-700 dark:text-slate-200 capitalize">
                                            {rev.status}
                                          </span>
                                        </div>

                                        <div className="text-slate-400">Completed At</div>
                                        <div className="text-slate-600 dark:text-slate-300 font-mono">
                                          {new Date(rev.updated).toLocaleString()}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {expandedTab === 'values' && (
                                  <div className="space-y-1.5">
                                    <div className="text-[10px] text-slate-400 italic">
                                      Helm release values.yaml for revision v{rev.revision}
                                    </div>
                                    <pre className="p-3 bg-slate-100 dark:bg-slate-950 text-[10px] font-mono rounded border border-slate-200 dark:border-slate-800 max-h-64 overflow-y-auto whitespace-pre select-text text-slate-700 dark:text-slate-300 leading-relaxed">
                                      {rev.values || '# No custom values configured for this revision.'}
                                    </pre>
                                  </div>
                                )}

                                {expandedTab === 'notes' && (
                                  <div className="space-y-1.5">
                                    <div className="text-[10px] text-slate-400 italic">
                                      Deployment notes (NOTES.txt) of revision v{rev.revision}
                                    </div>
                                    <pre className="p-3 bg-slate-100 dark:bg-slate-950 text-[10px] font-mono rounded border border-slate-200 dark:border-slate-800 max-h-64 overflow-y-auto whitespace-pre-wrap select-text text-slate-700 dark:text-slate-300 leading-relaxed">
                                      {rev.notes || 'No deployment notes recorded for this revision.'}
                                    </pre>
                                  </div>
                                )}

                                {expandedTab === 'manifest' && (
                                  <div className="space-y-1.5">
                                    <div className="text-[10px] text-slate-400 italic">
                                      Compiled Kubernetes manifests for revision v{rev.revision}
                                    </div>
                                    <pre className="p-3 bg-slate-100 dark:bg-slate-950 text-[9px] font-mono rounded border border-slate-200 dark:border-slate-800 max-h-64 overflow-y-auto whitespace-pre select-text text-slate-700 dark:text-slate-300 leading-normal">
                                      {rev.manifest || '# No manifest templates recorded for this revision.'}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {activeTab === 'values' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#E1E4E8] dark:border-slate-700 pb-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Live configuration for this release. Editing values will deploy a new upgrade revision.
              </p>
              <button
                onClick={handleUpgradeValues}
                disabled={upgrading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-xs font-semibold text-white rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                {upgrading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Upgrade Release
              </button>
            </div>

            <textarea
              value={valuesYaml}
              onChange={(e) => setValuesYaml(e.target.value)}
              rows={15}
              className="w-full bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-lg p-4 text-xs text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition leading-relaxed"
            />
          </div>
        )}

        {activeTab === 'manifest' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#E1E4E8] dark:border-slate-700 pb-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">Compiled Kubernetes resource manifests compiled by Helm template.</span>
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                Authorized Manifest
              </span>
            </div>

            <pre className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 text-xs text-slate-700 dark:text-slate-200 font-mono overflow-x-auto leading-relaxed select-text whitespace-pre">
              {release.manifest || '# No manifest output generated.'}
            </pre>
          </div>
        )}

            {activeTab === 'security' && (
              <AntivirusScanner 
                manifest={release?.manifest || ''} 
                releaseName={name} 
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
