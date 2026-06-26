import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { K8sCluster } from '@/types/k8s-cluster.type';
import { UserSession } from '@/types/user-session.type';

interface AppContextType {
  session: UserSession | null;
  loadingSession: boolean;
  checkSession: () => Promise<void>;
  handleLogout: () => Promise<void>;

  clusters: K8sCluster[];
  activeCluster: K8sCluster | null;
  setActiveCluster: (c: K8sCluster | null) => void;
  handleAddCluster: (cluster: K8sCluster) => void;
  handleRemoveCluster: (id: string) => void;
  handleSelectCluster: (cluster: K8sCluster | null) => void;

  isDarkMode: boolean;
  setIsDarkMode: (d: boolean) => void;

  globalSearchQuery: string;
  setGlobalSearchQuery: (q: string) => void;
  selectedNamespace: string;
  setSelectedNamespace: (ns: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<UserSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [clusters, setClusters] = useState<K8sCluster[]>([]);
  const [activeCluster, setActiveCluster] = useState<K8sCluster | null>(null);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [selectedNamespace, setSelectedNamespace] = useState('all');

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('helm_manager_theme') === 'dark' ||
        (!('helm_manager_theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('helm_manager_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('helm_manager_theme', 'light');
    }
  }, [isDarkMode]);

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { credentials: 'include' });
      const data = await res.json();
      setSession(data);
    } catch (err) {
      console.error('Failed to load session:', err);
    } finally {
      setLoadingSession(false);
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setSession({ authenticated: false });
    } catch (err) {
      console.error('Failed to log out:', err);
    }
  }, []);

  const handleAddCluster = useCallback((cluster: K8sCluster) => {
    setClusters(prev => {
      const updated = [...prev, cluster];
      localStorage.setItem('helm_manager_clusters', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const handleRemoveCluster = useCallback((id: string) => {
    setClusters(prev => {
      const updated = prev.filter(c => c.id !== id);
      localStorage.setItem('helm_manager_clusters', JSON.stringify(updated));
      return updated;
    });
    setActiveCluster(prev => prev?.id === id ? null : prev);
    localStorage.removeItem('helm_manager_active_cluster_id');
  }, []);

  const handleSelectCluster = useCallback((cluster: K8sCluster | null) => {
    setActiveCluster(cluster);
    if (cluster) {
      localStorage.setItem('helm_manager_active_cluster_id', cluster.id);
    } else {
      localStorage.removeItem('helm_manager_active_cluster_id');
    }
  }, []);

  // Load clusters and default cluster on mount
  useEffect(() => {
    checkSession();

    let hasActiveCluster = false;
    let hasSavedClusters = false;
    const saved = localStorage.getItem('helm_manager_clusters');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) hasSavedClusters = true;
        setClusters(parsed);
        const activeSaved = localStorage.getItem('helm_manager_active_cluster_id');
        if (activeSaved) {
          const found = parsed.find((c: K8sCluster) => c.id === activeSaved);
          if (found) { setActiveCluster(found); hasActiveCluster = true; }
        }
      } catch (e) {
        console.error('Error loading saved clusters:', e);
      }
    }

    if (!hasActiveCluster && !hasSavedClusters) {
      fetch('/api/k8s/default-cluster')
        .then(res => res.json())
        .then((defaultCluster: K8sCluster | null) => {
          if (defaultCluster) setActiveCluster(defaultCluster);
        })
        .catch(() => {});
    }
  }, []);

  return (
    <AppContext.Provider value={{
      session, loadingSession, checkSession, handleLogout,
      clusters, activeCluster, setActiveCluster,
      handleAddCluster, handleRemoveCluster, handleSelectCluster,
      isDarkMode, setIsDarkMode,
      globalSearchQuery, setGlobalSearchQuery,
      selectedNamespace, setSelectedNamespace,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
