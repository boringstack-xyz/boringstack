export async function load(): Promise<unknown> {
  return fetch("/api/v1/health");
}
