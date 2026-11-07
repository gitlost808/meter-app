# MeterApp

MeterApp is a meter data management system with PostgreSQL, a NestJS backend and a Vue + Vite frontend.

## Directory Structure

- `packages/service`: NestJS + Prisma backend
- `packages/web`: Vue + Vite frontend
- `packages/shared-api`: generated OpenAPI types shared with the frontend
- `docs`: project documentation

## Starting the Local Database with Docker

To start PostgreSQL locally for development, run:

**Attention**: If you are on Linux you should run `echo "UID=$UID" > .env` within the project root beforehand. This will ensure docker compose runs the containers with the correct UID for an optimal local DX.

```bash
docker compose up -d db
```

Keycloak now uses its own dedicated PostgreSQL service, `keycloak-db`, instead of sharing the app database.

## Login to the Database using Docker Compose

The provided `docker-compose.yml` file sets up PostgreSQL and PGAdmin for local development. To login to the database, follow these steps:

**Step 1: Access the PGAdmin Web Interface**

1. Open a web browser and navigate to `http://localhost:5000`. This is the default URL for the PGAdmin server.
2. Log in with the credentials provided:

- Email: root@db.com
- Password: root

**Step 2: Connect to the Database**

Once logged in, you'll be presented with a list of available servers. Use `db` for the application database or `keycloak-db` for Keycloak.

**Step 3: Provide Login Credentials**

Enter the login credentials for the database:

- For `db`: username `postgres`, password `postgres`
- For `keycloak-db`: username `keycloak`, password `keycloak`

**Step 4: Access the Database**

After logging in, you'll be taken to the PostgreSQL database console. You can now execute SQL queries, view database schema, and perform other administrative tasks.

By following these steps, you should be able to successfully login to the PostgreSQL database using the provided Docker Compose configuration.

**Test Data**

When starting the local environment with Docker, the application database is initialized using SQL scripts from `./docker/db/sql/app`. Keycloak keeps its own data in a separate database service (`keycloak-db`) and seeds its `dev` realm by importing `./docker/keycloak/import/dev-realm.json` on startup (see [Keycloak dev realm](#keycloak-dev-realm)). This setup keeps application and identity data isolated The public snapshot contains the application schema and report views with no application records. Create units, meter types and meters in the UI before entering readings. Keycloak accounts are development examples.

**Updating the report views**

The init scripts only run when the `pg-data` volume is created. When a report view changes (`02_report_meters.sql`, `03_report_values.sql`), apply it to an existing database by re-running that file; both use `CREATE OR REPLACE VIEW` and leave tables and data untouched (don't re-run `01_init.sql`, it creates the tables and seed data):

```bash
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d postgres < docker/db/sql/app/03_report_values.sql
```

**One reading per meter and day**

Readings are daily values: a meter has at most one reading per day (UTC); different meters may share a day, as at a meter change. `04_unique_value_per_day.sql` enforces this with a unique index and the API answers a second reading with `409 Conflict`. Apply it once to an existing database:

```bash
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d postgres < docker/db/sql/app/04_unique_value_per_day.sql
```

It first removes exact duplicates (same meter, day and value, keeping the lowest id). If a meter has several *different* readings on one day, it stops, lists them and changes nothing; keep one reading per meter and day by hand and run it again. Running it again after success changes nothing.

## Development

### 1. Install dependencies

```bash
npm install
```

### 2. Start only the database

```bash
docker compose up -d db
```

### 3. Configure backend env

`service` uses `DATABASE_URL`.

Set it in `envs/service.local.env` (example):

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres
```

### 4. Start the backend

```bash
npm run dev:service
```

Alternative (containerized service):

```bash
docker compose up -d --build service
```

### 5. Start the frontend

```bash
npm run dev:web
```

Alternative (containerized frontend):

```bash
docker compose up -d --build web
```

### 6. URLs

- Web: `http://localhost:5173`
- Web (containerized): `http://localhost:3001`
- API: `http://localhost:3002`
- Swagger UI: `http://localhost:3002/docs`
- OpenAPI JSON (runtime): `http://localhost:3002/docs/openapi.json`

## Auth Setup (Keycloak OIDC)

The app now uses OIDC Authorization Code + PKCE in the frontend and JWT verification in the backend.

### Frontend env (`envs/app.local.env`)

`npm run dev:web` sources this file automatically.

Example:

```bash
VITE_AUTH_DISABLED=false
VITE_OIDC_ISSUER=http://localhost:8081/realms/dev
VITE_OIDC_CLIENT_ID=app
VITE_OIDC_REDIRECT_URI=http://localhost:5173/auth/callback
VITE_OIDC_POST_LOGOUT_REDIRECT_URI=http://localhost:5173
VITE_OIDC_SCOPE=openid profile email
```

### Backend env (`envs/service.local.env`)

Example:

```bash
CORS_ORIGIN=http://localhost:5173,http://localhost:3001
METER_APP_AUTH_DISABLED=false
METER_APP_JWT_ISSUER=http://localhost:8081/realms/dev
METER_APP_JWT_JWKS_URI=http://localhost:8081/realms/dev/protocol/openid-connect/certs
METER_APP_JWT_AUDIENCE=account
METER_APP_JWT_RESOURCE=app
METER_APP_JWT_WRITE_ROLES=admin
```

For Docker Compose, `service` uses a container-internal JWKS URL (`http://keycloak:8080/...`) while still validating issuer `http://localhost:8081/realms/dev`.
`CORS_ORIGIN` is required and must contain the exact comma-separated browser origins allowed to call the API.

### Keycloak dev realm

Keycloak starts with `start-dev --import-realm` and imports the `dev` realm from `docker/keycloak/import/dev-realm.json` (mounted read-only to `/opt/keycloak/data/import`). The file only contains what differs from a new realm; Keycloak fills in its defaults (default roles, client scopes, flows, keys) on import. It configures the `dev` realm for local development:

- Client `app` is a public OIDC client using the standard flow with PKCE (`S256`).
- Redirect URIs: `http://localhost:5173/auth/callback` and `http://localhost:3001/auth/callback` (containerized web).
- Post logout redirect URIs and web origins: `http://localhost:5173` and `http://localhost:3001`.
- Client role `app` → `admin` grants write access (`METER_APP_JWT_WRITE_ROLES=admin`).

Dev users (password = username):

| User | Access |
|------|--------|
| `dev-writer` | read and write (`admin` role) |
| `dev-reader` | read only |

To change the realm configuration, edit `dev-realm.json` directly. For larger changes, make them in the admin console (`http://localhost:8081`, `admin`/`admin`), export the realm and carry only the relevant parts over into the file, keeping it minimal. Passwords are stored in plain text (`"value"`) and hashed by Keycloak on import.

`--import-realm` skips realms that already exist, so changes to the file only take effect on a fresh Keycloak database. Recreate the Keycloak containers to re-import (this discards changes made in the admin console): `docker compose rm -sfv keycloak keycloak-db && docker compose up -d keycloak`.

### 7. Regenerate OpenAPI and shared types

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres npm run openapi
```

### 8. Tests

```bash
npm run test   # unit tests, no database needed
```

Backend integration tests run against a real, disposable PostgreSQL (the database name must contain `test`; its schema is recreated from `docker/db/sql/app` on every run):

```bash
docker run -d --rm --name meter-it-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=meter_app_test -p 55432:5432 postgres:16-alpine
export DATABASE_URL=postgres://postgres:postgres@localhost:55432/meter_app_test
npm run prisma:generate --workspace @meter-app/service
npm run test:integration --workspace @meter-app/service
docker stop meter-it-pg
```

See AGENTS.md ("Testing and verification") for details.

## Screenshots

### Gas Report

![Gas](docs/assets/reports.png)

### Input Form

![Input](docs/assets/input.png)

## Publishing

See [Publishing a public snapshot](docs/publishing.md).
