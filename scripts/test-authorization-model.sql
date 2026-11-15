-- Local-only RLS regression test for platform and organisation-scoped roles.
-- Run with `supabase db query --local --file scripts/test-authorization-model.sql`
-- against a disposable local database after applying migrations.
BEGIN;

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'platform.consultant@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'assistant.a@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'assistant.b@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'client.user@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'client.admin@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'platform.admin@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'inactive.profile@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000008', 'authenticated', 'authenticated', 'inactive.membership@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000009', 'authenticated', 'authenticated', 'client.coworker@test.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organisations (id, name, status)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'Authorization Model Test Org A', 'active'),
  ('20000000-0000-0000-0000-000000000002', 'Authorization Model Test Org B', 'active'),
  ('20000000-0000-0000-0000-000000000003', 'Authorization Model Test Org C', 'active'),
  ('20000000-0000-0000-0000-000000000004', 'Authorization Model Test Org D', 'suspended')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.organisation_memberships (organisation_id, user_id, role, active)
VALUES
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'assistant_consultant', true),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'assistant_consultant', true),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 'assistant_consultant', true),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'client_user', true),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000005', 'client_administrator', true),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', 'client_user', true),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000008', 'client_user', false),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000009', 'client_user', true)
ON CONFLICT (organisation_id, user_id)
DO UPDATE SET role = EXCLUDED.role, active = EXCLUDED.active;

INSERT INTO public.platform_roles (user_id, role, active)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'main_consultant', true),
  ('10000000-0000-0000-0000-000000000006', 'administrator', true)
ON CONFLICT (user_id, role)
DO UPDATE SET role = EXCLUDED.role, active = EXCLUDED.active;

INSERT INTO public.organisation_workspace_snapshots (
  organisation_id,
  payload,
  imported_by
)
VALUES
  ('20000000-0000-0000-0000-000000000001', '{"version":1,"client":{"name":"Org A"}}', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', '{"version":1,"client":{"name":"Org B"}}', '10000000-0000-0000-0000-000000000001')
ON CONFLICT (organisation_id)
DO UPDATE SET payload = EXCLUDED.payload, imported_by = EXCLUDED.imported_by;

INSERT INTO public.organisation_client_records (
  organisation_id,
  record_id,
  source,
  payload,
  created_by
)
VALUES
  ('20000000-0000-0000-0000-000000000001', 'record-org-a', 'consultant', '{"id":"record-org-a","name":"Org A record"}', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', 'record-org-b', 'consultant', '{"id":"record-org-b","name":"Org B record"}', '10000000-0000-0000-0000-000000000001')
ON CONFLICT (organisation_id, record_id) DO NOTHING;

INSERT INTO public.organisation_tasks (
  id,
  organisation_id,
  created_by,
  assigned_to,
  title
)
VALUES (
  '30000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000009',
  'Org A shared task'
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT has_table_privilege('service_role', 'public.organisation_tasks', 'SELECT')
    OR NOT has_table_privilege('service_role', 'public.organisation_tasks', 'INSERT')
    OR NOT has_table_privilege('service_role', 'public.organisation_tasks', 'UPDATE') THEN
    RAISE EXCEPTION 'FAIL: trusted server role must read, create, and update organisation tasks';
  END IF;
  IF has_table_privilege('authenticated', 'public.organisation_tasks', 'INSERT')
    OR has_table_privilege('authenticated', 'public.organisation_tasks', 'UPDATE') THEN
    RAISE EXCEPTION 'FAIL: authenticated users must not directly mutate organisation tasks';
  END IF;
  RAISE NOTICE 'PASS: trusted server can manage tasks while authenticated users remain read-only';
END;
$$;

UPDATE public.profiles
SET active = false
WHERE id = '10000000-0000-0000-0000-000000000007';

SET LOCAL ROLE authenticated;

DO $$
DECLARE
  visible_count integer;
  changed_count integer;
  role_name text;
BEGIN
  PERFORM set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000001',
    true
  );
  SELECT (public.get_current_platform_roles())[1] INTO role_name;
  IF role_name IS DISTINCT FROM 'main_consultant' THEN
    RAISE EXCEPTION 'FAIL: main consultant platform role resolution';
  END IF;
  SELECT count(*) INTO visible_count
  FROM public.organisations
  WHERE id IN (
    '20000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000004'
  );
  IF visible_count <> 3 THEN
    RAISE EXCEPTION 'FAIL: global consultant must see all active and no suspended organisations';
  END IF;
  RAISE NOTICE 'PASS: main consultant sees third unassigned active organisation and not a suspended organisation';

  SELECT count(*) INTO visible_count
  FROM public.organisation_workspace_snapshots
  WHERE organisation_id IN (
    '20000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002'
  );
  IF visible_count <> 2 THEN
    RAISE EXCEPTION 'FAIL: main consultant cannot read assigned workspace snapshots';
  END IF;
  INSERT INTO public.organisation_workspace_snapshots (
    organisation_id,
    payload,
    imported_by
  )
  VALUES (
    '20000000-0000-0000-0000-000000000003',
    '{"version":1,"client":{"name":"Org C"}}',
    '10000000-0000-0000-0000-000000000001'
  )
  ON CONFLICT (organisation_id)
  DO UPDATE SET payload = EXCLUDED.payload, imported_by = EXCLUDED.imported_by;
  RAISE NOTICE 'PASS: main consultant can import an active organisation snapshot';

  PERFORM set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000006',
    true
  );
  SELECT count(*) INTO visible_count
  FROM public.organisations
  WHERE id IN (
    '20000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000004'
  );
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: platform administrator received automatic operational tenant access';
  END IF;
  SELECT count(*) INTO visible_count
  FROM public.organisation_workspace_snapshots;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: platform administrator received automatic operational snapshot access';
  END IF;
  RAISE NOTICE 'PASS: platform administrator has no automatic operational tenant access';

  PERFORM set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000002',
    true
  );
  SELECT count(*) INTO visible_count
  FROM public.organisations
  WHERE id IN (
    '20000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000004'
  );
  IF visible_count <> 1 OR NOT EXISTS (
    SELECT 1 FROM public.organisations
    WHERE id = '20000000-0000-0000-0000-000000000001'
  ) THEN
    RAISE EXCEPTION 'FAIL: assistant A organisation scope';
  END IF;
  RAISE NOTICE 'PASS: assistant A sees only organisation A';
  SELECT count(*) INTO visible_count
  FROM public.organisation_workspace_snapshots;
  IF visible_count <> 1 OR NOT EXISTS (
    SELECT 1 FROM public.organisation_workspace_snapshots
    WHERE organisation_id = '20000000-0000-0000-0000-000000000001'
  ) THEN
    RAISE EXCEPTION 'FAIL: assistant A snapshot scope';
  END IF;
  RAISE NOTICE 'PASS: assistant A sees only organisation A snapshot';

  BEGIN
    EXECUTE 'INSERT INTO public.organisation_workspace_snapshots (organisation_id, payload, imported_by) VALUES (''20000000-0000-0000-0000-000000000001'', ''{"version":1}'', ''10000000-0000-0000-0000-000000000002'')';
    RAISE EXCEPTION 'FAIL: assistant A inserted a workspace snapshot';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: assistant cannot insert workspace snapshots';
  END;

  UPDATE public.organisation_workspace_snapshots
  SET payload = '{"version":1,"client":{"name":"Tampered"}}'
  WHERE organisation_id = '20000000-0000-0000-0000-000000000001';
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: assistant A updated a workspace snapshot';
  END IF;
  RAISE NOTICE 'PASS: assistant cannot update workspace snapshots';

  BEGIN
    EXECUTE 'DELETE FROM public.organisation_workspace_snapshots WHERE organisation_id = ''20000000-0000-0000-0000-000000000001''';
    RAISE EXCEPTION 'FAIL: assistant A deleted a workspace snapshot';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: assistant cannot delete workspace snapshots';
  END;

  PERFORM set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000003',
    true
  );
  SELECT count(*) INTO visible_count
  FROM public.organisations
  WHERE id IN (
    '20000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000004'
  );
  IF visible_count <> 1 OR NOT EXISTS (
    SELECT 1 FROM public.organisations
    WHERE id = '20000000-0000-0000-0000-000000000002'
  ) THEN
    RAISE EXCEPTION 'FAIL: assistant B organisation scope';
  END IF;
  RAISE NOTICE 'PASS: assistant B sees only organisation B';
  SELECT count(*) INTO visible_count
  FROM public.organisation_workspace_snapshots;
  IF visible_count <> 1 OR NOT EXISTS (
    SELECT 1 FROM public.organisation_workspace_snapshots
    WHERE organisation_id = '20000000-0000-0000-0000-000000000002'
  ) THEN
    RAISE EXCEPTION 'FAIL: assistant B snapshot scope';
  END IF;
  RAISE NOTICE 'PASS: assistant B sees only organisation B snapshot';

  PERFORM set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000009',
    true
  );
  SELECT count(*) INTO visible_count
  FROM public.organisations
  WHERE id IN (
    '20000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000004'
  );
  IF visible_count <> 1 OR NOT EXISTS (
    SELECT 1 FROM public.organisations
    WHERE id = '20000000-0000-0000-0000-000000000001'
  ) THEN
    RAISE EXCEPTION 'FAIL: client user organisation scope';
  END IF;
  SELECT count(*) INTO visible_count
  FROM public.organisation_workspace_snapshots;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: client user received consultant workspace snapshots';
  END IF;
  SELECT count(*) INTO visible_count
  FROM public.organisation_client_records
  WHERE organisation_id IN (
    '20000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002'
  );
  IF visible_count <> 1 OR NOT EXISTS (
    SELECT 1 FROM public.organisation_client_records
    WHERE organisation_id = '20000000-0000-0000-0000-000000000001'
  ) THEN
    RAISE EXCEPTION 'FAIL: client user did not receive only its company records';
  END IF;
  SELECT count(*) INTO visible_count
  FROM public.organisation_tasks;
  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: task assignee must see the assigned task';
  END IF;
  RAISE NOTICE 'PASS: ordinary client user remains isolated to organisation A';

  PERFORM set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000004',
    true
  );
  SELECT count(*) INTO visible_count
  FROM public.organisation_memberships
  WHERE user_id = '10000000-0000-0000-0000-000000000004'
    AND organisation_id = '20000000-0000-0000-0000-000000000001'
    AND is_primary
    AND role = 'client_administrator';
  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: first client profile must be the Senior Manager';
  END IF;
  SELECT count(*) INTO visible_count
  FROM public.organisation_tasks;
  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: task creator must see the assigned task';
  END IF;
  RAISE NOTICE 'PASS: first client profile is the Senior Manager and can read created tasks';
  BEGIN
    EXECUTE 'INSERT INTO public.organisation_memberships (organisation_id, user_id, role) VALUES (''20000000-0000-0000-0000-000000000001'', ''10000000-0000-0000-0000-000000000009'', ''client_user'')';
    RAISE EXCEPTION 'FAIL: Senior Manager created a user membership';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: Senior Manager cannot create user memberships';
  END;

  PERFORM set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000003',
    true
  );
  SELECT count(*) INTO visible_count
  FROM public.organisation_tasks;
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: unrelated user received another company's task';
  END IF;
  RAISE NOTICE 'PASS: unrelated user cannot read another company's task';

  PERFORM set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000005',
    true
  );
  SELECT count(*) INTO visible_count
  FROM public.organisations
  WHERE id IN (
    '20000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000004'
  );
  IF visible_count <> 1 OR NOT EXISTS (
    SELECT 1 FROM public.organisations
    WHERE id = '20000000-0000-0000-0000-000000000002'
  ) THEN
    RAISE EXCEPTION 'FAIL: client administrator organisation scope';
  END IF;
  SELECT count(*) INTO visible_count
  FROM public.organisation_memberships
  WHERE user_id = '10000000-0000-0000-0000-000000000005'
    AND organisation_id = '20000000-0000-0000-0000-000000000002'
    AND is_primary
    AND role = 'client_administrator';
  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: first client administrator in organisation B is not primary';
  END IF;
  SELECT count(*) INTO visible_count
  FROM public.organisation_client_records
  WHERE organisation_id IN (
    '20000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000002'
  );
  IF visible_count <> 1 OR NOT EXISTS (
    SELECT 1 FROM public.organisation_client_records
    WHERE organisation_id = '20000000-0000-0000-0000-000000000002'
  ) THEN
    RAISE EXCEPTION 'FAIL: company user received another organisation records';
  END IF;
  RAISE NOTICE 'PASS: client administrator remains isolated to organisation B';

  PERFORM set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000007',
    true
  );
  SELECT count(*) INTO visible_count
  FROM public.organisations
  WHERE id = '20000000-0000-0000-0000-000000000001';
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: inactive profile received tenant access';
  END IF;
  RAISE NOTICE 'PASS: inactive profile receives no tenant data';

  PERFORM set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000008',
    true
  );
  SELECT count(*) INTO visible_count
  FROM public.organisations
  WHERE id = '20000000-0000-0000-0000-000000000001';
  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: inactive membership received tenant access';
  END IF;
  RAISE NOTICE 'PASS: inactive membership receives no tenant data';

  PERFORM set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000002',
    true
  );
  BEGIN
    EXECUTE 'UPDATE public.organisation_memberships SET role = ''main_consultant'' WHERE user_id = ''10000000-0000-0000-0000-000000000002''';
    RAISE EXCEPTION 'FAIL: assistant promoted own membership';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: assistant cannot promote own membership to main consultant';
  END;

  BEGIN
    EXECUTE 'INSERT INTO public.platform_roles (user_id, role) VALUES (''10000000-0000-0000-0000-000000000002'', ''main_consultant'')';
    RAISE EXCEPTION 'FAIL: assistant inserted platform role';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: assistant cannot promote self through platform_roles';
  END;

  PERFORM set_config(
    'request.jwt.claim.sub',
    '10000000-0000-0000-0000-000000000009',
    true
  );
  BEGIN
    EXECUTE 'INSERT INTO public.platform_roles (user_id, role) VALUES (''10000000-0000-0000-0000-000000000009'', ''administrator'')';
    RAISE EXCEPTION 'FAIL: client user inserted platform role';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: client user cannot promote self through platform_roles';
  END;

  BEGIN
    EXECUTE 'UPDATE public.organisation_memberships SET role = ''assistant_consultant'' WHERE user_id = ''10000000-0000-0000-0000-000000000009''';
    RAISE EXCEPTION 'FAIL: client user changed own role';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: client user cannot promote own membership';
  END;

  BEGIN
    EXECUTE 'SELECT * FROM public.platform_roles';
    RAISE EXCEPTION 'FAIL: authenticated user read platform_roles directly';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: authenticated user cannot read platform_roles directly';
  END;

  BEGIN
    EXECUTE 'UPDATE public.platform_roles SET role = ''administrator'' WHERE user_id = ''10000000-0000-0000-0000-000000000001''';
    RAISE EXCEPTION 'FAIL: authenticated user updated platform role';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: authenticated user cannot update platform_roles';
  END;

  BEGIN
    EXECUTE 'DELETE FROM public.platform_roles WHERE user_id = ''10000000-0000-0000-0000-000000000001''';
    RAISE EXCEPTION 'FAIL: authenticated user deleted platform role';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: authenticated user cannot delete platform_roles';
  END;
END;
$$;

RESET ROLE;
SET LOCAL ROLE anon;

DO $$
BEGIN
  BEGIN
    PERFORM count(*) FROM public.organisations;
    RAISE EXCEPTION 'FAIL: anonymous role can read organisations';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anonymous role cannot read tenant organisations';
  END;

  BEGIN
    PERFORM count(*) FROM public.responsible_people;
    RAISE EXCEPTION 'FAIL: anonymous role can read responsible people';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anonymous role cannot read tenant responsible people';
  END;
END;
$$;

ROLLBACK;
