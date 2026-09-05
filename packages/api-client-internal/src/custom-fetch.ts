const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * Orval fetch mutator: cookie auth (`credentials: "include"`) against apps/api.
 * `process.env.NEXT_PUBLIC_API_URL` is written so Next.js can inline it in browser builds.
 */
export async function customFetch<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const headers = new Headers(options?.headers);
  if (options?.body instanceof FormData) {
    headers.delete("Content-Type");
  }
  const response = await fetch(`${apiBaseUrl}${url}`, {
    ...options,
    headers,
    credentials: "include",
  });

  const hasBody = response.status !== 204 && response.status !== 205;
  const contentType = response.headers.get("content-type") ?? "";
  const isJson =
    contentType.includes("application/json") || contentType.includes("+json");
  const data = hasBody
    ? isJson
      ? await response.json()
      : await response.blob()
    : undefined;

  return { data, status: response.status, headers: response.headers } as T;
}
