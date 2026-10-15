# Application walkthrough

## Reporter

1. Log in with the Reporter demo account from the [README](../README.md#demo-accounts).
2. Open **My reports**, then **New report**. Enter a report name and description and submit it.
3. Confirm that details show Pending status and an empty decision history. Reload to check persistence.
4. Select **Edit report**, correct the content, and save. Only the owner can edit, and only while Pending.
5. After an Approver decides, reopen details to see the current status and history. The edit URL displays read-only feedback for decided reports.

To inspect conflict handling, open the same Pending report in two tabs, save in one, then try to save the older version in the other. The second write returns a conflict, preserves the draft, and requires **Reload latest report** before another save.

## Approver

1. Log out and log in with the Approver demo account.
2. Open **Review reports** and inspect a report's details.
3. Approve a Pending report. The table updates to Approved and exposes Reject as the available action.
4. Reject the Approved report, then approve it again.
5. Open details and verify all three transitions in **Decision history**, with actor identity and second-precision WIB timestamps.

Only valid decision actions are offered. Repeated status or a stale report version returns 409 without another history entry. Use **Reload reports** after a conflict; decisions are never resubmitted automatically.

## Admin

1. Log in with the Admin demo account. **Create account** is the landing page.
2. Enter a name, unique email, assigned password, and role.
3. Submit and confirm the safe account summary. The password field clears and the Admin stays signed in.
4. Log out and log in using the new credentials. The new account receives its assigned role's permissions immediately.
5. Creating the same email again returns a duplicate error and preserves the original account.

Admin accounts cannot access reports. Reporter accounts cannot open another Reporter's report by changing its URL. Public registration, account editing, and password reset are unavailable.

## Verification

The following checks passed on October 15, 2026, using Node 22.23.2 and npm 10.9.8.

| Area               | Commands or checks                                                               | Result                                                                            |
| ------------------ | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Clean installation | npm ci in backend/ and frontend/                                                 | PASS; dependencies and Prisma client installed from lockfiles                     |
| Database setup     | npm run db:validate; npm run db:migrate; npm run db:seed twice; npm run db:check | PASS; three migrations applied, seed rerun preserved accounts, SELECT 1 succeeded |
| Backend            | npm run typecheck; npm run lint; npm run format:check; npm run build             | PASS; compiled API starts with npm start                                          |
| Frontend           | npm run typecheck; npm run lint; npm run format:check; npm run build             | PASS                                                                              |
| Automated tests    | npm test in backend/                                                             | 181 tests across six files passed in 47.92 seconds                                |
| Dependencies       | npm audit in both packages                                                       | 0 vulnerabilities                                                                 |
| SQL import         | npx prisma db execute --file ../schema.sql on an empty database                  | PASS                                                                              |
| SQL export         | npm run db:export                                                                | Deterministic output from the three migrations                                    |
| Database parity    | Schema-only PostgreSQL dumps for migration/SQL setup                             | Identical application structure                                                   |
| Readiness          | Direct and Vite-proxied /api/health; read-only Neon connection check             | HTTP 200 and successful SELECT 1                                                  |

### Automated coverage

The backend suite tests authentication, session expiry/revocation/rotation, role checks, Origin/JSON rules, input allowlisting, password boundaries, safe responses, owner-scoped reads, Pending-only edits, all decision transitions, history ordering, duplicate accounts, transactions, and concurrent writes.

Two decisions against the same version allow only one commit. Edit-versus-decision races do not overwrite newer data. A forced history insert failure in the disposable database proves transaction rollback. A real Prisma connection refusal returns a safe 503 without connection details.

### Setup verification

A clean local Git clone was installed without copying node_modules, generated clients, build output, or existing environment files. Separate PostgreSQL 18 databases covered migration setup, SQL setup, and the integration suite. Browser verification used ports 4100/5174 with the API proxy and APP_ORIGIN adjusted together; the standard configuration remains 4000/5173.

Database parity compares `pg_dump --schema-only --no-owner --no-privileges --exclude-table=public._prisma_migrations`. After removing random dump guard keys, the outputs match, including enums, tables, indexes, defaults, nullability, foreign keys, and custom CHECK constraints. Both paths support seeded logins, account creation, report creation/editing, decisions/reversals, ordered history, and access-denial behavior. SQL-path seed reruns preserve stored user data.

The setup check used local committed source with the SQL export command included. A clone from the published remote was not tested. Application database configuration remained unchanged; fixture cleanup and deliberate session expiry used only disposable databases.

### Manual browser coverage

Manual checks verified the Reporter create/edit/persistence flow, Approver decisions and reversals, complete ordered history, read-only decided reports, expired-session login redirection, Admin account creation, cleared password fields, new-account login, and foreign-report denial. Desktop/phone history layouts at widths 1440 and 390 had no horizontal overflow.

These are manual browser checks, not an automated frontend suite. A browser database outage was not forced; connection refusal and safe failure responses are covered by automated API tests. Initial empty states were checked before creating test reports.

### Documentation checks

Documentation links and anchors resolve, Markdown fences are balanced, and git diff --check is clean. Configured private database URLs, hostnames, and passwords are absent from Git-visible text.

No hosted deployment is provided.
