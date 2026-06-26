export interface HelmChart {
  name: string;
  repo: string;
  description: string;
  version: string;
  appVersion: string;
  icon?: string;
  defaultValues?: string; // YAML string
}
