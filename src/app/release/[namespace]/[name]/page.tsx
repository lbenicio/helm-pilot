'use client';

import { useParams, useRouter } from 'next/navigation';

import ReleaseDetails from '@/components/ReleaseDetails';
import { useApp } from '@/contexts/AppContext';

export default function ReleasePage() {
  const params = useParams<{ namespace: string; name: string }>();
  const { activeCluster } = useApp();
  const router = useRouter();

  return (
    <ReleaseDetails
      name={params.name}
      namespace={params.namespace}
      activeCluster={activeCluster}
      onClose={() => router.push('/')}
      onRefresh={() => {}}
    />
  );
}
