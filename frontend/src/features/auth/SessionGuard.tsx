import { Link, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { roleHomePaths, type Role } from './auth.types';

export function SessionGuard() {
  const { session, refreshSession } = useAuth();

  if (session.status === 'loading') {
    return (
      <main className="page" role="status">
        <p>Checking your session...</p>
      </main>
    );
  }

  if (session.status === 'error') {
    return (
      <main className="page">
        <h1>Unable to check your session</h1>
        <p role="alert">{session.message}</p>
        <button type="button" onClick={() => void refreshSession()}>
          Try again
        </button>
      </main>
    );
  }

  return <Outlet />;
}

export function RequireSession() {
  const { session } = useAuth();

  if (!session.user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export function RequireRole({ role }: { role: Role }) {
  const { session } = useAuth();

  if (!session.user) {
    return <Navigate to="/login" replace />;
  }

  if (session.user.role !== role) {
    return (
      <main className="page">
        <h1>Access denied</h1>
        <p>Your account does not have access to this workspace.</p>
        <Link to={roleHomePaths[session.user.role]}>Return to your workspace</Link>
      </main>
    );
  }

  return <Outlet />;
}

export function HomeRedirect() {
  const { session } = useAuth();

  return (
    <Navigate to={session.user ? roleHomePaths[session.user.role] : '/login'} replace />
  );
}
