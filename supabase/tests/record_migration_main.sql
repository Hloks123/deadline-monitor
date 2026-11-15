DO $record_migration_main_tests$
DECLARE
  run_id uuid;
  first_result jsonb;
  second_result jsonb;
  reconciliation jsonb;
  mapped_contact_id uuid;
  contacts_payload jsonb := '[
    {
      "legacy_id":"legacy-contact-a",
      "checksum":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      "name":"Test Legacy Contact",
      "email":"CONTACT@EXAMPLE.INVALID",
      "phone":"+27 11 123 4567",
      "role_title":"Operations Manager",
      "authorised":true,
      "primary_contact":false
    }
  ]'::jsonb;
  records_payload jsonb := '[
    {
      "legacy_id":"legacy-record-a",
      "checksum":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      "name":"Imported test record",
      "category":"COIDA",
      "category2":"Certificate",
      "issue_date":null,
      "expiry_date":"2030-04-30",
      "status":"Current",
      "risk":"Low",
      "escalation_level":"Normal",
      "legacy_contact_id":"legacy-contact-a",
      "contact_name":"",
      "contact_email":"",
      "follow_up":null,
      "reference_number":null,
      "next_action":null,
      "notes":null,
      "reminder_frequency":null,
      "reminder_lead_days":null,
      "client_created":false,
      "last_confirmed":null,
      "confirmed_by":null,
      "confirmation_method":null,
      "data_source":null,
      "reminder_days":[30,7]
    }
  ]'::jsonb;
  communications_payload jsonb := '[
    {
      "legacy_id":"legacy-communication-a",
      "checksum":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      "record_legacy_id":"legacy-record-a",
      "unique_key":"legacy-key",
      "communication_type":"Reminder",
      "recipient":"test@example.invalid",
      "subject":"Reminder",
      "message":"Test message",
      "outcome":"Prepared",
      "delivery_status":"Draft",
      "next_follow_up":"2030-04-01",
      "occurred_at":null,
      "legacy_date_text":"01/04/2030",
      "related_task_id":null,
      "message_version":null,
      "reviewer":null,
      "decision":"draft",
      "reviewed_at":null,
      "failure_reason":null
    }
  ]'::jsonb;
  audit_events_payload jsonb := '[
    {
      "legacy_id":"legacy-audit-a",
      "checksum":"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      "record_legacy_id":"legacy-record-a",
      "entity_type":"record",
      "entity_id":"legacy-record-a",
      "entity_name":"Imported test record",
      "record_name":"Imported test record",
      "actor_label":"Legacy user",
      "action":"Record status changed",
      "field":"status",
      "previous_value":"Awaiting client",
      "new_value":"Current",
      "values_redacted":false,
      "occurred_at":null,
      "legacy_date_text":"01/04/2030"
    }
  ]'::jsonb;
BEGIN
  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub',
    'f0000000-0000-4000-8000-000000000001',
    true
  );
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    '{"sub":"f0000000-0000-4000-8000-000000000001","role":"authenticated"}',
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';

  IF (SELECT count(*) FROM public.organisation_records) <> 2 THEN
    RAISE EXCEPTION 'Main consultant did not see both active organisations.';
  END IF;
  IF (SELECT count(*) FROM public.organisation_audit_events) <> 2 THEN
    RAISE EXCEPTION 'Main consultant did not see both organisations'' audit events.';
  END IF;

  INSERT INTO public.data_migration_runs (
    organisation_id, initiated_by, source_type, source_legacy_client_id,
    source_checksum, source_counts, skipped_counts, validation_summary
  )
  VALUES (
    'f1000000-0000-4000-8000-000000000001',
    (SELECT auth.uid()),
    'browser_local_storage',
    'legacy-client-a',
    pg_catalog.repeat('b', 64),
    '{"contacts":1,"records":1,"communications":1,"auditEvents":1}'::jsonb,
    '{"records":0,"communications":0,"auditEvents":0}'::jsonb,
    '{}'::jsonb
  )
  RETURNING id INTO run_id;

  first_result := public.commit_local_record_migration_with_contacts(
    run_id,
    pg_catalog.repeat('b', 64),
    contacts_payload,
    records_payload,
    communications_payload,
    audit_events_payload
  );
  second_result := public.commit_local_record_migration_with_contacts(
    run_id,
    pg_catalog.repeat('b', 64),
    contacts_payload,
    records_payload,
    communications_payload,
    audit_events_payload
  );
  IF first_result ->> 'status' <> 'completed'
    OR (first_result -> 'importedCounts' ->> 'records')::integer <> 1
    OR second_result ->> 'status' <> 'completed'
  THEN
    RAISE EXCEPTION 'Repeated import did not return the completed migration.';
  END IF;

  IF (SELECT count(*) FROM public.organisation_records
      WHERE organisation_id = 'f1000000-0000-4000-8000-000000000001'
        AND legacy_id = 'legacy-record-a') <> 1
    OR (SELECT count(*) FROM public.organisation_communications
      WHERE organisation_id = 'f1000000-0000-4000-8000-000000000001'
        AND legacy_id = 'legacy-communication-a') <> 1
    OR (SELECT count(*) FROM public.organisation_audit_events
      WHERE organisation_id = 'f1000000-0000-4000-8000-000000000001'
        AND legacy_id = 'legacy-audit-a') <> 1
    OR (SELECT count(*) FROM public.organisation_audit_events) <> 3
    OR (SELECT count(*) FROM public.data_migration_items
      WHERE migration_run_id = run_id) <> 4
  THEN
    RAISE EXCEPTION 'Repeated import created duplicate target or ledger rows.';
  END IF;
  SELECT contact_id INTO mapped_contact_id
  FROM public.organisation_records
  WHERE organisation_id = 'f1000000-0000-4000-8000-000000000001'
    AND legacy_id = 'legacy-record-a';
  IF mapped_contact_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.organisation_records
      WHERE organisation_id = 'f1000000-0000-4000-8000-000000000001'
        AND legacy_id = 'legacy-record-a'
        AND legacy_contact_id IS NOT NULL
    )
    OR (SELECT count(*) FROM public.organisation_contacts
      WHERE id = mapped_contact_id
        AND organisation_id = 'f1000000-0000-4000-8000-000000000001'
        AND email = 'contact@example.invalid') <> 1
    OR (SELECT count(*) FROM public.data_migration_items
      WHERE migration_run_id = run_id
        AND entity_type = 'contact'
        AND target_id = mapped_contact_id) <> 1
  THEN
    RAISE EXCEPTION 'Legacy contact was not reconciled to a canonical organisation contact.';
  END IF;

  reconciliation := public.reconcile_local_record_migration(run_id);
  IF reconciliation ->> 'matched' <> 'true'
    OR reconciliation ->> 'status' <> 'reconciled'
  THEN
    RAISE EXCEPTION 'Migration reconciliation did not match imported rows.';
  END IF;

  second_result := public.commit_local_record_migration_with_contacts(
    run_id,
    pg_catalog.repeat('b', 64),
    contacts_payload,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb
  );
  IF second_result ->> 'status' <> 'reconciled' THEN
    RAISE EXCEPTION 'Completed migration retry was not idempotent after reconciliation.';
  END IF;
END;
$record_migration_main_tests$;
