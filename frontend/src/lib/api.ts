type ApiErrorResponse = {
  error?: { code?: string; message?: string };
};

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  signal?: AbortSignal;
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
  }
}

export async function requestApi<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const timeout = AbortSignal.timeout(15_000);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  let response: Response;

  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal,
    });
  } catch (error) {
    if (options.signal?.aborted) {
      throw error;
    }

    throw new Error('Unable to reach the API. Check that the backend is running.', {
      cause: error,
    });
  }

  if (!response.ok) {
    const body: ApiErrorResponse | null = await response.json().catch(() => null);

    throw new ApiError(
      response.status,
      body?.error?.message ?? 'The API could not complete the request.',
      body?.error?.code,
    );
  }

  return response.json() as Promise<T>;
}

export async function getApi<T>(path: string, signal: AbortSignal): Promise<T> {
  return requestApi<T>(path, { signal });
}
