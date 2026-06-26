import { Activity, AlertTriangle, CheckCircle2, Cpu, Database, Maximize2, RefreshCw, Sliders, TrendingUp } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { K8sCluster } from '@/types/k8s-cluster.type';

interface MetricPoint {
  time: string;
  timestamp: string;
  cpuUsage: number;
  cpuRequest: number;
  cpuLimit: number;
  memUsage: number;
  memRequest: number;
  memLimit: number;
}

interface ResourceUsageChartProps {
  name: string;
  namespace: string;
  activeCluster: K8sCluster | null;
}

export default function ResourceUsageChart({ name, namespace, activeCluster }: ResourceUsageChartProps) {
  const [metrics, setMetrics] = useState<MetricPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'cpu' | 'memory'>('cpu');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [podsFound, setPodsFound] = useState(false);
  const [cpuThreshold, setCpuThreshold] = useState<number>(80);
  const [memThreshold, setMemThreshold] = useState<number>(80);

  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMetrics = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    const headers: any = {};
    if (activeCluster) {
      headers['x-k8s-api-url'] = activeCluster.apiUrl;
      if (activeCluster.token) headers['x-k8s-token'] = activeCluster.token;
      if (activeCluster.caCert) headers['x-k8s-ca-cert'] = activeCluster.caCert;
    }

    try {
      const res = await fetch(`/api/k8s/releases/${namespace}/${name}/usage`, { headers });
      if (!res.ok) {
        throw new Error(`Failed to fetch resource metrics: ${res.statusText}`);
      }
      const data = await res.json();
      setMetrics(data.metrics || []);
      setPodsFound(data.podsFound);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to retrieve telemetry.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [name, namespace, activeCluster]);

  useEffect(() => {
    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(() => {
        fetchMetrics(true);
      }, 5000); // Poll every 5 seconds
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
  }, [autoRefresh, name, namespace, activeCluster]);

  if (loading && metrics.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-xl p-10 flex flex-col items-center justify-center space-y-3 shadow-sm min-h-[300px]">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-400">Loading container resources & performance metrics...</p>
      </div>
    );
  }

  if (error && metrics.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-xl p-10 text-center space-y-3 shadow-sm min-h-[300px] flex flex-col justify-center items-center">
        <AlertTriangle className="w-8 h-8 text-amber-500" />
        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">Metrics Offline</h4>
        <p className="text-[10px] text-slate-500 max-w-sm">{error}</p>
        <button
          onClick={() => fetchMetrics()}
          className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-[#E1E4E8] dark:border-slate-700 rounded-lg text-[10px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition cursor-pointer"
        >
          Retry Telemetry
        </button>
      </div>
    );
  }

  // Calculate current figures (latest index)
  const current = metrics[metrics.length - 1] || {
    cpuUsage: 0,
    cpuRequest: 0,
    cpuLimit: 0,
    memUsage: 0,
    memRequest: 0,
    memLimit: 0,
  };

  // Alert heuristics
  const cpuPercentOfLimit = current.cpuLimit ? (current.cpuUsage / current.cpuLimit) * 100 : 0;
  const memPercentOfLimit = current.memLimit ? (current.memUsage / current.memLimit) * 100 : 0;

  const getStatusTextAndBadge = () => {
    if (cpuPercentOfLimit > cpuThreshold || memPercentOfLimit > memThreshold) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 border border-rose-100 dark:border-rose-900/30">
          <AlertTriangle className="w-3.5 h-3.5" /> Threshold Exceeded
        </span>
      );
    }
    if (cpuPercentOfLimit > cpuThreshold * 0.8 || memPercentOfLimit > memThreshold * 0.8) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30">
          <AlertTriangle className="w-3.5 h-3.5" /> High Load
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
        <CheckCircle2 className="w-3.5 h-3.5" /> Healthy
      </span>
    );
  };

  const isCpuAlert = cpuPercentOfLimit > cpuThreshold;
  const isMemAlert = memPercentOfLimit > memThreshold;
  const currentAlert = activeTab === 'cpu' ? isCpuAlert : isMemAlert;

  return (
    <div className="bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-xl overflow-hidden shadow-sm flex flex-col mt-6">
      {/* Chart Panel Header */}
      <div className="p-4 border-b border-[#E1E4E8] dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-blue-50 dark:bg-slate-800 rounded-lg text-blue-600 dark:text-blue-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-[#1A1A1A] dark:text-slate-100 uppercase tracking-wide">Live Resource Utilization</h3>
              {getStatusTextAndBadge()}
            </div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              {podsFound
                ? 'Aggregated from active Kubernetes Pod containers spec & request bounds'
                : 'Projected release consumption baseline (No active pods discovered)'}
            </p>
          </div>
        </div>

        {/* View togglers & controls */}
        <div className="flex items-center gap-2.5 self-end md:self-auto">
          {/* CPU / MEM Switcher */}
          <div className="bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg flex">
            <button
              onClick={() => setActiveTab('cpu')}
              className={`px-3 py-1 rounded-md text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                activeTab === 'cpu'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Cpu className="w-3 h-3" />
              CPU
            </button>
            <button
              onClick={() => setActiveTab('memory')}
              className={`px-3 py-1 rounded-md text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                activeTab === 'memory'
                  ? 'bg-white dark:bg-slate-900 text-violet-600 dark:text-violet-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Database className="w-3 h-3" />
              Memory
            </button>
          </div>

          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />

          {/* Threshold config */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase hidden sm:inline-block">Alert %:</span>
            <div className="flex items-center border border-[#E1E4E8] dark:border-slate-700 rounded bg-white dark:bg-slate-900">
              <input
                type="number"
                min="1"
                max="100"
                value={activeTab === 'cpu' ? cpuThreshold : memThreshold}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (activeTab === 'cpu') setCpuThreshold(val);
                  else setMemThreshold(val);
                }}
                className="w-10 text-[10px] font-bold text-center bg-transparent focus:outline-none py-1 text-slate-700 dark:text-slate-300"
              />
            </div>
          </div>

          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />

          {/* Polling controller */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`p-1.5 rounded-lg border transition cursor-pointer flex items-center gap-1.5 text-[10px] font-semibold ${
              autoRefresh
                ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400'
            }`}
            title={autoRefresh ? 'Pause streaming telemetry' : 'Resume streaming telemetry'}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-blue-500 animate-ping' : 'bg-slate-400'}`} />
            {autoRefresh ? 'Live' : 'Paused'}
          </button>

          <button
            onClick={() => fetchMetrics()}
            className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition cursor-pointer"
            title="Refresh Metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metrics Readout Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[#E1E4E8] dark:divide-slate-700/80 border-b border-[#E1E4E8] dark:border-slate-700 bg-white dark:bg-slate-900">
        {/* Actual consumption card */}
        <div className={`p-4 flex flex-col justify-between transition-colors ${currentAlert ? 'bg-rose-50/50 dark:bg-rose-950/20' : ''}`}>
          <span
            className={`text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5 ${currentAlert ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'}`}
          >
            <TrendingUp className={`w-3.5 h-3.5 ${currentAlert ? 'text-rose-500 dark:text-rose-400' : 'text-blue-500'}`} />
            Current Utilization
          </span>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span
              className={`text-2xl font-bold font-mono tracking-tight ${currentAlert ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-white'}`}
            >
              {activeTab === 'cpu' ? `${current.cpuUsage}m` : `${current.memUsage}Mi`}
            </span>
            <span
              className={`text-[10px] font-semibold ${currentAlert ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400 dark:text-slate-500'}`}
            >
              {activeTab === 'cpu' ? `(${cpuPercentOfLimit.toFixed(0)}% limit)` : `(${memPercentOfLimit.toFixed(0)}% limit)`}
            </span>
          </div>
        </div>

        {/* Guaranteed request boundary card */}
        <div className="p-4 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-amber-500" />
            Configured Requests
          </span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-slate-700 dark:text-slate-300">
              {activeTab === 'cpu' ? `${current.cpuRequest}m` : `${current.memRequest}Mi`}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">Guaranteed</span>
          </div>
        </div>

        {/* Hard resource limits card */}
        <div className="p-4 flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Maximize2 className="w-3.5 h-3.5 text-rose-500" />
            Hard Limits
          </span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-xl font-bold font-mono text-slate-700 dark:text-slate-300">
              {activeTab === 'cpu' ? `${current.cpuLimit}m` : `${current.memLimit}Mi`}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">Max Cap</span>
          </div>
        </div>
      </div>

      {/* Main Recharts Visualization Stage */}
      <div className="p-5 h-72 bg-white dark:bg-slate-900 flex flex-col">
        {metrics.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-xs text-slate-400">Inspecting metrics queue...</span>
          </div>
        ) : (
          <div className="w-full h-full select-text">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  {/* Linear gradient definitions for glowing visual look */}
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="colorAlert" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E1E4E8" className="dark:stroke-slate-800/80" />
                <XAxis dataKey="time" tickLine={false} axisLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 600 }}
                  unit={activeTab === 'cpu' ? 'm' : 'M'}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(30, 41, 59, 0.95)',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '10px',
                    color: '#f8fafc',
                    fontFamily: 'monospace',
                  }}
                  itemStyle={{ color: '#f8fafc' }}
                  labelStyle={{ fontWeight: 'bold', color: '#94a3b8', marginBottom: '4px' }}
                />
                <Legend
                  verticalAlign="top"
                  height={32}
                  iconType="circle"
                  iconSize={6}
                  wrapperStyle={{ fontSize: '10px', fontWeight: 600, paddingBottom: '10px' }}
                />
                {activeTab === 'cpu' ? (
                  <>
                    <ReferenceLine
                      y={current.cpuLimit * (cpuThreshold / 100)}
                      stroke="#ef4444"
                      strokeDasharray="3 3"
                      opacity={0.5}
                      label={{
                        position: 'insideTopLeft',
                        value: `Alert Threshold (${cpuThreshold}%)`,
                        fill: '#ef4444',
                        fontSize: 10,
                        offset: 5,
                      }}
                    />
                    <Area
                      name="CPU Usage"
                      type="monotone"
                      dataKey="cpuUsage"
                      stroke={isCpuAlert ? '#ef4444' : '#3b82f6'}
                      strokeWidth={2}
                      fillOpacity={1}
                      fill={isCpuAlert ? 'url(#colorAlert)' : 'url(#colorCpu)'}
                    />
                    <Area
                      name="CPU Request"
                      type="monotone"
                      dataKey="cpuRequest"
                      stroke="#f59e0b"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      fillOpacity={0}
                    />
                    <Area name="CPU Limit" type="monotone" dataKey="cpuLimit" stroke="#ef4444" strokeWidth={1.5} fillOpacity={0} />
                  </>
                ) : (
                  <>
                    <ReferenceLine
                      y={current.memLimit * (memThreshold / 100)}
                      stroke="#ef4444"
                      strokeDasharray="3 3"
                      opacity={0.5}
                      label={{
                        position: 'insideTopLeft',
                        value: `Alert Threshold (${memThreshold}%)`,
                        fill: '#ef4444',
                        fontSize: 10,
                        offset: 5,
                      }}
                    />
                    <Area
                      name="Memory Usage"
                      type="monotone"
                      dataKey="memUsage"
                      stroke={isMemAlert ? '#ef4444' : '#8b5cf6'}
                      strokeWidth={2}
                      fillOpacity={1}
                      fill={isMemAlert ? 'url(#colorAlert)' : 'url(#colorMem)'}
                    />
                    <Area
                      name="Memory Request"
                      type="monotone"
                      dataKey="memRequest"
                      stroke="#f59e0b"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      fillOpacity={0}
                    />
                    <Area name="Memory Limit" type="monotone" dataKey="memLimit" stroke="#ef4444" strokeWidth={1.5} fillOpacity={0} />
                  </>
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Footer limits compliance message */}
      <div
        className={`px-4 py-2 border-t border-[#E1E4E8] dark:border-slate-700 text-[9px] flex items-center justify-between font-semibold ${currentAlert ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-500' : 'bg-slate-50 dark:bg-slate-900 text-slate-400'}`}
      >
        <span>Resource quotas active inside virtual cluster control plane</span>
        <span className="capitalize">
          {activeTab} utilization status check: {currentAlert ? 'THRESHOLD EXCEEDED' : 'normal'}
        </span>
      </div>
    </div>
  );
}
