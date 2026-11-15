# Supabase tenant-isolation test plan

This is a plan for a reviewed development-only test. It does not create users,
organisations, memberships, or other data. Use fictional identities and the
trusted Auth/onboarding workflows; never put passwords, tokens, real email
addresses, or other credentials in test files.

## Fictional fixtures

- **Organisation A:** Demo Construction
- **Organisation B:** Sample Logistics
- **User A:** fictional Auth user with only an active client membership in
  Organisation A
- **User B:** fictional Auth user with only an active client membership in
  Organisation B
- **Assistant A:** fictional Auth user with only an active
  `assistant_consultant` membership in Organisation A
- **Assistant B:** fictional Auth user with only an active
  `assistant_consultant` membership in Organisation B
- **Main consultant:** fictional Auth user with the active `main_consultant`
  platform role

Create Auth users through the approved Auth workflow. The Auth trigger should
create each profile only. Create the organisations and memberships through a
trusted administrative workflow; do not set roles or organisation IDs from
user-controlled Auth metadata. Add fictional responsible-person rows for both
organisations through an approved trusted fixture workflow.

The configured demo client accounts currently have primary
`client_administrator` memberships. The tenant test derives the expected role
from `is_primary` (`client_administrator` for primary, otherwise `client_user`);
both roles must retain the same tenant boundary.

## Access assertions

Run each assertion as the corresponding authenticated user using a valid,
short-lived test session and a rollback-safe test environment:

| Requesting user | Expected visible organisations | Expected visible responsible people | Expected memberships |
|---|---|---|---|
| User A | Organisation A only | Organisation A only | User A's own row only |
| User B | Organisation B only | Organisation B only | User B's own row only |
| Assistant A | Organisation A only | Organisation A only | Assistant A's own row only |
| Assistant B | Organisation B only | Organisation B only | Assistant B's own row only |
| Main consultant | Both active organisations | Both active organisations | Membership rows visible to the main consultant |
| Unauthenticated | None | None | None |

For User A and User B, verify the reciprocal tenant is not returned. Also
verify that an ordinary client user cannot insert a membership, update their
membership role, or promote themselves to `administrator` or `consultant`.
These attempts should be denied by table privileges and/or row-level security.

## Assistant workspace snapshot assertions

After applying `20261113120000_assistant_workspace_snapshots.sql`, create one
fictional snapshot per organisation through the trusted main-consultant
workflow. Verify:

- Assistant A can select Organisation A's snapshot and cannot select
  Organisation B's snapshot.
- Assistant B can select Organisation B's snapshot and cannot select
  Organisation A's snapshot.
- Client users and platform administrators without assistant memberships
  cannot select consultant snapshots.
- Assistants cannot insert, update, or delete snapshots.
- A main consultant can import or replace a snapshot only for an active
  organisation and cannot set `imported_by` to another user.
- The assistant API returns only the current assistant's active assigned
  organisations, including organisations without an imported snapshot.
- Assistant workspace API edits succeed only for currently assigned active
  organisations; requests for another organisation are denied.
- Valid record/work edits append audit history and reject stale workspace
  versions rather than overwriting a concurrent change.
- Direct assistant INSERT/UPDATE/DELETE attempts against the snapshot table
  remain denied; only the validated server-side API performs assistant edits.

`scripts/test-assistant-workspace.mjs` also checks that the browser import
serializer filters each data collection by the explicitly selected legacy
client ID, remaps it to the selected canonical organisation, and rejects
cross-organisation payload rows.

## Client manager, records, and task assertions

After applying `20261114090000_client_profiles_tasks_and_shared_records.sql`,
verify:

- The earliest client membership is the organisation's sole active-role
  Senior Manager, including after a later membership invitation or an
  administrator attempts to assign a second `client_administrator` role.
- A Senior Manager can update an existing same-company user's display name,
  job title, and membership status, but cannot update their own profile,
  promote another user, or invite/create a user.
- Client users can read the same organisation's sanitized monitored-record
  projection; a user from another organisation and an unauthenticated user
  cannot read it. Client roles cannot read the complete assistant snapshot.
- An assignment to an inactive or cross-organisation user is rejected.
- Assigning to multiple active users creates one independently actionable row
  for each selected user; selecting all active users has the same behavior.
- A task is readable only to its creator and assignee; only the assigned user
  can accept/reject it, and those transitions apply only while pending.
- A blank rejection reason is rejected; a non-empty reason is persisted only
  on the corresponding assignee's task row.
- Browser checklist/recurring-work storage differs for two profiles in the
  same organisation. It must not be used as authorization or as the persisted
  source for company task assignments.

## Responsible-person profile-link assertions

- A responsible person with `profile_id = NULL` is permitted.
- Linking a profile with an active membership in the same organisation is
  permitted.
- Linking User B's profile to an Organisation A responsible person is rejected
  unless User B has an active Organisation A membership.
- Run negative tests in a development-only fixture environment and roll back
  fixture changes.

## Cleanup and safety

Do not use production accounts or client data. Do not store credentials in SQL,
documentation, logs, or source control. Remove fictional fixtures using the
approved trusted workflow after testing.
