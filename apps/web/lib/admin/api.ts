export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface ErrorBody {
  error?: string;
  code?: string;
}

function isErrorBody(v: unknown): v is ErrorBody {
  return typeof v === 'object' && v !== null && 'error' in v;
}

/**
 * Fetch helper untuk halaman admin:
 * - selalu menyertakan header CSRF `X-Requested-With: fetch`
 * - 401 -> redirect /login; MUST_CHANGE_PIN -> redirect /ganti-pin
 * - galat -> lempar ApiError dengan pesan dari server
 */
export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit & { json?: unknown }
): Promise<T> {
  const headers: Record<string, string> = {
    'X-Requested-With': 'fetch',
    ...(init?.headers as Record<string, string> | undefined),
  };
  let body = init?.body;
  if (init?.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(init.json);
  }

  const res = await fetch(path, { ...init, headers, body });

  let data: unknown = null;
  try {
    data = (await res.json()) as unknown;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const err = isErrorBody(data) ? data : null;
    if (res.status === 401) {
      window.location.href = '/login';
      throw new ApiError('Sesi berakhir. Silakan login ulang.', 401);
    }
    if (err?.code === 'MUST_CHANGE_PIN') {
      window.location.href = '/ganti-pin';
      throw new ApiError('Anda wajib mengubah PIN terlebih dahulu.', 403, 'MUST_CHANGE_PIN');
    }
    throw new ApiError(
      err?.error || 'Terjadi kesalahan pada server',
      res.status,
      err?.code
    );
  }

  return data as T;
}
