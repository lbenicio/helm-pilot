'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import ClusterSelector from './ClusterSelector';
import ContextMenu from './ContextMenu';
import { Ship, Library, LayoutDashboard, LogOut, Moon, Sun, Search, X, ChevronRight, Folder, Copy, Activity, Heart } from 'lucide-react';
import { motion } from 'motion/react';
import pkg from '@/../package.json';

export default function Header() {
  const { session, handleLogout, clusters, activeCluster, handleAddCluster, handleRemoveCluster, handleSelectCluster, isDarkMode, setIsDarkMode, globalSearchQuery, setGlobalSearchQuery, selectedNamespace, setSelectedNamespace } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; path: string } | null>(null);

  const isCharts = pathname === '/charts';
  const isDashboard = pathname === '/';
  const isRelease = pathname.startsWith('/release/');
  const isEvents = pathname === '/events';
  const isHealth = pathname === '/health';
  const isSearch = pathname === '/search';
  const parts = pathname.split('/').filter(Boolean);
  const releaseNs = isRelease ? parts[1] : null;
  const releaseName = isRelease ? parts[2] : null;

  return (
    <>
      <header className="sticky top-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-[#E1E4E8] dark:border-slate-800 z-40 transition-colors duration-200">
        <div className="px-6 md:px-8 h-16 flex items-center justify-between">
          <button onClick={() => router.push('/')} className="flex items-center gap-2.5 hover:opacity-80 transition cursor-pointer">
            <div className="p-2 bg-blue-600 rounded-xl text-white shadow-sm"><Ship className="w-5 h-5" /></div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">Helm Manager</h1>
              <span className="text-[10px] text-slate-400 font-mono block">v{pkg.version}</span>
            </div>
          </button>

          <nav className="hidden md:flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 border border-[#E1E4E8] dark:border-slate-700 rounded-xl">
            <button onClick={() => router.push('/')} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${isDashboard ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}`}>
              <LayoutDashboard className="w-3.5 h-3.5" />Dashboard
            </button>
            <button onClick={() => router.push('/charts')} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${isCharts ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}`}>
              <Library className="w-3.5 h-3.5" />Charts
            </button>
            <button onClick={() => router.push('/events')} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${isEvents ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}`}>
              <Activity className="w-3.5 h-3.5" />Events
            </button>
            <button onClick={() => router.push('/health')} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${isHealth ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}`}>
              <Heart className="w-3.5 h-3.5" />Health
            </button>
          </nav>

          <div className="hidden md:flex items-center relative flex-1 max-w-xs lg:max-w-sm xl:max-w-md mx-4">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input type="text" placeholder="Search..." value={globalSearchQuery}
              onChange={(e) => setGlobalSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && globalSearchQuery) router.push(`/search?q=${encodeURIComponent(globalSearchQuery)}`); }}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-[#E1E4E8] dark:border-slate-700 rounded-xl pl-9.5 pr-8 py-2 text-xs text-[#1A1A1A] dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:focus:ring-slate-800 focus:border-blue-500 transition shadow-sm" />
            {globalSearchQuery && <button onClick={() => setGlobalSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded transition cursor-pointer"><X className="w-3.5 h-3.5" /></button>}
          </div>

          <div className="flex items-center gap-3">
            <ClusterSelector clusters={clusters} activeCluster={activeCluster} onSelectCluster={handleSelectCluster} onAddCluster={handleAddCluster} onRemoveCluster={handleRemoveCluster} />
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl transition cursor-pointer">
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {session && (
              <>
                <div className="hidden lg:flex flex-col text-right">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{session.name || 'Operator'}</span>
                  <span className="text-[9px] text-slate-400 font-mono mt-0.5">{session.email}</span>
                </div>
                <button onClick={handleLogout} className="p-2 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 border border-transparent hover:border-rose-100 dark:hover:border-rose-800/30 rounded-xl transition cursor-pointer">
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="px-6 md:px-8 mt-8">
        <div className="flex items-center flex-wrap gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 mb-6 bg-white dark:bg-slate-900 border border-[#E1E4E8] dark:border-slate-800 px-4 py-2.5 rounded-xl shadow-sm">
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} onClick={() => { router.push('/'); setSelectedNamespace('all'); }}
            className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition py-0.5 px-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md">
            <LayoutDashboard className="w-3.5 h-3.5 text-slate-400" /><span>Dashboard</span>
          </motion.button>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />

          {isRelease && releaseNs && releaseName ? (
            <>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} onClick={() => { router.push('/'); setSelectedNamespace(releaseNs); }}
                className="hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition py-0.5 px-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md flex items-center gap-1">
                <Folder className="w-3.5 h-3.5 text-slate-400" />
                <span className="flex items-center gap-1">Namespace: <b className="font-mono">{releaseNs}</b></span>
              </motion.button>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600" />
              <span className="text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md font-bold font-mono">{releaseName}</span>
            </>
          ) : isCharts ? (
            <span className="text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md font-bold flex items-center gap-1.5">
              <Library className="w-3.5 h-3.5 text-slate-400" /><span>Chart Store Catalog</span>
            </span>
          ) : isEvents ? (
            <span className="text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md font-bold flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-slate-400" /><span>Live Events</span>
            </span>
          ) : isHealth ? (
            <span className="text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md font-bold flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-slate-400" /><span>Cluster Health</span>
            </span>
          ) : isSearch ? (
            <span className="text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md font-bold flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-slate-400" /><span>Search Results</span>
            </span>
          ) : (
            <span className="text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md font-bold flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-slate-400" />
              <span className="flex items-center gap-1">{selectedNamespace === 'all' ? 'All Namespaces' : <>Namespace: <span className="font-mono font-bold">{selectedNamespace}</span></>}</span>
            </span>
          )}
        </div>
      </div>

      {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)} options={[{ label: 'Copy Path', icon: <Copy className="w-3.5 h-3.5" />, onClick: () => navigator.clipboard.writeText(contextMenu.path) }]} />}
    </>
  );
}
