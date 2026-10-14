import { getApi } from '../../lib/api';

type HealthResponse = {
  data: {
    status: 'ready';
    database: 'connected';
  };
};

export async function getHealth(signal: AbortSignal): Promise<void> {
  const response = await getApi<HealthResponse>('/health', signal);

  if (response?.data?.status !== 'ready' || response?.data?.database !== 'connected') {
    throw new Error('The API returned an unexpected readiness response.');
  }
}
