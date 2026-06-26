import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Cpu,
  Database,
  Download,
  Eye,
  EyeOff,
  Info,
  RefreshCw,
  Search,
  Terminal,
  User,
  XCircle,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import React, { useEffect, useRef, useState } from 'react';

import { ActivityLog as ActivityLogType } from '@/types/activity-log.type';
import { K8sCluster } from '@/types/k8s-cluster.type';

interface ActivityLogProps {
  activeCluster: K8sCluster | null;
}

export default function ActivityLog({ activeCluster }: ActivityLogProps) {
  const [logs, setLogs] = useState<ActivityLogType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'helm' | 'k8s'>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<'all' | 'info' | 'warning' | 'error' | 'success'>('all');
  const [selectedTimeRange, setSelectedTimeRange] = useState<'all' | '5m' | '15m' | '1h' | '12h'>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Log exporting states & references
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Click outside to dismiss export dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowExportDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const downloadJSON = () => {
    try {
      const dataStr = JSON.stringify(filteredLogs, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

      const exportFileDefaultName = `helm-k8s-activity-logs-${new Date().toISOString().slice(0, 10)}.json`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      setShowExportDropdown(false);
    } catch (err) {
      console.error('Failed to export JSON logs', err);
    }
  };

  const downloadCSV = () => {
    try {
      // CSV headers matching schema attributes
      const headers = ['ID', 'Timestamp', 'Type', 'Severity', 'Category', 'Message', 'User/Actor'];

      // Map logs to sanitized rows
      const rows = filteredLogs.map((log) => {
        const sanitizedMsg = (log.message || '').replace(/"/g, '""');
        const sanitizedUser = (log.user || '').replace(/"/g, '""');
        return [
          log.id,
          new Date(log.timestamp).toISOString(),
          log.type,
          log.severity,
          log.category,
          `"${sanitizedMsg}"`,
          `"${sanitizedUser}"`,
        ];
      });

      const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);

      const exportFileDefaultName = `helm-k8s-activity-logs-${new Date().toISOString().slice(0, 10)}.csv`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', url);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      URL.revokeObjectURL(url);
      setShowExportDropdown(false);
    } catch (err) {
      console.error('Failed to export CSV logs', err);
    }
  };

  const fetchLogs = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    const headers: any = {};
    if (activeCluster) {
      headers['x-k8s-api-url'] = activeCluster.apiUrl;
      if (activeCluster.token) headers['x-k8s-token'] = activeCluster.token;
      if (activeCluster.caCert) headers['x-k8s-ca-cert'] = activeCluster.caCert;
    }

    try {
      const res = await fetch('/api/k8s/activity', { headers });
      if (!res.ok) {
        throw new Error(`Failed to fetch activity logs: ${res.statusText}`);
      }
      const data = await res.json();
      setLogs(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while retrieving logs.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [activeCluster]);

  useEffect(() => {
    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(() => {
        fetchLogs(true);
      }, 5000);
    } else {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, activeCluster]);

  const toggleExpand = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  // Filter logic
  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.user && log.user.toLowerCase().includes(searchQuery.toLowerCase())) ||
      log.category.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = selectedType === 'all' || log.type === selectedType;
    const matchesSeverity = selectedSeverity === 'all' || log.severity === selectedSeverity;

    let matchesTime = true;
    if (selectedTimeRange !== 'all') {
      const logTime = new Date(log.timestamp).getTime();
      const now = Date.now();
      if (selectedTimeRange === '5m') {
        matchesTime = now - logTime <= 5 * 60 * 1000;
      } else if (selectedTimeRange === '15m') {
        matchesTime = now - logTime <= 15 * 60 * 1000;
      } else if (selectedTimeRange === '1h') {
        matchesTime = now - logTime <= 60 * 60 * 1000;
      } else if (selectedTimeRange === '12h') {
        matchesTime = now - logTime <= 12 * 60 * 60 * 1000;
      }
    }

    return matchesSearch && matchesType && matchesSeverity && matchesTime;
  });

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-rose-500 shrink-0" />;
      case 'info':
      default:
        return <Info className="w-4 h-4 text-blue-500 shrink-0" />;
    }
  };

  const getCategoryBadge = (category: string) => {
    let color = 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
    if (category === 'install') color = 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300';
    if (category === 'upgrade') color = 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
    if (category === 'rollback') color = 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    if (category === 'uninstall') color = 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300';
    if (category === 'repo') color = 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';

    return <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${color}`}>{category}</span>;
  };

  // Severity metrics
  const totalCount = logs.length;
  const successCount = logs.filter((l) => l.severity === 'success').length;
  const warningCount = logs.filter((l) => l.severity === 'warning').length;
  const errorCount = logs.filter((l) => l.severity === 'error').length;
  const infoCount = logs.filter((l) => l.severity === 'info').length;

  return (
    <div className="bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-xl overflow-hidden shadow-sm flex flex-col mt-6">
      {/* Header Panel */}
      <div className="p-4 border-b border-[#E1E4E8] dark:border-slate-700 flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-blue-50 dark:bg-slate-800 rounded-lg text-blue-600 dark:text-blue-400">
            <Activity className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-[#1A1A1A] dark:text-slate-100 uppercase tracking-wide">Cluster Activity Stream</h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">Real-time Helm operations & standard Kubernetes event logs</p>
          </div>
        </div>

        {/* Streaming Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Severity Counters / Badges */}
          <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
            <button
              onClick={() => setSelectedSeverity('all')}
              className={`px-2 py-1 rounded-md transition ${selectedSeverity === 'all' ? 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100' : 'hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
            >
              All ({totalCount})
            </button>
            <button
              onClick={() => setSelectedSeverity('success')}
              className={`px-2 py-1 rounded-md transition flex items-center gap-1 ${selectedSeverity === 'success' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300' : 'hover:bg-emerald-50 dark:hover:bg-emerald-950/20'}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Success ({successCount})
            </button>
            <button
              onClick={() => setSelectedSeverity('info')}
              className={`px-2 py-1 rounded-md transition flex items-center gap-1 ${selectedSeverity === 'info' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' : 'hover:bg-blue-50 dark:hover:bg-blue-950/20'}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Info ({infoCount})
            </button>
            <button
              onClick={() => setSelectedSeverity('warning')}
              className={`px-2 py-1 rounded-md transition flex items-center gap-1 ${selectedSeverity === 'warning' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300' : 'hover:bg-amber-50 dark:hover:bg-amber-950/20'}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Warn ({warningCount})
            </button>
            <button
              onClick={() => setSelectedSeverity('error')}
              className={`px-2 py-1 rounded-md transition flex items-center gap-1 ${selectedSeverity === 'error' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300' : 'hover:bg-rose-50 dark:hover:bg-rose-950/20'}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              Error ({errorCount})
            </button>
          </div>

          <div className="h-4 w-px bg-[#E1E4E8] dark:bg-slate-700 hidden sm:block" />

          {/* Autorefresh Button */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold border flex items-center gap-1.5 transition cursor-pointer ${
              autoRefresh
                ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700'
            }`}
            title={autoRefresh ? 'Click to pause streaming' : 'Click to resume streaming'}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-blue-500 animate-ping' : 'bg-slate-400'}`} />
            {autoRefresh ? 'Live Streaming' : 'Stream Paused'}
          </button>

          <button
            onClick={() => fetchLogs()}
            className="p-1.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-[#E1E4E8] dark:border-slate-700 text-slate-500 rounded-lg transition cursor-pointer"
            title="Force refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter and Search Sub-Bar */}
      <div className="px-4 py-3 border-b border-[#E1E4E8] dark:border-slate-700 flex flex-col md:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900">
        {/* Stream Source Selector Tab */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-full md:w-auto">
          <button
            onClick={() => setSelectedType('all')}
            className={`flex-1 md:flex-initial px-3 py-1 rounded-md text-[10px] font-bold transition cursor-pointer ${selectedType === 'all' ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            All Logs
          </button>
          <button
            onClick={() => setSelectedType('helm')}
            className={`flex-1 md:flex-initial px-3 py-1 rounded-md text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${selectedType === 'helm' ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <Terminal className="w-3 h-3" />
            Helm Ops
          </button>
          <button
            onClick={() => setSelectedType('k8s')}
            className={`flex-1 md:flex-initial px-3 py-1 rounded-md text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${selectedType === 'k8s' ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
          >
            <Database className="w-3 h-3" />
            K8s Events
          </button>
        </div>

        {/* Time range, Search, & Export Controls */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto md:justify-end">
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-[9px]">Time:</span>
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value as any)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 transition font-semibold cursor-pointer"
            >
              <option value="all">All Time</option>
              <option value="5m">Last 5 Min</option>
              <option value="15m">Last 15 Min</option>
              <option value="1h">Last Hour</option>
              <option value="12h">Last 12 Hours</option>
            </select>
          </div>

          <div className="relative w-full md:w-48">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg pl-8.5 pr-3 py-1.5 text-[11px] text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
            />
          </div>

          {/* Export Dropdown */}
          <div className="relative w-full sm:w-auto shrink-0" ref={dropdownRef}>
            <button
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              disabled={filteredLogs.length === 0}
              className="w-full sm:w-auto px-3.5 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title="Export filtered activity events to a local file"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export Logs</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showExportDropdown && (
              <div className="absolute right-0 mt-1.5 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-1 duration-150">
                <div className="px-3 py-1.5 border-b border-slate-100 dark:border-slate-800 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  Select Format
                </div>
                <button
                  onClick={downloadCSV}
                  className="w-full px-3.5 py-2 text-left text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition flex items-center gap-2 cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Export as CSV (.csv)
                </button>
                <button
                  onClick={downloadJSON}
                  className="w-full px-3.5 py-2 text-left text-[11px] font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition flex items-center gap-2 cursor-pointer"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  Export as JSON (.json)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Log Entries Container */}
      <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 bg-slate-50/20 dark:bg-slate-900/10 min-h-40">
        {loading && logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] text-slate-400">Pumping real-time events...</p>
          </div>
        ) : error && logs.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-xs text-rose-500 font-semibold mb-1">Failed to bind to event stream</p>
            <p className="text-[10px] text-slate-400 mb-3">{error}</p>
            <button
              onClick={() => fetchLogs()}
              className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] rounded-lg hover:bg-slate-50 font-semibold text-slate-600 cursor-pointer"
            >
              Reconnect
            </button>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-12 text-center">
            <Activity className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">No matching activities found</p>
            <p className="text-[10px] text-slate-400">Adjust your search query or severity filters</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filteredLogs.map((log, _index) => {
              const isExpanded = expandedLogId === log.id;
              return (
                <motion.div
                  key={log.id}
                  layout="position"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{
                    layout: { type: 'spring', damping: 25, stiffness: 220 },
                    opacity: { duration: 0.18 },
                    y: { duration: 0.22 },
                  }}
                  className={`transition-colors border-l-2 ${
                    log.severity === 'success'
                      ? 'border-emerald-500'
                      : log.severity === 'warning'
                        ? 'border-amber-500'
                        : log.severity === 'error'
                          ? 'border-rose-500'
                          : 'border-blue-500'
                  } hover:bg-slate-50/50 dark:hover:bg-slate-800/20`}
                >
                  {/* Log Line Summary Row */}
                  <div onClick={() => toggleExpand(log.id)} className="p-3.5 flex items-start gap-3 cursor-pointer text-xs">
                    {/* Status Icon */}
                    {getSeverityIcon(log.severity)}

                    {/* Message & Attributes */}
                    <div className="flex-1 space-y-1 min-w-0">
                      <p className="text-[#24292E] dark:text-slate-100 font-medium wrap-break-word leading-relaxed select-text">
                        {log.message}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 font-semibold">
                        {/* Log Source Indicator */}
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            log.type === 'helm'
                              ? 'bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30'
                              : 'bg-emerald-50 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30'
                          }`}
                        >
                          {log.type === 'helm' ? 'HELM' : 'K8S EVENT'}
                        </span>

                        {getCategoryBadge(log.category)}

                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>

                        {log.user && (
                          <span className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-1 rounded">
                            {log.type === 'helm' ? <User className="w-3 h-3 text-slate-400" /> : <Cpu className="w-3 h-3 text-slate-400" />}
                            {log.user}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Expand Toggler Icon */}
                    <div className="text-slate-300 dark:text-slate-600 group-hover:text-slate-400 transition pl-2">
                      {isExpanded ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </div>
                  </div>

                  {/* Log Monospace Detailed Row (Expandable) */}
                  <AnimatePresence initial={false}>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className="px-4 pb-4 pt-1.5 bg-slate-50/50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800/80 text-[10px] overflow-hidden"
                      >
                        <div className="bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-800 rounded-lg p-3 overflow-x-auto font-mono text-slate-600 dark:text-slate-300 shadow-inner">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-slate-800 font-sans font-semibold text-[10px]">
                            <div>
                              Log ID: <span className="font-mono text-slate-400">{log.id}</span>
                            </div>
                            <div>
                              Timestamp: <span className="font-mono text-slate-400">{new Date(log.timestamp).toISOString()}</span>
                            </div>
                            <div>
                              Category: <span className="font-mono text-slate-400 uppercase">{log.category}</span>
                            </div>
                            <div>
                              Actor/Component: <span className="font-mono text-slate-400">{log.user || 'N/A'}</span>
                            </div>
                          </div>
                          <span className="text-[9px] uppercase font-bold text-slate-400 block mb-1 font-sans">Full Trace Payload:</span>
                          <pre className="whitespace-pre-wrap font-mono text-[9px] select-all leading-normal text-slate-500 dark:text-slate-300">
                            {JSON.stringify(
                              {
                                id: log.id,
                                timestamp: log.timestamp,
                                type: log.type,
                                severity: log.severity,
                                category: log.category,
                                message: log.message,
                                actor: log.user || 'system',
                              },
                              null,
                              2,
                            )}
                          </pre>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Footer Info / Live Ticker */}
      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border-t border-[#E1E4E8] dark:border-slate-700 text-[10px] text-slate-400 flex items-center justify-between">
        <span className="font-semibold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Active Connection: REST-Engine proxied
        </span>
        <span>
          Showing {filteredLogs.length} of {totalCount} events
        </span>
      </div>
    </div>
  );
}
