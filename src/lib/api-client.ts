export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T = unknown>(
  path: string,
  options?: { method?: string; body?: unknown }
): Promise<T> {
  const res = await fetch(path, {
    method: options?.method ?? 'GET',
    headers: options?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError((data as { error?: string })?.error || res.statusText, res.status);
  }
  return data as T;
}
