export class ApiClientError extends Error {
  constructor(message: string, public status: number, public code?: string, public data?: Record<string, unknown>) {
    super(message);
  }
}

export async function apiFetch<T>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    /* non-JSON */
  }
  if (!res.ok) throw new ApiClientError(String(data.error ?? `Request failed (${res.status})`), res.status, data.code as string | undefined, data);
  return data as T;
}
