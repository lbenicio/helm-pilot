export interface HelmRelease {
  name: string;
  namespace: string;
  revision: number;
  updated: string;
  status: 'deployed' | 'failed' | 'uninstalling' | 'pending-install' | 'pending-upgrade' | 'pending-rollback' | string;
  chartName: string;
  chartVersion: string;
  appVersion: string;
  values?: string; // YAML string
  manifest?: string; // Full raw manifest
  notes?: string;
}
