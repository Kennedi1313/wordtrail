export async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok)
    throw new Error(`Request failed with status ${response.status}`);
  return response.json() as Promise<T>;
}
