'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import Dashboard from '@/components/Dashboard';

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
