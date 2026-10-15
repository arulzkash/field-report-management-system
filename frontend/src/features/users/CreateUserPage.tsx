import { useState, type FormEvent } from 'react';
import { ApiError } from '../../lib/api';
import { useAuth } from '../auth/AuthContext';
import { roleLabels, type Role, type User } from '../auth/auth.types';
import { createUser } from './user.api';
import './users.css';

export function CreateUserPage() {
  const { refreshSession } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('pelapor');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<User | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (submitting) {
      return;
    }

    setError(null);
    setCreated(null);

    if (!name.trim()) {
      setError('Enter a name. It cannot contain only spaces.');
      return;
    }

    const passwordBytes = new TextEncoder().encode(password).length;
    if (passwordBytes < 12) {
      setError('This password is too short. Try a longer password or a short phrase.');
      setPassword('');
      return;
    }

    if (passwordBytes > 72) {
      setError('This password is too long. Try a shorter phrase.');
      setPassword('');
      return;
    }

    setSubmitting(true);
    try {
      const user = await createUser({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
      });
      setCreated(user);
      setName('');
      setEmail('');
      setRole('pelapor');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await refreshSession();
        return;
      }

      setError(error instanceof Error ? error.message : 'Unable to create the account.');
    } finally {
      setPassword('');
      setSubmitting(false);
    }
  }

  return (
    <main className="page users-page">
      <header className="page-header">
        <h1>Create account</h1>
        <p>Create a login for a team member. All fields are required.</p>
      </header>
      {created && (
        <section className="user-success" role="status">
          <h2>Account created</h2>
          <p>
            {created.name} can now log in as {roleLabels[created.role]} using{' '}
            {created.email} and the password you assigned.
          </p>
        </section>
      )}
      <form
        className="user-form"
        onSubmit={(event) => void handleSubmit(event)}
        aria-busy={submitting}
      >
        <div className="form-field">
          <label htmlFor="user-name">Name</label>
          <input
            id="user-name"
            name="name"
            autoComplete="off"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={150}
            disabled={submitting}
          />
        </div>
        <div className="form-field">
          <label htmlFor="user-email">Email</label>
          <input
            id="user-email"
            name="email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            maxLength={254}
            disabled={submitting}
          />
        </div>
        <div className="form-field">
          <label htmlFor="user-password">Password</label>
          <input
            id="user-password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            maxLength={72}
            aria-describedby="password-hint"
            disabled={submitting}
          />
          <p id="password-hint" className="form-note">
            Use a long, memorable password, such as a short phrase.
          </p>
        </div>
        <div className="form-field">
          <label htmlFor="user-role">Role</label>
          <select
            id="user-role"
            name="role"
            value={role}
            onChange={(event) => setRole(event.target.value as Role)}
            disabled={submitting}
          >
            <option value="pelapor">Reporter</option>
            <option value="approver">Approver</option>
            <option value="admin">Admin</option>
          </select>
          <p className="form-note">
            Reporters manage their own reports. Approvers review all reports. Admins
            create accounts.
          </p>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creating...' : 'Create account'}
        </button>
      </form>
    </main>
  );
}
