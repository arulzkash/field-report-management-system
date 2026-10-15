import { requestApi } from '../../lib/api';
import type { Role, User } from '../auth/auth.types';

export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  role: Role;
};

export async function createUser(input: CreateUserInput): Promise<User> {
  const response = await requestApi<{ data: User }>('/users', {
    method: 'POST',
    body: input,
  });
  return response.data;
}
