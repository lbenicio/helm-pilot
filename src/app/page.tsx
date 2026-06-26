'use client';

import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import Dashboard from '@/components/Dashboard';

export default function DashboardPage() {
  const { activeCluster, globalSearchQuery, setGlobalSearchQuery, selectedNamespace, setSelectedNamespace } = useApp();
  const router = useRouter();

  return (
    <Dashboard
      activeCluster={activeCluster}
      onSelectRelease={(ns, name) => router.push(`/release/${ns}/${name}`)}
      onBrowseCharts={() => router.push('/charts')}
      searchQuery={globalSearchQuery}
      onSearchQueryChange={setGlobalSearchQuery}
      selectedNamespace={selectedNamespace}
      onNamespaceChange={setSelectedNamespace}
    />
  );
}
