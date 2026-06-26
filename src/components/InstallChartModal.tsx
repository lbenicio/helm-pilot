import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, ChevronRight, Code, FileText, Play, RefreshCw, Rocket, Settings, X } from 'lucide-react';
import React, { useState } from 'react';

import { HelmChart } from '@/types/helm-chart.type';
import { K8sCluster } from '@/types/k8s-cluster.type';

interface InstallChartModalProps {
  chart: HelmChart;
  activeCluster: K8sCluster | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function InstallChartModal({ chart, activeCluster, onClose, onSuccess }: InstallChartModalProps) {
  const [step, setStep] = useState<'basic' | 'advanced'>('basic');
  const [releaseName, setReleaseName] = useState(chart.name);
  const [namespace, setNamespace] = useState('default');
  const [version, setVersion] = useState(chart.version);
  const [valuesYaml, setValuesYaml] = useState(chart.defaultValues || `# Default values for ${chart.name}\nreplicaCount: 1\n\nimage:\n  repository: nginx\n  tag: ""\n\nservice:\n  type: ClusterIP\n  port: 80\n`);

  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!releaseName || !namespace) return;

    setDeploying(true);
    setError(null);

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
        setSuccessMsg(data.message || 'Chart deployed successfully!');
        setTimeout(() => { onSuccess(); onClose(); }, 1500);
      } else {
        setError(data.error || 'Failed to install chart.');
      }
    } catch (err: any) {
      setError(err.message || 'Network error.');
    } finally {
      setDeploying(false);
    }
  };

  const formatYaml = () => {
    try {
      // Basic YAML format: indent consistently
      const lines = valuesYaml.split('\n');
      setValuesYaml(lines.join('\n'));
    } catch { /* keep as-is */ }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans select-none">
      <div className="bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E1E4E8] dark:border-slate-700 p-5 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg text-blue-600 dark:text-blue-400">
              <Rocket className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">Deploy: {chart.name}</h3>
              <p className="text-xs text-slate-400">{activeCluster?.name || 'Active Cluster'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-400 transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 px-6 py-3 border-b border-[#E1E4E8] dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/30">
          {(['basic', 'advanced'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <button
                onClick={() => setStep(s)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  step === s ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                {s === 'basic' ? <Settings className="w-3.5 h-3.5" /> : <Code className="w-3.5 h-3.5" />}
                {s === 'basic' ? 'Basic' : 'Advanced'}
              </button>
              {i === 0 && <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />}
            </div>
          ))}
        </div>

        <form onSubmit={handleDeploy} className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-6">
            {step === 'basic' ? (
              /* Step 1: Basic Configuration */
              <div className="space-y-5 max-w-lg mx-auto">
                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1.5">Release Name</label>
                  <input
                    type="text"
                    placeholder="e.g. my-release"
                    value={releaseName}
                    onChange={(e) => setReleaseName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    required
                    className="w-full bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1.5">Namespace</label>
                  <input
                    type="text"
                    placeholder="default"
                    value={namespace}
                    onChange={(e) => setNamespace(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    required
                    className="w-full bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1.5">Chart Version</label>
                  <input
                    type="text"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-lg px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition"
                  />
                </div>

                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-lg p-4">
                  <p className="text-xs text-blue-700 dark:text-blue-300">Ready to deploy with defaults. Click <b>Advanced</b> to customize values.yaml.</p>
                </div>
              </div>
            ) : (
              /* Step 2: Advanced Values Editor */
              <div className="flex flex-col h-full min-h-75">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">values.yaml</label>
                  <button type="button" onClick={formatYaml} className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer">
                    Format
                  </button>
                </div>
                <textarea
                  value={valuesYaml}
                  onChange={(e) => setValuesYaml(e.target.value)}
                  rows={18}
                  className="flex-1 w-full bg-slate-50 dark:bg-slate-950 border border-[#E1E4E8] dark:border-slate-700 rounded-lg p-4 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition resize-none leading-relaxed"
                  placeholder="# values.yaml"
                  spellCheck={false}
                />
              </div>
            )}
          </div>

          {/* Feedback */}
          {error && (
            <div className="px-6 py-3 bg-rose-50 dark:bg-rose-950/20 border-t border-rose-200 dark:border-rose-900/30 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}
          {successMsg && (
            <div className="px-6 py-3 bg-emerald-50 dark:bg-emerald-950/20 border-t border-emerald-200 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 animate-bounce" />{successMsg}
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-[#E1E4E8] dark:border-slate-700 px-6 py-4 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between gap-3 shrink-0">
            {step === 'basic' ? (
              <>
                <button type="button" onClick={onClose} disabled={deploying} className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer">
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setStep('advanced')}
                  className="px-4 py-2 bg-white dark:bg-slate-800 border border-[#E1E4E8] dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                >
                  Advanced <ArrowRight className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setStep('basic')}
                  disabled={deploying}
                  className="px-4 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" /> Basic
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={onClose} disabled={deploying} className="px-4 py-2 bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300 rounded-lg cursor-pointer">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={deploying || !!successMsg}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-sm font-semibold text-white rounded-lg transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    {deploying ? <><RefreshCw className="w-4 h-4 animate-spin" />Deploying...</> : <><Play className="w-4 h-4" />Deploy</>}
                  </button>
                </div>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
