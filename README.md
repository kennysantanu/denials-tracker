# Denials Tracker

A full-stack, HIPAA-compliant web application for managing healthcare insurance claim denials — built for clinical environments where data security, audit accountability, and workflow efficiency are non-negotiable.

Designed and built from the ground up with a security-first architecture: PHI is never exposed in URLs, browser storage, logs, or cache. Every access event is logged. Every data mutation is controlled by server-side permission checks backed by PostgreSQL Row Level Security.

> Built with **Svelte 5 (Runes)**, **SvelteKit 2**, **TypeScript**, and a self-hosted **Supabase** backend.

---

## Key Features

### Clinical Workflow

- **Dashboard** — At-a-glance summary of open and closed denials across all patients
- **Patient records** — Full patient management with soft-delete and configurable data retention
- **Denial lifecycle** — Create, update, and resolve denials; attach notes and supporting documents; track open and closed claims
- **File attachments** — Documents attached to denials are served exclusively via signed URLs — no public bucket exposure
- **Reports** — Filterable denial reporting views
- **Labels & Insurance management** — Configurable payer lists and custom labels for categorizing denials

### Security & Compliance

- **Role-based access control** — Granular permission system enforced at both the server layer and PostgreSQL RLS — no client-side trust
- **Immutable audit log** — Every PHI access, data modification, and authentication event is recorded; filterable admin viewer with CSV export
- **Session security** — Configurable idle timeout with automatic logout and cross-tab session synchronization
- **Password policy** — Minimum 12 characters with complexity requirements; enforced expiry with redirect to change-password flow
- **Login lockout** — Account lockout after a configurable number of failed attempts
- **No PHI leakage** — `Cache-Control: no-store` on all protected routes; no PHI in URLs, localStorage, or error messages

### Administration

- **Admin panel** — Manage users, roles, labels, insurance payers, and application-wide preferences from a single interface
- **Audit log viewer** — Searchable, paginated PHI access log with CSV export (`/api/v1/audit/export`)
- **Self-hosted** — Full control: your infrastructure, your data, no third-party cloud dependency

### AI Assistant (Optional)

- **Local-only LLM chat** — Context-aware chat assistant powered by [LM Studio](https://lmstudio.ai/) or [Ollama](https://ollama.com/) via the OpenAI-compatible API
- **Denial context injection** — AI has access to denial records as tool input; no PHI leaves your network
- **Zero configuration env vars** — AI provider URL and model are configured through the in-app admin preferences

---

## Tech Stack

| Category      | Technology                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------------- |
| Framework     | [SvelteKit 2](https://kit.svelte.dev/) + [Svelte 5](https://svelte.dev/) (Runes)                                |
| Language      | TypeScript 5.9                                                                                                  |
| UI            | [Skeleton](https://skeleton.dev/) v4 + [Tailwind CSS](https://tailwindcss.com/) 4                               |
| Theme         | Custom "Meridian" clinical theme                                                                                |
| Backend / DB  | [Supabase](https://supabase.com/) (self-hosted) — PostgreSQL, Auth, Storage, RLS                                |
| Auth          | `@supabase/ssr` — cookie-based server-side auth via SvelteKit hooks                                             |
| Forms         | [sveltekit-superforms](https://superforms.rocks/) + [Zod](https://zod.dev/) (schema validation)                 |
| AI (optional) | OpenAI SDK — [LM Studio](https://lmstudio.ai/) or [Ollama](https://ollama.com/) (local-only)                    |
| Markdown      | [marked](https://marked.js.org/) + [DOMPurify](https://github.com/cure53/DOMPurify)                             |
| Testing       | [Vitest](https://vitest.dev/) (unit/component) + [Playwright](https://playwright.dev/) (E2E)                    |
| Deployment    | Docker / Portainer (`adapter-node`) or Cloudflare Pages (`adapter-cloudflare`) — runtime selected at build time |

---

## Architecture Highlights

- **Server-first rendering** — All data loading and mutations happen in `+page.server.ts` files; no client-side API calls for sensitive operations
- **Defense in depth** — Permissions checked at the route handler level AND enforced at the database via PostgreSQL RLS policies
- **Type-safe DB layer** — Centralized database functions in `src/lib/server/db/` with generated Supabase types; no raw SQL in route files
- **Form safety** — All forms validated with Zod schemas via sveltekit-superforms; server always re-validates regardless of client state
- **Audit by default** — `logAudit()` is fire-and-forget and never blocks user flows; every `load()` and form action on PHI routes logs an event
- **Health endpoint** — `/api/health` used by Docker health checks for zero-downtime readiness probing
- **Security headers** — HIPAA-relevant HTTP headers (`Cache-Control`, `X-Frame-Options`, etc.) applied globally via `hooks.server.ts`

---

## Testing

The project includes both unit and end-to-end test suites:

- **Unit tests** (Vitest + vitest-browser-svelte) — Component behavior, utility functions, DB layer logic
- **E2E tests** (Playwright) — Auth flows, denial CRUD, HIPAA header assertions, AI chat interactions, idle session timeout

```sh
npm run test:unit   # Vitest
npm run test:e2e    # Playwright
npm run test        # Both
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) >= 22 LTS
- [Docker](https://www.docker.com/) + Docker Compose
- A running [self-hosted Supabase](https://supabase.com/docs/guides/self-hosting/docker) instance

---

## Deployment

The app supports three runtime targets (Local Docker, Portainer Git stack,
Cloudflare Pages) against two backend options (self-hosted Supabase via
Docker, or Supabase Cloud).

| Target / Backend          | Self-hosted Supabase (Docker) |  Supabase Cloud   |
| ------------------------- | :---------------------------: | :---------------: |
| **Local Docker**          |  ✅ both stacks via compose   | ✅ app stack only |
| **Portainer (Git stack)** |  ✅ both stacks via compose   | ✅ app stack only |
| **Cloudflare Pages**      | ❌ (not reachable from edge)  |        ✅         |

All targets share the same source. Secrets are injected at runtime via
environment variables (`$env/dynamic/*`) — the build artifact contains no
instance-specific values, so the same image / bundle deploys anywhere.

### Required environment variables

| Variable                    | Required | Notes                                                       |
| --------------------------- | :------: | ----------------------------------------------------------- |
| `PUBLIC_SUPABASE_URL`       |    ✅    | Public Supabase URL the browser hits                        |
| `PUBLIC_SUPABASE_ANON_KEY`  |    ✅    | Public anon key                                             |
| `SUPABASE_SERVICE_ROLE_KEY` |    ✅    | **Secret** — admin operations and setup                     |
| `ORIGIN`                    |    ✅    | Public URL of the app (`https://...`)                       |
| `DATABASE_URL`              |    ⚠️    | Only needed when running migrations (`migrate` profile)     |
| `SUPABASE_INTERNAL_URL`     | optional | Docker-internal Supabase URL (set automatically by overlay) |

---

### 1. Local Docker

#### App only (existing Supabase — cloud or external host)

```sh
./install.sh           # or ./install.ps1 on Windows
# Choose option [1] App only and paste in your Supabase URL / keys.
```

Or manually:

```sh
cp .env.example .env   # then edit PUBLIC_SUPABASE_URL, keys, ORIGIN
docker compose up -d
```

To run database migrations once against the configured `DATABASE_URL`:

```sh
docker compose --profile migrate up migrate
```

#### App + bundled self-hosted Supabase (single host)

```sh
./install.sh
# Choose option [2] App + Supabase. Secrets and JWTs are generated for you.
```

Or manually:

```sh
cp .env.example .env   # POSTGRES_PASSWORD, JWT_SECRET, etc.
docker compose --profile with-local-db \
  -f docker-compose.yml -f docker-compose.supabase.yml up -d
```

Brings up: app, migrate, db (Postgres 15), kong, auth (GoTrue), rest
(PostgREST), storage + imgproxy, postgres-meta, Studio.

> The bundled Supabase stack is a slim subset of the upstream
> [supabase/supabase docker setup](https://github.com/supabase/supabase/tree/master/docker)
> (Apache-2.0). Realtime, edge functions, analytics/Logflare, and the
> Supavisor pooler are intentionally omitted. Vendored files live in
> `supabase/volumes/` with the required `LICENSE` and `NOTICE.md`.

---

### 2. Portainer (Git repository stack)

Create a stack in Portainer pointing at this repository's Git URL.
Portainer will clone the repo, run `docker compose build` (no registry
needed; `pull_policy: build` keeps it from trying Docker Hub), and start
the containers.

In the stack's **Environment variables** form, set the variables from the
table above. Optionally set the **profile** in the advanced compose
options:

- **(default)** — App only, points at external Supabase.
- **`migrate`** — Also runs migrations once at startup.
- **`with-local-db`** — Bundled self-hosted Supabase. Requires also
  selecting the secondary compose file `docker-compose.supabase.yml` in
  the stack's "Additional file" field.

`.env` is **not** required (it is marked optional in compose). All values
come from the Portainer stack form.

---

### 3. Cloudflare Pages

Cloudflare Pages requires **Supabase Cloud** (or any publicly-reachable
Supabase) — the CF edge cannot reach a Docker-local backend.

**Project setup (Cloudflare dashboard → Pages → Create → Connect to Git):**

| Field                  | Value                                                       |
| ---------------------- | ----------------------------------------------------------- |
| Build command          | `npm run build:cf`                                          |
| Build output directory | `.svelte-kit/cloudflare`                                    |
| Environment variables  | `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `ORIGIN` |
| Secrets                | `SUPABASE_SERVICE_ROLE_KEY` (mark as encrypted)             |

The build script `npm run build:cf` sets `SK_ADAPTER=cloudflare` so
SvelteKit emits Workers-compatible output. Default builds (`npm run build`)
keep emitting `adapter-node` for Docker.

**Migrations**: run them out-of-band against your Supabase Cloud project
(`supabase db push`, the dashboard SQL editor, or the migrate container
locally pointed at your cloud `DATABASE_URL`).

**Known CF caveat**: in-memory rate limiting on the AI routes is per-isolate
on Workers (not globally enforced). For strict global rate limiting on CF,
migrate to Cloudflare KV or Durable Objects.

---

### Reverse proxy / TLS

Docker/Portainer modes set `PROTOCOL_HEADER=x-forwarded-proto` and
`HOST_HEADER=x-forwarded-host`, so any TLS-terminating proxy (Caddy,
Nginx, Traefik, Cloudflare Tunnel) in front works out of the box.
Cloudflare Pages handles TLS automatically. Make sure `ORIGIN` matches
the public URL users type into the browser (including scheme).

### Bundled mode networking note

In bundled-Supabase mode, the app container reaches Supabase via
`SUPABASE_INTERNAL_URL=http://kong:8000` (set automatically by
`docker-compose.supabase.yml`). When unset, SSR falls back to
`PUBLIC_SUPABASE_URL` — the right behaviour for external/cloud Supabase.

---

## HIPAA Technical Safeguards

| Safeguard               | Implementation                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| Access control          | PostgreSQL RLS + server-side permission checks on every route                                      |
| Audit controls          | Immutable `audit_log` table; every PHI access and auth event recorded                              |
| Automatic logoff        | Configurable idle timeout (default 15 min) with cross-tab sync and warning modal                   |
| Password management     | 12-char minimum, complexity rules, configurable expiry, forced change flow                         |
| Transmission security   | HTTPS enforced; security headers applied at the hook layer                                         |
| PHI at rest             | Encrypted OS/infrastructure volumes                                                                |
| PHI in transit controls | `Cache-Control: no-store` on all protected routes; no PHI in URLs or browser storage               |
| Data retention          | Soft-delete with configurable retention period; admin-controlled hard delete and audit log pruning |
| AI privacy              | Local-only inference; no PHI sent to external providers                                            |

> **Disclaimer**: This software implements technical controls to support HIPAA compliance but does **not** constitute compliance on its own. Deployers are responsible for administrative safeguards, physical safeguards, BAAs, risk assessments, and operational policies required by HIPAA.

---

## License

[MIT](LICENSE)
