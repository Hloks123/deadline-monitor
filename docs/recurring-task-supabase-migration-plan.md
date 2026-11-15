# Recurring-task Supabase migration plan

## Status and scope

This is a repository-source inventory and design plan only. No application persistence was changed, no migration or scheduled job was created, no browser data was read or removed, and no Supabase project was contacted. The assessment used the checked-in source and migrations; a local database inspection was not necessary.

The goal is to migrate recurring-task definitions and occurrences from browser storage and imported workspace snapshots into tenant-scoped server persistence without beginning the migration. It excludes one-off assigned tasks in `organisation_tasks`, work trackers/checklists, work reminders, UI preferences, and any localStorage cleanup.

Relevant source files:

- [`src/lib/recurringTasks/types.ts`](../src/lib/recurringTasks/types.ts)
- [`src/lib/recurringTasks/recurrenceEngine.ts`](../src/lib/recurringTasks/recurrenceEngine.ts)
- [`src/lib/recurringTasks/taskStore.ts`](../src/lib/recurringTasks/taskStore.ts)
- [`src/lib/recurringTasks/occurrenceService.ts`](../src/lib/recurringTasks/occurrenceService.ts)
- [`src/lib/clientWorkspace.ts`](../src/lib/clientWorkspace.ts)
- [`src/lib/clientWorkspaceStore.ts`](../src/lib/clientWorkspaceStore.ts)
- [`src/lib/clientWorkspaceConstants.ts`](../src/lib/clientWorkspaceConstants.ts)
- [`src/lib/assistantWorkspaceImport.ts`](../src/lib/assistantWorkspaceImport.ts)
- [`src/lib/assistantWorkspaceMutations.ts`](../src/lib/assistantWorkspaceMutations.ts)
- [`src/lib/consultantWork.ts`](../src/lib/consultantWork.ts)
- [`src/lib/clientActivities.ts`](../src/lib/clientActivities.ts)
- [`src/lib/consultantActivities.ts`](../src/lib/consultantActivities.ts)

## 1. Current persistence and Supabase context

There are no normalized recurring-task or recurring-occurrence tables in the migrations inspected. The current definitions and occurrence rows are primarily browser-local. The assistant import path can copy a selected client's tasks and occurrences into `organisation_workspace_snapshots.payload` (JSONB), but that is an imported snapshot, not authoritative normalized storage.

Relevant existing Supabase tables:

| Existing table | Current purpose | Recurring-task implication |
| --- | --- | --- |
| `organisation_tasks` | One-off tasks assigned to profile users, with an acceptance/rejection lifecycle. | Do not reuse as recurring definitions or generated occurrences. |
| `organisation_workspace_snapshots` | Versioned JSONB assistant workspace imported from the browser. | Contains imported `tasks`, `occurrences`, people, and other workspace state; assistant occurrence changes currently use snapshot optimistic concurrency. |
| `organisation_audit_events` | Tenant-scoped generic audit events. It has `entity_type`/`entity_id`, nullable `record_id`, actor/action/value fields and a timestamp. | Can hold recurring-task events with `record_id = NULL`; it has no task FK or dedicated entity lookup index. Existing consultant/assistant policies do not grant clients direct access. |
| `responsible_people` | Organisation-scoped operational people; `profile_id` is optional and is checked against an active membership when present. | Closely matches the client workspace `ResponsiblePerson` concept, but browser IDs still require reconciliation. |
| `organisation_contacts` | Canonical organisation contacts used by monitored-record contact assignment. | Do not assume it is interchangeable with `responsible_people`; decide which meaning a recurring-task owner represents. |
| `profiles`, `organisation_memberships`, platform roles | Canonical users and access. | Use profile UUIDs only after verifying active same-organisation membership or the established main-consultant role rule. |

`responsible_people` currently has active-member read policy and authenticated `SELECT` grant; authenticated writes are not generally granted by its foundation migration. Main-consultant and assistant server writes should use the existing trusted server authorization pattern rather than widening this table's grants without need. A platform administrator does not gain operational tenant access merely by holding the platform role.

The existing assistant API authenticates and scopes workspace requests. Assistant occurrence changes are validated in `assistantWorkspaceMutations.ts` and written back to the snapshot with an expected `updated_at` check. This protects that snapshot path but does not make the imported JSONB data a normalized shared source for dashboard, client, or calendar reads.

## 2. Browser storage keys and data inventory

`getClientProfileStorageKey()` returns the base key unchanged when there is no authenticated client profile context. With a client organisation and user it prefixes the key as:

```text
docmon_client_profile_v1:<encoded-organisation-id>:<encoded-user-id>:<base-key>
```

Consequently, a raw consultant key and one or more profile-qualified client keys may coexist. Do not merge them by key name alone or assume they contain the same rows.

| Exact key or pattern | Type and source | Authority and tenant/parent | IDs, dates, status and deduplication | Consumers and migration risk |
| --- | --- | --- | --- | --- |
| `docmon_recurring_tasks_v1` (raw or profile-qualified) | `RecurringTask[]`; `recurringTasks/taskStore.ts`. | Authoritative for the browser-local consultant/client flows. `organisationId` is commonly a legacy client ID; a client profile key additionally scopes by organisation and user. | IDs are `task-${crypto.randomUUID()}` for new tasks; older and demo IDs can differ. `startDate` is date-only; `dueTime` is a wall-clock string; `timezone` is an IANA zone string; run and audit timestamps are ISO strings. Status: `active`, `paused`, `cancelled`, `archived`. No server uniqueness. | Consultant work/dashboard/calendar and client task/calendar/report selectors read it. Demo seeding writes fictional tasks; no explicit `isDemo` provenance marker exists. |
| `docmon_recurring_occurrences_v1` (raw or profile-qualified) | `TaskOccurrence[]`; `recurringTasks/occurrenceService.ts`. | Authoritative for browser-local occurrence state. Each row has a parent recurring-task ID and organisation ID; neither is a database-enforced relation. | IDs use `occ_${Date.now()}_${random-suffix}`. `uniqueKey` is `organisationId:recurringTaskId:YYYY-MM-DD`; it is checked only in the current local array. `scheduledFor` is intended as a date; `dueAt` is emitted without an offset. Status is stored locally. | Dashboard, calendar, client activities, work views and reports. Same-day/device checks do not prevent cross-device duplicate occurrences. Occurrences can be orphaned or use legacy task IDs. |
| `doc-monitor-audit-events` (raw or profile-qualified) | `AuditEvent[]`; `recordStore.ts`, also written by task and occurrence helpers. | Local audit source for local flows; generic entity ID is optional text, organisation is often a display name, and actor is often a display label. | Browser UUID, ISO date/timestamp, free-text or JSON values, context. No database FK or local deduplication. | Audit-history and dashboard activity selectors. Values can include whole task JSON, reasons, evidence-adjacent data, local IDs and placeholder actors; an allowlist is required before server import. |
| `docmon_client_workspace_v1` (raw or profile-qualified) | `ClientWorkspaceState`; `clientWorkspaceStore.ts`. Holds `people`, trackers, checklist items, and reminder preference. | Organisation-scoped local data. `people` feed client task/calendar owner selectors; current importer also has a raw-key collection path, while normal store access can be profile-qualified. | New local person IDs are `person-${UUID}`, but defaults can reuse nested client-contact IDs. Tracker/item dates are date-only; timestamps are ISO. People are active/inactive. | Owner mapping and local defaults. The profile-qualified versus raw-key discrepancy can omit people during snapshot import. This is a supporting identity source, not a second recurrence store. |
| `doc-monitor-clients` | Local `Client[]`; `clientStore.ts`. | Unscoped legacy consultant directory. Nested contacts and client IDs are local, not guaranteed UUIDs. | Client IDs are commonly slugs; contact IDs are legacy strings or locally generated values. No creation timestamps or tenant FK. | Legacy organisation mapping and prototype/demo detection. Duplicate company names are possible. |
| `doc-monitor-records` (raw or profile-qualified) | Legacy monitored-record map; `recordStore.ts`. | Supporting source for `linkedRecordId`; the monitored-record server cutover is separate. | Legacy record IDs may not be UUIDs. | Resolve links only through an explicit canonical record mapping; never cast or infer IDs. |
| `doc-monitor-communications` (raw or profile-qualified) | Communication/reminder history; `recordStore.ts`. | Supporting data, not the recurring occurrence store. Optional `relatedTaskId` can be a legacy recurring-task ID. | Mixed date/time encodings and free-text content. | Reconcile linked IDs only if communications are included in a later, separately approved slice. |
| `docmon_client_report_favorites_<organisation-id>_v1` | UI preference. | Organisation-keyed, not user-keyed. | String IDs; duplicate-safe toggle behavior. | Keep local unless cross-device preference synchronization is explicitly requested. |
| `docmon_client_read_notifications_<organisation-id>_v1` | UI-derived read-state. | Organisation-keyed, not user-keyed. | String IDs; not a notification history. | Keep local unless cross-device read-state is explicitly requested. |

The task store's `seedDemoRecurringTasksIfEmpty()` checks the raw task key even when ordinary reads/writes may use a profile-qualified key. That can seed into or reason about a different namespace. The key prefix itself does not indicate whether a row is genuine or a prototype.

No values from these browser stores were read for this inventory. Migration should read only user-selected source stores after server authorization and explicit organisation mapping; it must not clear or remove any local key.

## 3. Exact current TypeScript domain types

The definitions below are the current recurrence and task/occurrence types in `src/lib/recurringTasks/types.ts`:

```ts
export type RecurrenceFrequency =
  | "once"
  | "daily"
  | "weekdays"
  | "weekly"
  | "monthly"
  | "month_end"
  | "quarterly"
  | "annually"
  | "custom";

export type TaskPriority = "low" | "medium" | "high" | "critical";

export type TaskStatus =
  | "active"
  | "paused"
  | "cancelled"
  | "archived";

export type OccurrenceStatus =
  | "upcoming"
  | "due_today"
  | "in_progress"
  | "completed"
  | "skipped"
  | "failed"
  | "overdue"
  | "cancelled";

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  weekdays?: number[]; // 0 = Sunday ... 6 = Saturday
  dayOfMonth?: number;
  interval?: number;
  intervalUnit?: "day" | "week" | "month" | "year";
}

export interface RecurringTask {
  id: string;
  organisationId: string;
  name: string;
  description?: string;
  linkedRecordId?: string;
  linkedFolderId?: string;
  ownerId: string;
  reviewerId?: string;
  priority: TaskPriority;
  startDate: string;
  dueTime?: string;
  timezone: string;
  recurrence: RecurrenceRule;
  escalationRule?: {
    enabled: boolean;
    afterDays: number;
    escalateToUserId?: string;
  };
  requiresCompletionEvidence: boolean;
  requiresConsultantReview: boolean;
  clientVisible?: boolean;
  clientCanSkip?: boolean;
  status: TaskStatus;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type RecurringTaskInput = Omit<
  RecurringTask,
  "id" | "createdAt" | "updatedAt"
>;

export interface TaskOccurrence {
  id: string;
  recurringTaskId: string;
  recurringTaskName?: string;
  organisationId: string;
  scheduledFor: string;
  dueAt: string;
  status: OccurrenceStatus;
  ownerId: string;
  uniqueKey: string;
  startedAt?: string;
  completedAt?: string;
  completionEvidence?: string;
  skippedReason?: string;
  failureReason?: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
}
```

`linkedFolderId`, `lastRunAt`, and `nextRunAt` have no confirmed normalized destination or effective server-side writer in the inspected recurrence path. `recurringTaskName` is a denormalized occurrence display snapshot. `ownerId` on an occurrence is copied from the task when it is generated.

## 4. Recurrence calculation and range generation

`shouldGenerateOccurrence(task, date)` in `recurrenceEngine.ts` is the current recurrence rule:

| Frequency | Current rule |
| --- | --- |
| `once` | Exactly the task start date. |
| `daily` | Every candidate date from the start date onward. |
| `weekdays` | Monday through Friday, regardless of `rule.weekdays`. |
| `weekly` | Candidate weekday is in `rule.weekdays` (0 Sunday through 6 Saturday). |
| `monthly` | Candidate day equals `dayOfMonth` or the start-day fallback, clamped to the last day of the month. |
| `month_end` | Last calendar day of each month. |
| `quarterly` | Same start-day anchor, clamped to month end, every three months from the start month. |
| `annually` | Same start month and day anchor, clamped to month end. A February 29 anchor therefore becomes February 28 in non-leap years. |
| `custom` day/week | Difference from start is calculated by flooring elapsed local-midnight milliseconds into days or weeks and taking the interval modulus. |
| `custom` month/year | Calendar month/year distance is used; anchor day is clamped as above. |

The function rejects dates before `startDate` and tasks not in `active` state. The UI calendar builder validates a strict `YYYY-MM-DD` date, weekday range and uniqueness, month day range 1–31, and custom interval 1–365. Not all of those UI constraints are guaranteed by the domain type or by every caller; server validation and database checks must not trust the browser.

`generateOccurrences(tasks, from, through)` iterates each local calendar day in the inclusive range and calls the recurrence function. It rejects invalid or reversed ranges. It checks a set of existing `uniqueKey` values from the current browser array, then creates missing rows. The natural key is deterministic, but the generated occurrence ID is not. Duplicate prevention is thus local, not shared or concurrency-safe.

Current call sites generate different windows: dashboard/task-list/client workspace flows generally generate about 30 days, task detail can generate about 60 days, and client task creation generates about 30 days after its start date. One-time client-created work generates its single matching date. The exact windows are UI behavior, not a central scheduler contract.

## 5. Statuses, transitions, skip/fail/retry, and pause/resume

### Current persisted state

Task status is stored as `active`, `paused`, `cancelled`, or `archived`. Occurrence status is also stored, including the time-relative labels `upcoming`, `due_today`, and `overdue`. `markOverdueOccurrences()` compares `new Date(dueAt)` with the current browser time and changes non-terminal occurrences to `overdue`.

There is no centralized transition matrix. `updateOccurrenceStatus()` accepts any occurrence status. Start, complete, skip, and fail helpers update the row without checking its prior status. The retry helper is narrower: it acts only on `failed`, sets `in_progress`, clears `failureReason`, and increments `retryCount`. There is no retry ceiling. UI visibility and validation provide some additional constraints, but they are not a tenant-safe server policy.

| Action | Current behavior |
| --- | --- |
| Start | Any found row can be set to `in_progress`; `startedAt` is set. |
| Complete | Any found row can be set to `completed`; completion time and optional text evidence are stored. |
| Skip | Any found row can be set to `skipped`; a reason is stored. Client UI may restrict availability based on task settings, but local helpers themselves do not enforce it. |
| Fail | Any found row can be set to `failed`; a reason is stored. |
| Retry | Only `failed` is retried; same row moves to `in_progress`, failure reason clears, retry count increments. |
| Mark overdue | A due instant in the past changes any non-terminal row other than already overdue to `overdue`; even `in_progress` can become overdue. |
| Generic update | Can set any declared occurrence status without validation. |
| Pause task | Prevents future generation while paused; existing occurrences remain unchanged/actionable. |
| Resume task | Sets task active. Normal generators start from their requested current window; missed pause dates are not automatically backfilled by a dedicated catch-up process. |

### Recommended server lifecycle

Persist actionable states (`scheduled`, `in_progress`, `completed`, `skipped`, `failed`, `cancelled`) and derive `upcoming`, `due_today`, and `overdue` labels from the scheduled date, due instant, and organisation timezone. This avoids stored date-relative labels becoming stale. If compatibility requires the current wire values, expose the derived display status at the API boundary.

Recommended allowed transitions:

- `scheduled` → `in_progress`, `completed`, `skipped`, `failed`, or `cancelled`, subject to caller role and task policy.
- `in_progress` → `completed`, `skipped`, `failed`, or `cancelled`.
- `failed` → `in_progress` through an explicit retry action only; increment retry count and audit the retry separately.
- `completed`, `skipped`, and `cancelled` are terminal unless a separately authorized reopen action is designed.
- Time passing changes only the derived display label; it does not overwrite `in_progress`.
- A task pause blocks new generation only. Whether already-generated occurrences remain actionable is the least surprising compatibility behavior; missed-date catch-up on resume needs a product decision.

Enforce transitions in one server transaction, not only in the UI. Require non-empty bounded skip/failure reasons where the product requires them. Define whether retry is unlimited, capped, or manually approved before adding an upper-bound constraint. Do not store a pause state on each occurrence.

## 6. Date, time, and time-zone behavior

- `startDate` and `scheduledFor` are intended date-only `YYYY-MM-DD` values.
- `dueTime` is a local wall-clock time; the main task form initializes it to `17:00`. The calendar action allows an empty time and the occurrence creator defaults it to `17:00`.
- The task stores a timezone string. Forms use `Africa/Johannesburg`, but `recurrenceEngine.ts` does not use `task.timezone` in date calculations.
- `createDueAt()` currently returns `YYYY-MM-DDTHH:mm:ss` without a UTC offset or zone. `new Date(dueAt)` then interprets that string using the browser's local zone. A browser outside South Africa can therefore evaluate the same occurrence against a different instant.
- Date-only recurrence calculations use JavaScript local `Date` construction and local getters. Custom day/week intervals divide millisecond differences between local midnights; in DST-observing zones that duration can differ from 24 hours per date.
- Calendar/client selectors separately use `Africa/Johannesburg` for some date interpretation. That does not fix recurrence-engine date arithmetic.
- `createdAt`, `updatedAt`, `startedAt`, and `completedAt` are ISO instants generated with `toISOString()`. Target database columns for these must be `timestamptz`; do not store them as `date`.

Recommended target semantics:

1. Keep `start_date` and `scheduled_for` as PostgreSQL `date`, never convert them through UTC for storage or display.
2. Keep `due_time` as `time without time zone` plus an IANA `timezone` on the task.
3. Generate `due_at` as a `timestamptz` using the task's timezone and the scheduled calendar date. Snapshot the timezone used on the occurrence for audit/reproducibility.
4. Define gap/repeated-wall-time behavior for DST-observing zones. Reject or report ambiguous legacy local timestamps rather than guessing; preserve their original source text in migration staging.
5. Use date arithmetic that is independent of the server/browser process timezone. Do not use `Date` elapsed-millisecond division for date-only intervals.

## 7. Identity, ownership, reviewer, and related-record mapping

### Current sources

- Consultant recurring-task owner and reviewer inputs can be free text; demo rows include labels such as `"Prototype Consultant"` and `"Demo task owner"`.
- Client task forms use active `workspaceState.people`. The current `getEffectiveClientTaskOwnerId()` picks the current value or the first active person. These IDs can come from nested local client contacts or from local `person-${UUID}` rows.
- Client calendar creation checks that the selected person is active and belongs to the current local organisation. This check is browser-side.
- `responsible_people` is an existing organisation-scoped table with an optional profile link. The local `ResponsiblePerson` has matching name/email/role/active concepts.
- `organisation_contacts` is the canonical contact table used by monitored records. It represents authorised contacts and is not automatically equivalent to an operational assignee.
- Reviewer and escalation target values are strings and can be labels rather than profile IDs. The current UI does not establish a canonical account relationship for every value.
- `linkedRecordId` refers to a local monitored-record ID. `linkedFolderId` has no destination entity found in the inspected model.

### Recommended canonical representation

Use explicit typed ownership rather than a single arbitrary `owner_id`:

- `owner_profile_id` for a real account, after validating an active membership in this organisation (or the established main-consultant access rule).
- `owner_responsible_person_id` for an external operational assignee from `responsible_people`, with same-organisation validation.
- Exactly one owner field must be non-null.
- `reviewer_profile_id` should identify a real, authorized consultant account; do not map arbitrary reviewer text to a profile.
- `escalate_to_profile_id` should be nullable and same-organisation/role-validated.
- Resolve `linked_record_id` through the canonical `organisation_records` mapping and enforce same-organisation scope.
- Do not automatically map a local person ID or display name to `organisation_contacts`. A product decision is needed on whether task assignees are operational `responsible_people`, authorised `organisation_contacts`, or both via an explicit bridge.

For tenant-safe composite foreign keys, add same-organisation uniqueness on the referenced `(organisation_id, id)` pairs where needed, or enforce equivalent scope in a trusted trigger. Do not infer identity from display name. Email matching may be a preview hint, but ambiguous or non-unique matches require manual reconciliation.

## 8. Completion evidence and review

`completionEvidence` is optional free text on an occurrence. It is not a file upload or a document/blob reference. Assistant mutation validation caps supplied text at 2,000 characters; local helper paths do not apply one universal length limit. Do not assume evidence is low sensitivity.

`requiresCompletionEvidence` and `requiresConsultantReview` are task flags. There is no separate occurrence review state or review action in the inspected model. The assistant mutation path validates allowed occurrence actions and evidence, but no unified server occurrence service exists. The schema/API design should distinguish:

- a client-submitted completion claim and bounded evidence text;
- the consultant review-required flag;
- a future review decision/actor/time if the product adds an actual review workflow.

Do not silently treat `requiresConsultantReview` as proof that an occurrence was reviewed. A future review workflow should add explicit occurrence review fields or a dedicated event rather than overloading completion status.

## 9. Audit behavior and required audit fields

Current task/occurrence audit calls use `addAuditEvent()` in `recordStore.ts`, so the direct browser flows write to `doc-monitor-audit-events`:

- Task create/edit writes a full task JSON snapshot as new/previous value.
- Schedule, owner, and reviewer changes have additional named events.
- Task status change logs pause/resume/cancel.
- Occurrence status actions log start, complete, skip, fail, and overdue changes. Skip/failure reasons may be embedded in context/value text.
- Occurrence generation itself is not audited.
- Retry is recorded as a transition to “started,” not a distinct retry event, and does not explicitly audit the new retry count.
- Completion evidence is stored on the occurrence; the status event does not needlessly include the evidence, but imported task JSON and free-text logs are not generally allowlisted.
- Calendar task creation calls `saveRecurringTask()` and also writes “Task created from Calendar” with the task and generated occurrence IDs, which can create overlapping create-event history.
- The dashboard material-activity selector includes selected recurring create/edit/complete/pause/resume/schedule/owner actions, but not every possible reviewer, skip, fail, retry, or generation event.

`organisation_audit_events` already has generic entity columns and can be reused without exposing audit rows to clients. Proposed recurring events should set `record_id = NULL`, use `entity_type` of `recurring task` or `task occurrence`, and set `entity_id` to the canonical UUID. Persist `actor_id`, action, field, previous/new allowlisted values, and `occurred_at` within the same transaction as the mutation. Do not serialize entire task rows, evidence, arbitrary notes, or secrets. Add an index on `(organisation_id, entity_type, entity_id, occurred_at DESC)` if task-history queries need it. Keep client-visible activity behind an explicitly sanitized API projection.

If existing generic audit events cannot support the needed retention, actor, or FK guarantees, decide that before choosing a separate audit table; do not create duplicate history systems by default.

## 10. Consultant, assistant, client, dashboard, calendar, reminder, and report flows

| Surface | Current recurring-task source and behavior | Migration consequence |
| --- | --- | --- |
| Consultant `/dashboard` | `consultantWork` snapshot reads local recurring tasks/occurrences and calculates recurring health/exceptions. Dashboard selectors report active/paused, missed/failed and due-today work. | Migrate both task and occurrence reads to one canonical server source; do not only change the visual summary. |
| Consultant `/work` and `/recurring-tasks` | Local task store and local occurrence service; task pages can generate occurrences on load/range. | Replace reads/writes as a coherent repository boundary after API and generator semantics are defined. |
| Consultant calendar | `ConsultantCalendar` loads monitored records/organisations from the server but its work snapshot still reads local task and occurrence stores for recurring work. Calendar task creation uses the local client workspace person store. | This is a mixed-source screen; migrated records do not make recurring task data server-backed. |
| Client `/client/work`, `/client/calendar`, activities/reports | `useClientWorkspaceData()` fetches `/api/client/workspace` for organization/team/record projection, then loads recurring tasks and occurrences via `getClientWorkspaceTasks()`/`getClientWorkspaceOccurrences()` from browser storage. | Server-backed organization/record context does not imply server-backed recurring work. Add client-visible task/occurrence projection and authorized actions. |
| Assistant workspace/calendar | Reads tasks and occurrences from `organisation_workspace_snapshots` after explicit import; mutation writes the versioned snapshot with expected timestamp. | This is server-persisted JSONB but not the canonical normalized source; plan a compatibility adapter or explicit cutover for assistant views. |
| Reminders | `/reminders` is monitored-record/reminder-communication focused. No recurring-occurrence generation or reminder scheduler was found there. Client notification selectors can classify task-related communications, but this is not a central recurring scheduler. | Do not fold record reminders or notification preferences into this recurring-task slice. |
| Client one-off task API | `/api/client/tasks` and `organisation_tasks` represent assigned one-off tasks with a separate lifecycle. | Keep separate; do not silently migrate or merge this entity. |
| Recent activity/report selectors | Client and consultant activity/report selectors consume recurring task/occurrence data and local audit events. | Update source adapters and projection tests when a later UI cutover occurs. |

There is no recurring-task server cron, Supabase scheduled job, or centralized generator in the inspected repository. Generation is initiated from browser paths. No recurring-task test suite currently exercises recurrence-engine boundary behavior or cross-device uniqueness.

## 11. Proposed normalized Supabase schema

Use ordinary typed columns for the finite recurrence, ownership, lifecycle, time and audit-adjacent metadata. Do not put the entire recurrence object or occurrence in unconstrained JSONB. A bounded JSONB field is not needed for the current rule set; use one only if a future versioned recurrence standard requires it and validate it against a schema.

### `organisation_recurring_tasks`

| Column | PostgreSQL type | Null/default | FK and CHECK constraints | Index need | Reason |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | NOT NULL, `gen_random_uuid()` | Primary key. | PK. | Canonical task identity. |
| `organisation_id` | `uuid` | NOT NULL | FK to `organisations(id)`, delete restricted or cascade only under an explicit organisation deletion policy. | Leading key for tenant queries. | Authoritative tenant. |
| `created_by`, `updated_by` | `uuid` | `created_by` NOT NULL; `updated_by` NOT NULL | FK to `profiles(id)`; actor authorization checked at write time. | Optional actor lookup index only if queried. | Canonical creator/updater identity. |
| `name` | `text` | NOT NULL | Non-empty after trim; bounded length (120 characters matches calendar creation validation). | Tenant/name search only if needed. | User-visible task title. |
| `description` | `text` | NULL | Bounded length; not a free-form unbounded private-note field. | None by default. | Optional client-facing task description/notes; visibility gated. |
| `linked_record_id` | `uuid` | NULL | FK to `organisation_records`; enforce same `organisation_id` with composite FK or trigger. | `(organisation_id, linked_record_id)` when filtering by record. | Optional canonical record relationship. |
| `owner_profile_id` | `uuid` | NULL | FK to `profiles`; same-org active membership or allowed consultant role checked server-side/trigger. | `(organisation_id, owner_profile_id)` if owner filtering is common. | User account assignment. |
| `owner_responsible_person_id` | `uuid` | NULL | FK to `responsible_people`; composite same-org FK or trusted scope trigger. | `(organisation_id, owner_responsible_person_id)` if used for filters. | External operational assignee. |
| `reviewer_profile_id` | `uuid` | NULL | FK to `profiles`; active assigned consultant authorization required. | Tenant/reviewer index only if queried. | Replace untrusted reviewer text with a canonical account. |
| `priority` | `text` | NOT NULL, `medium` | CHECK in `low`, `medium`, `high`, `critical`. | `(organisation_id, priority)` only if common filter. | Existing priority enum. |
| `start_date` | `date` | NOT NULL | No timestamp conversion. | `(organisation_id, status, start_date)`. | Recurrence anchor. |
| `due_time` | `time without time zone` | NOT NULL, `17:00` | Valid PostgreSQL time. | None. | Local wall-clock time. |
| `timezone` | `text` | NOT NULL, `Africa/Johannesburg` | Validate as an accepted IANA zone in server logic; do not accept arbitrary abbreviations. | None. | Defines due-time interpretation. |
| `recurrence_frequency` | `text` | NOT NULL | CHECK in `once`, `daily`, `weekdays`, `weekly`, `monthly`, `month_end`, `quarterly`, `annually`, `custom`. | `(organisation_id, recurrence_frequency, status)` if filtered. | Finite recurrence rule discriminator. |
| `recurrence_weekdays` | `smallint[]` | NULL | For `weekly`, require 1–7 unique values each 0–6; otherwise NULL. Enforce uniqueness/shape with a check helper or use a child table. | None by default. | Preserves current selected weekday set. |
| `recurrence_day_of_month` | `smallint` | NULL | For `monthly`, 1–31; otherwise NULL. Values 29–31 clamp to month end, preserving current behavior. | None. | Monthly anchor. |
| `recurrence_interval` | `integer` | NULL | For `custom`, 1–365; otherwise NULL. | None. | Custom interval. |
| `recurrence_interval_unit` | `text` | NULL | CHECK in `day`, `week`, `month`, `year`; required iff frequency is `custom`. | None. | Custom interval unit. |
| `escalation_enabled` | `boolean` | NOT NULL, `false` | If true, `escalation_after_days` must be 1–365. | None. | Normalize nested escalation rule. |
| `escalation_after_days` | `integer` | NULL | CHECK 1–365 when present. | None. | Escalation delay. |
| `escalate_to_profile_id` | `uuid` | NULL | FK to `profiles`; same-org authorization check. | None unless escalation queue filters on it. | Optional canonical escalation target. |
| `requires_completion_evidence` | `boolean` | NOT NULL, `false` | Boolean. | None. | Existing task policy. |
| `requires_consultant_review` | `boolean` | NOT NULL, `false` | Boolean. | `(organisation_id, requires_consultant_review, status)` if operationally queried. | Existing flag; not proof of completed review. |
| `client_visible` | `boolean` | NOT NULL, `false` | Boolean. | `(organisation_id, client_visible, status)`. | Controls sanitized client projection. |
| `client_can_skip` | `boolean` | NOT NULL, `false` | CHECK `client_can_skip` implies `client_visible`. | None. | Client action policy. |
| `status` | `text` | NOT NULL, `active` | CHECK in `active`, `paused`, `cancelled`, `archived`. | Partial active-task index `(organisation_id, start_date)` WHERE status=`active`; tenant/status index for lists. | Task lifecycle. |
| `version` | `integer` | NOT NULL, `1` | CHECK `version >= 1`; increment on every accepted update. | None. | Optimistic concurrency. |
| `generated_through_date` | `date` | NULL | Date-only cursor; update transactionally with generation. | `(status, generated_through_date)` for scheduler scans if useful. | Recovery/catch-up cursor; not a display date. |
| `deleted_at` | `timestamptz` | NULL | If present, require archived state; paired with `deleted_by`. | Partial index for non-deleted lists if needed. | Soft deletion without erasing occurrences/audit. |
| `deleted_by` | `uuid` | NULL | FK to `profiles`; required when `deleted_at` is set. | None. | Deletion actor. |
| `created_at`, `updated_at` | `timestamptz` | NOT NULL, `now()` | `updated_at` trigger; UTC instants. | `(organisation_id, updated_at DESC)` if ordered lists use it. | Server timestamps. |

Additional constraints:

- Require exactly one of `owner_profile_id` and `owner_responsible_person_id`.
- Require recurrence fields to match the selected frequency. `weekdays` frequency itself has fixed Monday–Friday semantics; weekly selected days use the weekday field.
- If `linked_record_id` is set, its organisation must equal the task organisation.
- For a composite tenant FK to `responsible_people` or `organisation_records`, add a unique `(organisation_id, id)` constraint/index on the referenced table if absent. Do not weaken existing policies to compensate.
- Avoid storing `last_run_at` and `next_run_at` as writable authority until their semantics are defined. Derive next occurrence from non-terminal occurrence rows; derive last completion from actual completed occurrences. The current fields are not maintained consistently.
- Archive/cancel rather than hard-delete. If `deleted_at` is used, retain events and occurrences; do not cascade away history.

### `organisation_task_occurrences`

| Column | PostgreSQL type | Null/default | FK and CHECK constraints | Index need | Reason |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | NOT NULL, `gen_random_uuid()` | Primary key. | PK. | Canonical occurrence identity. |
| `organisation_id` | `uuid` | NOT NULL | FK to `organisations(id)`. | Leading tenant key. | Tenant scope. |
| `recurring_task_id` | `uuid` | NOT NULL | Composite FK `(organisation_id, recurring_task_id)` to task; delete restricted or soft-delete task. | `(organisation_id, recurring_task_id, scheduled_for)`. | Parent relation and tenant consistency. |
| `scheduled_for` | `date` | NOT NULL | Date-only. | Included in unique key and date-range index. | Logical scheduled calendar date. |
| `due_at` | `timestamptz` | NOT NULL | Computed from date, task wall-clock time and IANA zone. | `(organisation_id, due_at)` for due queues. | Actual deadline instant. |
| `timezone` | `text` | NOT NULL | Valid IANA zone. | None. | Snapshot timezone used to produce `due_at`. |
| `status` | `text` | NOT NULL, `scheduled` | CHECK in `scheduled`, `in_progress`, `completed`, `skipped`, `failed`, `cancelled`. Display `upcoming`, `due_today`, and `overdue` as derived labels. | `(organisation_id, status, due_at)`; partial open-work index. | Avoid persistently stale time-relative labels. |
| `owner_profile_id` | `uuid` | NULL | FK to `profiles`; same-org validation. | Tenant/owner filter only if used. | Owner snapshot for history and stable display. |
| `owner_responsible_person_id` | `uuid` | NULL | FK to `responsible_people`; same-org validation. | Tenant/owner filter only if used. | External assignee snapshot. |
| `retry_count` | `integer` | NOT NULL, `0` | CHECK `retry_count >= 0`; explicit policy needed before any maximum. | None. | Attempt count. |
| `started_at`, `completed_at` | `timestamptz` | NULL | Instants. | None. | Occurrence lifecycle timestamps. |
| `completion_evidence` | `text` | NULL | Bounded (2,000 characters to align with assistant validation); avoid file contents. | None. | Optional text evidence. |
| `skipped_reason`, `failure_reason` | `text` | NULL | Bounded; require non-empty only when the corresponding action requires a reason. | None. | Action rationale. |
| `version` | `integer` | NOT NULL, `1` | CHECK `version >= 1`; increment on each accepted state change. | None. | Optimistic concurrency. |
| `created_by`, `updated_by` | `uuid` | NULL | FK to `profiles`; NULL allowed for a trusted scheduler-created occurrence. | None. | Actor attribution. |
| `created_at`, `updated_at` | `timestamptz` | NOT NULL, `now()` | `updated_at` trigger; UTC instants. | `(organisation_id, updated_at DESC)` only if needed. | Server timestamps. |

Required uniqueness: `UNIQUE (organisation_id, recurring_task_id, scheduled_for)`. This is the database equivalent of the current logical key and protects concurrent generators across devices. A separate legacy `unique_key` string should not be authoritative; it can be retained temporarily in import staging for reconciliation.

Require exactly one of the occurrence owner snapshot fields if owner snapshots are retained. For new occurrences, copy the task's owner identity; do not copy display-name strings as canonical IDs.

### Optional `organisation_task_generation_runs`

Add a per-organisation run table with the scheduler slice, not as a prerequisite to reading task definitions:

| Column | PostgreSQL type | Null/default | FK and CHECK constraints | Index need | Reason |
| --- | --- | --- | --- | --- | --- |
| `id` | `uuid` | NOT NULL, generated UUID | Primary key. | PK. | Run identity. |
| `organisation_id` | `uuid` | NOT NULL | FK to organisation. | `(organisation_id, started_at DESC)`. | Tenant-scoped health. |
| `started_by` | `uuid` | NULL | FK to profile; NULL for cron/service execution. | None. | Manual actor attribution. |
| `source` | `text` | NOT NULL | CHECK in `cron`, `manual`, `retry`. | None. | Execution source. |
| `window_start`, `window_end` | `date` | NOT NULL | CHECK `window_end >= window_start`. | None. | Idempotent generation window. |
| `status` | `text` | NOT NULL | CHECK in `running`, `completed`, `failed`. | `(status, started_at)` for operations. | Run outcome. |
| `tasks_seen`, `occurrences_created`, `duplicates_skipped` | `integer` | NOT NULL, `0` | Each CHECK `>= 0`. | None. | Bounded health/count summary. |
| `error_code` | `text` | NULL | Safe internal code only; no secrets or raw exception payload. | None. | Failure reporting. |
| `started_at`, `finished_at` | `timestamptz` | `started_at` NOT NULL, default `now()`; finish nullable | `finished_at >= started_at` when set. | Started-time index above. | Run timing. |

If the hosting scheduler already provides durable run history and tenant health, this table can be deferred. Do not store credential-bearing errors.

## 12. Constraints, indexes, and database behavior

Required database guarantees:

1. Unique tenant/task/date occurrence identity.
2. Same-organisation parent task, linked monitored record, responsible person, and profile authorization.
3. Closed enum checks for task status, occurrence lifecycle, priority, frequency and interval unit.
4. Recurrence-field shape checks (valid weekdays, day-of-month, custom interval/unit).
5. Owner XOR check, escalation bounds, client-visible/skip relationship, bounded evidence/reason fields, non-negative retry count, and positive version.
6. Server-managed `created_at`/`updated_at`; no trusting client timestamps for authority.
7. Row-level optimistic concurrency using task/occurrence `version` or an expected `updated_at`, returning HTTP 409 for stale writes.
8. Mutations and audit insert in one transaction. Rejected authorization, tenant, validation, or stale writes create no successful audit event.

Start with the listed tenant-leading indexes and add others only for measured queries. Avoid redundant indexes that duplicate primary/unique constraints. The unique occurrence key is a correctness constraint, not merely a performance optimization.

## 13. RLS and authorization design

Enable RLS on each new table and grant only the minimum table/column access needed by authenticated APIs. Prefer server-side service operations after explicit session authorization for complex writes; never expose service-role credentials to browser code.

| Actor | Task definitions | Occurrences | Audit/history |
| --- | --- | --- | --- |
| Main consultant | Read/write only organisations allowed by existing main-consultant rules. | Read and perform authorized lifecycle actions. | Consultant history access under existing audit rules. |
| Assistant consultant | Read only assigned organisations. Current assistant flow supports occurrence mutation through a server route; do not grant task-definition writes beyond established product permission. | Read assigned tenant occurrences; server validates allowed action and version. | Existing consultant audit policy supports assistant-assigned organisation access. |
| Client administrator/user | Read only `client_visible` tasks and related occurrence projection for their active organisation. Actions restricted to task flags and membership role. No task-definition, reviewer, escalation, internal note, or audit-table access. | Only allowed actions for visible occurrences; skip only if `client_can_skip`; no arbitrary owner reassignment. | No direct access to internal audit rows; expose only a separately sanitized activity projection if required. |
| Platform administrator | No operational access merely from platform-admin status. | Same. | Same. |
| Scheduler/service | Server-only generation over authorized active tenants; use narrow server function or trusted service credentials. | Insert missing occurrences idempotently and advance cursor atomically. | Write system actor/run events without revealing credentials or internal errors. |

RLS should use `can_access_organisation`, platform-role helpers, active membership/assignment helpers, and same-tenant joins already established in migrations. For client occurrence policy, the task join must additionally enforce `client_visible`. Do not trust a submitted `organisation_id` as proof of access.

## 14. API and repository boundaries

Create a server-backed repository/service contract before converting screens. All routes must validate authentication, role, tenant, payload shape, referenced owner/contact/record scope, and expected version.

Proposed operations:

- `GET /api/recurring-tasks?organisationId=...`: list only accessible tasks; resolve organisation access server-side.
- `POST /api/recurring-tasks`: create a task with canonical owner, recurrence validation, and audit in one transaction.
- `GET /api/recurring-tasks/[id]`: scoped read; return the same not-found response for absent and inaccessible IDs where existence concealment is required.
- `PATCH /api/recurring-tasks/[id]`: allowlisted edit with expected version; return 409 on stale state.
- `POST /api/recurring-tasks/[id]/actions`: pause, resume, cancel, archive, or restore only through validated action-specific transitions.
- `GET /api/recurring-tasks/[id]/occurrences`: scoped range query with bounded date range and pagination.
- `POST /api/task-occurrences/[id]/actions`: start, complete, skip, fail, retry, and any future review action; server checks role, task flags, status transition, reasons/evidence and expected version transactionally.
- `GET /api/recurring-tasks/[id]/history`: tenant-scoped generic audit events by entity, excluding raw service/internal values.
- Client routes or a bounded `/api/client/workspace` projection: expose only approved fields of visible tasks/occurrences and allow only client-permitted occurrence actions.
- A server-only scheduler entry point: no browser caller can supply arbitrary tenant scope or create arbitrary occurrences.
- A separately authorized preview/import route in a later migration slice; it must not clear browser keys.

The repository should have a typed conflict error for 409, explicit validation errors, and explicit upstream/database failures. Avoid empty-array success fallbacks when server data is unavailable.

## 15. Server-side occurrence generation and scheduling

Move the pure recurrence calculation to a server-executable domain service only after preserving its date behavior with tests. A protected scheduled job can then generate a bounded horizon (for example 30 days; choose the horizon with product/operations rather than inheriting inconsistent page windows).

Per-organisation transaction:

1. Acquire a per-tenant/task lock or use a deterministic run lease.
2. Select active tasks in the tenant and compute scheduled dates using date-only, timezone-independent logic.
3. Convert each date and wall-clock time with the task's IANA timezone.
4. Insert each occurrence with `ON CONFLICT (organisation_id, recurring_task_id, scheduled_for) DO NOTHING`.
5. Advance `generated_through_date` only after successful inserts in the same transaction.
6. Write run counts and safe failure code. Retry the same window safely after a partial/transient failure.
7. Queue reminders/notifications separately with a unique idempotency key if/when notification delivery is in scope. This plan does not implement reminders.

A manual “generate” UI action should call this idempotent server operation, not write local occurrence arrays. Do not add a cron until the schedule horizon, pause/catch-up behavior, and DST policy are decided.

## 16. Legacy migration and reconciliation plan

No migration has been created. When authorized, use ordered additive migrations and local Supabase first.

### Preview and mapping

1. Collect only selected task/occurrence arrays from the relevant raw or profile-qualified key; explicitly report which key was read.
2. Require an explicit legacy organisation ID → canonical `organisations.id` map. Never match tenant identity permanently by company display name.
3. Exclude or explicitly confirm prototype/demo seeds; there is no reliable per-row demo marker.
4. Reconcile task IDs, occurrence IDs, `uniqueKey`s, owners, reviewers, linked records, and audit entity IDs. Do not cast local IDs to UUID.
5. Report orphan occurrences, duplicate logical task/date rows, invalid recurrence rules, unsupported linked folders, ambiguous names/emails, and malformed dates as exceptions for review.
6. Use same-organisation exact canonical IDs when already available; use email/name only to suggest a candidate. Ambiguous matches must remain unresolved.

### Conversion and idempotence

- Create database UUIDs for legacy string IDs and persist an explicit `(source, legacy_id) → target_id` mapping in a migration ledger or staging table.
- Deduplicate occurrences by canonical organisation + canonical task + scheduled date. If duplicates have conflicting terminal state/evidence, report them; do not pick the “latest” silently.
- Preserve `scheduledFor` as DATE. Parse `dueAt` with an explicit offset when present; for offset-free legacy values, use the task timezone only if unambiguous. Reject/report gaps, ambiguous local times, and malformed values.
- Validate all enum values, recurrence shapes, owner scope, linked record scope, and evidence bounds before import.
- Import task/occurrence rows transactionally and make re-import idempotent by source identity/checksum and the natural occurrence constraint.
- Read back server rows and reconcile counts by organisation, task status, occurrence status, and logical key. Report imported, skipped, duplicate, and failed counts with actionable safe errors.
- Keep original localStorage untouched. No import operation may call `removeItem`, `clear`, or rewrite the source array.

### Key migration risks

- Raw and profile-qualified key versions can coexist and disagree.
- Demo seeding writes records without a reliable provenance flag.
- Legacy organisation, task, occurrence, person, contact, record, reviewer and audit IDs are not necessarily canonical.
- Snapshot import changes organisation scope but does not normalize all linked IDs.
- A local array's duplicate check cannot prove the server has no copy from another device.
- Browser timezone interpretation can change `dueAt` instants for naive strings.

## 17. Test and verification plan

No recurring-task persistence tests or recurrence-engine tests were run for this documentation-only inventory. The following existing coverage was found:

- `npm run test:unit` includes `src/lib/clientActivities.test.cjs`, `src/lib/consultantActivities.test.cjs`, `src/lib/consultantDashboardSelectors.test.cjs`, `src/lib/consultantWork.test.cjs`, and client task selector tests. These cover selected consumer/projection behavior, not database recurrence generation.
- `scripts/test-assistant-workspace.mjs` exercises assistant snapshot scoping.
- `scripts/test-assistant-workspace-mutations.mjs` exercises assistant occurrence mutation and evidence validation. These are standalone scripts, not included in the package's `test:unit` script.
- No dedicated tests were found for `shouldGenerateOccurrence`, `generateOccurrences`, uniqueness across generators/devices, timezone/DST semantics, or a recurring-task SQL schema.

Before any UI cutover, add focused local integration and unit tests for:

1. All recurrence frequencies, `once`, weekday numbering, monthly day 29/30/31 clamping, month-end, quarterly anchors, leap day, custom day/week/month/year, invalid interval/weekday shapes, and dates before start.
2. Date-only results under multiple process/browser timezones; `due_at` conversion with IANA zone; DST gap/repeated-time policy; no calendar-day shift.
3. Two concurrent generation attempts produce one occurrence per tenant/task/date; retrying a failed generator is idempotent.
4. Same-organisation owner and linked-record references accepted; cross-organisation person/profile/record references rejected.
5. RLS: main consultant, assigned assistant, client roles, and administrator are limited to the intended tenant/role matrix.
6. Client projection only includes approved task/occurrence fields and filters `client_visible=false`.
7. Client skip policy, required evidence/reasons, retry action and retry-count policy.
8. State transition matrix, terminal-state behavior, pause/resume/catch-up policy, and 409 stale task/occurrence updates.
9. One mutation and one audit event commit atomically; rejected/stale/cross-tenant attempts produce no success event.
10. Import preview/reconciliation: duplicate raw/scoped keys, demo fixture exclusion, ambiguous owner, orphan occurrence, linked-record mismatch, invalid date, duplicate natural key, rerun idempotency, and no browser-key deletion.
11. Assistant snapshot compatibility during the transition and server-vs-snapshot reconciliation.
12. Dashboard, consultant/client calendar, work views, activity, report and reminder isolation from other work domains.

Run local Supabase-dependent suites only after starting local Supabase and applying local migrations. Stop it after those suites. Do not use a linked/remote migration command. No TypeScript, lint, build, unit, SQL, or browser tests were run for this document-only work.

## 18. Product and schema decisions required before implementation

1. **Owner identity:** Should an operational task assignee reference `responsible_people`, `organisation_contacts`, an active profile, or support both external people and users? Recommendation: `responsible_people` for external operational assignees and `profiles` for logged-in users, with explicit XOR fields; do not auto-conflate the contact tables.
2. **Reviewer identity:** Is review restricted to consultant accounts, and which consultant roles may review? The current free-text reviewer field is insufficient.
3. **Pause/catch-up:** On resume, should occurrences missed while paused be backfilled, skipped, or never created? Existing behavior prevents new generation while paused and does not provide a catch-up job.
4. **Retry:** Is retry unlimited, bounded, or manually approved? Existing behavior has no maximum.
5. **Status representation:** Approve derived `upcoming`/`due_today`/`overdue` display labels and persisted lifecycle states, or require those labels to remain stored for compatibility.
6. **Timezone ambiguity:** Define behavior for DST gaps and repeated wall times for zones that observe DST. `Africa/Johannesburg` is the current form default but the type allows other zones.
7. **Occurrence ownership:** When a task owner changes, should already-generated occurrences retain the original owner snapshot or be reassigned? Current behavior preserves the copied owner until those rows are individually changed.
8. **Client visibility:** Confirm which task fields and state actions are client-visible, whether a client can see evidence and skip/failure reasons, and whether a client completion awaits consultant review.
9. **Evidence retention:** Define maximum content, retention and visibility. Current evidence is text only; no file upload is represented.
10. **Task deletion/archive:** Decide whether archive is the only supported removal or if a distinct soft-delete/restore flow is needed. No current task hard-delete behavior was found.
11. **Schedule edits:** Decide whether existing future occurrences are retained, cancelled, or regenerated when recurrence/timezone changes. Current task save updates only the definition; it does not consistently reconcile prior occurrence rows.
12. **Generation horizon:** Choose one server horizon and whether the system backfills dates before the cursor after downtime.
13. **Audit:** Confirm if generic `organisation_audit_events` is the canonical audit destination for tasks and occurrences and what values are safe to retain/display.
14. **Migration source scope:** Decide how to handle raw and user-qualified keys, multiple devices, duplicate snapshots, and prototype rows without provenance.
15. **`linkedFolderId`:** Confirm whether a folder entity is intended; otherwise report and leave unresolved instead of importing it.
16. **Reminders:** Confirm whether recurring reminder delivery belongs in this later migration. It is not part of the current `/reminders` page's monitored-record workflow and is excluded here.

## 19. Recommended implementation sequence

1. Resolve the ownership/contact, pause/catch-up, retry, status, visibility, timezone and audit decisions above.
2. Add only additive normalized task/occurrence schema, tenant constraints, versioning, RLS and focused local SQL tests. Keep current UI/localStorage untouched during this foundation step.
3. Implement a typed server repository/API and server validation with transactionally recorded audit and optimistic concurrency. Add local route/integration tests before switching readers.
4. Implement a previewable, idempotent local-only import with explicit tenant/person/record mapping and read-back reconciliation. Do not clear localStorage.
5. Cut over consultant screens, then assistant snapshot compatibility, then client-safe projections. Migrate dashboard/calendar/report/work reads to the canonical source; leave unrelated one-off tasks, trackers and reminders alone.
6. Add centralized generation and scheduler only after date/timezone and pause/catch-up policy tests pass. Do not rely on UI page loads for production occurrence creation.
7. Retain the legacy stores as read-only compatibility sources until reconciliation and operational rollback are verified. Remove compatibility only in a separately authorized slice.

## 20. Exact recommended first implementation slice

After decisions 1–7 and 13 above are approved, the first code slice should be a local-only, additive database foundation for `organisation_recurring_tasks` and `organisation_task_occurrences`: typed columns, same-tenant constraints, occurrence natural uniqueness, version columns, RLS, and focused SQL tests. Reuse `organisation_audit_events` unless its capability review identifies a concrete gap. Do not add cron, import data, switch screens, change assistant snapshot semantics, migrate client reads, remove localStorage, or touch unrelated work domains in that slice.

This inventory stops before that slice. No recurring-task migration has been started.
