export interface K8sResourceStatus {
  kind: string;
  name: string;
  namespace: string;
  status: 'Healthy' | 'Progressing' | 'Failed' | 'Unknown';
  detail?: string;
}
