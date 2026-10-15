import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from '../features/auth/LoginPage';
import {
  HomeRedirect,
  RequireRole,
  RequireSession,
  SessionGuard,
} from '../features/auth/SessionGuard';
import { WorkspacePage } from '../features/auth/WorkspacePage';
import { HealthPage } from '../features/health/HealthPage';
import { AppLayout } from './AppLayout';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<SessionGuard />}>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireSession />}>
          <Route element={<AppLayout />}>
            <Route index element={<HomeRedirect />} />
            <Route element={<RequireRole role="admin" />}>
              <Route path="/workspace/admin" element={<WorkspacePage />} />
            </Route>
            <Route element={<RequireRole role="pelapor" />}>
              <Route path="/workspace/reporter" element={<WorkspacePage />} />
            </Route>
            <Route element={<RequireRole role="approver" />}>
              <Route path="/workspace/approver" element={<WorkspacePage />} />
            </Route>
            <Route path="/status" element={<HealthPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
