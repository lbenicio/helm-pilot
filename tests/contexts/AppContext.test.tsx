import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { K8sCluster } from '@/types/k8s-cluster.type';

import { AppProvider, useApp } from '@/contexts/AppContext';

// ---------------------------------------------------------------------------
// Mock global fetch
// ---------------------------------------------------------------------------
const mockFetch = vi.fn();
global.fetch = mockFetch;

// ---------------------------------------------------------------------------
// localStorage store (populated by the mock installed in beforeEach)
// ---------------------------------------------------------------------------
const lsStore: Record<string, string> = Object.create(null);

// ---------------------------------------------------------------------------
// Test consumer – renders context values and action buttons
// ---------------------------------------------------------------------------
function TestConsumer() {
  const ctx = useApp();
  return (
    <div>
      <span data-testid="authenticated">{String(ctx.session?.authenticated ?? 'null')}</span>
      <span data-testid="email">{ctx.session?.email ?? 'null'}</span>
      <span data-testid="name">{ctx.session?.name ?? 'null'}</span>
      <span data-testid="loading">{String(ctx.loadingSession)}</span>
      <span data-testid="cluster-count">{ctx.clusters.length}</span>
      <span data-testid="active-cluster-id">{ctx.activeCluster?.id ?? 'null'}</span>
      <span data-testid="active-cluster-name">{ctx.activeCluster?.name ?? 'null'}</span>
      <span data-testid="dark-mode">{String(ctx.isDarkMode)}</span>
      <span data-testid="search">{ctx.globalSearchQuery}</span>
      <span data-testid="namespace">{ctx.selectedNamespace}</span>

      <button data-testid="check-session" onClick={() => ctx.checkSession()}>
        Check Session
      </button>
      <button data-testid="logout" onClick={() => ctx.handleLogout()}>
        Logout
      </button>
      <button
        data-testid="add-cluster"
        onClick={() =>
          ctx.handleAddCluster({ id: 'c1', name: 'Cluster 1', apiUrl: 'https://k8s-1.example.com' })
        }
      >
        Add Cluster
      </button>
      <button data-testid="add-cluster-2"
        onClick={() =>
          ctx.handleAddCluster({ id: 'c2', name: 'Cluster 2', apiUrl: 'https://k8s-2.example.com' })
        }
      >
        Add Cluster 2
      </button>
      <button data-testid="remove-cluster" onClick={() => ctx.handleRemoveCluster('c1')}>
        Remove Cluster
      </button>
      <button
        data-testid="select-cluster"
        onClick={() =>
          ctx.handleSelectCluster({ id: 'c1', name: 'Cluster 1', apiUrl: 'https://k8s-1.example.com' })
        }
      >
        Select Cluster
      </button>
      <button data-testid="deselect-cluster" onClick={() => ctx.handleSelectCluster(null)}>
        Deselect
      </button>
      <button data-testid="toggle-dark" onClick={() => ctx.setIsDarkMode(!ctx.isDarkMode)}>
        Toggle Dark
      </button>
      <button data-testid="set-search" onClick={() => ctx.setGlobalSearchQuery('nginx')}>
        Set Search
      </button>
      <button data-testid="set-namespace" onClick={() => ctx.setSelectedNamespace('kube-system')}>
        Set Namespace
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default fetch response for /api/auth/session
// ---------------------------------------------------------------------------
function defaultSessionResponse() {
  return { authenticated: true, email: 'user@test.com', name: 'Test User' };
}

function setupDefaultFetch() {
  mockFetch.mockImplementation(async (url: string) => {
    if (url === '/api/auth/session') {
      return { ok: true, json: () => Promise.resolve(defaultSessionResponse()) };
    }
    if (url === '/api/auth/logout') {
      return { ok: true, json: () => Promise.resolve({ success: true }) };
    }
    if (url === '/api/k8s/default-cluster') {
      return { ok: true, json: () => Promise.resolve(null) };
    }
    return { ok: true, json: () => Promise.resolve({}) };
  });
}

// ---------------------------------------------------------------------------
// Helper to wait until loadingSession becomes false
// ---------------------------------------------------------------------------
async function waitForSessionLoaded() {
  await waitFor(() => {
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('AppContext', () => {
  let user: ReturnType<typeof userEvent.setup>;

  function clearLocalStorage() {
    Object.keys(lsStore).forEach((k) => delete lsStore[k]);
  }

  /**
   * Install a matchMedia stub that returns the given `matches` value.
   */
  function stubMatchMedia(matches: boolean) {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    clearLocalStorage();
    document.documentElement.classList.remove('dark');

    // Install localStorage mock
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => (key in lsStore ? lsStore[key] : null)),
      setItem: vi.fn((key: string, value: string) => {
        lsStore[key] = value;
      }),
      removeItem: vi.fn((key: string) => {
        delete lsStore[key];
      }),
      clear: vi.fn(() => {
        Object.keys(lsStore).forEach((k) => delete lsStore[k]);
      }),
      get length() {
        return Object.keys(lsStore).length;
      },
      key: vi.fn((index: number) => Object.keys(lsStore)[index] ?? null),
    });

    // Default matchMedia: light mode
    stubMatchMedia(false);

    setupDefaultFetch();
    user = userEvent.setup();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  // -----------------------------------------------------------------------
  // Rendering helper
  // -----------------------------------------------------------------------
  function renderApp() {
    return render(
      <AppProvider>
        <TestConsumer />
      </AppProvider>,
    );
  }

  // =====================================================================
  // Basic state provision
  // =====================================================================
  describe('state provision', () => {
    it('provides session state after mount', async () => {
      renderApp();
      await waitForSessionLoaded();

      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
      expect(screen.getByTestId('email')).toHaveTextContent('user@test.com');
      expect(screen.getByTestId('name')).toHaveTextContent('Test User');
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    it('provides clusters as an empty array initially', async () => {
      renderApp();
      await waitForSessionLoaded();

      expect(screen.getByTestId('cluster-count')).toHaveTextContent('0');
    });

    it('provides activeCluster as null initially', async () => {
      renderApp();
      await waitForSessionLoaded();

      expect(screen.getByTestId('active-cluster-id')).toHaveTextContent('null');
    });

    it('provides dark mode state (defaults to false)', async () => {
      renderApp();
      await waitForSessionLoaded();

      expect(screen.getByTestId('dark-mode')).toHaveTextContent('false');
    });

    it('provides globalSearchQuery as empty string', async () => {
      renderApp();
      await waitForSessionLoaded();

      expect(screen.getByTestId('search')).toHaveTextContent('');
    });

    it('provides selectedNamespace as "all" by default', async () => {
      renderApp();
      await waitForSessionLoaded();

      expect(screen.getByTestId('namespace')).toHaveTextContent('all');
    });

    it('setGlobalSearchQuery updates the search state', async () => {
      renderApp();
      await waitForSessionLoaded();

      await user.click(screen.getByTestId('set-search'));

      expect(screen.getByTestId('search')).toHaveTextContent('nginx');
    });

    it('setSelectedNamespace updates the namespace state', async () => {
      renderApp();
      await waitForSessionLoaded();

      await user.click(screen.getByTestId('set-namespace'));

      expect(screen.getByTestId('namespace')).toHaveTextContent('kube-system');
    });
  });

  // =====================================================================
  // checkSession
  // =====================================================================
  describe('checkSession', () => {
    it('fetches /api/auth/session with credentials: include', async () => {
      // Clear localStorage to avoid default-cluster fetch interfering
      // Pre-populate clusters to skip default cluster fetch
      localStorage.setItem('helm_manager_clusters', JSON.stringify([]));
      renderApp();
      await waitForSessionLoaded();

      // The effect already called checkSession once on mount.
      // Now we click the button to test the direct call.
      mockFetch.mockClear();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ authenticated: true, email: 'second@test.com', name: 'Second User' }),
      });

      await user.click(screen.getByTestId('check-session'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/auth/session', { credentials: 'include' });
      });
    });

    it('updates session state after a successful checkSession call', async () => {
      localStorage.setItem('helm_manager_clusters', JSON.stringify([]));
      renderApp();
      await waitForSessionLoaded();

      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ authenticated: true, email: 'updated@test.com', name: 'Updated User' }),
      });

      await user.click(screen.getByTestId('check-session'));

      await waitFor(() => {
        expect(screen.getByTestId('email')).toHaveTextContent('updated@test.com');
        expect(screen.getByTestId('name')).toHaveTextContent('Updated User');
      });
    });

    it('sets loadingSession to false even when fetch fails', async () => {
      // Save a cluster so the default-cluster fetch is not triggered
      localStorage.setItem(
        'helm_manager_clusters',
        JSON.stringify([{ id: 's', name: 'S', apiUrl: 'https://s.k8s' }]),
      );
      mockFetch.mockReset();
      // Mount will call checkSession which will fail
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderApp();

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      expect(consoleSpy).toHaveBeenCalledWith('Failed to load session:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  // =====================================================================
  // handleLogout
  // =====================================================================
  describe('handleLogout', () => {
    it('calls POST /api/auth/logout', async () => {
      localStorage.setItem('helm_manager_clusters', JSON.stringify([]));
      renderApp();
      await waitForSessionLoaded();

      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await user.click(screen.getByTestId('logout'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
      });
    });

    it('sets session to { authenticated: false } after logout', async () => {
      localStorage.setItem('helm_manager_clusters', JSON.stringify([]));
      renderApp();
      await waitForSessionLoaded();

      // At this point session is authenticated (from mount)
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');

      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await user.click(screen.getByTestId('logout'));

      await waitFor(() => {
        expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      });
    });

    it('handles logout failure gracefully (not crashing)', async () => {
      localStorage.setItem('helm_manager_clusters', JSON.stringify([]));
      renderApp();
      await waitForSessionLoaded();

      mockFetch.mockClear();
      mockFetch.mockRejectedValueOnce(new Error('Logout failed'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await user.click(screen.getByTestId('logout'));

      // Even on failure, session should be set to { authenticated: false }
      // because the handler sets it in the try block before the fetch, wait...
      // Actually looking at the source more carefully:
      //   const handleLogout = useCallback(async () => {
      //     try {
      //       await fetch('/api/auth/logout', { method: 'POST' });
      //       setSession({ authenticated: false });
      //     } catch (err) { ... }
      //   }, []);
      // So setSession is ONLY called on success. On failure, session stays.
      // But the error is logged.
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to log out:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });

  // =====================================================================
  // handleAddCluster
  // =====================================================================
  describe('handleAddCluster', () => {
    it('adds a cluster to the clusters array', async () => {
      localStorage.setItem('helm_manager_clusters', JSON.stringify([]));
      renderApp();
      await waitForSessionLoaded();

      expect(screen.getByTestId('cluster-count')).toHaveTextContent('0');

      await user.click(screen.getByTestId('add-cluster'));

      expect(screen.getByTestId('cluster-count')).toHaveTextContent('1');
    });

    it('persists clusters to localStorage', async () => {
      localStorage.setItem('helm_manager_clusters', JSON.stringify([]));
      renderApp();
      await waitForSessionLoaded();

      await user.click(screen.getByTestId('add-cluster'));

      const saved = JSON.parse(localStorage.getItem('helm_manager_clusters')!);
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject({
        id: 'c1',
        name: 'Cluster 1',
        apiUrl: 'https://k8s-1.example.com',
      });
    });

    it('appends to existing clusters', async () => {
      const existing: K8sCluster[] = [
        { id: 'existing-1', name: 'Existing', apiUrl: 'https://existing.k8s' },
      ];
      localStorage.setItem('helm_manager_clusters', JSON.stringify(existing));
      renderApp();
      await waitForSessionLoaded();

      // Should show the existing cluster
      expect(screen.getByTestId('cluster-count')).toHaveTextContent('1');

      await user.click(screen.getByTestId('add-cluster'));

      expect(screen.getByTestId('cluster-count')).toHaveTextContent('2');
      const saved = JSON.parse(localStorage.getItem('helm_manager_clusters')!);
      expect(saved).toHaveLength(2);
      expect(saved[0].id).toBe('existing-1');
      expect(saved[1].id).toBe('c1');
    });

    it('persists multiple clusters across additions', async () => {
      localStorage.setItem('helm_manager_clusters', JSON.stringify([]));
      renderApp();
      await waitForSessionLoaded();

      await user.click(screen.getByTestId('add-cluster'));
      await user.click(screen.getByTestId('add-cluster-2'));

      expect(screen.getByTestId('cluster-count')).toHaveTextContent('2');
      const saved = JSON.parse(localStorage.getItem('helm_manager_clusters')!);
      expect(saved).toHaveLength(2);
      expect(saved[0].id).toBe('c1');
      expect(saved[1].id).toBe('c2');
    });
  });

  // =====================================================================
  // handleRemoveCluster
  // =====================================================================
  describe('handleRemoveCluster', () => {
    it('removes a cluster by ID', async () => {
      const existing: K8sCluster[] = [
        { id: 'c1', name: 'Cluster 1', apiUrl: 'https://k8s-1.example.com' },
        { id: 'c2', name: 'Cluster 2', apiUrl: 'https://k8s-2.example.com' },
      ];
      localStorage.setItem('helm_manager_clusters', JSON.stringify(existing));
      renderApp();
      await waitForSessionLoaded();

      expect(screen.getByTestId('cluster-count')).toHaveTextContent('2');

      await user.click(screen.getByTestId('remove-cluster'));

      expect(screen.getByTestId('cluster-count')).toHaveTextContent('1');
      const saved = JSON.parse(localStorage.getItem('helm_manager_clusters')!);
      expect(saved).toHaveLength(1);
      expect(saved[0].id).toBe('c2');
    });

    it('clears active cluster when removing the selected cluster', async () => {
      const existing: K8sCluster[] = [
        { id: 'c1', name: 'Cluster 1', apiUrl: 'https://k8s-1.example.com' },
      ];
      localStorage.setItem('helm_manager_clusters', JSON.stringify(existing));
      localStorage.setItem('helm_manager_active_cluster_id', 'c1');
      renderApp();
      await waitForSessionLoaded();

      // The mount effect should have restored the active cluster
      expect(screen.getByTestId('active-cluster-id')).toHaveTextContent('c1');

      await user.click(screen.getByTestId('remove-cluster'));

      expect(screen.getByTestId('active-cluster-id')).toHaveTextContent('null');
    });

    it('removes active_cluster_id from localStorage', async () => {
      const existing: K8sCluster[] = [
        { id: 'c1', name: 'Cluster 1', apiUrl: 'https://k8s-1.example.com' },
      ];
      localStorage.setItem('helm_manager_clusters', JSON.stringify(existing));
      localStorage.setItem('helm_manager_active_cluster_id', 'c1');
      renderApp();
      await waitForSessionLoaded();

      await user.click(screen.getByTestId('remove-cluster'));

      expect(localStorage.getItem('helm_manager_active_cluster_id')).toBeNull();
    });

    it('keeps active cluster when removing a different cluster', async () => {
      const existing: K8sCluster[] = [
        { id: 'c1', name: 'Cluster 1', apiUrl: 'https://k8s-1.example.com' },
        { id: 'c2', name: 'Cluster 2', apiUrl: 'https://k8s-2.example.com' },
      ];
      localStorage.setItem('helm_manager_clusters', JSON.stringify(existing));
      localStorage.setItem('helm_manager_active_cluster_id', 'c2');
      renderApp();
      await waitForSessionLoaded();

      expect(screen.getByTestId('active-cluster-id')).toHaveTextContent('c2');

      // Remove c1, active cluster (c2) should stay
      await user.click(screen.getByTestId('remove-cluster'));

      // In-memory activeCluster stays c2, but localStorage is unconditionally
      // cleared by handleRemoveCluster (matches source behaviour).
      expect(screen.getByTestId('active-cluster-id')).toHaveTextContent('c2');
      expect(localStorage.getItem('helm_manager_active_cluster_id')).toBeNull();
    });

    it('updates localStorage clusters after removal', async () => {
      const existing: K8sCluster[] = [
        { id: 'c1', name: 'Cluster 1', apiUrl: 'https://k8s-1.example.com' },
      ];
      localStorage.setItem('helm_manager_clusters', JSON.stringify(existing));
      renderApp();
      await waitForSessionLoaded();

      await user.click(screen.getByTestId('remove-cluster'));

      const saved = JSON.parse(localStorage.getItem('helm_manager_clusters')!);
      expect(saved).toHaveLength(0);
    });
  });

  // =====================================================================
  // handleSelectCluster
  // =====================================================================
  describe('handleSelectCluster', () => {
    it('selects a cluster and updates activeCluster state', async () => {
      localStorage.setItem('helm_manager_clusters', JSON.stringify([]));
      renderApp();
      await waitForSessionLoaded();

      await user.click(screen.getByTestId('select-cluster'));

      expect(screen.getByTestId('active-cluster-id')).toHaveTextContent('c1');
      expect(screen.getByTestId('active-cluster-name')).toHaveTextContent('Cluster 1');
    });

    it('persists the selected cluster ID to localStorage', async () => {
      localStorage.setItem('helm_manager_clusters', JSON.stringify([]));
      renderApp();
      await waitForSessionLoaded();

      await user.click(screen.getByTestId('select-cluster'));

      expect(localStorage.getItem('helm_manager_active_cluster_id')).toBe('c1');
    });

    it('deselects (sets null) and removes from localStorage', async () => {
      localStorage.setItem('helm_manager_clusters', JSON.stringify([]));
      renderApp();
      await waitForSessionLoaded();

      // First select
      await user.click(screen.getByTestId('select-cluster'));
      expect(screen.getByTestId('active-cluster-id')).toHaveTextContent('c1');
      expect(localStorage.getItem('helm_manager_active_cluster_id')).toBe('c1');

      // Then deselect
      await user.click(screen.getByTestId('deselect-cluster'));

      expect(screen.getByTestId('active-cluster-id')).toHaveTextContent('null');
      expect(localStorage.getItem('helm_manager_active_cluster_id')).toBeNull();
    });
  });

  // =====================================================================
  // Dark mode
  // =====================================================================
  describe('dark mode', () => {
    it('toggles dark mode state', async () => {
      localStorage.setItem('helm_manager_clusters', JSON.stringify([]));
      renderApp();
      await waitForSessionLoaded();

      // Default is false
      expect(screen.getByTestId('dark-mode')).toHaveTextContent('false');

      await user.click(screen.getByTestId('toggle-dark'));

      expect(screen.getByTestId('dark-mode')).toHaveTextContent('true');
    });

    it('adds "dark" class to document.documentElement when dark mode is enabled', async () => {
      localStorage.setItem('helm_manager_clusters', JSON.stringify([]));
      renderApp();
      await waitForSessionLoaded();

      await user.click(screen.getByTestId('toggle-dark'));

      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('removes "dark" class from document.documentElement when dark mode is disabled', async () => {
      localStorage.setItem('helm_manager_clusters', JSON.stringify([]));
      // Start with dark mode enabled via localStorage
      localStorage.setItem('helm_manager_theme', 'dark');
      renderApp();
      await waitForSessionLoaded();

      expect(screen.getByTestId('dark-mode')).toHaveTextContent('true');
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      await user.click(screen.getByTestId('toggle-dark'));

      expect(screen.getByTestId('dark-mode')).toHaveTextContent('false');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('persists "dark" to localStorage when enabled', async () => {
      localStorage.setItem('helm_manager_clusters', JSON.stringify([]));
      renderApp();
      await waitForSessionLoaded();

      await user.click(screen.getByTestId('toggle-dark'));

      expect(localStorage.getItem('helm_manager_theme')).toBe('dark');
    });

    it('persists "light" to localStorage when disabled', async () => {
      localStorage.setItem('helm_manager_clusters', JSON.stringify([]));
      localStorage.setItem('helm_manager_theme', 'dark');
      renderApp();
      await waitForSessionLoaded();

      await user.click(screen.getByTestId('toggle-dark'));

      expect(localStorage.getItem('helm_manager_theme')).toBe('light');
    });

    it('initializes dark mode from localStorage when "dark" is saved', async () => {
      localStorage.setItem('helm_manager_theme', 'dark');
      localStorage.setItem('helm_manager_clusters', JSON.stringify([]));
      renderApp();
      await waitForSessionLoaded();

      expect(screen.getByTestId('dark-mode')).toHaveTextContent('true');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('initializes dark mode from localStorage when "light" is saved', async () => {
      localStorage.setItem('helm_manager_theme', 'light');
      localStorage.setItem('helm_manager_clusters', JSON.stringify([]));
      renderApp();
      await waitForSessionLoaded();

      expect(screen.getByTestId('dark-mode')).toHaveTextContent('false');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('initializes dark mode from system preference when no localStorage value', async () => {
      stubMatchMedia(true);
      localStorage.setItem('helm_manager_clusters', JSON.stringify([]));
      // No helm_manager_theme in localStorage
      renderApp();
      await waitForSessionLoaded();

      expect(screen.getByTestId('dark-mode')).toHaveTextContent('true');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('defaults to light mode when no localStorage and system prefers light', async () => {
      stubMatchMedia(false);
      localStorage.setItem('helm_manager_clusters', JSON.stringify([]));
      renderApp();
      await waitForSessionLoaded();

      expect(screen.getByTestId('dark-mode')).toHaveTextContent('false');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('toggles dark mode multiple times correctly', async () => {
      localStorage.setItem('helm_manager_clusters', JSON.stringify([]));
      renderApp();
      await waitForSessionLoaded();

      await user.click(screen.getByTestId('toggle-dark'));
      expect(screen.getByTestId('dark-mode')).toHaveTextContent('true');
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      await user.click(screen.getByTestId('toggle-dark'));
      expect(screen.getByTestId('dark-mode')).toHaveTextContent('false');
      expect(document.documentElement.classList.contains('dark')).toBe(false);

      await user.click(screen.getByTestId('toggle-dark'));
      expect(screen.getByTestId('dark-mode')).toHaveTextContent('true');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  // =====================================================================
  // Load clusters from localStorage on mount
  // =====================================================================
  describe('loading clusters from localStorage on mount', () => {
    it('loads saved clusters into state', async () => {
      const savedClusters: K8sCluster[] = [
        { id: 'saved-1', name: 'Saved One', apiUrl: 'https://saved-1.k8s' },
        { id: 'saved-2', name: 'Saved Two', apiUrl: 'https://saved-2.k8s' },
      ];
      localStorage.setItem('helm_manager_clusters', JSON.stringify(savedClusters));
      renderApp();
      await waitForSessionLoaded();

      expect(screen.getByTestId('cluster-count')).toHaveTextContent('2');
    });

    it('loads and selects the active cluster from localStorage', async () => {
      const savedClusters: K8sCluster[] = [
        { id: 'saved-1', name: 'Saved One', apiUrl: 'https://saved-1.k8s' },
        { id: 'saved-2', name: 'Saved Two', apiUrl: 'https://saved-2.k8s' },
      ];
      localStorage.setItem('helm_manager_clusters', JSON.stringify(savedClusters));
      localStorage.setItem('helm_manager_active_cluster_id', 'saved-2');
      renderApp();
      await waitForSessionLoaded();

      expect(screen.getByTestId('active-cluster-id')).toHaveTextContent('saved-2');
      expect(screen.getByTestId('active-cluster-name')).toHaveTextContent('Saved Two');
    });

    it('does not select a cluster if active_cluster_id is not found in saved clusters', async () => {
      const savedClusters: K8sCluster[] = [
        { id: 'saved-1', name: 'Saved One', apiUrl: 'https://saved-1.k8s' },
      ];
      localStorage.setItem('helm_manager_clusters', JSON.stringify(savedClusters));
      localStorage.setItem('helm_manager_active_cluster_id', 'non-existent-id');
      renderApp();
      await waitForSessionLoaded();

      expect(screen.getByTestId('active-cluster-id')).toHaveTextContent('null');
    });

    it('handles corrupt localStorage data gracefully', async () => {
      localStorage.setItem('helm_manager_clusters', 'not-valid-json{');
      renderApp();
      await waitForSessionLoaded();

      // Should not crash; clusters stays as empty array
      expect(screen.getByTestId('cluster-count')).toHaveTextContent('0');
    });

    it('stays with empty clusters when localStorage has no saved clusters', async () => {
      renderApp();
      await waitForSessionLoaded();

      expect(screen.getByTestId('cluster-count')).toHaveTextContent('0');
    });
  });

  // =====================================================================
  // Load default cluster from /api/k8s/default-cluster
  // =====================================================================
  describe('loading default cluster from API', () => {
    it('fetches /api/k8s/default-cluster when no saved clusters exist', async () => {
      mockFetch.mockReset();
      mockFetch.mockImplementation(async (url: string) => {
        if (url === '/api/auth/session') {
          return { ok: true, json: () => Promise.resolve(defaultSessionResponse()) };
        }
        if (url === '/api/k8s/default-cluster') {
          return {
            ok: true,
            json: () => Promise.resolve({ id: 'default-cluster', name: 'Default', apiUrl: 'https://default.k8s' }),
          };
        }
        return { ok: true, json: () => Promise.resolve({}) };
      });

      renderApp();
      await waitForSessionLoaded();

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/k8s/default-cluster');
      });
    });

    it('sets the default cluster as activeCluster', async () => {
      mockFetch.mockReset();
      mockFetch.mockImplementation(async (url: string) => {
        if (url === '/api/auth/session') {
          return { ok: true, json: () => Promise.resolve(defaultSessionResponse()) };
        }
        if (url === '/api/k8s/default-cluster') {
          return {
            ok: true,
            json: () => Promise.resolve({ id: 'default-cluster', name: 'Default Cluster', apiUrl: 'https://default.k8s' }),
          };
        }
        return { ok: true, json: () => Promise.resolve({}) };
      });

      renderApp();
      await waitForSessionLoaded();

      await waitFor(() => {
        expect(screen.getByTestId('active-cluster-id')).toHaveTextContent('default-cluster');
        expect(screen.getByTestId('active-cluster-name')).toHaveTextContent('Default Cluster');
      });
    });

    it('does not fetch default cluster when saved clusters exist', async () => {
      const savedClusters: K8sCluster[] = [
        { id: 'saved-1', name: 'Saved One', apiUrl: 'https://saved-1.k8s' },
      ];
      localStorage.setItem('helm_manager_clusters', JSON.stringify(savedClusters));

      mockFetch.mockReset();
      mockFetch.mockImplementation(async (url: string) => {
        if (url === '/api/auth/session') {
          return { ok: true, json: () => Promise.resolve(defaultSessionResponse()) };
        }
        return { ok: true, json: () => Promise.resolve({}) };
      });

      renderApp();
      await waitForSessionLoaded();

      // Give a tick for any pending promises
      await new Promise((r) => setTimeout(r, 50));

      // Should not have called default-cluster endpoint
      const defaultClusterCalls = mockFetch.mock.calls.filter(
        (call: any[]) => call[0] === '/api/k8s/default-cluster',
      );
      expect(defaultClusterCalls).toHaveLength(0);
    });

    it('does not fetch default cluster when active cluster is already selected', async () => {
      const savedClusters: K8sCluster[] = [
        { id: 'active-1', name: 'Active One', apiUrl: 'https://active-1.k8s' },
      ];
      localStorage.setItem('helm_manager_clusters', JSON.stringify(savedClusters));
      localStorage.setItem('helm_manager_active_cluster_id', 'active-1');

      mockFetch.mockReset();
      mockFetch.mockImplementation(async (url: string) => {
        if (url === '/api/auth/session') {
          return { ok: true, json: () => Promise.resolve(defaultSessionResponse()) };
        }
        return { ok: true, json: () => Promise.resolve({}) };
      });

      renderApp();
      await waitForSessionLoaded();

      await new Promise((r) => setTimeout(r, 50));

      const defaultClusterCalls = mockFetch.mock.calls.filter(
        (call: any[]) => call[0] === '/api/k8s/default-cluster',
      );
      expect(defaultClusterCalls).toHaveLength(0);
    });

    it('handles default-cluster fetch failure silently', async () => {
      mockFetch.mockReset();
      mockFetch.mockImplementation(async (url: string) => {
        if (url === '/api/auth/session') {
          return { ok: true, json: () => Promise.resolve(defaultSessionResponse()) };
        }
        if (url === '/api/k8s/default-cluster') {
          return Promise.reject(new Error('Connection refused'));
        }
        return { ok: true, json: () => Promise.resolve({}) };
      });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderApp();
      await waitForSessionLoaded();

      await new Promise((r) => setTimeout(r, 50));

      // Should not crash – the catch block is empty (just logs nothing actually)
      expect(screen.getByTestId('active-cluster-id')).toHaveTextContent('null');
      consoleSpy.mockRestore();
    });

    it('does not set activeCluster when default-cluster returns null', async () => {
      mockFetch.mockReset();
      mockFetch.mockImplementation(async (url: string) => {
        if (url === '/api/auth/session') {
          return { ok: true, json: () => Promise.resolve(defaultSessionResponse()) };
        }
        if (url === '/api/k8s/default-cluster') {
          return { ok: true, json: () => Promise.resolve(null) };
        }
        return { ok: true, json: () => Promise.resolve({}) };
      });

      renderApp();
      await waitForSessionLoaded();

      await new Promise((r) => setTimeout(r, 50));

      expect(screen.getByTestId('active-cluster-id')).toHaveTextContent('null');
    });
  });
});
