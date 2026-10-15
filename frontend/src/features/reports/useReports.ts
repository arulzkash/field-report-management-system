import { useEffect, useState } from 'react';
import { ApiError } from '../../lib/api';
import { useAuth } from '../auth/AuthContext';
import { getReport, listReports } from './report.api';
import type { Report } from './report.types';

type ReportsState =
  | { status: 'loading' }
  | { status: 'ready'; reports: Report[] }
  | { status: 'error'; message: string };

export function useReports(id?: string) {
  const { refreshSession } = useAuth();
  const [state, setState] = useState<ReportsState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function load(): Promise<void> {
      try {
        const reports = id
          ? [await getReport(id, controller.signal)]
          : await listReports(controller.signal);

        if (!controller.signal.aborted) {
          setState({ status: 'ready', reports });
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        if (error instanceof ApiError && error.status === 401) {
          await refreshSession();
          return;
        }

        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Unable to load reports.',
        });
      }
    }

    void load();
    return () => controller.abort();
  }, [id, attempt, refreshSession]);

  function retry(): void {
    setState({ status: 'loading' });
    setAttempt((current) => current + 1);
  }

  return { state, retry };
}
