# Testing Denials Tracker

## Architecture and boundaries

SvelteKit is the server and UI: page loads/actions and API handlers authorize requests,
then access Supabase Auth, Postgres/PostgREST, and private Storage. Canonical permissions
come from user_role_assignments and role_permissions; database RLS is a separate defense.
Audit writes are asynchronous. Optional AI streaming/tools and the filesystem wiki have
additional feature gates and permission checks.

## Fast development loop

Use Node 22 LTS or newer and `npm ci`. Install Chromium once with
`npx playwright install chromium` (Linux CI also needs `--with-deps`).

```sh
npm run check
npm run check:tests
npm run test:server
npm run test:components
```

A local `.env` is required for `npm run check` / `npm run check:tests`: SvelteKit
generates `$env/dynamic/private` types from it. In a fresh checkout without one,
`svelte-check` reports ~23 errors that are not real code defects (verified on the
untouched baseline). CI copies `.env.example` for this; use placeholders locally.

`test:unit` is watch mode; `test:unit:run` is the complete one-shot suite.
The server unit tests generally mock Supabase: they do not prove SQL policies work.
Component tests use a real headless Chromium browser, but mock server dependencies.

## Real backend + browser tests

Requires Docker Compose. The app/tests run natively; a test-only Supabase stack runs
in Docker. No existing `.env`, remote staging backend, or production credentials are
used. The helper creates a mode-0600 `.env.test.local` with random secrets.

```sh
npm run test:backend:up
npm run test:e2e
npm run test:backend:down
```

The stack has checkout-specific Compose project, network, and volumes, with loopback-only
ports **58000** (Supabase API) and **55432** (Postgres). Playwright owns app port
**4173** and refuses to reuse another app server. `up` applies all migrations and
checks API readiness; running it again verifies already-applied migrations are skipped.
This does not prove SQL idempotence or migration upgrade compatibility.
`down` stops only this checkout’s test stack and retains its volumes for the next run.
Keep `.env.test.local` with those volumes: if it is missing, startup refuses to generate
new secrets for existing volumes. Restore the original file to resume. Worktrees have
separate volumes and secrets, but share fixed host ports, so run only one at a time.
Never change the test URL to a shared/production backend. Environment safety checks
fail closed instead of silently skipping backend-dependent tests.

Playwright builds the application before starting preview. Its environment overrides
every app runtime setting from the normal developer `.env` (including login limits,
session/password expiry, cookie security, wiki path, and adapter); `SUPABASE_INTERNAL_URL` is cleared for native execution.
Do not run another Vite build against the same checkout while the browser suite runs.

Each suite seeds random, synthetic editor/reader/denied/admin identities and canonical
role assignments. Patient fixtures are unique per test and removed afterwards. Global
teardown removes recorded identities/roles; an interrupted run's recorded identities
are cleaned on the next run. This is a disposable synthetic environment, not a staging
copy. Audit rows can remain in its retained database. Setup clears synthetic login-failure
audit rows so repeated runs do not accumulate IP lockouts.

Coverage includes:

- Real browser sign-in, deep links, sign-out, and denied access.
- Actual denial creation, note persistence, update/closure, deletion, and eventual audit/application-event persistence.
- Read-only UI and direct form-submission denial.
- Direct Supabase RLS tests using ordinary authenticated user JWTs, not service-role assertions.
- Private Storage uploads, denied access, signed download, and public URL rejection.
- No-store/security headers and separate allowed/denied audit access.
- Explicit AI-disabled behavior (401/403/503), not a pass when a feature is absent.

## CI / pre-merge gate

```sh
npm run test:backend:up
npm run test:ci
npm run test:backend:down
```

GitHub Actions installs Chromium and runs this gate for PRs and pushes to staging/main.
The production build is covered by the Playwright webServer startup. Browser failure
screenshots/traces are saved locally and uploaded by CI; keep them private because
screenshots, traces, and request bodies can contain data. Use synthetic data only.

## Remaining coverage to extend

- Upgrade migrations from a captured previous schema (fresh install alone is not upgrade proof).
- Full AI-enabled streaming/tool execution with a deterministic local model stub, then an optional real-model smoke test.
- Broader permission combinations, break-glass auditing, password expiry, actual timed idle logout, and retention.
- Mobile/responsive end-to-end and accessibility checks; the current E2E baseline is desktop Chromium.
- Target-specific deployment checks (Cloudflare vs Node) and HTTPS/proxy behavior.

Passing this suite is not HIPAA certification. `/api/health` is app liveness only;
backend tests are required to establish database/auth/storage functionality.
