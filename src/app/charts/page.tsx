'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import InstallChartModal from '@/components/InstallChartModal';
import RepoCatalog from '@/components/RepoCatalog';
import { useApp } from '@/contexts/AppContext';
import { HelmChart } from '@/types/helm-chart.type';

export default function ChartsPage() {
  const { activeCluster, globalSearchQuery, setGlobalSearchQuery } = useApp();
  const router = useRouter();
  const [selectedChart, setSelectedChart] = useState<HelmChart | null>(null);

  return (
    <>
      <RepoCatalog onDeployChart={setSelectedChart} searchQuery={globalSearchQuery} onSearchQueryChange={setGlobalSearchQuery} />
      {selectedChart && (
        <InstallChartModal
          chart={selectedChart}
          activeCluster={activeCluster}
          onClose={() => setSelectedChart(null)}
          onSuccess={() => {
            setSelectedChart(null);
            router.push('/');
          }}
        />
      )}
    </>
  );
}
