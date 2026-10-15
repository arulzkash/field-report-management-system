import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';

export function AppLayout() {
  const { session, signOut } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogout(): Promise<void> {
    setSubmitting(true);
    setError(null);

    try {
      await signOut();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to log out.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <header className="site-header">
        <span className="site-name">Field Report Management</span>
        <nav aria-label="Main navigation">
          {session.user?.role === 'pelapor' && (
            <NavLink to="/reports">My reports</NavLink>
          )}
          <NavLink
            to={`/workspace/${session.user?.role === 'pelapor' ? 'reporter' : session.user?.role}`}
          >
            Account
          </NavLink>
          <NavLink to="/status">System status</NavLink>
        </nav>
        <button type="button" onClick={() => void handleLogout()} disabled={submitting}>
          {submitting ? 'Logging out...' : 'Log out'}
        </button>
      </header>
      {error && (
        <p className="page form-error" role="alert">
          {error}
        </p>
      )}
      <Outlet />
    </div>
  );
}
