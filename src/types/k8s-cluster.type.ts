export interface K8sCluster {
  id: string;
  name: string;
  apiUrl: string;
  token?: string;
  caCert?: string;
}
