'use client';

import { AppProvider } from '@/contexts/AppContext';
import AppShell from './AppShell';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <AppShell>{children}</AppShell>
    </AppProvider>
  );
}
