const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * Orval fetch mutator: cookie auth (`credentials: "include"`) against apps/api.
 * `process.env.NEXT_PUBLIC_API_URL` is written so Next.js can inline it in browser builds.
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

  return { data, status: response.status, headers: response.headers } as T;
}
