'use client';

import { Activity, AlertTriangle, CheckCircle2, Database, RefreshCw, Server, Wifi, XCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';

import { useApp } from '@/contexts/AppContext';

interface HealthData {
  success: boolean;
  clusterName: string;
  latencyMs: number;
  nodes: {
    total: number;
    ready: number;
    notReady: number;
    cpuUsagePercent: number;
    memoryUsagePercent: number;
    list: { name: string; status: string; role: string; cpu: string; memory: string }[];
  };
  components: {
    controllerManager: string;
    scheduler: string;
    etcd: string;
  };
  polledAt: string;
}

export default function HealthPage() {
  const { activeCluster } = useApp();
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const headers: any = {};
      if (activeCluster) {
        headers['x-k8s-api-url'] = activeCluster.apiUrl;
        if (activeCluster.token) headers['x-k8s-token'] = activeCluster.token;
        if (activeCluster.caCert) headers['x-k8s-ca-cert'] = activeCluster.caCert;
      }
      const res = await fetch('/api/k8s/cluster-health', { headers });
      if (res.ok) {
        setData(await res.json());
        setError(null);
      } else {
        setError('Failed to fetch health data');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, [activeCluster]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-600" />
            Cluster Health & Diagnostics
          </h2>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {data ? `Last polled: ${new Date(data.polledAt).toLocaleTimeString()}` : 'Loading...'}
          </p>
        </div>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="p-1.5 bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-lg text-slate-500 hover:text-slate-700 transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error ? (
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-xl p-6 text-center">
          <AlertTriangle className="w-6 h-6 text-rose-400 mx-auto mb-2" />
          <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
          <button
            onClick={fetchHealth}
            className="mt-2 px-3 py-1.5 bg-rose-100 dark:bg-rose-900/30 text-xs font-semibold text-rose-700 dark:text-rose-300 rounded-lg"
          >
            Retry
          </button>
        </div>
      ) : loading && !data ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-xl p-5 h-48" />
          ))}
        </div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Server className="w-4 h-4 text-blue-500" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nodes</span>
              </div>
              <div className="text-2xl font-bold text-slate-800 dark:text-white">
                {data.nodes.ready}/{data.nodes.total}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Ready / Total</div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full"
                  style={{ width: `${(data.nodes.ready / Math.max(data.nodes.total, 1)) * 100}%` }}
                />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Wifi className="w-4 h-4 text-amber-500" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">API Latency</span>
              </div>
              <div className="text-2xl font-bold font-mono text-slate-800 dark:text-white">
                {data.latencyMs}
                <span className="text-xs text-slate-400 ml-1">ms</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1">Response time</div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Database className="w-4 h-4 text-purple-500" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Resources</span>
              </div>
              <div className="space-y-2 mt-2">
                <div>
                  <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                    <span>CPU</span>
                    <span>{data.nodes.cpuUsagePercent}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full rounded-full" style={{ width: `${data.nodes.cpuUsagePercent}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                    <span>Memory</span>
                    <span>{data.nodes.memoryUsagePercent}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                    <div className="bg-purple-500 h-full rounded-full" style={{ width: `${data.nodes.memoryUsagePercent}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Node Details Table */}
          <div className="bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Node Inventory</span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400">
                  <th className="text-left px-4 py-2 font-medium">Name</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-left px-4 py-2 font-medium">Role</th>
                  <th className="text-left px-4 py-2 font-medium">CPU</th>
                  <th className="text-left px-4 py-2 font-medium">Memory</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {data.nodes.list.map((node, i) => (
                  <motion.tr
                    key={node.name}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/30"
                  >
                    <td className="px-4 py-2.5 font-mono text-slate-700 dark:text-slate-300">{node.name}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          node.status === 'Ready'
                            ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {node.status === 'Ready' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {node.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{node.role}</td>
                    <td className="px-4 py-2.5 text-slate-500">{node.cpu}</td>
                    <td className="px-4 py-2.5 text-slate-500">{node.memory}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Control Plane Components */}
          <div className="bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950/20 border-b border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Control Plane Components</span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800">
              {(['controllerManager', 'scheduler', 'etcd'] as const).map((comp) => (
                <div key={comp} className="p-4 text-center">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">
                    {comp === 'controllerManager' ? 'Controller' : comp === 'scheduler' ? 'Scheduler' : 'etcd'}
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold ${
                      data.components[comp] === 'Healthy'
                        ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400'
                        : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {data.components[comp] === 'Healthy' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {data.components[comp]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
