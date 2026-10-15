# Technical decisions

## Feature modules and direct Prisma access

Auth, reports, and users are separate features. Controllers handle HTTP input/output; services enforce business rules and use Prisma directly. Shared middleware handles authentication, roles, Origin validation, and errors. Repository abstractions, DTO class hierarchies, and dependency injection frameworks would add complexity without a requirement that justifies them.

## Two independent packages

The backend uses Express + TypeScript; the frontend uses React + Vite + TypeScript. Separate npm packages and lockfiles keep installation straightforward without monorepo tooling. Exact dependency versions and Node 22.23.2 make the runtime reproducible. Plain CSS, fetch, React Context, and local form state are sufficient for this application.

## Database-backed cookie sessions

Opaque sessions support immediate logout revocation and authoritative role checks. A random token is delivered through an HttpOnly cookie; PostgreSQL stores only its SHA-256 hash. Sessions expire after eight hours. SameSite cookies, exact Origin validation, and JSON-only mutations protect the single-origin workflow. Production enables Secure cookies.

Passwords use bcrypt cost 12 and a 12-72 UTF-8 byte policy. Preserving the exact password avoids silent trimming or normalization. Friendly form guidance avoids exposing byte terminology to users while server-side validation remains authoritative.

## Role and ownership boundaries

Each account has one role. Admins create accounts without inheriting report permissions. Reporters query only their own reports; Approvers may review all reports. Another owner's report produces the same 404 response as a missing report, avoiding disclosure through report identifiers.

User/history queries select safe response fields explicitly. Client-supplied owners, actors, statuses, timestamps, and unexpected fields cannot bypass business rules.

## Optimistic concurrency and transactional decisions

Reports carry an incrementing version. Pending edits use a conditional database update constrained by id, owner, status, and version. A decision conditionally changes status/version and appends history in one transaction. Concurrent requests against the same version cannot both commit; history insertion failure rolls back the status update.

Conflicts return 409 and require explicit reload. The UI preserves an edit draft for reference and does not retry decisions automatically. This fits the workload without distributed locks, event sourcing, or automatic mutation retries.

## Decision history

History records the report, authenticated Approver, previous/new status, resulting report version, and database timestamp. Ordering by reportVersion remains deterministic through reversals, timestamp ties, and gaps from content edits. Restrictive foreign keys and unique report/version constraints preserve relationships and prevent duplicate decision versions.

History is append-only through the application. Actor identity is read from the current User record. Direct database administration can change records and is outside the application's audit guarantee.

## Migrations and schema.sql

Reviewed Prisma models and migrations are the schema source. The SQL export command derives schema.sql from ordered migrations, including CHECK constraints not represented by Prisma models alone. This avoids maintaining a second hand-written schema.

The SQL snapshot is an alternative empty-database setup path and excludes seed data and Prisma migration bookkeeping. Future migration-based upgrades after SQL import require baselining. Separate migrated/SQL-created databases have matching normalized schema-only dumps.

## Account creation and demo data

Account creation inserts allowlisted fields and a bcrypt hash, then returns safe user data without changing the Admin session. PostgreSQL's unique email constraint handles racing requests; duplicate insertion maps to 409 instead of overwriting an existing account.

Demo seed passwords are explicit environment values. The seed validates credentials and roles before writing, preserves existing accounts on reruns, and is disabled in production. No hidden passwords are embedded in application code.

## Isolated integration tests

Tests use a distinct disposable PostgreSQL database, not the application database. The configuration guard rejects equivalent database identities, including common host aliases and Neon pooler aliases, and requires a name ending in `_test`. The supplied Docker container binds to loopback and stores disposable data in tmpfs.

Real database tests cover authorization, constraints, transactions, rollback, and concurrency. Browser smoke checks complement the API suite but are manual rather than an automated frontend suite.

## Application interface and limits

The interface uses clear forms, semantic tables, status labels, visible focus, responsive layouts, and explicit loading/empty/error states. Maps, decorative dashboards, image assets, motion libraries, and advanced design tooling do not serve the required workflow.

Lists are unpaginated. There is no public registration, account editing, password reset, report deletion, history mutation, notification system, or hosted deployment. The in-memory login limiter suits a single-process API; a multi-instance deployment would require a shared limiter and proxy configuration.

## Dependency compatibility

Pinned Prisma 7 packages use the ESM client generator and PostgreSQL adapter. Overrides for deepmerge-ts 8.0.2 and mysql2 3.24.6 address transitive dependency audit findings. PostgreSQL is the only runtime database. Client generation, migrations, schema validation, builds, and integration tests verify compatibility with the pinned versions.
