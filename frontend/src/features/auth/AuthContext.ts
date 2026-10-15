import { createContext, useContext } from 'react';
import type { User } from './auth.types';

export type SessionState =
  | { status: 'loading'; user: null }
  | { status: 'ready'; user: User | null }
  | { status: 'error'; user: null; message: string };

export type AuthContextValue = {
  session: SessionState;
  refreshSession: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
}
