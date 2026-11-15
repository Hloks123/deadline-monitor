DO $record_migration_client_tests$
BEGIN
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub',
    'f0000000-0000-4000-8000-000000000003',
    true
  );
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    '{"sub":"f0000000-0000-4000-8000-000000000003","role":"authenticated"}',
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';

  IF (SELECT count(*) FROM public.organisation_records) <> 0
    OR (SELECT count(*) FROM public.organisation_communications) <> 0
    OR (SELECT count(*) FROM public.organisation_audit_events) <> 0
  THEN
    RAISE EXCEPTION 'Client user could read consultant-only monitored data.';
  END IF;
END;
$record_migration_client_tests$;
