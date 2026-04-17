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

| Category      | Technology                                                                                      |
| ------------- | ----------------------------------------------------------------------------------------------- |
| Framework     | [SvelteKit 2](https://kit.svelte.dev/) + [Svelte 5](https://svelte.dev/) (Runes)                |
| Language      | TypeScript 5.9                                                                                  |
| UI            | [Skeleton](https://skeleton.dev/) v4 + [Tailwind CSS](https://tailwindcss.com/) 4               |
| Theme         | Custom "Meridian" clinical theme                                                                |
| Backend / DB  | [Supabase](https://supabase.com/) (self-hosted) — PostgreSQL, Auth, Storage, RLS                |
| Auth          | `@supabase/ssr` — cookie-based server-side auth via SvelteKit hooks                             |
| Forms         | [sveltekit-superforms](https://superforms.rocks/) + [Zod](https://zod.dev/) (schema validation) |
| AI (optional) | OpenAI SDK — [LM Studio](https://lmstudio.ai/) or [Ollama](https://ollama.com/) (local-only)    |
| Markdown      | [marked](https://marked.js.org/) + [DOMPurify](https://github.com/cure53/DOMPurify)             |
| Testing       | [Vitest](https://vitest.dev/) (unit/component) + [Playwright](https://playwright.dev/) (E2E)    |
| Deployment    | Docker (multi-stage, non-root) + Docker Compose + `@sveltejs/adapter-node`                      |

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
