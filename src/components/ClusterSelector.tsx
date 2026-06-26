import { Check, Plus, RefreshCw, Server, ShieldAlert, Trash2, Wifi, WifiOff, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { K8sCluster } from '@/types/k8s-cluster.type';

interface ClusterSelectorProps {
  clusters: K8sCluster[];
  activeCluster: K8sCluster | null;
  onSelectCluster: (cluster: K8sCluster | null) => void;
  onAddCluster: (cluster: K8sCluster) => void;
  onRemoveCluster: (id: string) => void;
}

export default function ClusterSelector({ clusters, activeCluster, onSelectCluster, onAddCluster, onRemoveCluster }: ClusterSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [caCert, setCaCert] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Connectivity Status State
  const [pingStatus, setPingStatus] = useState<'checking' | 'healthy' | 'degraded' | 'offline'>('checking');
  const [latency, setLatency] = useState<number | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const pingCluster = async () => {
    setPingStatus('checking');
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (activeCluster) {
        headers['x-k8s-api-url'] = activeCluster.apiUrl;
        if (activeCluster.token) {
          if (activeCluster.token) headers['x-k8s-token'] = activeCluster.token;
        }
        if (activeCluster.caCert) {
          headers['x-k8s-ca-cert'] = activeCluster.caCert;
        }
        headers['x-k8s-cluster-name'] = activeCluster.name;
      }

      const startTime = Date.now();
      const response = await fetch('/api/k8s/cluster-health', {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error('Offline');
      }

      const data = await response.json();
      const endTime = Date.now();
      const calculatedLatency = data.latencyMs || endTime - startTime;

      if (data.success) {
        setLatency(calculatedLatency);
        if (calculatedLatency < 120) {
          setPingStatus('healthy');
        } else {
          setPingStatus('degraded');
        }
      } else {
        setPingStatus('offline');
        setLatency(null);
      }
    } catch (err) {
      console.error('Ping failed:', err);
      setPingStatus('offline');
      setLatency(null);
    } finally {
      setLastChecked(new Date());
    }
  };

  useEffect(() => {
    pingCluster();

    const interval = setInterval(() => {
      pingCluster();
    }, 15000); // periodically ping every 15s

    return () => clearInterval(interval);
  }, [activeCluster]);

  const handleTestConnection = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!apiUrl) {
      setTestResult({ success: false, message: 'API URL is required to test.' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const headers: Record<string, string> = {
        'x-k8s-api-url': apiUrl.trim(),
        'x-k8s-ca-cert': caCert.trim(),
      };

      const res = await fetch('/api/k8s/test', { headers });
      const data = await res.json();
      if (data.success) {
        setTestResult({ success: true, message: `Successfully connected! Found namespaces: ${data.namespaces.join(', ')}` });
      } else {
        setTestResult({ success: false, message: data.error || 'Connection failed' });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Network error testing connection' });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !apiUrl) return;

    const newCluster: K8sCluster = {
      id: crypto.randomUUID(),
      name: name.trim(),
      apiUrl: apiUrl.trim(),
      caCert: caCert.trim() || undefined,
    };

    onAddCluster(newCluster);
    onSelectCluster(newCluster);

    // Reset form
    setName('');
    setApiUrl('');
    setCaCert('');
    setTestResult(null);
    setShowAddForm(false);
  };

  return (
    <div className="relative font-sans select-none">
      {/* Cluster Button */}
      <button
        id="btn-active-cluster-status"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2.5 px-4 py-2 rounded-xl border text-sm font-medium transition cursor-pointer active:scale-95 bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/40"
      >
        <Server className="w-4 h-4 shrink-0" />
        <span className="max-w-37.5 truncate">{activeCluster?.name || 'Cluster'}</span>
        <div
          className={`w-2 h-2 rounded-full transition-all duration-300 animate-pulse ${
            pingStatus === 'healthy'
              ? 'bg-emerald-500 shadow-[0_0_8px_#10B981]'
              : pingStatus === 'degraded'
                ? 'bg-amber-500 shadow-[0_0_8px_#F59E0B]'
                : pingStatus === 'offline'
                  ? 'bg-rose-500 shadow-[0_0_8px_#F43F5E]'
                  : 'bg-slate-400 dark:bg-slate-500'
          }`}
          title={
            pingStatus === 'healthy'
              ? `Healthy (${latency}ms)`
              : pingStatus === 'degraded'
                ? `Degraded Latency (${latency}ms)`
                : pingStatus === 'offline'
                  ? 'Offline / Unreachable'
                  : 'Checking connectivity...'
          }
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-xl shadow-lg z-50 p-4 text-[#1A1A1A] dark:text-slate-100">
          <div className="flex items-center justify-between border-b border-[#E1E4E8] dark:border-slate-700 pb-2.5 mb-3">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Clusters & Profiles</h3>
            <button
              onClick={() => {
                setShowAddForm(!showAddForm);
                setTestResult(null);
              }}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Cluster
            </button>
          </div>

          {!showAddForm ? (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {/* Default cluster from env vars (always shown when configured) */}
              {activeCluster && activeCluster.id === 'default' && (
                <div className="flex items-center justify-between p-3 rounded-lg border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30 text-emerald-900 dark:text-emerald-200 font-medium">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                      <Server className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold">{activeCluster.name}</div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 truncate max-w-45">{activeCluster.apiUrl}</div>
                    </div>
                  </div>
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                </div>
              )}

              {/* Added clusters */}
              {clusters.map((cluster) => (
                <div
                  key={cluster.id}
                  onClick={() => {
                    onSelectCluster(cluster);
                    setIsOpen(false);
                  }}
                  className={`flex items-center justify-between p-3 rounded-lg cursor-pointer border transition ${
                    activeCluster?.id === cluster.id
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-950 font-medium'
                      : 'bg-white dark:bg-slate-900 border-[#E1E4E8] dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div
                      className={`p-1.5 rounded-lg ${activeCluster?.id === cluster.id ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}
                    >
                      <Server className="w-4 h-4" />
                    </div>
                    <div className="overflow-hidden">
                      <div className="text-xs font-semibold truncate">{cluster.name}</div>
                      <div className="text-[10px] text-slate-400 truncate select-all">{cluster.apiUrl}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                    {activeCluster?.id === cluster.id && <Check className="w-4 h-4 text-emerald-600" />}
                    <button
                      onClick={() => onRemoveCluster(cluster.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      title="Remove profile"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3 pt-1">
              <div>
                <label className="block text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase mb-1">
                  Cluster Nickname
                </label>
                <input
                  type="text"
                  placeholder="e.g. Production GKE"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-[#1A1A1A] dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase mb-1">API Server URL</label>
                <input
                  type="url"
                  placeholder="https://10.100.0.1:6443"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  required
                  className="w-full bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-lg px-3 py-1.5 text-xs text-[#1A1A1A] dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500"
                />
              </div>

              <div className="text-[10px] text-slate-500 bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 flex items-start gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-500" />
                <p>Authentication is handled automatically via your logged-in session (OIDC). No manual bearer token is required.</p>
              </div>

              {testResult && (
                <div
                  className={`p-2.5 rounded-lg text-[10px] border leading-relaxed ${
                    testResult.success
                      ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400'
                      : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/30 text-rose-800 dark:text-rose-400'
                  }`}
                >
                  {testResult.message}
                </div>
              )}

              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing}
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 text-xs text-slate-700 dark:text-slate-200 font-medium rounded-lg flex items-center gap-1 transition cursor-pointer"
                >
                  {testing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Wifi className="w-3 h-3" />}
                  Test Connection
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-xs text-white font-medium rounded-lg transition cursor-pointer shadow-sm"
                >
                  Save Cluster
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setTestResult(null);
                  }}
                  className="px-2 py-1.5 bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Connectivity Status Info Block */}
          <div className="mt-4 pt-3.5 border-t border-[#E1E4E8] dark:border-slate-800 flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium dark:text-slate-500">API Status:</span>
              <span
                className={`inline-flex items-center gap-1.5 font-bold uppercase ${
                  pingStatus === 'healthy'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : pingStatus === 'degraded'
                      ? 'text-amber-600 dark:text-amber-400'
                      : pingStatus === 'offline'
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    pingStatus === 'healthy'
                      ? 'bg-emerald-500'
                      : pingStatus === 'degraded'
                        ? 'bg-amber-500'
                        : pingStatus === 'offline'
                          ? 'bg-rose-500'
                          : 'bg-slate-400'
                  } animate-pulse`}
                />
                {pingStatus === 'checking' ? 'Checking...' : pingStatus}
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 font-mono text-[9px]">
              {latency !== null && <span>{latency}ms</span>}
              {lastChecked && (
                <span className="opacity-80">
                  Refreshed: {lastChecked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                </span>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  pingCluster();
                }}
                disabled={pingStatus === 'checking'}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300 rounded transition cursor-pointer flex items-center justify-center disabled:opacity-50"
                title="Ping Now"
              >
                <RefreshCw className={`w-3 h-3 ${pingStatus === 'checking' ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
