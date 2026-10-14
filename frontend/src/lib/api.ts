type ApiErrorResponse = {
  error?: {
    message?: string;
  };
};

export async function getApi<T>(path: string, signal: AbortSignal): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`/api${path}`, {
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    });
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }

    throw new Error('Unable to reach the API. Check that the backend is running.', {
      cause: error,
    });
  }

  if (!response.ok) {
    const body: ApiErrorResponse | null = await response.json().catch(() => null);

    throw new Error(body?.error?.message ?? 'The API could not complete the request.');
  }

  return response.json() as Promise<T>;
}
