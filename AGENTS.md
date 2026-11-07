# AGENTS.md

## Purpose

This repository is a small monorepo for a meter data management app. It contains:

- `packages/service`: NestJS + Fastify + Prisma backend
- `packages/web`: Vue 3 + Vite + Vuetify frontend
- `packages/shared-api`: generated OpenAPI types consumed by the frontend
- `docker/` and `docker-compose.yml`: local PostgreSQL, Keycloak, and helper services

Read this file before making structural changes. Most work spans the backend API, generated types, and the frontend query layer.

## Monorepo shape

- Root `package.json` uses npm workspaces with `packages/*`.
- Root scripts delegate into package scripts.
- The repo is currently cleanly split by package responsibility; avoid duplicating API types or fetch logic across packages.

Important root commands:

- `npm install`
- `npm run build`
- `npm run lint`
- `npm run test`
- `npm run typecheck`
- `npm run dev:service`
- `npm run dev:web`
- `npm run openapi`

## Local runtime assumptions

- Frontend dev server: `http://localhost:5173`
- Backend API: `http://localhost:3002`
- Swagger UI: `http://localhost:3002/docs`
- Frontend proxies `/api` to the backend via Vite.
- Backend uses `DATABASE_URL` from `envs/service.local.env` in local dev.
- Docker compose provides:
  - app Postgres on `5432`
  - PGAdmin on `5000`
  - Keycloak on `8081`
- Auth is enabled by default, so local dev needs Keycloak running (`docker compose up -d keycloak`):
  - `npm run dev:web` sources `envs/app.local.env` (`VITE_OIDC_*`); the backend reads `METER_APP_JWT_*` from `envs/service.local.env`.
  - Dev users in the `dev` realm (password = username): `dev-writer` (read and write) and `dev-reader` (read only).
  - To work without Keycloak, set `VITE_AUTH_DISABLED=true` and `METER_APP_AUTH_DISABLED=true`.
  - Right after a dev server restart, the first login can fail once because Vite reloads the page while optimizing new dependencies; logging in again works.

The seeded local database is initialized from `docker/db/sql/app`. Report features depend on SQL views created there, especially:

- `v_meter_stats`
- `v_value_stats`

If a change affects reports or derived meter/value behavior, check those SQL views as well as the Nest service code.

## Backend architecture

Backend entry points:

- `packages/service/src/main.ts`
- `packages/service/src/app.module.ts`

Conventions in `service`:

- API routes are exposed under the global `/api` prefix.
- Each feature lives in its own Nest module directory such as `units/`, `meter-types/`, `meters/`, `values/`, `value-entries/`, `notes/`, `reports/`, `meter-stats/`.
- `value-entries/` (`POST /api/value-entries`) saves all meter types of one value entry, including meter changes and the note of the entry (create/update/delete), in a single Prisma transaction. The value entry page must use it instead of combining the per-resource endpoints.
- Readings are daily values: one reading per meter and day (UTC), enforced by the unique index `ux_t_value_meter_day` from `docker/db/sql/app/04_unique_value_per_day.sql`. Different meters may share a day (meter change). Every write to `t_value` must go through `rethrowOneValuePerDay` (`src/values/one-value-per-day.ts`), which turns a violation into `409 Conflict`; Prisma's schema can't express this expression index.
- Typical structure per feature:
  - `*.controller.ts` for HTTP contract
  - `*.service.ts` for Prisma/data logic
  - `dto/` for request DTOs
  - `*.spec.ts` for Vitest unit tests
- Validation is global via `ValidationPipe` with `whitelist`, `transform`, and `forbidNonWhitelisted`.
- Services commonly enforce existence checks and throw `NotFoundException` before updating/deleting.
- Auth is global via two `APP_GUARD`s in `app.module.ts`:
  - `JwtAuthGuard` requires a valid Keycloak JWT on every route; mark intentionally open routes with `@Public()` (as on `health`).
  - `WriteAccessGuard` additionally requires a role from `METER_APP_JWT_WRITE_ROLES` (realm roles or client roles of `METER_APP_JWT_RESOURCE`) for `POST`/`PUT`/`PATCH`/`DELETE`.
  - Guards run before validation, so a forbidden write returns `403` even for an invalid body.

Persistence:

- Prisma schema lives in `packages/service/prisma/schema.prisma`.
- Prisma models map onto existing SQL tables using `@@map(...)`.
- Some reporting logic is not represented as Prisma models; it is queried through raw SQL against database views.

Generated/backend-derived artifacts:

- Runtime/opened spec: `/docs/openapi.json` from the Nest Swagger setup
- Checked-in generated spec: `packages/service/openapi.json`
- Type generation script: `packages/service/scripts/write-openapi.ts`

When changing backend DTOs, routes, or response shapes:

1. Update Nest controllers/services/DTOs.
2. Regenerate OpenAPI with `npm run openapi`.
3. Review changes in `packages/service/openapi.json`.
4. Review regenerated types in `packages/shared-api/src/generated/openapi.ts`.
5. Update frontend API wrappers and query composables as needed.

## Frontend architecture

Frontend entry points:

- `packages/web/src/main.ts`
- `packages/web/src/App.vue`
- `packages/web/src/router/index.ts`

Routing and layouts:

- Uses file-based routing via `vue-router/auto-routes`.
- Pages live in `packages/web/src/pages`.
- Layout selection is route-meta based in `App.vue`.
- Reports page opts into `layout: 'reports'`.

Frontend state conventions:

- Use Vue Query for server state.
- Use Pinia for UI/client state only.
- Route all HTTP access through `packages/web/src/api`.
- Prefer generated DTO types from `@shared-api`.

This is also documented in `docs/frontend-migration.md`. The `units` slice is the reference pattern for migrated code.

Expected layering for a feature:

1. `src/api/*.ts`: typed fetch wrappers using `apiRequest`
2. `src/composables/queries/*.ts`: Vue Query hooks and invalidation
3. `src/pages/*` and `src/components/*`: UI that consumes composables directly
4. `src/stores/*`: Pinia only for local UI state, not server persistence

Notable frontend implementation details:

- `packages/web/src/api/client.ts` is the common fetch helper and error wrapper.
- Vite alias `@shared-api` points to `../shared-api/src`.
- Auto-imports are enabled for Vue, Vue Router, Pinia, stores, and composables.
- Components are auto-registered from `src/components`.
- Vuetify is the main UI system; Tailwind is present for utility styling.
- Auth lives in `src/auth/` (`oidcAuthService.ts`, OIDC Authorization Code + PKCE). The router guard redirects to the login, `src/pages/auth/` handles the callback and error pages, and `client.ts` attaches the access token. Don't `await router.isReady()` before mounting in `main.ts`: it rejects when the auth guard aborts the initial navigation.

## Cross-package change workflow

For API-backed features, prefer this order:

1. Change backend DTO/controller/service behavior.
2. Regenerate OpenAPI and shared types.
3. Update `packages/web/src/api/...`.
4. Update `packages/web/src/composables/queries/...`.
5. Update pages/components.
6. Add or adjust tests in the affected package(s).

Avoid:

- hand-maintaining duplicate frontend types for backend DTOs when generated types are usable
- fetching directly from Vue components
- putting remote data lifecycle into Pinia stores

## Testing and verification

Repo-level:

- `npm run test`
- `npm run lint`
- `npm run typecheck`

Package-level:

- `npm run test --workspace @meter-app/service`
- `npm run test --workspace @meter-app/web`
- `npm run lint --workspace @meter-app/service`
- `npm run lint --workspace @meter-app/web`
- `npm run typecheck --workspace @meter-app/web`

Current tests are mostly focused unit tests, not large integration coverage. When changing behavior, add narrow tests close to the affected slice.

`npm run test` stays database-free (unit tests with mocked Prisma, `*.spec.ts`).

Backend integration tests (`packages/service/src/**/*.int-spec.ts`, config `packages/service/vitest.integration.config.mts`) run against a real PostgreSQL:

- They cover the report views (`v_value_stats` via `GET /api/reports/:meterTypeId`, `v_meter_stats` via `GET /api/meter-stats`), the transaction of `POST /api/value-entries`, and the one-reading-per-day rule including `04_unique_value_per_day.sql`.
- They need `DATABASE_URL` pointing at a disposable test database whose name contains `test`; there is no default, and other names are refused, because the run drops and recreates the `public` schema. Never point it at the dev database.
- The Vitest global setup rebuilds the schema from `docker/db/sql/app/*.sql` exactly as shipped (tables, seed data, views); each test truncates all tables and inserts its own small fixtures.
- Tests boot the real `AppModule` on Fastify with `configureApp` from `src/app.setup.ts` (same prefix and `ValidationPipe` as `main.ts`), auth disabled, and call it with `app.inject`.
- Helpers live in `packages/service/test/integration/`. Run `prisma generate` first, as for typecheck.

```bash
docker run -d --rm --name meter-it-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=meter_app_test -p 55432:5432 postgres:16-alpine
export DATABASE_URL=postgres://postgres:postgres@localhost:55432/meter_app_test
npm run prisma:generate --workspace @meter-app/service
npm run test:integration --workspace @meter-app/service
docker stop meter-it-pg
```

`npm run test:integration:prepare --workspace @meter-app/service` only rebuilds the schema (useful for inspecting the test database). CI runs the same steps in the `integration` job of `.github/workflows/ci.yml` with a `postgres:16-alpine` service container.

If you change the SQL views, `value-entries`, or the app setup, run the integration tests.

The docker init scripts only run on a fresh `pg-data` volume, so a changed view doesn't reach an existing database by itself. Keep the view files re-runnable (`CREATE OR REPLACE VIEW`, which can only append columns and can't change existing column types) and mention in the commit that the file has to be re-applied, e.g. `docker compose exec -T db psql -v ON_ERROR_STOP=1 -U postgres -d postgres < docker/db/sql/app/03_report_values.sql` (README "Updating the report views").

## High-value files to inspect first

When starting a task, these files give the fastest orientation:

- `README.md`
- `docs/frontend-migration.md`
- `packages/service/src/app.module.ts`
- `packages/service/prisma/schema.prisma`
- `packages/service/scripts/write-openapi.ts`
- `packages/web/src/api/client.ts`
- `packages/web/src/composables/queries/useUnits.ts`
- `packages/web/src/pages/units.vue`
- `packages/web/vite.config.ts`

## Editing guidance for agents

- Keep package boundaries clean.
- Treat `packages/shared-api/src/generated/openapi.ts` as generated; do not hand-edit it unless the task explicitly requires it.
- If reports look wrong, inspect SQL view definitions under `docker/db/sql/app/` before changing frontend chart logic.
- Preserve the current frontend migration direction: Vue Query for server state, Pinia for local state.
- Prefer following the `units` slice pattern when adding or refactoring frontend features.
- If you change route structure, remember routing is file-based and layout selection depends on page meta.
- The Keycloak dev realm is seeded by realm import from `docker/keycloak/import/dev-realm.json` (`start-dev --import-realm`). Edit that file directly and keep it minimal (only what differs from Keycloak defaults); don't replace it with a full realm export. The import skips existing realms, so recreate Keycloak to apply changes: `docker compose rm -sfv keycloak keycloak-db && docker compose up -d keycloak` (see README "Keycloak dev realm").
