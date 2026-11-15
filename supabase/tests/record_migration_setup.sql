DO $record_migration_setup$
BEGIN
  INSERT INTO auth.users (
    id, aud, role, email, raw_user_meta_data, created_at, updated_at
  )
  VALUES
    ('f0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
      'record-migration-main@example.invalid', '{"display_name":"Migration Main"}',
      now(), now()),
    ('f0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
      'record-migration-assistant-a@example.invalid', '{"display_name":"Migration Assistant A"}',
      now(), now()),
    ('f0000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
      'record-migration-client@example.invalid', '{"display_name":"Migration Client"}',
      now(), now()),
    ('f0000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
      'record-migration-assistant-b@example.invalid', '{"display_name":"Migration Assistant B"}',
      now(), now());

  INSERT INTO public.organisations (id, name, status)
  VALUES
    ('f1000000-0000-4000-8000-000000000001', 'Record Migration Test A', 'active'),
    ('f1000000-0000-4000-8000-000000000002', 'Record Migration Test B', 'active');
  INSERT INTO public.platform_roles (user_id, role)
  VALUES ('f0000000-0000-4000-8000-000000000001', 'main_consultant');
  INSERT INTO public.organisation_memberships (
    organisation_id, user_id, role, active
  )
  VALUES
    ('f1000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000002', 'assistant_consultant', true),
    ('f1000000-0000-4000-8000-000000000001',
      'f0000000-0000-4000-8000-000000000003', 'client_user', true),
    ('f1000000-0000-4000-8000-000000000002',
      'f0000000-0000-4000-8000-000000000004', 'assistant_consultant', true);
  INSERT INTO public.organisation_records (
    organisation_id, name, category, category2, expiry_date, status, risk,
    escalation_level, reminder_days
  )
  VALUES
    ('f1000000-0000-4000-8000-000000000001', 'Tenant A record',
      'COIDA', 'Certificate', '2030-01-01', 'Current', 'Low', 'Normal',
      ARRAY[30, 7]),
    ('f1000000-0000-4000-8000-000000000002', 'Tenant B record',
      'COIDA', 'Certificate', '2030-01-01', 'Current', 'Low', 'Normal',
      ARRAY[30, 7]);

END;
$record_migration_setup$;
