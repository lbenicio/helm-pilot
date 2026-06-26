import React, { useEffect, useState } from 'react';
import { ChartRepo } from '@/types/chart-repo.type';
import { HelmChart } from '@/types/helm-chart.type';
import { Search, FolderPlus, Trash2, Library, Cpu, Info, Zap, X, ShieldCheck } from 'lucide-react';

interface RepoCatalogProps {
  onDeployChart: (chart: HelmChart) => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
}

export default function RepoCatalog({
  onDeployChart,
  searchQuery: passedSearchQuery,
  onSearchQueryChange,
}: RepoCatalogProps) {
  const [repos, setRepos] = useState<ChartRepo[]>([]);
  const [charts, setCharts] = useState<HelmChart[]>([]);
  
  // Search/Filters
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  const searchQuery = onSearchQueryChange ? (passedSearchQuery ?? '') : localSearchQuery;
  const setSearchQuery = onSearchQueryChange || setLocalSearchQuery;
  const [selectedRepo, setSelectedRepo] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [addingRepo, setAddingRepo] = useState(false);

  // New repo form
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoUrl, setNewRepoUrl] = useState('');
  const [repoError, setRepoError] = useState('');

  // Load repos first
  useEffect(() => {
    fetchRepos();
  }, []);

  // Sync charts when selectedRepo changes
  useEffect(() => {
    fetchCharts();
  }, [selectedRepo]);

  const fetchRepos = async () => {
    try {
      const res = await fetch('/api/repos');
      const data = await res.json();
      setRepos(data);
    } catch (err) {
      console.error('Failed to fetch repos:', err);
    }
  };

  const fetchCharts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedRepo && selectedRepo !== 'all') params.append('repo', selectedRepo);

      const res = await fetch(`/api/repos/search?${params.toString()}`);
      const data = await res.json();
      setCharts(data);
    } catch (err) {
      console.error('Failed to search charts:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredCharts = charts.filter((chart) => {
    const matchesSearch =
      chart.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      chart.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleAddRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    setRepoError('');
    if (!newRepoName || !newRepoUrl) return;

    try {
      const res = await fetch('/api/repos/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRepoName, url: newRepoUrl }),
      });
      const data = await res.json();

      if (res.ok) {
        setRepos(data.repos);
        setNewRepoName('');
        setNewRepoUrl('');
        setAddingRepo(false);
        fetchCharts(); // Refresh list to include newly added repository charts
      } else {
        setRepoError(data.error || 'Failed to add repository.');
      }
    } catch (err: any) {
      setRepoError(err.message || 'Connection error.');
    }
  };

  const handleRemoveRepo = async (name: string) => {
    if (!confirm(`Are you sure you want to remove the "${name}" repository?`)) return;

    try {
      const res = await fetch(`/api/repos/${name}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok) {
        setRepos(data.repos);
        if (selectedRepo === name) {
          setSelectedRepo('all');
        }
        fetchCharts();
      }
    } catch (err) {
      console.error('Failed to remove repo:', err);
    }
  };

  const handleAutoDetect = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/repos/auto-detect', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setRepos(data.repos);
        if (data.added?.length > 0) {
          fetchCharts();
        }
      }
    } catch (err) {
      console.error('Auto-detect failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 font-sans">
      {/* Repositories Sidebar */}
      <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 p-4 rounded-xl flex flex-col space-y-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-[#E1E4E8] dark:border-slate-700 pb-3">
          <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
            <Library className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm">Chart Repositories</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoDetect}
              disabled={loading}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 font-medium cursor-pointer disabled:opacity-50"
              title="Scan cluster for installed charts and add matching repos"
            >
              {loading ? 'Scanning...' : 'Auto-detect'}
            </button>
            <button
              onClick={() => {
                setAddingRepo(!addingRepo);
                setRepoError('');
              }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 font-medium cursor-pointer"
            >
              {addingRepo ? 'Cancel' : 'Add'}
            </button>
          </div>
        </div>

        {addingRepo && (
          <form onSubmit={handleAddRepo} className="bg-slate-50 dark:bg-slate-800 border border-[#E1E4E8] dark:border-slate-700 p-3 rounded-lg space-y-3">
            <div>
              <label className="block text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase mb-1">Repo Name</label>
              <input
                type="text"
                placeholder="e.g. bitnami"
                value={newRepoName}
                onChange={(e) => setNewRepoName(e.target.value)}
                required
                className="w-full bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-[#1A1A1A] dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase mb-1">Repo URL</label>
              <input
                type="url"
                placeholder="https://..."
                value={newRepoUrl}
                onChange={(e) => setNewRepoUrl(e.target.value)}
                required
                className="w-full bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded px-2.5 py-1.5 text-xs text-[#1A1A1A] dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            {repoError && <div className="text-[10px] text-rose-600 leading-normal">{repoError}</div>}
            <button
              type="submit"
              className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-xs font-semibold rounded text-white transition cursor-pointer"
            >
              Add Repo
            </button>
          </form>
        )}

        <div className="space-y-1.5 overflow-y-auto">
          <button
            onClick={() => setSelectedRepo('all')}
            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium border transition ${
              selectedRepo === 'all'
                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800/50 text-blue-800 dark:text-blue-300 font-semibold'
                : 'bg-transparent border-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            All Repositories
          </button>

          {repos.map((repo) => (
            <div
              key={repo.name}
              className={`flex items-center justify-between p-1 pl-3 pr-2 rounded-lg text-xs font-medium border transition ${
                selectedRepo === repo.name
                  ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800/50 text-blue-800 dark:text-blue-300 font-semibold'
                  : 'bg-transparent border-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <span
                className="flex-1 text-left truncate cursor-pointer py-1.5"
                onClick={() => setSelectedRepo(repo.name)}
              >
                {repo.name}
              </span>
              <button
                onClick={() => handleRemoveRepo(repo.name)}
                className="p-1 hover:text-rose-600 text-slate-400 transition cursor-pointer"
                title="Remove repo"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Charts Grid */}
      <div className="lg:col-span-3 space-y-4">
        {/* Filters Panel */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search charts (e.g. nginx, redis, grafana...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#1A1A1A] dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-500 transition shadow-sm"
            />
          </div>
        </div>

        {/* Charts Results */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3 bg-white dark:bg-slate-900 rounded-xl border border-[#E1E4E8] dark:border-slate-700 shadow-sm">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-slate-400">Querying active chart repositories...</p>
          </div>
        ) : filteredCharts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-xl border border-[#E1E4E8] dark:border-slate-700 text-center p-6 shadow-sm">
            <Library className="w-10 h-10 text-slate-400 mb-3" />
            <p className="text-sm text-slate-700 dark:text-slate-200 font-semibold mb-1">No Charts Match Your Search</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm">
              Try searching for common applications, adding custom Helm repositories, or selecting "All Repositories".
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCharts.map((chart) => (
              <div
                key={`${chart.repo}/${chart.name}`}
                className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-[#E1E4E8] dark:border-slate-700 p-5 rounded-xl transition flex flex-col justify-between group shadow-sm"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-50 dark:bg-slate-800 p-2 flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700">
                        {chart.icon ? (
                          <img
                            src={chart.icon}
                            alt={chart.name}
                            className="object-contain w-full h-full max-h-8 max-w-8"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Cpu className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm text-slate-900 dark:text-white group-hover:text-blue-600 transition truncate capitalize max-w-37.5">
                          {chart.name}
                        </h4>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 uppercase">
                          {chart.repo}
                        </span>
                      </div>
                    </div>

                    <div className="text-right text-[10px] text-slate-400 space-y-0.5">
                      <div>Chart v{chart.version}</div>
                      <div>App v{chart.appVersion}</div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 min-h-8">
                    {chart.description}
                  </p>
                </div>

                <div className="border-t border-[#E1E4E8] dark:border-slate-700 pt-3 mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    Verified Helm Payload
                  </div>
                  <button
                    onClick={() => onDeployChart(chart)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white rounded-lg transition flex items-center gap-1 cursor-pointer shadow-sm"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Deploy
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
