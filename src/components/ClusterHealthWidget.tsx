import React, { useEffect, useState, useRef } from 'react';
import { K8sCluster } from '@/types/k8s-cluster.type';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Activity, 
  Server, 
  Cpu, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Wifi, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Database,
  Layers,
  Heart
} from 'lucide-react';

interface ClusterHealthWidgetProps {
  activeCluster: K8sCluster | null;
}

interface NodeInfo {
  name: string;
  status: 'Ready' | 'NotReady';
  role: string;
  cpu: string;
  memory: string;
}

interface ClusterHealthData {
  success: boolean;
  clusterName: string;
  latencyMs: number;
  nodes: {
    total: number;
    ready: number;
    notReady: number;
    cpuUsagePercent: number;
    memoryUsagePercent: number;
    list: NodeInfo[];
  };
  components: {
    controllerManager: 'Healthy' | 'Unhealthy';
    scheduler: 'Healthy' | 'Unhealthy';
    etcd: 'Healthy' | 'Unhealthy';
  };
  polledAt: string;
}

export default function ClusterHealthWidget({ activeCluster }: ClusterHealthWidgetProps) {
  const [healthData, setHealthData] = useState<ClusterHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchClusterHealth = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (activeCluster) {
        headers['x-k8s-api-url'] = activeCluster.apiUrl;
        if (activeCluster.token) headers['x-k8s-token'] = activeCluster.token;
        if (activeCluster.caCert) {
          headers['x-k8s-ca-cert'] = activeCluster.caCert;
        }
        headers['x-k8s-cluster-name'] = activeCluster.name;
      }

      const response = await fetch('/api/k8s/cluster-health', {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to retrieve cluster metrics: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        setHealthData(data);
      } else {
        throw new Error(data.error || 'Unknown cluster health retrieval error');
      }
    } catch (err: any) {
      console.error('Error fetching cluster health:', err);
      setError(err.message || 'Failed to connect to cluster API');
    } finally {
      setLoading(false);
    }
  };

  // Poll setup
  useEffect(() => {
    fetchClusterHealth();

    if (autoRefresh) {
      pollIntervalRef.current = setInterval(() => {
        fetchClusterHealth(true);
      }, 10000); // Poll every 10s
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [activeCluster, autoRefresh]);

  // Color logic for latency status
  const getLatencyColor = (ms: number) => {
    if (ms < 50) return 'text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30';
    if (ms < 150) return 'text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30';
    return 'text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900/30';
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-xl shadow-sm overflow-hidden transition-all duration-300">
      {/* Header section with status triggers */}
      <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-lg border border-blue-100 dark:border-blue-900/30">
            <Activity className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-[#1A1A1A] dark:text-slate-100 uppercase tracking-wider animate-fade-in">
                Control Plane & Cluster Metrics
              </h2>
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Live heartbeat telemetry of {activeCluster ? activeCluster.name : 'Active Cluster'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-end sm:self-auto">
          {/* Auto refresh switch */}
          <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
            <input 
              type="checkbox" 
              checked={autoRefresh}
              onChange={() => setAutoRefresh(!autoRefresh)}
              className="sr-only peer"
            />
            <div className="relative w-7 h-4 bg-slate-200 peer-focus:outline-none dark:bg-slate-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:inset-s-0.5 after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {autoRefresh ? 'Live Polling' : 'Manual'}
            </span>
          </label>

          <button
            onClick={() => fetchClusterHealth()}
            disabled={loading}
            className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-1.5 text-[10px] font-bold"
            title="Force telemetry refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main widget grid */}
      {error ? (
        <div className="p-6 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">Failed to connect to Kubernetes</h3>
            <p className="text-[10px] text-slate-400 max-w-md mx-auto">{error}</p>
          </div>
          <button
            onClick={() => fetchClusterHealth()}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-lg transition active:scale-95 cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      ) : (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Overall Node Health */}
            <div className="bg-slate-50/50 dark:bg-slate-950/15 border border-slate-200/60 dark:border-slate-800/80 p-3.5 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-slate-500" />
                  Overall Node Health
                </span>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  Stable
                </span>
              </div>

              {loading && !healthData ? (
                <div className="space-y-3 animate-pulse py-1">
                  <div className="flex items-baseline justify-between">
                    <div className="h-7 w-16 bg-slate-200 dark:bg-slate-800 rounded-md" />
                    <div className="h-3.5 w-20 bg-slate-100 dark:bg-slate-800/60 rounded" />
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800/40 rounded-full" />
                  <div className="h-3.5 w-44 bg-slate-100 dark:bg-slate-800/40 rounded" />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-black text-slate-800 dark:text-white font-mono">
                      {healthData?.nodes.ready}/{healthData?.nodes.total}
                    </span>
                    <span className="text-[10px] text-slate-500">Nodes Ready</span>
                  </div>
                  
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <motion.div 
                      className="bg-emerald-500 h-full" 
                      initial={{ width: 0 }}
                      animate={{ width: `${((healthData?.nodes.ready || 1) / (healthData?.nodes.total || 1)) * 100}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                    />
                  </div>
                  
                  {healthData?.nodes.notReady && healthData.nodes.notReady > 0 ? (
                    <div className="text-[9px] font-bold text-rose-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {healthData.nodes.notReady} node(s) unhealthy or not responding
                    </div>
                  ) : (
                    <div className="text-[9px] text-slate-400 flex items-center gap-1 font-medium">
                      All provisioned nodes are healthy and executing scheduled tasks
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. API Server Latency */}
            <div className="bg-slate-50/50 dark:bg-slate-950/15 border border-slate-200/60 dark:border-slate-800/80 p-3.5 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Wifi className="w-3.5 h-3.5 text-slate-500" />
                  API Server Response
                </span>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border ${getLatencyColor(healthData?.latencyMs || 0)}`}>
                  Latency
                </span>
              </div>

              {loading && !healthData ? (
                <div className="space-y-3.5 animate-pulse py-1">
                  <div className="flex items-baseline justify-between">
                    <div className="h-7 w-20 bg-slate-200 dark:bg-slate-800 rounded-md" />
                    <div className="h-3 w-28 bg-slate-100 dark:bg-slate-800/60 rounded" />
                  </div>
                  <div className="flex gap-0.5 items-end h-3 pt-1">
                    {Array.from({ length: 14 }).map((_, i) => (
                      <div key={i} className="w-1 h-2 bg-slate-100 dark:bg-slate-800/60 rounded-t-sm" />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-black text-slate-800 dark:text-white font-mono">
                      {healthData?.latencyMs} <span className="text-xs font-semibold text-slate-400">ms</span>
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">
                      {healthData?.latencyMs && healthData.latencyMs < 50 ? 'Excellent connection' : 'Slight network congestion'}
                    </span>
                  </div>

                  <div className="flex gap-0.5 items-end h-3 pt-1">
                    {/* Tiny animated bars just for aesthetic response weight */}
                    {[12, 18, 14, 25, 30, 15, 20, 24, 28, 12, 15, 19, (healthData?.latencyMs || 20) / 2].map((h, i) => (
                      <motion.div 
                        key={i} 
                        initial={{ height: 2 }}
                        animate={{ height: `${Math.min(h, 12)}px` }}
                        transition={{ type: 'spring', damping: 10, stiffness: 180, delay: i * 0.015 }}
                        className={`w-1 rounded-t-sm transition-all duration-350 ${
                          (healthData?.latencyMs || 0) > 150 ? 'bg-rose-400' : 'bg-blue-400 dark:bg-blue-500'
                        }`} 
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Controller Status Components */}
            <div className="bg-slate-50/50 dark:bg-slate-950/15 border border-slate-200/60 dark:border-slate-800/80 p-3.5 rounded-xl space-y-3">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-slate-500" />
                Control Plane Integrity
              </span>

              {loading && !healthData ? (
                <div className="grid grid-cols-3 gap-1.5 animate-pulse py-1">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-900/80 p-2 border border-slate-200/40 dark:border-slate-800/50 rounded-lg text-center space-y-2 h-14 flex flex-col justify-between">
                      <div className="h-2.5 w-10 bg-slate-100 dark:bg-slate-800 mx-auto rounded" />
                      <div className="h-4.5 w-14 bg-slate-200 dark:bg-slate-850 mx-auto rounded-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="bg-white dark:bg-slate-900/80 p-2 border border-slate-200/40 dark:border-slate-800/50 rounded-lg text-center space-y-1">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Controller</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      healthData?.components.controllerManager === 'Healthy'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400'
                    }`}>
                      {healthData?.components.controllerManager}
                    </span>
                  </div>

                  <div className="bg-white dark:bg-slate-900/80 p-2 border border-slate-200/40 dark:border-slate-800/50 rounded-lg text-center space-y-1">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">Scheduler</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      healthData?.components.scheduler === 'Healthy'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400'
                    }`}>
                      {healthData?.components.scheduler}
                    </span>
                  </div>

                  <div className="bg-white dark:bg-slate-900/80 p-2 border border-slate-200/40 dark:border-slate-800/50 rounded-lg text-center space-y-1">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block">etcd database</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      healthData?.components.etcd === 'Healthy'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400'
                    }`}>
                      {healthData?.components.etcd}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Node Inspector Accordion */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900/40">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full px-4 py-2.5 bg-slate-50/50 dark:bg-slate-950/10 hover:bg-slate-100/40 dark:hover:bg-slate-950/30 transition text-left flex items-center justify-between text-[11px] font-bold text-slate-700 dark:text-slate-300 select-none cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-slate-500" />
                <span>Node Hardware Specifications ({healthData?.nodes.list.length || 0})</span>
              </span>
              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-normal">
                <span>{isExpanded ? 'Collapse' : 'Expand Node details'}</span>
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </div>
            </button>

            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeInOut' }}
                  className="border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden"
                >
                  <div className="p-3">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-[10px]">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                            <th className="py-2 px-3">Node Name</th>
                            <th className="py-2 px-3">Role</th>
                            <th className="py-2 px-3">CPU Capacity</th>
                            <th className="py-2 px-3">Memory Capacity</th>
                            <th className="py-2 px-3 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50 text-slate-700 dark:text-slate-300 font-mono">
                          {healthData?.nodes.list.map((node, index) => (
                            <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                              <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">{node.name}</td>
                              <td className="py-2 px-3">
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase text-[8px] border border-slate-200/50 dark:border-slate-700/50">
                                  {node.role}
                                </span>
                              </td>
                              <td className="py-2 px-3">{node.cpu}</td>
                              <td className="py-2 px-3">{node.memory}</td>
                              <td className="py-2 px-3 text-right">
                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                  node.status === 'Ready'
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400'
                                    : 'bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400'
                                }`}>
                                  <span className={`w-1 h-1 rounded-full ${node.status === 'Ready' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                  {node.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer timestamp */}
          {healthData?.polledAt && (
            <div className="flex items-center justify-between text-[9px] text-slate-400 dark:text-slate-500 font-mono pt-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Last Polled: {new Date(healthData.polledAt).toLocaleString()}
              </span>
              <span>Next Poll in {autoRefresh ? '10s' : 'manual click'}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
