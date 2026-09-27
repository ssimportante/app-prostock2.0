/**
 * Client-side CSRF token helper.
 * Reads the CSRF token from the non-httpOnly cookie and adds it to fetch headers.
 */

function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)prostock-csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Merge CSRF token into a HeadersInit object for mutation requests.
 */
export function withCsrfHeaders(headers: HeadersInit = {}): HeadersInit {
  const token = getCsrfToken();
  if (!token) return headers;

  if (headers instanceof Headers) {
    const cloned = new Headers(headers);
    cloned.set('X-CSRF-Token', token);
    return cloned;
  }

  if (Array.isArray(headers)) {
    return [...headers, ['X-CSRF-Token', token]];
  }

  return { ...headers, 'X-CSRF-Token': token };
}
