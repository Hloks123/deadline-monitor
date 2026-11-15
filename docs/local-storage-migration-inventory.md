# Local Storage Migration Inventory

## Phase 1 status

This is a source-code inventory only. No browser storage values were read, exported, modified, or deleted. No database schema or application code was changed. Do not start the schema migration until the identity, ownership, and settings questions below are resolved.

The inventory is based on a repository-wide search for `localStorage`, `sessionStorage`, `JSON.parse`/`JSON.stringify`, storage event listeners, and the existing stores and Supabase tables, followed by inspection of their types and current readers/writers.

## First monitored-record slice

The approved first implementation slice is now in place:

- `organisation_records`, `organisation_communications`, `organisation_audit_events`, `data_migration_runs`, and `data_migration_items` are added by ordered Supabase migrations. The migration ledger stores counts, validation results, checksums, and reconciliation state; it does not store the submitted browser payload.
- Record access is limited to main consultants and assistants assigned to the organisation. Client roles receive no access to these tables or APIs. Existing tenant authorization functions are reused.
- The authenticated record API and repository contract support listing, reading, creating, updating with a version check, and reading record history.
- Settings provides a one-time migration preview/import page. It reads only the known local-storage keys after the server verifies main-consultant access, requires explicit legacy-client-to-Supabase-organisation selection, and sends only the selected client’s records and linked history.
- Built-in example records are excluded by default. Invalid and orphaned rows are reported and skipped. Unmapped contact IDs are retained as legacy references; ambiguous legacy timestamps remain text. Audit free-text values outside the approved field allowlist and audit context are omitted.
- The normalized schema and APIs are an additive first slice. Existing pages still use the synchronous `recordStore.ts` compatibility adapter; no local-storage key is cleared or removed, and the existing client-visible projection is not replaced.

Run the focused schema and local-database checks with:

```powershell
npm run test:monitored-record-migration
```

The database checks require the local Supabase stack with the local schema migrations applied and remove their temporary fixtures. Apply pending local schema migrations with `supabase migration up`; do not run `db reset` as part of this migration.

Run the unit-test collection with `npm run test:unit`. It explicitly selects the repository's `src/lib/**/*.test.cjs` unit tests so database scripts are not picked up by Node's default `node --test` discovery. Do not run the migration check against the linked Supabase project.

Rollback is additive: disable the migration page and its API routes while leaving the new tables and import ledger intact. Do not drop tables or delete browser storage. If imported rows must be removed, first back up the tenant data and review the run’s `data_migration_items`; rows may be shared by later idempotent runs, so a blind run-level delete is unsafe.

## Executive summary

- Ten runtime key patterns were found. Seven hold operational business data, one holds mixed business configuration, and two hold UI state.
- No production `sessionStorage` use, `localStorage.clear()` call, or `localStorage.removeItem()` cleanup routine was found.
- One browser `storage` event listener synchronizes client-report favourites across tabs.
- Most consultant operational data is still browser-local. The current assistant import copies a selected client's entire snapshot into `organisation_workspace_snapshots` and refreshes the `organisation_client_records` projection; it is not a normalized, per-item migration with preview, reconciliation, or migration-run tracking.
- No `supabase/seed.sql` or local-storage migration/reconciliation script exists. Demo defaults are embedded in the stores and may be written to local storage on first read.

## Storage key scoping

[`getClientProfileStorageKey`](../src/lib/clientWorkspaceConstants.ts) returns a key unchanged when there is no authenticated client-organisation context. When that context is set, it prefixes keys as:

```text
docmon_client_profile_v1:<encoded-organisation-id>:<encoded-user-id>:<base-key>
```

Consequently, a store may exist as a raw base key, a profile-qualified key, or both. The client IDs used by the legacy stores are not necessarily Supabase UUIDs. The client list and settings key are always raw, unqualified keys.

## Key inventory

| Key or pattern | Classification | Type and purpose | Proposed destination |
| --- | --- | --- | --- |
| `doc-monitor-clients` | Business data | `Client[]`; local consultant organisation directory and nested contacts. | Existing `organisations` and `organisation_contacts`; require an explicit legacy-client-to-UUID map. |
| `doc-monitor-records` (raw or profile-qualified) | Business data | `Record<string, MonitoredRecord>`; monitored compliance/renewal records. | New normalized `organisation_records`; retain `organisation_client_records` only as the existing client-visible projection if still needed. |
| `doc-monitor-audit-events` (raw or profile-qualified) | Business data | `AuditEvent[]`; local audit history for records and other entities. | New `organisation_audit_events`. |
| `doc-monitor-communications` (raw or profile-qualified) | Business data | `CommunicationEvent[]`; reminder/follow-up history and review decisions. | New `organisation_communications`. |
| `docmon_client_workspace_v1` (raw or profile-qualified) | Mixed business data and operational preferences | One `ClientWorkspaceState` containing people, trackers, checklist/work items, and reminder preferences. | Existing `responsible_people`; new `organisation_work_trackers` and `organisation_work_items`. Reminder-preference ownership needs a decision; `organisations.reminder_preferences` exists but is currently organization-scoped. |
| `docmon_recurring_tasks_v1` (raw or profile-qualified) | Business data | `RecurringTask[]`; recurrence definitions. | New `organisation_recurring_tasks`. |
| `docmon_recurring_occurrences_v1` (raw or profile-qualified) | Business data | `TaskOccurrence[]`; generated and actioned task instances. | New `organisation_task_occurrences`. |
| `doc-monitor-settings-v2` | Unknown / review; contains business configuration | Singleton `SettingsData` with business, reminder, risk, retention, support, email-template, package, and category configuration. | No single proposed table fits. Decide which values are platform-level, organisation-level, or user-level before mapping. |
| `docmon_client_report_favorites_<organisation-id>_v1` | UI preference | `string[]` of favourite report IDs for the current client workspace. | Keep local; not business data. |
| `docmon_client_read_notifications_<organisation-id>_v1` | UI preference / derived read-state | `string[]` of notification IDs marked read. Notifications themselves are selected from workspace data. | Keep local unless cross-device read state is explicitly required. |

No separate temporary-draft or derived-cache key was found in the direct storage calls. Other `JSON.parse`/`JSON.stringify` occurrences include API payloads and audit serialization and are not separate storage keys.

## Business-data records

### `doc-monitor-clients` — client directory

- **Source/type:** [`clientStore.ts`](../src/lib/clientStore.ts), `Client[]`; edited through [`ClientForm.tsx`](../src/components/clients/ClientForm.tsx).
- **Shape:** Required `id`, `company`, `servicePackage`, `status`, `reminderPreference`, and `contacts`. Optional `canonicalOrganisationId` and `registrationNumber`. Each nested `ClientContact` has `id`, `name`, `role`, `email`, `primary`, and `authorised`; `phone` is optional.
- **IDs and relationships:** Client IDs are company-name slugs, with `-2`, `-3`, etc. added for local collisions; an empty slug falls back to `client-<Date.now()>`. A legacy row with no ID is assigned `legacy-client-<array-index>` when read. Contact IDs include seeded slugs or `contact-<UUID>`. Records and recurring/work data use this client ID as their legacy `organisationId`; record contacts refer to nested contact IDs.
- **Values/dates:** No created/updated timestamp. `servicePackage` is `Starter | Standard | Managed | Custom`; status is `Active | Pilot | Suspended`; reminder channel is `Email | Phone | WhatsApp`.
- **Duplicates/deletion:** `saveClient` updates by ID or appends; there is no unique-company rule or client deletion function. Contact edits/removals are nested in the parent client save. Duplicate company names are possible.
- **Authority/defaults:** The store is authoritative for the local consultant UI. `getClients()` writes the embedded demo clients into storage when the key is absent. There is no field distinguishing demo defaults from actual client rows.
- **Mapping risks:** `canonicalOrganisationId` is optional; the local ID is not a Supabase UUID. Existing matching can fall back to a normalized company name only when exactly one match exists. Names must not be used as permanent tenant identifiers.

### `doc-monitor-records` — monitored records

- **Source/type:** [`recordStore.ts`](../src/lib/recordStore.ts), `Record<string, MonitoredRecord>`; created/edited in the monitored-record pages and updated by reminder workflows.
- **Shape:** Required fields: `id`, `name`, `organisationId`, `organisation`, `category`, `category2`, `issueDate`, `expiryDate`, `status`, `risk`, `escalationLevel`, `contactId`, `contact`, `contactEmail`, `followUp`, `lastConfirmed`, `confirmedBy`, `confirmationMethod`, `dataSource`, and `reminderDays`. Optional fields: `referenceNumber`, `nextAction`, `notes`, `reminderFrequency`, `reminderLeadDays`, and `clientCreated`.
- **Controlled values:** Category is one of `COIDA`, `SARS`, `Vehicles`, `Company Documents`, `CIPC`, `Insurance`, `Employees`, `Contracts`, `Property`, `Professional Registrations`, `Health and Safety`, or `Other`. Status is `Current`, `Due soon`, `Expired`, `Awaiting client`, `Awaiting confirmation`, `Completed`, or `Paused`; risk is `Low | Medium | High`; escalation is `Normal | Follow-up required | Escalated | Critical`; reminder frequency, when set, is `daily | weekly | monthly | custom`.
- **IDs/relationships:** IDs are strings, commonly seeded slugs or a name-derived ID with a local collision suffix (or `record-<Date.now()>` fallback). `organisationId` is normally the legacy client ID, not the database UUID. `contactId` refers to a nested client contact ID; both contact name and email are duplicated as denormalized fields.
- **Dates/timestamps:** `issueDate`, `expiryDate`, `followUp`, and `lastConfirmed` are intended as date-only strings (usually `YYYY-MM-DD`). The store accepts legacy objects and upgrades missing fields, so old or malformed representations remain possible. No record-level created/updated timestamps are part of the type.
- **Computed vs authoritative:** `calculateStatus` derives date-based statuses while preserving explicit `Completed` and `Paused` states. `calculateEscalation` derives escalation from status, risk, and follow-up date. Stored status/escalation should be reconciled with the current calculation rules before migration; do not blindly treat every stored value as independently authoritative.
- **Duplicates/deletion:** Records are keyed/upserted by ID; there is no business-key duplicate rule or record deletion routine. `getRecords()` writes embedded demo records to storage when the key is absent.
- **Existing target:** `organisation_client_records` stores a client-visible payload projection with text `record_id`; the current import also keeps the full record in a versioned workspace snapshot. Neither is a normalized authoritative record table. Proposed normalized target: `organisation_records`.
- **Risks:** Defaults such as `coida-letter` and `vehicle-licence` may be present without being real client records. `notes`, `nextAction`, and contact fields require content minimization and review against the approved-metadata boundary.

### `doc-monitor-audit-events` — audit history

- **Source/type:** [`recordStore.ts`](../src/lib/recordStore.ts), `AuditEvent[]`; also written by client workspace and recurring-task operations.
- **Fields:** Required `id`, `recordId`, `recordName`, `organisation`, `user`, `action`, `previousValue`, `newValue`, and `date`. Optional `field`, `timestamp`, `entityType`, `entityId`, `entityName`, and `context`.
- **IDs/relationships:** `id` is a UUID generated in the browser. `recordId` can be empty for non-record events; generic relationships use optional `entityType`/`entityId`. `organisation` is a display name, not a stable tenant ID. `user` is a display label (including `"Prototype Consultant"`), not necessarily a profile UUID.
- **Dates/timestamps:** `date` and `timestamp` are ISO strings created at event time; legacy rows may omit `timestamp`.
- **Duplicate/deletion/authority:** Events are prepended to an array with no deduplication or soft deletion. The API does not enforce a database foreign key to an entity.
- **Migration risk:** `previousValue`, `newValue`, and `context` are free text and are often JSON-serialized whole objects. They may include notes, business contact details, completion text, or other unnecessary content. Audit import needs a redaction/allowlist policy and stable tenant/entity mapping. Proposed target: `organisation_audit_events`.

### `doc-monitor-communications` — communication history

- **Source/type:** [`recordStore.ts`](../src/lib/recordStore.ts), `CommunicationEvent[]`; written by reminder and review flows.
- **Fields:** Required `id`, `uniqueKey`, `recordId`, `type`, `recipient`, `subject`, `message`, `outcome`, `deliveryStatus`, `nextFollowUp`, and `date`. Optional `organisation`, `relatedTaskId`, `messageVersion`, `reviewer`, `decision`, `reviewedAt`, and `failureReason`.
- **Controlled values:** `type` is `Reminder | Follow-up`; `deliveryStatus` is `Draft | Approved | Sent | Delivered | Failed | Bounced | Suppressed`; `decision` is `approved | suppressed | draft`.
- **IDs/relationships:** `id` is a browser UUID. `uniqueKey` is composed from record ID, type, next-follow-up value, and lower-cased recipient. `recordId` refers to a local record; optional `relatedTaskId` refers to a recurring-task ID.
- **Dates/timestamps:** `nextFollowUp` is intended as a date string. `date` is inconsistent: normal creation uses `toLocaleString("en-ZA")`, while review-save uses ISO. Optional `reviewedAt` is ISO.
- **Duplicates/deletion/authority:** Creation rejects an existing `uniqueKey`; review-save updates by that key or inserts. There is no soft-delete behavior. The key may collapse two events with the same record/type/follow-up/recipient even if their message or outcome differs.
- **Migration risks:** `recipient`, `subject`, and `message` can contain personal or confidential content; `outcome`/`failureReason` are free text. Separate reviewed/draft/sent state carefully; do not assume these entries prove email delivery. Proposed target: `organisation_communications`.

### `docmon_client_workspace_v1` — people, trackers, checklist items, reminder preferences

- **Source/type:** [`clientWorkspaceStore.ts`](../src/lib/clientWorkspaceStore.ts), one `ClientWorkspaceState` object with `organisationId`, `people`, `trackers`, `items`, and `reminderPreference`.
- **Responsible people:** Required `id`, `organisationId`, `name`, `active`; optional `email` and `role`. IDs are `person-<UUID>`. Duplicate email is rejected case-insensitively within the current local organisation. Existing `responsible_people` is a candidate target; it has optional profile linkage, which the legacy type does not establish.
- **Work trackers:** Required `id`, `organisationId`, `name`, `periodType`, `startDate`, `endDate`, `ownerId`, `reminderPreference`, `status`, `createdAt`, and `updatedAt`; `description` is optional. IDs are `tracker-<UUID>`. `ownerId` refers to a responsible-person ID. Period is `Daily checklist | Weekly tracker | Monthly tracker | Custom tracker`; status is `Draft | Active | Completed | Archived`.
- **Checklist/work items:** Required `id`, `organisationId`, `trackerId`, `task`, `responsiblePersonId`, `responsiblePersonName`, `targetDate`, `status`, `priority`, `reminderPreference`, `createdAt`, and `updatedAt`. Optional fields include responsible email, target time, `clientCanSkip`, progress notes, next action, completion evidence, completed date, blocked reason, and carry-forward reason. IDs are `item-<UUID>`. `trackerId` points to a tracker and `responsiblePersonId` to a person. Status is `Not Started | In Progress | Scheduled | Awaiting Confirmation | Completed | Skipped | Blocked | Overdue | Carry Forward`; priority is `High | Medium | Low`.
- **Reminder preferences:** Delivery (`In-app only | Email and in-app | No reminder`), summary frequency, optional weekday/custom recurrence fields, time, daily-summary mode, monthly rule/day, categories, time zone, and optional start/end dates. The code stores this inside the same organization workspace blob, although it is not clear whether it is an organization-wide setting or a user-specific preference.
- **Dates/timestamps:** Tracker/item date fields and `completedDate` are intended as `YYYY-MM-DD`; `targetTime` and reminder `time` are local wall-clock strings; `createdAt`/`updatedAt` are ISO timestamps. Reminder schedules include time zone and custom schedule dates.
- **Duplicates/deletion/authority:** Trackers/items are updated by ID; no unique business-key constraints exist. `deleteDraftChecklistItem` physically removes only a `Not Started` item and logs an audit event; other items are retained through statuses. There is no soft-deletion field. Trackers can be archived.
- **Important key-reading discrepancy:** Normal store reads/writes may use the profile-qualified key, but `getAllClientWorkspaceEntries()` reads only the raw base key. The current assistant-import collector uses that function, so data present only under a qualified key may not be included by that collector.
- **Risks:** `ownerId`/person IDs are legacy strings and should not be assumed to be profile UUIDs. `completionEvidence`, notes, and next-action text are free-form; import only approved metadata, not documents or document contents. Proposed targets: existing `responsible_people`, new `organisation_work_trackers`, and new `organisation_work_items`.

### `docmon_recurring_tasks_v1` — recurring task definitions

- **Source/type:** [`recurringTasks/taskStore.ts`](../src/lib/recurringTasks/taskStore.ts), `RecurringTask[]`, typed in [`recurringTasks/types.ts`](../src/lib/recurringTasks/types.ts).
- **Fields:** Required `id`, `organisationId`, `name`, `ownerId`, `priority`, `startDate`, `timezone`, `recurrence`, completion-evidence/review flags, `status`, `createdAt`, and `updatedAt`. Optional `description`, `linkedRecordId`, `linkedFolderId`, `reviewerId`, `dueTime`, escalation rule, client visibility/skip flags, `lastRunAt`, and `nextRunAt`.
- **Recurrence/status values:** Frequency is `once | daily | weekdays | weekly | monthly | month_end | quarterly | annually | custom`. Rules may include weekday numbers, day of month, interval, and interval unit (`day | week | month | year`). Priority is `low | medium | high | critical`; status is `active | paused | cancelled | archived`.
- **IDs/relationships:** New IDs are `task-<UUID>`; old or demo IDs may differ. `organisationId` is usually a legacy client ID. `linkedRecordId` refers to a monitored record; `linkedFolderId` has no corresponding folder entity in the inspected model. `ownerId`, `reviewerId`, and optional escalation target are strings and may not map to profile IDs.
- **Dates/timestamps:** `startDate` is date-only; `dueTime` is local time with `timezone`; run/created/updated fields are ISO timestamp strings.
- **Duplicates/deletion/authority:** Task writes update by ID; no unique rule beyond ID and no physical delete function. Cancellation/archival/pause are represented as statuses. A seed helper checks a raw unqualified key while ordinary get/save uses the profile-qualified helper, creating a legacy-key ambiguity.
- **Proposed target:** New `organisation_recurring_tasks`. Preserve recurrence-engine semantics and validate custom intervals before choosing a database uniqueness scheme.

### `docmon_recurring_occurrences_v1` — recurring task occurrences

- **Source/type:** [`recurringTasks/occurrenceService.ts`](../src/lib/recurringTasks/occurrenceService.ts), `TaskOccurrence[]`, typed in [`recurringTasks/types.ts`](../src/lib/recurringTasks/types.ts).
- **Fields:** Required `id`, `recurringTaskId`, `organisationId`, `scheduledFor`, `dueAt`, `status`, `ownerId`, `uniqueKey`, `retryCount`, `createdAt`, and `updatedAt`; optional task name, start/completion timestamps, completion evidence, skipped reason, and failure reason.
- **IDs/relationships:** IDs use `occ_<epoch-ms>_<random-fragment>`. `recurringTaskId` refers to the recurring-task ID. `uniqueKey` is `organisationId:recurringTaskId:scheduledFor` and is the existing idempotency key.
- **Statuses:** `upcoming | due_today | in_progress | completed | skipped | failed | overdue | cancelled`.
- **Dates/timestamps:** `scheduledFor` is a date-only key. `dueAt` is built as a local datetime string without an explicit UTC offset; `startedAt`, `completedAt`, `createdAt`, and `updatedAt` are ISO timestamps.
- **Duplicates/deletion/authority:** Generation checks `uniqueKey` and `createOccurrence` returns an existing occurrence with the same key. No physical deletion; cancellation is a status. Skipped and failed occurrences retain free-text reasons; completion evidence is text, not an uploaded document.
- **Proposed target:** New `organisation_task_occurrences`; keep the current recurrence key semantics only after confirming time-zone/DST behavior.

## Configuration and UI state

### `doc-monitor-settings-v2` — mixed settings

- **Source/type:** [`settingsStore.ts`](../src/lib/settingsStore.ts), one `SettingsData` object; global, not organisation- or user-qualified.
- **Fields:** Business name, time zone, support email, sender name/email/domain-verification flag, reminder days, review booleans, risk/escalation levels, retention months, backup/support/outage/escalation contacts, email templates, service packages, and category configuration.
- **Nested types:** Templates have `id`, `name`, `subject`, `message`, `active`; packages have `id`, `name`, setup/monthly fees, record/user limits, `active`, and features; categories have IDs/names/active flags plus child categories.
- **Dates/IDs/duplicates:** No timestamps. Nested IDs are strings with no storage-level uniqueness constraint. Values are sanitized by merging defaults; retention months are clamped to 1–120. A legacy `users` property is stripped when the store reads and rewrites this key.
- **Classification/mapping:** This is not a UI-only preference. It contains business configuration and contact information, but has no tenant owner and no single table mapping. Decide what is global product configuration versus organisation-level settings before migration. `organisations` already has `timezone` and `reminder_preferences`, but does not represent every field.

### Report favourites

- **Source:** [`client/reports/page.tsx`](../src/app/client/reports/page.tsx).
- **Value:** JSON string array of favourite report IDs. Key is qualified only by `CLIENT_WORKSPACE_ORGANISATION_ID`, not user ID.
- **Classification:** UI preference; no business record, date, timestamp, or parent relation. Toggle logic avoids duplicates.
- **Recommendation:** Keep local unless users require cross-device favourites; if that changes, determine whether favourites are user- or organisation-scoped first.

### Read notification IDs

- **Source:** [`client/notifications/page.tsx`](../src/app/client/notifications/page.tsx).
- **Value:** JSON string array of IDs marked as read; key is qualified by organisation ID, not user ID.
- **Classification:** Derived UI read-state. Notifications are assembled from workspace records/tasks, and this array is not a notification history.
- **Recommendation:** Keep local unless cross-device read state is required. If persisted server-side, scope by user as well as organisation.

## Existing Supabase data model and import path

The inspected migrations already provide:

- `organisations`, `profiles`, `platform_roles`, `organisation_memberships`, and `responsible_people` in the tenant foundation.
- `organisation_contacts` for authorised organisation contacts.
- `organisation_workspace_snapshots`, which stores the full version-1 assistant workspace as JSONB by canonical organisation UUID.
- `organisation_client_records`, a client-visible record projection with a JSONB payload and text `record_id`.
- `organisation_tasks`, a separate assigned-user task table with its own acceptance/rejection lifecycle. It is not a replacement for recurring task definitions, occurrences, trackers, or checklist items.

The current import path is [`assistantWorkspaceImport.ts`](../src/lib/assistantWorkspaceImport.ts) → `POST /api/assistant/workspace`. It selects one legacy client, maps the selected snapshot's `organisationId` to the canonical organisation UUID, upserts the full snapshot, and refreshes the client-record projection. Snapshot validation and role checks exist, but there are no `data_migration_runs`/`data_migration_items` tables, per-record exception report, read-back reconciliation, or general migration preview/import API. Assistant screens read the snapshots; client record pages read the projection, and assigned client tasks use `organisation_tasks`. Those paths do not replace normalized persistence for the remaining legacy business entities.

No normalized `organisation_records`, recurring-task, occurrence, tracker, work-item, communication, audit-event, or migration-ledger table was found. The migration scripts currently cover authorization, tenant isolation, assistant workspace, and assistant mutations; no migration reconciliation tests were found. `supabase/seed.sql` is absent; demo data is embedded in browser stores.

## Cross-cutting risks and unresolved decisions

1. **Tenant identity:** Legacy `organisationId` fields often contain a client slug. `canonicalOrganisationId` is optional, duplicate names are allowed, and some import filtering uses names. Establish an explicit mapping for every legacy client to `organisations.id`; do not infer permanent identity from names.
2. **Profile/device scope:** Local storage belongs to a browser profile/device. The same logical store may be raw or prefixed by organisation and user. The current import helper reads a raw workspace key, while normal storage reads can use the qualified key. Define which source keys are in scope for each importing consultant and how conflicts are previewed.
3. **Fixture provenance:** Reading absent client/record stores writes embedded demo data into local storage. No `isDemo` or provenance marker distinguishes those rows from live rows. Preview/import must let the user exclude fixtures and must not silently import them.
4. **Ownership:** Legacy task `ownerId`/`reviewerId`, responsible-person IDs, audit `user`, and communication `reviewer` are strings and can be display names or placeholder values rather than `profiles.id`.
5. **Status semantics:** Record status/escalation values are partly calculated. Work-item and task statuses also have workflow-specific rules. Preserve domain calculations and map obsolete/invalid values with warnings rather than silent defaults.
6. **Dates/time zones:** Most dates are date-only strings, but communication dates include locale-formatted values and occurrence due times omit an offset. Define normalization and preserve the original source value for exceptions; confirm the recurrence time-zone model before adding occurrence uniqueness constraints.
7. **Deletion history:** No `deleted_at` tombstones exist. Most data has no deletion API; checklist drafts can be physically removed, while other entities use cancelled/archived statuses. Historical absence cannot be interpreted as an intentional deletion.
8. **Cross-entity links:** Record/contact IDs and tracker/person/task IDs use separate legacy string schemes. `linkedFolderId` has no known destination entity. Audit events may refer to generic entities or have empty `recordId`; communications can link to records or recurring tasks.
9. **Privacy/content:** Free-text notes, messages, audit JSON, completion evidence, and support/contact fields can exceed the approved metadata boundary. Define an allowlist/redaction policy; do not migrate document contents, credentials, or unnecessary personal data.
10. **Settings ownership:** The unscoped settings blob mixes global and organisation-like values. Confirm ownership and intended sharing before deciding whether settings remain local or move to organization/profile tables.
11. **Duplicate prevention:** Records, clients, people, trackers, and items mainly deduplicate by legacy ID. Communications use a composite key; occurrences use their existing `uniqueKey`; audit events have no deduplication rule. Reconciliation must report collisions rather than guess.

## Mapping summary and recommended first slice

| Legacy entity | Candidate destination | Important prerequisite |
| --- | --- | --- |
| Clients | Existing `organisations` | Explicit one-to-one legacy ID → canonical UUID map; review demo fixtures and duplicate names. |
| Client contacts | Existing `organisation_contacts` | Map nested IDs; preserve authorised/primary semantics and handle duplicate contact rows. |
| Responsible people | Existing `responsible_people` | Confirm when an operational person should also be an authorised contact or login profile. |
| Monitored records | New `organisation_records` | Resolve tenant/contact IDs; reconcile computed status/escalation; retain a sanitized client projection. |
| Communications | New `organisation_communications` | Normalize date values, dedupe with reviewed rules, and minimize message content. |
| Audit events | New `organisation_audit_events` | Map actor/entity IDs and define a metadata allowlist for serialized values. |
| Recurring tasks | New `organisation_recurring_tasks` | Map ownership and record links; preserve recurrence/time-zone behavior. |
| Occurrences | New `organisation_task_occurrences` | Reuse `uniqueKey` only after confirming DST and local-date semantics. |
| Trackers and checklist items | New `organisation_work_trackers` and `organisation_work_items` | Map owner/person/tracker IDs; define how hard-deleted drafts are represented. |
| Reminder preferences | Existing organization settings or a new user-preference model | Decide organization-wide versus per-user scope. |
| Report favourites/read state | Keep local | User has not requested cross-device persistence. |
| App settings | Unresolved | Separate platform configuration from tenant settings and user preferences. |

The recommended first implementation slice is monitored records, with the supporting communications/audit tables, a server-backed record repository/API, one previewable monitored-record import, tenant-isolation tests, and source/read-back reconciliation tests. Before Phase 2, the legacy-client-to-organisation mapping, fixture exclusion, contact mapping, and privacy allowlist must be specified. This document intentionally stops before creating migrations or changing application behavior.
