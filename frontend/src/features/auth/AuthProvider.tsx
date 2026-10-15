import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ApiError } from '../../lib/api';
import * as authApi from './auth.api';
import { AuthContext, type SessionState } from './AuthContext';

async function resolveSession(signal?: AbortSignal): Promise<SessionState> {
  try {
    const user = await authApi.getSession(signal);

    return { status: 'ready', user };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return { status: 'ready', user: null };
    }

    return {
      status: 'error',
      user: null,
      message: error instanceof Error ? error.message : 'Unable to check your session.',
    };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({ status: 'loading', user: null });

  useEffect(() => {
    const controller = new AbortController();

    void resolveSession(controller.signal).then((nextSession) => {
      if (!controller.signal.aborted) {
        setSession(nextSession);
      }
    });

    return () => controller.abort();
  }, []);

  const refreshSession = useCallback(async (): Promise<void> => {
    setSession({ status: 'loading', user: null });
    setSession(await resolveSession());
  }, []);

  async function signIn(email: string, password: string): Promise<void> {
    const user = await authApi.login(email, password);

    setSession({ status: 'ready', user });
  }

  async function signOut(): Promise<void> {
    try {
      await authApi.logout();
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) {
        throw error;
      }
    }

    setSession({ status: 'ready', user: null });
  }

  return (
    <AuthContext.Provider value={{ session, refreshSession, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
