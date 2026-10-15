import { useAuth } from './AuthContext';
import { roleLabels } from './auth.types';

export function WorkspacePage() {
  const { session } = useAuth();
  const user = session.user;

  if (!user) {
    return null;
  }

  return (
    <main className="page">
      <header className="page-header">
        <p className="eyebrow">Your workspace</p>
        <h1>{roleLabels[user.role]} workspace</h1>
        <p className="introduction">Welcome, {user.name}.</p>
      </header>
      <section className="status-panel" aria-labelledby="account-heading">
        <h2 id="account-heading">Your account</h2>
        <dl className="account-details">
          <div>
            <dt>Name</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{roleLabels[user.role]}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
