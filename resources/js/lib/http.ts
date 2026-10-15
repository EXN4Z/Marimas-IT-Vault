// [F9-INERTIA] Helper fetch JSON same-origin, pengganti axios untuk 3 pengecualian JSON:
// (1) polling notifikasi + aksinya, (2) push-subscription, (3) autentikasi channel Echo (/broadcasting/auth).
// Cookie sesi ikut otomatis; CSRF lewat header X-XSRF-TOKEN yang dibaca dari cookie XSRF-TOKEN.
// Mutasi halaman TIDAK lewat sini -- pakai router/useForm Inertia.

export class HttpError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, data: unknown) {
    super('HTTP ' + status);
    this.name = 'HttpError';
    this.status = status;
    this.data = data;
  }
}

function xsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export async function requestJson<T = unknown>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  };

  const token = xsrfToken();
  if (token) headers['X-XSRF-TOKEN'] = token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    method,
    headers,
    credentials: 'same-origin',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) throw new HttpError(res.status, data);
  return data as T;
}
