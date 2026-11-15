# Supabase role administration

## Role boundaries

`platform_roles` holds trusted platform roles (`main_consultant` and `administrator`). `organisation_memberships` holds `assistant_consultant`, `client_administrator`, and `client_user` assignments. Auth metadata, profile fields, browser parameters, and localStorage are not authorization sources.

The main consultant can access every active organisation through RLS. Assistant consultants and client users require an active membership in an active organisation. A platform administrator does not receive automatic operational tenant access; platform administration routes explicitly authorize the actions they support.

The final role migration is `20261112100000_final_platform_role_model.sql`. It creates the final platform-role model directly from the deployed tenant/auth foundation; the obsolete unpushed draft migration was removed. It does not infer a global platform role from an organisation membership.

## Administrative server workflows

`/api/admin/organisations` supports reading the permitted organisation directory and creating canonical organisation rows. `/api/admin/organisations/[organisationId]` updates organisation details and service status; its `contacts` route manages authorised business contacts in `public.organisation_contacts`. Inactive organisations are included only for explicitly authorized administrative directory requests. `/api/admin/users` invites users through Supabase Auth and assigns either a trusted administrator role or scoped memberships. Assistant Consultant invitations create one active membership per selected active organisation; the Auth profile-bootstrap trigger creates the profile, and assignment IDs are not stored in Auth metadata. `/api/admin/users/[userId]` manages account suspension, membership assignments, administrator access, and password-reset requests. The Assistant Consultant dashboard lists only active organisations returned through the authenticated, membership-scoped organisations endpoint.

Authenticated users can manage their own display name through `/api/account`; password changes and invitation/reset completion use Supabase Auth directly from the account page and `/update-password`. The server never reads or stores passwords.

Every privileged route first resolves the cookie-authenticated user, active profile, and platform role through the publishable-key server client. Only then may it construct the server-only Supabase Admin client. Configure `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SITE_URL` in the server environment; never expose either value to browser code. The service role has only the required table privileges for managed-user reads and inserts and organisation creation; these grants do not alter RLS or permit browser clients to perform administrative writes.

Organisation contacts are stored in their canonical table and visible through RLS only to active members of that organisation. Assistant history and reports are limited to events included in an imported organisation snapshot. Administrative handlers' prepared audit events are still not persisted.

## Assistant operational workspace

The main consultant can import browser-local client data from `/clients`. Each browser client must be explicitly mapped to an active canonical organisation; mappings are never inferred from names. Importing replaces that organisation's existing assistant workspace, including changes made by assistants, and the confirmation explains this.

Snapshots are stored in `public.organisation_workspace_snapshots`. RLS permits an assistant to read only snapshots for active organisations where they have an active `assistant_consultant` membership. Client roles cannot read these consultant snapshots. Only a main consultant can directly insert or replace a snapshot. Assistant edits go through the server-side workspace API, which rechecks the authenticated active membership and organisation, validates the requested record/work operation, audits the change, and uses an optimistic version check before its server-only service-role update. Direct assistant table writes remain denied.

Assistants can view assigned clients, monitored records, work, calendar, reminders, reports, and audit history. They can create and update monitored records, checklist work, and recurring-work occurrences only for their assigned active organisations; they cannot delete data, change recurring schedules, create clients, change contacts or assignments, or access global settings. Report and history downloads are CSV. They retain access to their own Account page for display-name and password management. Settings, user/role/assignment administration, organisation administration, billing, integrations, global reminders, and system settings remain unavailable to assistants.

The existing main-consultant operational UI still uses browser-local storage; snapshots are an explicit copy, not a live synchronization source. A later main-consultant import replaces assistant changes. Administrative writes and service-role table grants remain confined to server-side routes after role and organisation verification.

## Client employee profiles and assignments

Migration `20261114090000_client_profiles_tasks_and_shared_records.sql` promotes the earliest client membership in each organisation to the unique Senior Manager (`client_administrator` and `is_primary`). New client memberships are assigned that role only when the organisation has no prior client membership; later client memberships remain ordinary `client_user` accounts. The Senior Manager can edit names/job titles and suspend or restore existing memberships through `/client/team`, but cannot invite or create accounts. Email changes remain under Supabase Auth's verified account workflow.

Company monitored-record metadata is projected into `public.organisation_client_records`. Active employees can read that shared company view, but client record pages are read-only and client roles cannot read the complete assistant snapshot. A consultant import or validated assistant workspace edit refreshes the projection through `replace_organisation_client_records`.

Task assignments are persisted in `public.organisation_tasks`. A task can be assigned to one or more active users in the same organisation; the API creates one independent assignment per selected user so each person can respond separately. Reads are limited to the task creator and assignee. Only the assignee can accept or reject a pending task, and rejection requires a non-empty reason saved in `response_note`. Existing browser-local checklists and recurring work are separately keyed by organisation and profile; they are not a substitute for shared server task assignments.

Client report downloads include an all-records export and an all-client-work export. The latter includes client-visible recurring/checklist work plus server-backed assignments visible to the current user as creator or assignee, including each assignment's response note.

## Validation

`scripts/test-workspace-authorization.mjs` exercises server role resolution and route boundaries. `scripts/test-authorization-model.sql` exercises RLS, third-organisation visibility, scoped assistant/client access, inactive accounts/memberships, and platform-role escalation denial against a disposable local Supabase database.
