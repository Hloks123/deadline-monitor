DO $record_migration_assistant_tests$
BEGIN
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub',
    'f0000000-0000-4000-8000-000000000002',
    true
  );
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    '{"sub":"f0000000-0000-4000-8000-000000000002","role":"authenticated"}',
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';

  IF (SELECT count(*) FROM public.organisation_records) <> 2
    OR EXISTS (
      SELECT 1 FROM public.organisation_records
      WHERE organisation_id = 'f1000000-0000-4000-8000-000000000002'
    )
    OR (SELECT count(*) FROM public.organisation_audit_events) <> 2
    OR EXISTS (
      SELECT 1 FROM public.organisation_audit_events
      WHERE organisation_id = 'f1000000-0000-4000-8000-000000000002'
    )
  THEN
    RAISE EXCEPTION 'Assistant could read another organisation''s records or audit events.';
  END IF;

  BEGIN
    INSERT INTO public.organisation_records (
      organisation_id, name, category, category2, expiry_date, status, risk,
      escalation_level, created_by, updated_by
    )
    VALUES (
      'f1000000-0000-4000-8000-000000000002', 'Cross-tenant attempt',
      'COIDA', 'Certificate', '2030-01-01', 'Current', 'Low', 'Normal',
      (SELECT auth.uid()), (SELECT auth.uid())
    );
    RAISE EXCEPTION 'Assistant inserted a record into another organisation.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    PERFORM public.commit_local_record_migration(
      'f2000000-0000-4000-8000-000000000001',
      pg_catalog.repeat('b', 64),
      '[]'::jsonb,
      '[]'::jsonb,
      '[]'::jsonb
    );
    RAISE EXCEPTION 'Assistant was able to execute a migration import.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$record_migration_assistant_tests$;
