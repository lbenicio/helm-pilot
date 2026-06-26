export interface ActivityLog {
  id: string;
  timestamp: string;
  type: 'helm' | 'k8s';
  severity: 'info' | 'warning' | 'error' | 'success';
  category: 'install' | 'upgrade' | 'rollback' | 'uninstall' | 'cluster' | 'repo';
  message: string;
  user?: string;
  details?: any;
}
