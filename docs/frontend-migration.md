# Frontend Architecture

## Direction

`packages/web` is the active frontend and the migration target for all ongoing UI work.

The main frontend pattern is now established:

- typed API wrappers in `src/api`
- Vue Query composables in `src/composables/queries`
- pages and components consuming composables directly
- Pinia reserved for local UI state and workflow state, not generic server persistence

## Current State

The following pieces are already in place:

- Vue Query is wired into the app bootstrap and is the default mechanism for server state.
- A shared fetch helper exists in `src/api/client.ts`.
- All API-backed slices (`units`, `meters`, `meter-types`, `reports`, `notes`, `values`) use the API-layer plus Vue Query pattern.
- The value entry flow reads report data through Vue Query (`useValueEntryReports.ts`) and the note of the selected day through `useNotesQuery` (`useNotes.ts`), and saves through a mutation (`useValues.ts`) that sends the whole entry, including the create/update/delete of its note, in one request to `POST /api/value-entries`, which writes it in a single transaction; its save state comes from `useIsSavingValueEntries`. The note's form state lives in the `value` Pinia store next to `inputValues`.
- The remaining Pinia stores hold client state only: `value` (selected date and form inputs), `reports` (report filters), and `store` (date formats and snackbars).
- Generated OpenAPI types from `packages/shared-api` are used where they fit the frontend shape.
- Auth is a standalone OIDC integration (Authorization Code + PKCE via `oidc-client-ts`): `src/auth/oidcAuthService.ts` holds the session, the router guard in `src/router/index.ts` redirects to the login, `src/pages/auth/` handles the callback and errors, and `src/api/client.ts` attaches the access token to every request.
- Every query composable in `src/composables/queries` has a focused spec next to it (`use*.spec.ts`). The specs mock the `src/api` module at the boundary, run the composables in a real Vue app with `VueQueryPlugin`, and check API calls, query keys (including reactive keys), invalidation after mutations, and the derived value entry state. HTTP itself is covered by `src/api/*.spec.ts`.

## State Rules

- Use Vue Query for remote server state by default.
- Use Pinia for UI state, transient workflow state, and cross-page client state.
- Do not introduce new fetch-heavy Pinia stores for API-backed resources.
- Route all HTTP access through `packages/web/src/api`.
- Prefer generated backend DTO types from `packages/shared-api` where they are usable.
- Do not add compatibility layers that reintroduce old framework behavior.
- Keep Vuetify as the primary UI system; use Tailwind for lightweight utility styling only.

## Priorities

No open migration items. New query composables and mutations should come with a spec that follows the existing ones (for example `useUnits.spec.ts` for CRUD slices).

## Reference Slice

The `units` slice is the reference implementation for the current pattern:

- API functions in `src/api/units.ts`
- Vue Query composables in `src/composables/queries/useUnits.ts`
- Pages and components consuming composables and mutations directly

Treat `units` as the preferred shape for simple CRUD features.
