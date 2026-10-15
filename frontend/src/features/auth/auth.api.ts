import { requestApi } from '../../lib/api';
import type { User } from './auth.types';

type UserResponse = { data: User };

export async function getSession(signal?: AbortSignal): Promise<User> {
  const response = await requestApi<UserResponse>('/auth/me', { signal });

  return response.data;
}

export async function login(email: string, password: string): Promise<User> {
  const response = await requestApi<UserResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
  });

  return response.data;
}

export async function logout(): Promise<void> {
  await requestApi('/auth/logout', { method: 'POST', body: {} });
}
