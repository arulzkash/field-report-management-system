import type { User } from '../../generated/prisma/client.js';

export type SafeUser = Pick<User, 'id' | 'name' | 'email' | 'role'>;

export const safeUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
} as const;

export type AuthenticatedSession = {
  sessionId: string;
  user: SafeUser;
};
