# Field Report Management System

A REST API and web dashboard for field reports. Reporters submit field observations, Approvers review and reverse decisions, and Admins create accounts.

## Stack

- Backend: Express, TypeScript, Prisma, PostgreSQL / Neon.
- Frontend: React, Vite, TypeScript, React Router, plain CSS.
- Authentication: HttpOnly cookie sessions and bcrypt password hashing.

The backend and frontend are independent npm packages with committed lockfiles.

## Requirements

- Node.js 22.23.2, as specified in `.nvmrc`, and npm.
- An empty PostgreSQL database for initial setup. Neon requires internet access.
- Ports 4000 and 5173 for the backend and frontend.
- Docker or a separate disposable PostgreSQL database to run integration tests.

## Run locally

Clone the repository:

```sh
git clone https://github.com/arulzkash/field-report-management-system.git
cd field-report-management-system
```

### 1. Configure the backend

Copy [backend/.env.example](backend/.env.example) to `backend/.env` and set the database connection:

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require"
PORT=4000
NODE_ENV=development
APP_ORIGIN="http://localhost:5173"
```

For local PostgreSQL without TLS, use `sslmode=disable`. An optional `DIRECT_URL` can provide a separate connection for Prisma migrations. Runtime connections always use `DATABASE_URL`.

Copy [backend/.env.demo.example](backend/.env.demo.example) to `backend/.env.demo`. To use the demo credentials below, set:

```dotenv
SEED_ADMIN_PASSWORD="Demo-5df16af3b7dc125ecf9b1e51"
SEED_PELAPOR_PASSWORD="Demo-9e7dc631c45dc8bd1d2cfca9"
SEED_APPROVER_PASSWORD="Demo-3c58645261aa58236e0c7881"
```

These are public demo credentials. Environment files are ignored by Git. Preserve existing configuration when updating an installation.

### 2. Start the backend

From the repository root:

```sh
cd backend
npm ci
npm run db:validate
npm run db:migrate
npm run db:seed
npm run db:check
npm run dev
```

Installation generates the Prisma client. Migrations create the schema without resetting data. The seed creates three demo accounts; reruns preserve existing accounts and reject conflicting credentials or roles. `db:check` performs a read-only connection check. Demo seeding is disabled in production.

### 3. Start the frontend

In a second terminal, from the repository root:

```sh
cd frontend
npm ci
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Vite proxies `/api` to `127.0.0.1:4000`. Use `localhost`, matching `APP_ORIGIN`; `127.0.0.1` is a different browser origin. Changing the backend port also requires updating the proxy target in `frontend/vite.config.ts`.

## Demo accounts

| Role     | Email                 | Password                        |
| -------- | --------------------- | ------------------------------- |
| Admin    | `admin@demo.local`    | `Demo-5df16af3b7dc125ecf9b1e51` |
| Reporter | `reporter@demo.local` | `Demo-9e7dc631c45dc8bd1d2cfca9` |
| Approver | `approver@demo.local` | `Demo-3c58645261aa58236e0c7881` |

Reporter corresponds to the persisted role `pelapor`. Public registration is unavailable.

## Application workflow

- **Reporter:** Create reports, view only their own reports, edit Pending reports, and read decision history.
- **Approver:** View all reports, approve or reject Pending reports, and reverse Approved/Rejected decisions.
- **Admin:** Create accounts with an assigned role. Admins do not inherit report access.

Each report contains a name, description, status, and version. Names/descriptions are limited to 150/5,000 trimmed characters. Every decision stores its actor and server timestamp, atomically with the status update. History preserves reversals and displays timestamps in WIB. Stale edits or decisions return a conflict and require reloading current data.

See the [application walkthrough](docs/walkthrough.md) for a short review flow and the [API contract](docs/architecture.md#api-contract) for endpoints and payloads.

## Alternative database setup

[schema.sql](schema.sql) provides the complete database structure, including custom constraints. After installing backend dependencies and configuring the environment, it can replace the migration step on a separate **empty** database. From backend/:

```sh
npx prisma db execute --file ../schema.sql
npm run db:seed
npm run db:check
```

Use either migrations or SQL import for initial setup. Do not apply both to the same database. SQL import excludes Prisma migration history; future migration-based upgrades require baselining first. Demo data is seeded separately. Regenerate the SQL snapshot with `npm run db:export` in backend/.

## Tests and checks

Copy [backend/.env.test.example](backend/.env.test.example) to `backend/.env.test`. Set the same local test password in `TEST_POSTGRES_PASSWORD` and `TEST_DATABASE_URL`. From the repository root:

```sh
docker compose --project-name field-report-tests --env-file backend/.env.test -f compose.test.yml up --detach --wait
```

The supplied PostgreSQL container uses port 55432 and disposable tmpfs storage. Tests apply migrations and recreate fixtures only in the separate test database. Never use the application database as `TEST_DATABASE_URL`; the test configuration guard requires a different database whose name ends in `_test`.

Run in backend/:

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm audit
```

Run in frontend/:

```sh
npm run typecheck
npm run lint
npm run format:check
npm run build
npm audit
```

The backend suite contains 181 tests covering authentication, roles, ownership, validation, decisions, history, rollback, and concurrent writes. [Verification results](docs/walkthrough.md#verification) distinguish automated tests from manual browser checks.

## Compiled build

Stop the development backend before starting the compiled backend on the same port:

```sh
cd backend
npm run build
npm start
```

Build frontend assets with `npm run build` in frontend/. No hosted deployment is provided. Production hosting requires HTTPS and frontend/API routing through one origin.

## Documentation

- [Architecture and API](docs/architecture.md)
- [Technical decisions](docs/decisions.md)
- [Application walkthrough and verification](docs/walkthrough.md)
