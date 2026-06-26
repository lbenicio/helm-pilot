// In-memory Helm repo store
let repos: { name: string; url: string }[] = [];
const searchCache = new Map<string, { charts: any[]; fetchedAt: number }>();

export function getRepos() {
  return repos;
}
export function addRepo(repo: { name: string; url: string }) {
  if (repos.some((r) => r.name.toLowerCase() === repo.name.toLowerCase())) return false;
  repos.push(repo);
  return true;
}
export function removeRepo(name: string) {
  repos = repos.filter((r) => r.name.toLowerCase() !== name.toLowerCase());
}
export function getSearchCache() {
  return searchCache;
}
export { repos };
