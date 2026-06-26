import React, { useState } from 'react';
import { HelmChart } from '@/types/helm-chart.type';
import { K8sCluster } from '@/types/k8s-cluster.type';
import { X, Play, RefreshCw, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';

interface InstallChartModalProps {
  chart: HelmChart;
  activeCluster: K8sCluster | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function InstallChartModal({
  chart,
  activeCluster,
  onClose,
  onSuccess,
}: InstallChartModalProps) {
  const [releaseName, setReleaseName] = useState(chart.name);
  const [namespace, setNamespace] = useState('default');
  const [version, setVersion] = useState(chart.version);
  const [valuesYaml, setValuesYaml] = useState(chart.defaultValues || 'replicaCount: 1');
  
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!releaseName || !namespace) return;

    setDeploying(true);
    setError(null);

    const headers: any = {
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
      const res = await fetch('/api/k8s/releases/install', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: releaseName.toLowerCase().trim(),
          namespace: namespace.toLowerCase().trim(),
          chartName: chart.name,
          repoName: chart.repo,
          chartVersion: version,
          valuesYaml,
          isUpgrade: false,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message || 'Helm chart deployed successfully!');
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      } else {
        setError(data.error || 'Failed to install Helm chart.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error during installation.');
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans select-none">
      <div className="bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl animate-in fade-in zoom-in-95 duration-150 text-[#1A1A1A] dark:text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E1E4E8] dark:border-slate-700 p-5 bg-slate-50 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg text-blue-600 dark:text-blue-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Deploy Chart: {chart.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Installs a new Helm release in {activeCluster ? activeCluster.name : 'the active cluster'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleDeploy} className="flex-1 overflow-hidden flex flex-col">
          {/* Modal Content - Split View */}
          <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Form Settings */}
            <div className="lg:col-span-4 space-y-4">
              <div>
                <label className="block text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                  Release Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. frontend-web"
                  value={releaseName}
                  onChange={(e) => setReleaseName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  required
                  className="w-full bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-lg px-3.5 py-2 text-sm text-[#1A1A1A] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                  Namespace
                </label>
                <input
                  type="text"
                  placeholder="e.g. default"
                  value={namespace}
                  onChange={(e) => setNamespace(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  required
                  className="w-full bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-lg px-3.5 py-2 text-sm text-[#1A1A1A] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                  Chart Version
                </label>
                <input
                  type="text"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  required
                  className="w-full bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-lg px-3.5 py-2 text-sm text-[#1A1A1A] dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition font-mono"
                />
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 p-4 border border-[#E1E4E8] dark:border-slate-700 rounded-lg space-y-2">
                <h4 className="text-[10px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Deployment Scope</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                  Helm release state secrets will be written to the cluster namespace. Ensure your Service Account token has secret write permissions.
                </p>
              </div>
            </div>

            {/* Right Column: Values YAML Editor */}
            <div className="lg:col-span-8 flex flex-col min-h-75">
              <label className="block text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1.5">
                values.yaml (Custom Configuration)
              </label>
              <textarea
                value={valuesYaml}
                onChange={(e) => setValuesYaml(e.target.value)}
                rows={15}
                className="flex-1 w-full bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-lg p-4 text-xs text-[#1A1A1A] dark:text-slate-100 font-mono focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition resize-none leading-relaxed"
                placeholder="key: value"
              />
            </div>
          </div>

          {/* Feedback section */}
          {error && (
            <div className="px-6 py-3 bg-rose-50 border-t border-b border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="px-6 py-3 bg-emerald-50 border-t border-b border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 animate-bounce" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Footer actions */}
          <div className="border-t border-[#E1E4E8] dark:border-slate-700 px-6 py-4 bg-slate-50 dark:bg-slate-800 flex justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={deploying}
              className="px-4 py-2 bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={deploying || !!successMsg}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-sm font-semibold text-white rounded-lg transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {deploying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Deploy Release
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
