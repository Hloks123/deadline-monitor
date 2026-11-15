# Deadline-Monitor: Project Structure and Data Flow

This guide explains how the application is organised, how a request moves through it, and where the main types of data are stored. It is intended as a map for reading and maintaining the project, rather than a description of every individual screen.

## 1. What the application does

Deadline-Monitor helps consultants and client teams keep track of business records, due dates, recurring work, assigned tasks, reminders, calendars, and reports. The application has three main user experiences:

- **Main consultant** — manages client organisations and their operational data.
- **Assistant consultant** — works with the clients assigned to them, using imported client workspace data.
- **Client users** — view their organisation's records and work, manage team tasks, and download reports.

An **administrator** manages platform access and accounts. Platform administration does not automatically grant access to operational client data.

## 2. Technology at a glance

- **Next.js App Router** provides the web application, page routing, and server-side API route handlers.
- **React** builds the interactive screens and reusable components.
- **TypeScript** defines the application's data shapes and catches many mistakes during development.
- **Tailwind CSS** supplies the styling utilities.
- **Supabase** provides authentication and the shared PostgreSQL database, including row-level security (RLS).
- **Browser storage** (`localStorage`) still backs much of the original consultant-side data model.

The dependency and command list is in [`package.json`](../package.json). Global page metadata and CSS are set in [`src/app/layout.tsx`](../src/app/layout.tsx) and [`src/app/globals.css`](../src/app/globals.css).

## 3. Reading the source tree

```text
src/
  app/                 Pages and API endpoints (Next.js App Router)
    api/               Server endpoints called by the screens
    client/            Client workspace pages
    login/             Sign-in screen
    ...                Main consultant and public pages
  components/          Reusable screen sections, forms, tables, and calendars
    client/            Client workspace UI
    workspace/         Consultant shell and assistant-consultant UI
  lib/                 Application rules, types, selectors, storage, and helpers
    admin/             Account/organisation authorization and provisioning helpers
    auth/              Workspace role and access resolution
    recurringTasks/    Recurrence rules, task definitions, and occurrences
    supabase/          Browser, server-cookie, admin, and proxy Supabase clients
supabase/
  migrations/          Ordered database schema, functions, and RLS policies
  seed.sql             Local development seed data
scripts/               Focused workspace, tenant, and SQL authorization checks
docs/                  Project and feature documentation
```

### The important boundaries

- A file under `src/app/**/page.tsx` usually selects or wraps a screen; the detailed interface is often in `src/components/`.
- A file under `src/app/api/**/route.ts` runs on the server. It validates requests, checks access, reads or updates data, and returns JSON.
- `src/lib/` contains domain behavior that should not be tied to one screen—for example record status calculations, report selection, task recurrence, or access resolution.
- `supabase/migrations/` is the authoritative history of database structure and policies. Change the database through migrations, not by treating a manually edited local database as the source of truth.

## 4. Main pages and what they are for

### Public and sign-in pages

- `/` — public landing page.
- `/get-started` — enquiry/onboarding entry point.
- `/login`, `/forgot-password`, `/update-password` — account access and password recovery.
- `/privacy`, `/terms` — public policy pages.
- `/assigned-access-pending` — explains that an account is not yet assigned to a workspace.

### Consultant workspace

Most consultant pages are at the site root:

- `/dashboard` — operational overview.
- `/clients` and `/clients/[id]` — client directory and client detail.
- `/monitored-records` and `/monitored-records/[id]` — monitored records, with new/edit routes.
- `/work` and `/recurring-tasks` — work tracking and recurring task definitions.
- `/calendar`, `/reminders`, `/reports`, `/audit-history` — operational views and reporting.
- `/settings` and `/account` — settings and personal account actions.

These pages use the consultant workspace shell. The shell checks the signed-in user's workspace role before showing operational screens.

### Assistant consultant behavior

Assistant consultants use the same consultant-side routes and navigation shell, but the shell switches their operational content to [`AssistantWorkspaceView`](../src/components/workspace/AssistantWorkspaceView.tsx). That view is scoped to organisations assigned to the assistant. Its calendar is built from those assigned clients' imported workspace snapshots, rather than from the main consultant's browser-local data.

### Client workspace

Client pages are grouped under `/client`:

- `/client/dashboard` — organisation overview.
- `/client/records` and `/client/records/[id]` — shared records.
- `/client/work`, `/client/work-tracker`, `/client/tasks` — work and task views.
- `/client/calendar`, `/client/notifications`, `/client/reports` — calendar, notifications, and exports.
- `/client/team` and `/client/account` — team and account settings.

## 5. Authentication and route access, step by step

1. The user submits the sign-in form in [`LoginForm.tsx`](../src/app/login/LoginForm.tsx). Supabase Auth verifies the credentials and establishes a session.
2. The form calls `GET /api/auth/workspace`. The endpoint asks [`getWorkspaceAccess`](../src/lib/auth/workspace.ts) to verify the authenticated user, active profile, platform roles, and active organisation memberships.
3. If access is valid, the endpoint returns the correct destination (consultant or client workspace). If it is invalid, the user is signed out and shown an access-specific error.
4. On subsequent requests, [`src/proxy.ts`](../src/proxy.ts) delegates to the Supabase session helper to refresh and preserve the session cookies.
5. Password recovery sends a token-hash link to `/auth/callback`; the callback verifies the recovery token on the server and sets the session cookie before opening `/update-password`. This avoids depending on the PKCE verifier being present in the browser that opens the email.
6. Workspace screens and API handlers check access again. The UI gate is useful for navigation and feedback, but the server-side access check is what protects data operations.

The roles are declared in `src/lib/auth/workspace.ts`:

| Role | Scope |
| --- | --- |
| `administrator` | Platform-level account administration |
| `main_consultant` | Consultant operations and client management |
| `assistant_consultant` | Consultant workspace limited to assigned organisations |
| `client_administrator` | Client organisation access with administrator functions |
| `client_user` | Client organisation access as a regular user |

The workspace resolver deliberately distinguishes platform roles from organisation memberships. A user with administrative access is not thereby granted a client operational membership.

## 6. How the main data flows work

### A. Main consultant data

The older consultant operating screens use browser-side stores in `src/lib/`, including:

- [`recordStore.ts`](../src/lib/recordStore.ts) — monitored records, record status calculations, audit events, and communications.
- [`clientStore.ts`](../src/lib/clientStore.ts) — the client directory and client details.
- [`clientWorkspaceStore.ts`](../src/lib/clientWorkspaceStore.ts) — responsible people, work trackers, and checklist/work items.
- [`recurringTasks/`](../src/lib/recurringTasks) — recurring task definitions and their occurrences.

These stores read and write `localStorage` in the user's browser. This means that **not all main-consultant operational data is automatically shared through Supabase**. Data in these stores is tied to the browser/device until it is explicitly imported into the shared workspace.

### B. Importing a client workspace for assistants and client views

The import path bridges the legacy browser-local stores and shared Supabase data:

1. A main consultant selects a client to import from the consultant UI.
2. [`assistantWorkspaceImport.ts`](../src/lib/assistantWorkspaceImport.ts) collects that client's records, recurring tasks, task occurrences, people, trackers, checklist items, audit events, and communications from the browser stores.
3. The snapshot builder filters the data to the selected client and maps it to the canonical Supabase organisation ID.
4. The UI sends the result to `POST /api/assistant/workspace`. The server verifies the main-consultant role and validates the organisation and snapshot before saving.
5. The full snapshot is stored in `organisation_workspace_snapshots`. A sanitized records projection is also replaced in `organisation_client_records`, so client pages can read shared records.
6. An assistant's `GET /api/assistant/workspace` returns only organisations assigned to that assistant. Assistant changes go through `PATCH /api/assistant/workspace`, where the server verifies the assignment, validates the requested change, and checks the snapshot version before writing.

The version check prevents a stale assistant browser from silently overwriting a newer workspace update. Assistant updates also refresh the client-record projection.

### C. Client pages and assigned tasks

1. Client pages request their workspace through `GET /api/client/workspace`. The server resolves the authenticated user's active client membership and returns data scoped to that organisation.
2. Shared record data comes from `organisation_client_records`; team details come from active profiles and memberships.
3. Assigned client tasks use `/api/client/tasks`. `GET` returns the signed-in user's tasks and tasks they created. `POST` creates one task row per selected active assignee. `PATCH` handles task actions such as accepting, rejecting, or reassigning.
4. Rejecting a task requires a non-empty reason. The reason is stored in the task's response note alongside its current status.
5. Calendar and report views select from the data available to that workspace. Client reports include shared records and task/work information rather than relying only on a single screen's currently displayed rows.

Client API routes validate the organisation membership on the server; a client cannot choose an arbitrary organisation ID to read or change.

### D. Calendar and reports

Calendar and report data are assembled by selectors and helpers in `src/lib/`, then presented by components in `src/components/`. The main consultant calendar uses consultant operational data; the assistant calendar derives activities from the assistant's assigned-client snapshots; client calendars and reports use the client workspace APIs.

Report export helpers are in the client/report-related library modules and produce downloadable formats such as spreadsheet, PDF, and document files. If a record or task is missing from a report, check both the source data path and the report selector: data stored only in a consultant's `localStorage` does not become shared client data until it is imported.

## 7. Data storage map

| Data | Main source | Notes |
| --- | --- | --- |
| Sign-in credentials and session | Supabase Auth | Session is carried with Supabase SSR cookies. |
| Profiles, platform roles, organisation membership | Supabase tables | Access resolver and RLS use these to establish scope. |
| Main consultant legacy records, client directory, trackers, task definitions | Browser `localStorage` | Device/browser-local; not automatically synced. |
| Assistant workspace copy | `organisation_workspace_snapshots` | Imported snapshot, scoped by organisation and assistant membership. |
| Client-visible record projection | `organisation_client_records` | Shared projection derived from imported records. |
| Client-assigned tasks and responses | `organisation_tasks` | Server-backed, organisation-scoped, with status and response note. |
| Client-side preferences/drafts | Browser storage where used | Profile-scoped storage keys are provided by `clientWorkspaceConstants.ts`. |

The data model for imported workspaces is described in [`assistantWorkspaceTypes.ts`](../src/lib/assistantWorkspaceTypes.ts). Recurrence and occurrence shapes are in [`recurringTasks/types.ts`](../src/lib/recurringTasks/types.ts).

## 8. Supabase: tables, migrations, and security

The migrations build the tenant model in stages. The main tables include:

- `organisations` — client organisation and service-level metadata.
- `profiles` — user display and active-account state.
- `platform_roles` — platform-wide administrator/main-consultant roles.
- `organisation_memberships` — a user's organisation and workspace role.
- `organisation_contacts` — organisation contact records.
- `organisation_workspace_snapshots` — imported assistant workspace snapshots.
- `organisation_client_records` — records shared with client workspaces.
- `organisation_tasks` — individually assigned client tasks.

Migration SQL also defines helper functions and RLS policies. Review the policies alongside the API route when changing who can read or mutate a table. Supabase project settings for local development are in [`supabase/config.toml`](../supabase/config.toml); ordered schema changes are in [`supabase/migrations/`](../supabase/migrations).

The local recovery email template is [`supabase/templates/recovery.html`](../supabase/templates/recovery.html). Hosted Supabase email templates are configured separately in the project's Authentication settings, so changing this file alone does not update the hosted project's outgoing recovery emails.

There are three Supabase client patterns under `src/lib/supabase/`:

- **Browser client** — uses the public/publishable key for browser authentication.
- **Server client** — reads and writes the session through Next.js cookies and is used for authenticated server-side access checks.
- **Admin client** — server-only and uses the service-role key for privileged operations. Routes using it must perform their own authorization and input validation before using it.

Never put a service-role key in client-side code or commit environment secrets. Use [`.env.example`](../.env.example) to see the required environment variable names without exposing local credentials.

## 9. Where to look when changing a feature

Use this sequence to trace a feature from screen to database:

1. **Find the route page** in `src/app/` to see which shell and screen are used.
2. **Find the component** in `src/components/` to understand user actions and displayed state.
3. **Find its data helper or selector** in `src/lib/` to understand filtering, mapping, and calculations.
4. **Find the API route** in `src/app/api/` if the feature reads or writes shared/server data.
5. **Find the migration and RLS policy** in `supabase/migrations/` if a database table is involved.
6. **Find the focused test** in the matching `src/lib/*.test.cjs` file or `scripts/` directory.

For example, to change assistant work updates, start with `AssistantWorkspaceView.tsx`, then follow its request into `/api/assistant/workspace`, `assistantWorkspaceMutations.ts`, and the snapshot migration. To change a client task, start with the client task screen and follow `/api/client/tasks` to `organisation_tasks` and its migration policies.

## 10. Development and checks

- Install dependencies using the repository's package manager and lockfile.
- Configure local environment variables using `.env.example` as a reference. Do not copy real secrets into documentation or source files.
- Start the web app with `npm run dev`.
- Run static checks with `npm run lint` and `npm run build`.
- Local Supabase setup is defined by `supabase/config.toml`; migrations are under `supabase/migrations/`.
- Focused authorization and tenant checks are in `scripts/`. The project currently has no `npm test` script, so use the relevant test/check file and its documented prerequisites.

Useful current checks include the workspace authorization, tenant isolation, assistant workspace, and assistant mutation scripts, plus focused library tests such as `clientReports.test.cjs` and `clientActivities.test.cjs`.

## 11. Suggested reading order

If you are new to the code, read these in order:

1. [`src/app/page.tsx`](../src/app/page.tsx) — see the product entry page.
2. [`src/app/login/LoginForm.tsx`](../src/app/login/LoginForm.tsx) — see how a user signs in and gets routed.
3. [`src/lib/auth/workspace.ts`](../src/lib/auth/workspace.ts) — understand the role and organisation model.
4. [`src/components/workspace/WorkspaceShell.tsx`](../src/components/workspace/WorkspaceShell.tsx) — see how consultant screens are gated and how assistants are routed to their view.
5. [`src/lib/recordStore.ts`](../src/lib/recordStore.ts) and [`src/lib/clientWorkspaceStore.ts`](../src/lib/clientWorkspaceStore.ts) — understand the legacy browser data model.
6. [`src/app/api/assistant/workspace/route.ts`](../src/app/api/assistant/workspace/route.ts) and [`src/app/api/client/tasks/route.ts`](../src/app/api/client/tasks/route.ts) — follow representative shared-data APIs.
7. [`supabase/migrations/`](../supabase/migrations) — understand the shared database and its access policies.

The most important architectural point to remember is that the application currently has **both browser-local consultant data and server-backed shared workspace data**. When tracing a missing item, first establish which store is its source and whether that data has been imported or written to the server-backed API.
