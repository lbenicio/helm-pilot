'use client';

import { useRouter, useSearchParams } from 'next/navigation';

import Dashboard from '@/components/Dashboard';
import { useApp } from '@/contexts/AppContext';

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.get('q') || '';
  const { activeCluster, selectedNamespace, setSelectedNamespace } = useApp();

  return (
    <Dashboard
      activeCluster={activeCluster}
      onSelectRelease={(ns, name) => router.push(`/release/${ns}/${name}`)}
      onBrowseCharts={() => router.push(`/charts?q=${encodeURIComponent(query)}`)}
      searchQuery={query}
      onSearchQueryChange={() => {}}
      selectedNamespace={selectedNamespace}
      onNamespaceChange={setSelectedNamespace}
    />
  );
}
