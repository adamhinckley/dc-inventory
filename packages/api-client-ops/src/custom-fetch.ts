const apiBaseUrl =
  (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

/**
 * Orval fetch mutator: cookie auth (`credentials: "include"`) against apps/api.
 */
export async function customFetch<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${url}`, {
    ...options,
    credentials: "include",
  });

  const hasBody = response.status !== 204 && response.status !== 205;
  const data = hasBody ? await response.json() : undefined;

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  return { data, status: response.status, headers: response.headers } as T;
}
