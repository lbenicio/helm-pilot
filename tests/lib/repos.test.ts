import { beforeEach, describe, expect, it } from 'vitest';

import { addRepo, getRepos, getSearchCache, removeRepo, repos } from '@/lib/repos';

describe('repos', () => {
  beforeEach(() => {
    // Reset the module-level repos array in place by clearing it.
    // The module re-exports `repos` as a live binding, so mutating this
    // reference is sufficient to reset state between tests.
    repos.splice(0, repos.length);
  });

  // -----------------------------------------------------------------------
  // getRepos
  // -----------------------------------------------------------------------
  describe('getRepos', () => {
    it('returns an empty array initially', () => {
      expect(getRepos()).toEqual([]);
    });

    it('returns all added repos', () => {
      addRepo({ name: 'stable', url: 'https://charts.helm.sh/stable' });
      addRepo({ name: 'bitnami', url: 'https://charts.bitnami.com/bitnami' });
      expect(getRepos()).toHaveLength(2);
      expect(getRepos()).toEqual([
        { name: 'stable', url: 'https://charts.helm.sh/stable' },
        { name: 'bitnami', url: 'https://charts.bitnami.com/bitnami' },
      ]);
    });
  });

  // -----------------------------------------------------------------------
  // addRepo
  // -----------------------------------------------------------------------
  describe('addRepo', () => {
    it('adds a new repo and returns true', () => {
      const result = addRepo({ name: 'incubator', url: 'https://charts.helm.sh/incubator' });
      expect(result).toBe(true);
      expect(getRepos()).toEqual([
        { name: 'incubator', url: 'https://charts.helm.sh/incubator' },
      ]);
    });

    it('prevents adding a duplicate repo with the same name (case-insensitive) and returns false', () => {
      addRepo({ name: 'MyRepo', url: 'https://example.com/charts' });
      const result = addRepo({ name: 'myrepo', url: 'https://different-url.com' });
      expect(result).toBe(false);
      expect(getRepos()).toHaveLength(1);
      // The original entry (with original casing) is preserved
      expect(getRepos()[0]).toEqual({ name: 'MyRepo', url: 'https://example.com/charts' });
    });

    it('allows adding repos with different names but the same URL', () => {
      addRepo({ name: 'repo-a', url: 'https://same-url.com' });
      const result = addRepo({ name: 'repo-b', url: 'https://same-url.com' });
      expect(result).toBe(true);
      expect(getRepos()).toHaveLength(2);
    });

    it('handles multiple additions sequentially', () => {
      expect(addRepo({ name: 'first', url: 'https://first.com' })).toBe(true);
      expect(addRepo({ name: 'second', url: 'https://second.com' })).toBe(true);
      expect(addRepo({ name: 'third', url: 'https://third.com' })).toBe(true);
      expect(getRepos()).toHaveLength(3);
    });

    it('returns false for all subsequent duplicates after the first add', () => {
      addRepo({ name: 'unique', url: 'https://unique.com' });
      expect(addRepo({ name: 'UNIQUE', url: 'https://other.com' })).toBe(false);
      expect(addRepo({ name: 'Unique', url: 'https://another.com' })).toBe(false);
      expect(getRepos()).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // removeRepo
  // -----------------------------------------------------------------------
  describe('removeRepo', () => {
    it('removes an existing repo by name (case-insensitive)', () => {
      addRepo({ name: 'Stable', url: 'https://stable.com' });
      addRepo({ name: 'bitnami', url: 'https://bitnami.com' });
      expect(getRepos()).toHaveLength(2);

      removeRepo('stable');
      expect(getRepos()).toHaveLength(1);
      expect(getRepos()[0]).toEqual({ name: 'bitnami', url: 'https://bitnami.com' });
    });

    it('is a no-op when the repo does not exist', () => {
      addRepo({ name: 'only-repo', url: 'https://only.com' });
      removeRepo('nonexistent');
      expect(getRepos()).toHaveLength(1);
      expect(getRepos()[0].name).toBe('only-repo');
    });

    it('removes all repos when called successively', () => {
      addRepo({ name: 'a', url: 'https://a.com' });
      addRepo({ name: 'b', url: 'https://b.com' });
      removeRepo('a');
      expect(getRepos()).toHaveLength(1);
      removeRepo('b');
      expect(getRepos()).toEqual([]);
    });

    it('handles removing with different casing', () => {
      addRepo({ name: 'MyChartRepo', url: 'https://charts.example.com' });
      removeRepo('myChartrepo');
      expect(getRepos()).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // getSearchCache
  // -----------------------------------------------------------------------
  describe('getSearchCache', () => {
    it('returns an empty Map initially', () => {
      const cache = getSearchCache();
      expect(cache).toBeInstanceOf(Map);
      expect(cache.size).toBe(0);
    });

    it('returns the same Map instance across calls', () => {
      const cache1 = getSearchCache();
      const cache2 = getSearchCache();
      expect(cache1).toBe(cache2);
    });

    it('can be used to store and retrieve cached chart data', () => {
      const cache = getSearchCache();
      cache.set('stable', { charts: [{ name: 'nginx' }], fetchedAt: Date.now() });
      expect(cache.has('stable')).toBe(true);
      expect(cache.get('stable')!.charts).toEqual([{ name: 'nginx' }]);
    });
  });

  // -----------------------------------------------------------------------
  // repos export
  // -----------------------------------------------------------------------
  describe('repos export', () => {
    it('is the same reference as getRepos return value', () => {
      addRepo({ name: 'test', url: 'https://test.com' });
      expect(repos).toBe(getRepos());
      expect(repos.length).toBe(1);
    });
  });
});
