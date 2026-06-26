import React, { useEffect, useState } from 'react';
import { K8sCluster } from '@/types/k8s-cluster.type';
import { HelmRelease } from '@/types/helm-release.type';
import { RefreshCw, Search, Layers, Box, AlertCircle, Play, SlidersHorizontal, CheckCircle, HelpCircle, ArrowUpRight, RotateCcw, Trash2, ArrowUpCircle, CheckSquare, Square, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ActivityLog from './ActivityLog';
import ClusterHealthWidget from './ClusterHealthWidget';
import NamespaceQuotaWidget from './NamespaceQuotaWidget';
const noReleasesImg = '/static/images/no_releases.png';

interface DashboardProps {
  activeCluster: K8sCluster | null;
  onSelectRelease: (namespace: string, name: string) => void;
  onBrowseCharts: () => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  selectedNamespace?: string;
  onNamespaceChange?: (namespace: string) => void;
}

export default function Dashboard({
  activeCluster,
  onSelectRelease,
  onBrowseCharts,
  searchQuery: passedSearchQuery,
  onSearchQueryChange,
  selectedNamespace: passedSelectedNamespace,
  onNamespaceChange,
}: DashboardProps) {
  const [releases, setReleases] = useState<HelmRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search/Filters
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const searchQuery = onSearchQueryChange ? (passedSearchQuery ?? '') : localSearchQuery;
  const setSearchQuery = onSearchQueryChange || setLocalSearchQuery;
  const [localNamespace, setLocalNamespace] = useState('all');
  const selectedNamespace = passedSelectedNamespace !== undefined ? passedSelectedNamespace : localNamespace;
  const setSelectedNamespace = onNamespaceChange || setLocalNamespace;

  // Bulk operation states
  const [selectedReleases, setSelectedReleases] = useState<string[]>([]); // "namespace/name"
  const [bulkProgress, setBulkProgress] = useState<{
    active: boolean;
    actionName: string;
    total: number;
    current: number;
    currentReleaseName: string;
    successCount: number;
    errorCount: number;
    logs: string[];
  } | null>(null);

  const toggleSelectRelease = (key: string) => {
    setSelectedReleases(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const toggleSelectAll = (visibleReleases: HelmRelease[]) => {
    const visibleKeys = visibleReleases.map(r => `${r.namespace}/${r.name}`);
    const allSelected = visibleKeys.every(k => selectedReleases.includes(k));
    if (allSelected) {
      setSelectedReleases(prev => prev.filter(k => !visibleKeys.includes(k)));
    } else {
      setSelectedReleases(prev => {
        const newSelection = [...prev];
        visibleKeys.forEach(k => {
          if (!newSelection.includes(k)) {
            newSelection.push(k);
          }
        });
        return newSelection;
      });
    }
  };

  const handleBulkDelete = async () => {
    const selectedList = releases.filter(r => 
      selectedReleases.includes(`${r.namespace}/${r.name}`)
    );
    if (selectedList.length === 0) return;

    const confirmMsg = `CRITICAL ACTION: Are you sure you want to completely uninstall and delete the ${selectedList.length} selected Helm releases? This will delete all deployment history and active resources.`;
    if (!confirm(confirmMsg)) return;

    setBulkProgress({
      active: true,
      actionName: 'Delete',
      total: selectedList.length,
      current: 0,
      currentReleaseName: '',
      successCount: 0,
      errorCount: 0,
      logs: []
    });

    const headers: any = { 'Content-Type': 'application/json' };
    if (activeCluster) {
      headers['x-k8s-api-url'] = activeCluster.apiUrl;
      if (activeCluster.token) headers['x-k8s-token'] = activeCluster.token;
      if (activeCluster.caCert) headers['x-k8s-ca-cert'] = activeCluster.caCert;
    }

    let successes = 0;
    let errors = 0;
    const newLogs: string[] = [];

    for (let i = 0; i < selectedList.length; i++) {
      const rel = selectedList[i];
      setBulkProgress(prev => prev ? {
        ...prev,
        current: i + 1,
        currentReleaseName: `${rel.namespace}/${rel.name}`,
      } : null);

      try {
        const res = await fetch(`/api/k8s/releases/${rel.namespace}/${rel.name}/uninstall`, {
          method: 'POST',
          headers
        });
        const data = await res.json();
        if (res.ok) {
          successes++;
          newLogs.push(`✅ [${rel.namespace}/${rel.name}] Successfully deleted: ${data.message || 'Complete'}`);
        } else {
          errors++;
          newLogs.push(`❌ [${rel.namespace}/${rel.name}] Failed to delete: ${data.error || 'Unknown error'}`);
        }
      } catch (err: any) {
        errors++;
        newLogs.push(`❌ [${rel.namespace}/${rel.name}] Connection error: ${err.message || err}`);
      }

      setBulkProgress(prev => prev ? {
        ...prev,
        successCount: successes,
        errorCount: errors,
        logs: [...newLogs]
      } : null);
    }

    await fetchReleases();
    setSelectedReleases(prev => {
      return prev.filter(k => {
        const failed = newLogs.some(log => log.includes(`❌ [${k}]`));
        return failed;
      });
    });
  };

  const handleBulkRollback = async () => {
    const selectedList = releases.filter(r => 
      selectedReleases.includes(`${r.namespace}/${r.name}`)
    );
    if (selectedList.length === 0) return;

    const invalidRollbacks = selectedList.filter(r => r.revision <= 1);
    if (invalidRollbacks.length > 0) {
      alert(`The following releases cannot be rolled back because they are at revision v1: ${invalidRollbacks.map(r => r.name).join(', ')}`);
    }

    const validList = selectedList.filter(r => r.revision > 1);
    if (validList.length === 0) {
      alert('None of the selected releases can be rolled back (all are at revision v1).');
      return;
    }

    const confirmMsg = `Are you sure you want to roll back the ${validList.length} selected Helm releases to their previous revision?`;
    if (!confirm(confirmMsg)) return;

    setBulkProgress({
      active: true,
      actionName: 'Rollback',
      total: validList.length,
      current: 0,
      currentReleaseName: '',
      successCount: 0,
      errorCount: 0,
      logs: []
    });

    const headers: any = { 'Content-Type': 'application/json' };
    if (activeCluster) {
      headers['x-k8s-api-url'] = activeCluster.apiUrl;
      if (activeCluster.token) headers['x-k8s-token'] = activeCluster.token;
      if (activeCluster.caCert) headers['x-k8s-ca-cert'] = activeCluster.caCert;
    }

    let successes = 0;
    let errors = 0;
    const newLogs: string[] = [];

    for (let i = 0; i < validList.length; i++) {
      const rel = validList[i];
      const prevRevision = rel.revision - 1;
      setBulkProgress(prev => prev ? {
        ...prev,
        current: i + 1,
        currentReleaseName: `${rel.namespace}/${rel.name} (to v${prevRevision})`,
      } : null);

      try {
        const res = await fetch(`/api/k8s/releases/${rel.namespace}/${rel.name}/rollback`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ revision: prevRevision })
        });
        const data = await res.json();
        if (res.ok) {
          successes++;
          newLogs.push(`✅ [${rel.namespace}/${rel.name}] Successfully rolled back to v${prevRevision}`);
        } else {
          errors++;
          newLogs.push(`❌ [${rel.namespace}/${rel.name}] Failed to roll back: ${data.error || 'Unknown error'}`);
        }
      } catch (err: any) {
        errors++;
        newLogs.push(`❌ [${rel.namespace}/${rel.name}] Connection error: ${err.message || err}`);
      }

      setBulkProgress(prev => prev ? {
        ...prev,
        successCount: successes,
        errorCount: errors,
        logs: [...newLogs]
      } : null);
    }

    await fetchReleases();
    setSelectedReleases(prev => {
      return prev.filter(k => {
        const failed = newLogs.some(log => log.includes(`❌ [${k}]`));
        return failed;
      });
    });
  };

  const handleBulkUpgrade = async () => {
    const selectedList = releases.filter(r => 
      selectedReleases.includes(`${r.namespace}/${r.name}`)
    );
    if (selectedList.length === 0) return;

    const confirmMsg = `Are you sure you want to upgrade the ${selectedList.length} selected Helm releases? This will fetch their current configuration values and trigger an upgrade transaction.`;
    if (!confirm(confirmMsg)) return;

    setBulkProgress({
      active: true,
      actionName: 'Upgrade',
      total: selectedList.length,
      current: 0,
      currentReleaseName: '',
      successCount: 0,
      errorCount: 0,
      logs: []
    });

    const headers: any = { 'Content-Type': 'application/json' };
    if (activeCluster) {
      headers['x-k8s-api-url'] = activeCluster.apiUrl;
      if (activeCluster.token) headers['x-k8s-token'] = activeCluster.token;
      if (activeCluster.caCert) headers['x-k8s-ca-cert'] = activeCluster.caCert;
    }

    let successes = 0;
    let errors = 0;
    const newLogs: string[] = [];

    for (let i = 0; i < selectedList.length; i++) {
      const rel = selectedList[i];
      setBulkProgress(prev => prev ? {
        ...prev,
        current: i + 1,
        currentReleaseName: `${rel.namespace}/${rel.name}`,
      } : null);

      try {
        newLogs.push(`🔄 [${rel.namespace}/${rel.name}] Fetching active configurations...`);
        setBulkProgress(prev => prev ? { ...prev, logs: [...newLogs] } : null);

        const detailRes = await fetch(`/api/k8s/releases/${rel.namespace}/${rel.name}`, { headers });
        if (!detailRes.ok) {
          throw new Error(`Could not fetch details: ${detailRes.statusText}`);
        }
        const detailData = await detailRes.json();
        const currentValues = detailData.values || '';

        const filteredIntermediates = newLogs.filter(log => !log.startsWith(`🔄 [${rel.namespace}/${rel.name}]`));

        const upgradeRes = await fetch('/api/k8s/releases/install', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: rel.name,
            namespace: rel.namespace,
            chartName: rel.chartName,
            chartVersion: rel.chartVersion,
            valuesYaml: currentValues,
            isUpgrade: true,
          })
        });
        const upgradeData = await upgradeRes.json();

        if (upgradeRes.ok) {
          successes++;
          filteredIntermediates.push(`✅ [${rel.namespace}/${rel.name}] Successfully upgraded to v${rel.revision + 1}`);
        } else {
          errors++;
          filteredIntermediates.push(`❌ [${rel.namespace}/${rel.name}] Upgrade failed: ${upgradeData.error || 'Unknown error'}`);
        }

        // Replace log array
        newLogs.length = 0;
        newLogs.push(...filteredIntermediates);

      } catch (err: any) {
        errors++;
        const filteredIntermediates = newLogs.filter(log => !log.startsWith(`🔄 [${rel.namespace}/${rel.name}]`));
        filteredIntermediates.push(`❌ [${rel.namespace}/${rel.name}] Error: ${err.message || err}`);
        newLogs.length = 0;
        newLogs.push(...filteredIntermediates);
      }

      setBulkProgress(prev => prev ? {
        ...prev,
        successCount: successes,
        errorCount: errors,
        logs: [...newLogs]
      } : null);
    }

    await fetchReleases();
    setSelectedReleases(prev => {
      return prev.filter(k => {
        const failed = newLogs.some(log => log.includes(`❌ [${k}]`));
        return failed;
      });
    });
  };

  useEffect(() => {
    fetchReleases();
  }, [activeCluster, selectedNamespace]);

  const fetchReleases = async () => {
    setLoading(true);
    setError(null);

    const headers: any = {};
    if (activeCluster) {
      headers['x-k8s-api-url'] = activeCluster.apiUrl;
      if (activeCluster.token) headers['x-k8s-token'] = activeCluster.token;
      if (activeCluster.caCert) headers['x-k8s-ca-cert'] = activeCluster.caCert;
    }

    try {
      const url = `/api/k8s/releases?namespace=${selectedNamespace}`;
      const res = await fetch(url, { headers });
      const data = await res.json();
      if (res.ok) {
        setReleases(data);
      } else {
        setError(data.error || 'Failed to fetch Helm releases.');
      }
    } catch (err: any) {
      setError(err.message || 'Connection error querying Kubernetes cluster.');
    } finally {
      setLoading(false);
    }
  };

  // Extract unique namespaces from releases list
  const namespaces = Array.from(new Set(releases.map((r) => r.namespace)));

  // Filter releases locally based on search query
  const filteredReleases = releases.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.chartName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Calculations for stats
  const totalReleases = releases.length;
  const healthyCount = releases.filter((r) => r.status === 'deployed').length;
  const failedCount = releases.filter((r) => r.status === 'failed').length;
  const uniqueNsCount = Array.from(new Set(releases.map(r => r.namespace))).length;

  // Namespace distribution counts
  const nsCounts = releases.reduce((acc, curr) => {
    acc[curr.namespace] = (acc[curr.namespace] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const sortedNsCounts = (Object.entries(nsCounts) as [string, number][]).sort((a, b) => b[1] - a[1]);

  // Warning status releases (releases whose status is not 'deployed')
  const warningReleasesList = releases.filter(r => r.status !== 'deployed');
  const warningReleasesCount = warningReleasesList.length;

  // Colors for namespaces
  const nsColorsList = [
    'bg-blue-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-orange-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-amber-500',
    'bg-cyan-500',
  ];
  
  const nsTextColorsList = [
    'text-blue-600 dark:text-blue-400',
    'text-purple-600 dark:text-purple-400',
    'text-pink-600 dark:text-pink-400',
    'text-orange-600 dark:text-orange-400',
    'text-indigo-600 dark:text-indigo-400',
    'text-teal-600 dark:text-teal-400',
    'text-amber-600 dark:text-amber-400',
    'text-cyan-600 dark:text-cyan-400',
  ];

  const nsBgColorsList = [
    'bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30',
    'bg-purple-50 dark:bg-purple-950/20 border-purple-100 dark:border-purple-900/30',
    'bg-pink-50 dark:bg-pink-950/20 border-pink-100 dark:border-pink-900/30',
    'bg-orange-50 dark:bg-orange-950/20 border-orange-100 dark:border-orange-900/30',
    'bg-indigo-50 dark:bg-indigo-950/20 border-indigo-100 dark:border-indigo-900/30',
    'bg-teal-50 dark:bg-teal-950/20 border-teal-100 dark:border-teal-900/30',
    'bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30',
    'bg-cyan-50 dark:bg-cyan-950/20 border-cyan-100 dark:border-cyan-900/30',
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 font-sans select-none"
    >
      
      {/* Cluster Health Widget */}
      <ClusterHealthWidget activeCluster={activeCluster} />
      
      {/* Top statistics summary row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 p-5 rounded-xl flex flex-col justify-between relative overflow-hidden group shadow-sm"
        >
          <div className="text-slate-500 dark:text-slate-400 font-semibold text-[10px] uppercase tracking-wider mb-2">Cluster Context</div>
          {loading ? (
            <div className="space-y-2.5 animate-pulse">
              <div className="h-5 w-32 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="h-3 w-40 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${activeCluster ? 'bg-emerald-500' : 'bg-slate-400'} shrink-0`} />
                <div className="text-sm font-bold text-[#1A1A1A] dark:text-slate-100 truncate max-w-32.5">
                  {activeCluster ? activeCluster.name : 'No Cluster'}
                </div>
              </div>
              <span className="text-[10px] text-slate-400 mt-2 block truncate">
                {activeCluster ? activeCluster.apiUrl : 'No cluster configured'}
              </span>
            </>
          )}
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 p-5 rounded-xl flex flex-col justify-between shadow-sm"
        >
          <div className="text-slate-500 dark:text-slate-400 font-semibold text-[10px] uppercase tracking-wider mb-2">Total Releases</div>
          {loading ? (
            <div className="space-y-2.5 animate-pulse">
              <div className="h-7 w-12 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="h-3 w-28 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
            </div>
          ) : error ? (
            <>
              <div className="text-2xl font-bold text-slate-300 dark:text-slate-600 font-sans">&mdash;</div>
              <span className="text-[10px] text-rose-400 mt-2 block">Unavailable</span>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-[#1A1A1A] dark:text-slate-100 font-sans">{totalReleases}</div>
              <span className="text-[10px] text-slate-400 mt-2 block">Across {uniqueNsCount} namespace(s)</span>
            </>
          )}
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 p-5 rounded-xl flex flex-col justify-between shadow-sm"
        >
          <div className="text-slate-500 dark:text-slate-400 font-semibold text-[10px] uppercase tracking-wider mb-2">Healthy Workloads</div>
          {loading ? (
            <div className="space-y-2.5 animate-pulse">
              <div className="h-7 w-20 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
            </div>
          ) : error ? (
            <>
              <div className="text-2xl font-bold text-slate-300 dark:text-slate-600 font-sans">&mdash;</div>
              <span className="text-[10px] text-rose-400 mt-2 block">Unavailable</span>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-emerald-600 font-sans">
                {healthyCount} <span className="text-xs text-slate-400 font-sans font-normal">/ {totalReleases}</span>
              </div>
              <span className="text-[10px] text-emerald-600 mt-2 block">Status: deployed</span>
            </>
          )}
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 p-5 rounded-xl flex flex-col justify-between shadow-sm"
        >
          <div className="text-slate-500 dark:text-slate-400 font-semibold text-[10px] uppercase tracking-wider mb-2">Failed Upgrades</div>
          {loading ? (
            <div className="space-y-2.5 animate-pulse">
              <div className="h-7 w-12 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="h-3 w-32 bg-slate-100 dark:bg-slate-800/60 rounded-md" />
            </div>
          ) : error ? (
            <>
              <div className="text-2xl font-bold text-slate-300 dark:text-slate-600 font-sans">&mdash;</div>
              <span className="text-[10px] text-rose-400 mt-2 block">Unavailable</span>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-rose-500 font-sans">
                {failedCount}
              </div>
              <span className="text-[10px] text-rose-500 mt-2 block">Requires diagnostic check</span>
            </>
          )}
        </motion.div>
      </div>

      {/* Cluster Health & Namespace Distribution Summary Widget */}
      <div className="bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-xs font-bold text-[#1A1A1A] dark:text-slate-100 uppercase tracking-wider flex items-center gap-2">
              <Box className="w-4 h-4 text-blue-600" />
              Cluster Health & Workload Distribution
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Live telemetry insights from <b>{activeCluster ? activeCluster.name : 'Active Cluster'}</b>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-semibold text-slate-500 dark:text-slate-400">
              {totalReleases} Deployments
            </span>
            <span className="text-[10px] bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded font-semibold border border-blue-100 dark:border-blue-900/30">
              {uniqueNsCount} Namespace(s)
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Total Deployments & Overall Status (4 cols) */}
          {error ? (
            <div className="lg:col-span-4 flex flex-col items-center justify-center py-8 space-y-2 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-100 dark:border-slate-800">
              <AlertCircle className="w-6 h-6 text-rose-400" />
              <p className="text-[10px] text-slate-400">Unavailable</p>
            </div>
          ) : loading ? (
            <div className="lg:col-span-4 space-y-3 bg-slate-50 dark:bg-slate-950/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-24 bg-slate-200 dark:bg-slate-850 rounded" />
                <div className="h-4.5 w-16 bg-slate-100 dark:bg-slate-800 rounded-full" />
              </div>
              <div className="space-y-2.5 pt-1">
                <div className="h-7 w-20 bg-slate-200 dark:bg-slate-850 rounded" />
                <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800/80 rounded-full" />
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800 h-10" />
                <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800 h-10" />
              </div>
            </div>
          ) : (
            <div className="lg:col-span-4 space-y-3 bg-slate-50 dark:bg-slate-950/40 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Deployments Status</span>
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 rounded">
                  {((healthyCount / (totalReleases || 1)) * 100).toFixed(0)}% Healthy
                </span>
              </div>

              <div className="space-y-1">
                <div className="text-2xl font-black text-slate-800 dark:text-white flex items-baseline gap-1.5">
                  {totalReleases}
                  <span className="text-xs font-normal text-slate-400">Total Deployments</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-500" 
                    style={{ width: `${(healthyCount / (totalReleases || 1)) * 100}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div className="text-slate-400">Healthy</div>
                  <div className="font-bold text-emerald-600 mt-0.5">{healthyCount} Deployed</div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div className="text-slate-400">Pending/Failed</div>
                  <div className="font-bold text-rose-500 dark:text-rose-400 mt-0.5">{warningReleasesCount} Active</div>
                </div>
              </div>
            </div>
          )}

          {/* Middle: Namespace Weight Proportions (5 cols) */}
          {error ? (
            <div className="lg:col-span-5 flex flex-col items-center justify-center py-8 space-y-2 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-100 dark:border-slate-800">
              <AlertCircle className="w-6 h-6 text-rose-400" />
              <p className="text-[10px] text-slate-400">Unavailable</p>
            </div>
          ) : loading ? (
            <div className="lg:col-span-5 space-y-3.5 animate-pulse">
              <div className="h-3.5 w-44 bg-slate-200 dark:bg-slate-850 rounded" />
              <div className="h-6 w-full bg-slate-100 dark:bg-slate-800 rounded-lg" />
              <div className="flex flex-wrap gap-1.5 pt-1">
                <div className="h-6 w-20 bg-slate-200 dark:bg-slate-850 rounded-md" />
                <div className="h-6 w-16 bg-slate-200 dark:bg-slate-850 rounded-md" />
                <div className="h-6 w-24 bg-slate-200 dark:bg-slate-850 rounded-md" />
              </div>
            </div>
          ) : (
            <div className="lg:col-span-5 space-y-3">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">
                Namespace Weights & Distribution
              </span>

              {/* Segmented Progress Bar */}
              {totalReleases === 0 ? (
                <div className="h-6 bg-slate-50 dark:bg-slate-950 rounded-lg flex items-center justify-center text-[10px] text-slate-400 border border-dashed border-slate-200 dark:border-slate-800">
                  No active releases detected
                </div>
              ) : (
                <div className="h-6 w-full rounded-lg flex overflow-hidden shadow-inner border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
                  {sortedNsCounts.map(([ns, count], idx) => {
                    const widthPct = (count / totalReleases) * 100;
                    const colorClass = nsColorsList[idx % nsColorsList.length];
                    return (
                      <motion.div 
                        key={ns}
                        initial={{ width: 0 }}
                        animate={{ width: `${widthPct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: idx * 0.05 }}
                        className={`${colorClass} h-full relative group flex items-center justify-center`}
                        title={`${ns}: ${count} deployment(s) (${widthPct.toFixed(0)}%)`}
                      >
                        {widthPct > 12 && (
                          <span className="text-[9px] font-bold text-white font-mono drop-shadow-sm truncate px-1">
                            {count}
                          </span>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Legend Map */}
              <div className="flex flex-wrap gap-1.5">
                {sortedNsCounts.map(([ns, count], idx) => {
                  const colorClass = nsColorsList[idx % nsColorsList.length];
                  const textClass = nsTextColorsList[idx % nsTextColorsList.length];
                  const bgClass = nsBgColorsList[idx % nsBgColorsList.length];
                  return (
                    <button
                      key={ns}
                      onClick={() => setSelectedNamespace(ns)}
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-bold border transition hover:scale-105 cursor-pointer active:scale-95 ${bgClass} ${
                        selectedNamespace === ns ? 'ring-2 ring-blue-500/30 font-extrabold' : ''
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${colorClass}`} />
                      <span className="font-mono text-slate-700 dark:text-slate-200">{ns}</span>
                      <span className="text-slate-400 font-mono">({count})</span>
                    </button>
                  );
                })}
                {sortedNsCounts.length > 0 && selectedNamespace !== 'all' && (
                  <button
                    onClick={() => setSelectedNamespace('all')}
                    className="px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 text-[10px] font-bold text-slate-600 dark:text-slate-300 rounded-md transition cursor-pointer"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Right: Warnings monitor (3 cols) */}
          {error ? (
            <div className="lg:col-span-3 flex flex-col items-center justify-center py-8 space-y-2 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-100 dark:border-slate-800">
              <AlertCircle className="w-6 h-6 text-rose-400" />
              <p className="text-[10px] text-slate-400">Unavailable</p>
            </div>
          ) : loading ? (
            <div className="lg:col-span-3 space-y-3.5 animate-pulse">
              <div className="h-3.5 w-36 bg-slate-200 dark:bg-slate-850 rounded" />
              <div className="bg-slate-50/50 dark:bg-slate-950/15 border border-slate-200/60 dark:border-slate-800/80 rounded-xl p-3.5 h-26.25 flex flex-col justify-center gap-2">
                <div className="h-4 w-32 bg-slate-200 dark:bg-slate-850 rounded" />
                <div className="h-3 w-24 bg-slate-100 dark:bg-slate-800/60 rounded" />
              </div>
            </div>
          ) : (
            <div className="lg:col-span-3 space-y-3">
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider block">
                Active Warnings Monitor
              </span>

              {warningReleasesCount === 0 ? (
                <div className="bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-3.5 flex flex-col items-center justify-center text-center h-26.25">
                  <CheckCircle className="w-5 h-5 text-emerald-500 mb-1.5" />
                  <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400">All Workloads Stable</span>
                  <span className="text-[9px] text-emerald-600 dark:text-emerald-500 mt-0.5">No anomalies detected</span>
                </div>
              ) : (
                <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/40 rounded-xl p-3.5 flex flex-col justify-between min-h-26.25 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5 animate-pulse" />
                    <div>
                      <span className="text-[11px] font-bold text-amber-800 dark:text-amber-400 block">
                        {warningReleasesCount} Warning Release(s)
                      </span>
                      <span className="text-[9px] text-amber-600 dark:text-amber-500">
                        Require configuration or resource review
                      </span>
                    </div>
                  </div>

                  <div className="max-h-12.5 overflow-y-auto space-y-1 text-[9px] font-mono scrollbar-thin">
                    {warningReleasesList.slice(0, 3).map(r => (
                      <div 
                        key={`${r.namespace}/${r.name}`} 
                        onClick={() => onSelectRelease(r.namespace, r.name)}
                        className="bg-white dark:bg-slate-900/80 hover:bg-white/90 border border-amber-100 dark:border-amber-900/30 px-1.5 py-0.5 rounded text-amber-800 dark:text-amber-300 flex justify-between items-center cursor-pointer truncate gap-1"
                      >
                        <span className="truncate font-semibold">{r.name}</span>
                        <span className="text-[8px] uppercase tracking-wider font-bold bg-amber-100 dark:bg-amber-950 px-1 rounded shrink-0">
                          {r.status}
                        </span>
                      </div>
                    ))}
                    {warningReleasesCount > 3 && (
                      <div className="text-[8px] text-amber-600 dark:text-amber-500 italic text-center">
                        + {warningReleasesCount - 3} more releases
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Namespace Resource Quotas and Utilization */}
      <NamespaceQuotaWidget 
        namespace={selectedNamespace} 
        activeCluster={activeCluster} 
      />

      {/* Control Filters Row */}
      <div className="bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div className="flex flex-1 items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search release name or chart..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-lg pl-9 pr-4 py-2 text-xs text-[#1A1A1A] dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
            />
          </div>

          {/* Namespace Selector */}
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedNamespace}
              onChange={(e) => setSelectedNamespace(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-200 py-1.5 px-3.5 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition cursor-pointer font-medium"
            >
              <option value="all">All Namespaces</option>
              <option value="default">default</option>
              {namespaces.filter(ns => ns !== 'default').map((ns) => (
                <option key={ns} value={ns}>{ns}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={fetchReleases}
            className="p-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-[#E1E4E8] dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg transition cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onBrowseCharts}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white rounded-lg transition flex items-center gap-1 cursor-pointer shadow-sm active:scale-95"
          >
            Deploy New Chart
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Bulk operation progress bar / alert */}
      {bulkProgress && bulkProgress.active && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-5 rounded-xl shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                Bulk Operation in Progress: <span className="text-blue-600 capitalize">{bulkProgress.actionName}</span>
              </h4>
            </div>
            <span className="text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-500 dark:text-slate-400">
              {bulkProgress.current} / {bulkProgress.total}
            </span>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Currently processing: <span className="font-semibold text-slate-800 dark:text-slate-200">{bulkProgress.currentReleaseName || 'Initial configuration...'}</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-blue-600 h-full transition-all duration-300"
                style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-200 dark:border-slate-800 font-mono text-[10px] text-slate-600 dark:text-slate-300 max-h-36 overflow-y-auto space-y-1">
            {bulkProgress.logs.length === 0 ? (
              <div className="text-slate-400 italic">Initializing transaction log...</div>
            ) : (
              bulkProgress.logs.map((log, index) => (
                <div key={index} className="whitespace-pre-wrap leading-relaxed">{log}</div>
              ))
            )}
          </div>

          {bulkProgress.current === bulkProgress.total && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Completed with <span className="font-bold text-emerald-600">{bulkProgress.successCount} success</span> and <span className="font-bold text-rose-500">{bulkProgress.errorCount} failed</span>
              </div>
              <button
                onClick={() => setBulkProgress(null)}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white rounded-lg transition cursor-pointer"
              >
                Dismiss Logs
              </button>
            </div>
          )}
        </div>
      )}

      {/* Floating or inline actions bar */}
      {!loading && selectedReleases.length > 0 && (!bulkProgress || !bulkProgress.active) && (
        <div className="bg-[#1E293B] dark:bg-slate-950 border border-slate-700 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg text-white">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold">{selectedReleases.length} Release(s) Selected</div>
              <div className="text-[10px] text-slate-400">Perform a bulk action on these selected workloads</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            <button
              onClick={handleBulkUpgrade}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 w-full md:w-auto justify-center"
            >
              <ArrowUpCircle className="w-4 h-4" />
              Bulk Upgrade
            </button>
            <button
              onClick={handleBulkRollback}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-xs font-bold text-white rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 w-full md:w-auto justify-center"
            >
              <RotateCcw className="w-4 h-4" />
              Bulk Rollback
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 w-full md:w-auto justify-center"
            >
              <Trash2 className="w-4 h-4" />
              Bulk Uninstall
            </button>
            <div className="w-px h-6 bg-slate-700 hidden md:block mx-1" />
            <button
              onClick={() => setSelectedReleases([])}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 rounded-lg transition flex items-center gap-1 cursor-pointer w-full md:w-auto justify-center"
            >
              <X className="w-3.5 h-3.5" />
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {error ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 bg-rose-50 border border-[#E1E4E8] dark:border-slate-700 text-center rounded-xl shadow-sm">
          <AlertCircle className="w-10 h-10 text-rose-500 mb-3" />
          <h3 className="font-semibold text-rose-900 mb-1">Cluster Handshake Failed</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed mb-4">
            {error}. Verify the cluster's endpoint, Service Account JWT token, and ensure the target cluster allows anonymous or bearer authentications.
          </p>
          <button
            onClick={fetchReleases}
            className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-xs text-slate-700 dark:text-slate-200 font-semibold transition cursor-pointer"
          >
            Retry Call
          </button>
        </div>
      ) : !loading && filteredReleases.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-6 bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 text-center rounded-xl shadow-sm">
          <img
            src={noReleasesImg}
            alt="No active Helm releases discovered"
            className="w-48 h-48 object-contain mb-4 rounded-lg opacity-85 dark:opacity-80"
            referrerPolicy="no-referrer"
          />
          <h3 className="font-semibold text-slate-700 dark:text-slate-200 mb-1">No Helm Releases Discovered</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-5 leading-normal">
            We couldn't locate any active releases matching your filters. Start by deploying an app from the Chart Store Catalog.
          </p>
          <button
            onClick={onBrowseCharts}
            className="px-4 py-2 bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-blue-600 dark:text-blue-400 rounded-lg transition cursor-pointer"
          >
            Browse Helm Charts
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
          {/* Table View for Medium+ Screens */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E1E4E8] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                  <th className="py-4 px-6 w-12 text-center">
                    <input
                      type="checkbox"
                      disabled={loading}
                      checked={!loading && filteredReleases.length > 0 && filteredReleases.every(r => selectedReleases.includes(`${r.namespace}/${r.name}`))}
                      onChange={() => toggleSelectAll(filteredReleases)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer transition disabled:opacity-50"
                      title="Select all visible releases"
                    />
                  </th>
                  <th className="py-4 px-6">Release Name</th>
                  <th className="py-4 px-6">Namespace</th>
                  <th className="py-4 px-6">Chart</th>
                  <th className="py-4 px-6">Revision</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6">Last Updated</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-200">
                {loading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={idx} className="animate-pulse bg-white dark:bg-slate-900">
                      <td className="py-4 px-6 text-center">
                        <div className="w-4 h-4 bg-slate-100 dark:bg-slate-800 rounded mx-auto" />
                      </td>
                      <td className="py-4 px-6">
                        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
                      </td>
                      <td className="py-4 px-6">
                        <div className="h-4 w-20 bg-slate-100 dark:bg-slate-800/80 rounded" />
                      </td>
                      <td className="py-4 px-6">
                        <div className="h-4 w-28 bg-slate-100 dark:bg-slate-800/60 rounded" />
                      </td>
                      <td className="py-4 px-6">
                        <div className="h-4 w-8 bg-slate-100 dark:bg-slate-800/60 rounded" />
                      </td>
                      <td className="py-4 px-6">
                        <div className="h-5 w-16 bg-slate-200 dark:bg-slate-800 rounded-full" />
                      </td>
                      <td className="py-4 px-6">
                        <div className="h-4 w-24 bg-slate-100 dark:bg-slate-800/60 rounded" />
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="h-7 w-16 bg-slate-100 dark:bg-slate-800 rounded-md inline-block" />
                      </td>
                    </tr>
                  ))
                ) : (
                  <AnimatePresence initial={false}>
                    {filteredReleases.map((release, index) => {
                    const isSelected = selectedReleases.includes(`${release.namespace}/${release.name}`);
                    return (
                      <motion.tr
                        key={`${release.namespace}/${release.name}`}
                        layout="position"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ 
                          layout: { type: 'spring', damping: 25, stiffness: 220 },
                          opacity: { duration: 0.2 },
                          y: { duration: 0.25 }
                        }}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition group ${
                          isSelected ? 'bg-blue-50/40 dark:bg-blue-950/10' : ''
                        }`}
                      >
                      <td className="py-3.5 px-6 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRelease(`${release.namespace}/${release.name}`)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer transition"
                        />
                      </td>
                      <td className="py-3.5 px-6 font-semibold text-[#1A1A1A] dark:text-slate-100 capitalize">{release.name}</td>
                      <td className="py-3.5 px-6">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                          {release.namespace}
                        </span>
                      </td>
                      <td className="py-3.5 px-6">
                        <div className="font-semibold text-slate-700 dark:text-slate-200">{release.chartName}</div>
                        <div className="text-[10px] text-slate-400">v{release.chartVersion}</div>
                      </td>
                      <td className="py-3.5 px-6 font-mono text-slate-500 dark:text-slate-400 font-bold">v{release.revision}</td>
                      <td className="py-3.5 px-6">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          release.status === 'deployed'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${release.status === 'deployed' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {release.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-slate-400 text-[10px]">
                        {new Date(release.updated).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <button
                          onClick={() => onSelectRelease(release.namespace, release.name)}
                          className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-950 rounded-lg transition text-[11px] font-semibold text-slate-600 dark:text-slate-300 cursor-pointer active:scale-95"
                        >
                          Manage
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
                </AnimatePresence>
                )}
              </tbody>
            </table>
          </div>

          {/* Card View for Mobile Screens */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              Array.from({ length: 3 }).map((_, idx) => (
                <div key={idx} className="p-4 space-y-3 animate-pulse bg-white dark:bg-slate-900">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 bg-slate-100 dark:bg-slate-800 rounded shrink-0" />
                    <div className="flex-1 flex items-center justify-between">
                      <div className="h-4 w-28 bg-slate-200 dark:bg-slate-800 rounded" />
                      <div className="h-5 w-14 bg-slate-100 dark:bg-slate-800 rounded-full" />
                    </div>
                  </div>
                  <div className="pl-7 grid grid-cols-2 gap-2">
                    <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800/60 rounded" />
                    <div className="h-3 w-24 bg-slate-100 dark:bg-slate-800/60 rounded" />
                    <div className="h-3 w-16 bg-slate-100 dark:bg-slate-800/60 rounded" />
                    <div className="h-3 w-18 bg-slate-100 dark:bg-slate-800/60 rounded" />
                  </div>
                  <div className="pt-2 pl-7 flex justify-end">
                    <div className="h-8 w-full bg-slate-100 dark:bg-slate-800 rounded-lg" />
                  </div>
                </div>
              ))
            ) : (
              <AnimatePresence initial={false}>
                {filteredReleases.map((release) => {
                  const isSelected = selectedReleases.includes(`${release.namespace}/${release.name}`);
                  return (
                    <motion.div
                      key={`${release.namespace}/${release.name}`}
                      layout="position"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ 
                        layout: { type: 'spring', damping: 25, stiffness: 220 },
                        opacity: { duration: 0.2 },
                        y: { duration: 0.25 }
                      }}
                      className={`p-4 space-y-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition ${
                        isSelected ? 'bg-blue-50/30 dark:bg-blue-950/5' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRelease(`${release.namespace}/${release.name}`)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer transition shrink-0"
                        />
                        <div className="flex-1 flex items-center justify-between">
                          <span className="font-semibold text-[#1A1A1A] dark:text-slate-100 capitalize">{release.name}</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            release.status === 'deployed'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-rose-100 text-rose-700'
                          }`}>
                            {release.status}
                          </span>
                        </div>
                      </div>

                      <div className="pl-7 grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                        <div>
                          Namespace: <b className="text-slate-600 dark:text-slate-300">{release.namespace}</b>
                        </div>
                        <div>
                          Chart: <b className="text-slate-600 dark:text-slate-300">{release.chartName} (v{release.chartVersion})</b>
                        </div>
                        <div>
                          Revision: <b className="text-slate-600 dark:text-slate-300">v{release.revision}</b>
                        </div>
                        <div>
                          Updated: <b className="text-slate-600 dark:text-slate-300">{new Date(release.updated).toLocaleDateString()}</b>
                        </div>
                      </div>

                      <div className="pt-2 pl-7 flex justify-end">
                        <button
                          onClick={() => onSelectRelease(release.namespace, release.name)}
                          className="w-full py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-[#E1E4E8] dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 rounded-lg transition cursor-pointer"
                        >
                          Manage Release
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </div>
      )}
      
      {/* Real-time Activity Stream panel */}
      <ActivityLog activeCluster={activeCluster} />
    </motion.div>
  );
}
