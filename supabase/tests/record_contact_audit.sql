DO $record_contact_audit_tests$
DECLARE
  organisation_a CONSTANT uuid := 'f1000000-0000-4000-8000-000000000001';
  organisation_b CONSTANT uuid := 'f1000000-0000-4000-8000-000000000002';
  contact_a CONSTANT uuid := 'f3000000-0000-4000-8000-000000000001';
  contact_b CONSTANT uuid := 'f3000000-0000-4000-8000-000000000002';
  contact_from_b CONSTANT uuid := 'f3000000-0000-4000-8000-000000000003';
  target_record_id uuid;
  missing_contact CONSTANT uuid := 'f3000000-0000-4000-8000-000000000099';
  affected integer;
  audit_count integer;
  visible_count integer;
  previous_values jsonb;
  new_values jsonb;
  event_field text;
BEGIN
  INSERT INTO public.organisation_contacts (
    id, organisation_id, name, email, authorised, primary_contact, active
  )
  VALUES
    (
      'f3000000-0000-4000-8000-000000000001',
      'f1000000-0000-4000-8000-000000000001',
      'Contact A',
      'contact-a@example.invalid',
      true,
      false,
      true
    ),
    (
      'f3000000-0000-4000-8000-000000000002',
      'f1000000-0000-4000-8000-000000000001',
      'Contact B',
      'contact-b@example.invalid',
      true,
      false,
      true
    ),
    (
      'f3000000-0000-4000-8000-000000000003',
      'f1000000-0000-4000-8000-000000000002',
      'Contact from organisation B',
      'contact-org-b@example.invalid',
      true,
      false,
      true
    );

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

  INSERT INTO public.organisation_records (
    organisation_id, name, category, category2, issue_date, expiry_date,
    status, risk, escalation_level, contact_id, follow_up, reminder_days,
    reminder_frequency, reminder_lead_days, client_visible, created_by, updated_by
  )
  VALUES (
    organisation_a, 'Contact audit test record', 'COIDA',
    'Certificate', '2026-01-01', '2030-04-30', 'Current', 'Low', 'Normal',
    NULL, NULL, ARRAY[30, 7], 'weekly', 7, true, (SELECT auth.uid()),
    (SELECT auth.uid())
  )
  RETURNING id INTO target_record_id;

  SELECT count(*) INTO audit_count
  FROM public.organisation_audit_events AS audit
  WHERE audit.record_id = target_record_id
    AND audit.action = 'Monitored record created'
    AND audit.new_value::jsonb -> 'contactId' = 'null'::jsonb;
  IF audit_count <> 1 THEN
    RAISE EXCEPTION 'Creating an unassigned record did not preserve its null contact audit value.';
  END IF;

  UPDATE public.organisation_records
  SET contact_id = contact_a,
      contact_name = 'Contact A',
      contact_email = 'contact-a@example.invalid',
      updated_by = (SELECT auth.uid())
  WHERE id = target_record_id
    AND organisation_id = organisation_a
    AND version = 1;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION 'Assigning Contact A did not update the record.';
  END IF;

  SELECT field, previous_value::jsonb, new_value::jsonb
  INTO event_field, previous_values, new_values
  FROM public.organisation_audit_events AS audit
  WHERE audit.record_id = target_record_id
    AND audit.field = 'contact_id'
    AND audit.previous_value::jsonb -> 'contactId' = 'null'::jsonb
    AND audit.new_value::jsonb ->> 'contactId' = contact_a::text;
  IF event_field <> 'contact_id' THEN
    RAISE EXCEPTION 'Null-to-contact assignment was not marked as a contact audit change.';
  END IF;

  UPDATE public.organisation_records
  SET contact_id = contact_b,
      contact_name = 'Contact B',
      contact_email = 'contact-b@example.invalid',
      updated_by = (SELECT auth.uid())
  WHERE id = target_record_id
    AND organisation_id = organisation_a
    AND version = 2;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 OR NOT EXISTS (
    SELECT 1
    FROM public.organisation_audit_events AS audit
    WHERE audit.record_id = target_record_id
      AND audit.field = 'contact_id'
      AND audit.previous_value::jsonb ->> 'contactId' = contact_a::text
      AND audit.new_value::jsonb ->> 'contactId' = contact_b::text
  ) THEN
    RAISE EXCEPTION 'Changing between same-organisation contacts was not audited.';
  END IF;

  UPDATE public.organisation_records
  SET contact_id = NULL,
      contact_name = '',
      contact_email = '',
      updated_by = (SELECT auth.uid())
  WHERE id = target_record_id
    AND organisation_id = organisation_a
    AND version = 3;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 OR NOT EXISTS (
    SELECT 1
    FROM public.organisation_audit_events AS audit
    WHERE audit.record_id = target_record_id
      AND audit.field = 'contact_id'
      AND audit.previous_value::jsonb ->> 'contactId' = contact_b::text
      AND audit.new_value::jsonb -> 'contactId' = 'null'::jsonb
  ) THEN
    RAISE EXCEPTION 'Removing a responsible contact was not audited.';
  END IF;

  UPDATE public.organisation_records
  SET follow_up = '2030-04-15',
      updated_by = (SELECT auth.uid())
  WHERE id = target_record_id
    AND organisation_id = organisation_a
    AND version = 4;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 OR NOT EXISTS (
    SELECT 1
    FROM public.organisation_audit_events AS audit
    WHERE audit.record_id = target_record_id
      AND audit.field = 'record'
      AND audit.previous_value::jsonb -> 'contactId' = 'null'::jsonb
      AND audit.new_value::jsonb -> 'contactId' = 'null'::jsonb
      AND audit.previous_value::jsonb ->> 'followUp' IS DISTINCT FROM
        audit.new_value::jsonb ->> 'followUp'
  ) THEN
    RAISE EXCEPTION 'Saving an unrelated field created a false contact audit change.';
  END IF;

  SELECT count(*) INTO audit_count
  FROM public.organisation_audit_events AS audit
  WHERE audit.record_id = target_record_id;
  IF audit_count <> 5 THEN
    RAISE EXCEPTION 'A row update created more than one consolidated audit event.';
  END IF;

  UPDATE public.organisation_records
  SET contact_id = contact_a,
      contact_name = 'Contact A',
      contact_email = 'contact-a@example.invalid',
      expiry_date = '2031-04-30',
      updated_by = (SELECT auth.uid())
  WHERE id = target_record_id
    AND organisation_id = organisation_a
    AND version = 5;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION 'Combined contact and expiry update did not update the record.';
  END IF;

  SELECT field, previous_value::jsonb, new_value::jsonb
  INTO event_field, previous_values, new_values
  FROM public.organisation_audit_events AS audit
  WHERE audit.record_id = target_record_id
    AND audit.field = 'record'
    AND audit.previous_value::jsonb -> 'contactId' = 'null'::jsonb
    AND audit.new_value::jsonb ->> 'contactId' = contact_a::text
    AND audit.previous_value::jsonb ->> 'expiryDate' = '2030-04-30'
    AND audit.new_value::jsonb ->> 'expiryDate' = '2031-04-30';
  IF event_field <> 'record' THEN
    RAISE EXCEPTION 'Combined changes did not retain the consolidated record event.';
  END IF;

  SELECT count(*) INTO audit_count
  FROM public.organisation_audit_events AS audit
  WHERE audit.record_id = target_record_id;
  IF audit_count <> 6 THEN
    RAISE EXCEPTION 'A combined update created duplicate audit events.';
  END IF;

  UPDATE public.organisation_records
  SET deleted_at = pg_catalog.now(),
      deleted_by = (SELECT auth.uid()),
      updated_by = (SELECT auth.uid())
  WHERE id = target_record_id
    AND organisation_id = organisation_a
    AND version = 6;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 OR NOT EXISTS (
    SELECT 1
    FROM public.organisation_audit_events AS audit
    WHERE audit.record_id = target_record_id
      AND audit.field = 'record'
      AND audit.previous_value::jsonb -> 'deletedAt' = 'null'::jsonb
      AND audit.new_value::jsonb -> 'deletedAt' <> 'null'::jsonb
  ) THEN
    RAISE EXCEPTION 'Soft deletion was not retained in the audit snapshot.';
  END IF;

  UPDATE public.organisation_records
  SET deleted_at = NULL,
      deleted_by = NULL,
      updated_by = (SELECT auth.uid())
  WHERE id = target_record_id
    AND organisation_id = organisation_a
    AND version = 7;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 OR NOT EXISTS (
    SELECT 1
    FROM public.organisation_audit_events AS audit
    WHERE audit.record_id = target_record_id
      AND audit.field = 'record'
      AND audit.previous_value::jsonb -> 'deletedAt' <> 'null'::jsonb
      AND audit.new_value::jsonb -> 'deletedAt' = 'null'::jsonb
  ) THEN
    RAISE EXCEPTION 'Restoration was not retained in the audit snapshot.';
  END IF;

  UPDATE public.organisation_records
  SET issue_date = '2026-02-02',
      expiry_date = '2032-05-01',
      status = 'Awaiting client',
      risk = 'High',
      follow_up = '2030-04-20',
      reminder_days = ARRAY[60, 30, 7],
      reminder_frequency = 'monthly',
      reminder_lead_days = 14,
      client_visible = false,
      updated_by = (SELECT auth.uid())
  WHERE id = target_record_id
    AND organisation_id = organisation_a
    AND version = 8;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 1 THEN
    RAISE EXCEPTION 'Updating established monitored-record fields failed.';
  END IF;

  SELECT count(*) INTO audit_count
  FROM public.organisation_audit_events AS audit
  WHERE audit.record_id = target_record_id
    AND audit.field = 'record'
    AND audit.previous_value::jsonb ->> 'issueDate' = '2026-01-01'
    AND audit.new_value::jsonb ->> 'issueDate' = '2026-02-02'
    AND audit.previous_value::jsonb ->> 'expiryDate' = '2031-04-30'
    AND audit.new_value::jsonb ->> 'expiryDate' = '2032-05-01'
    AND audit.previous_value::jsonb ->> 'status' = 'Current'
    AND audit.new_value::jsonb ->> 'status' = 'Awaiting client'
    AND audit.previous_value::jsonb ->> 'risk' = 'Low'
    AND audit.new_value::jsonb ->> 'risk' = 'High'
    AND audit.previous_value::jsonb ->> 'followUp' = '2030-04-15'
    AND audit.new_value::jsonb ->> 'followUp' = '2030-04-20'
    AND audit.previous_value::jsonb -> 'reminderDays' = '[30, 7]'::jsonb
    AND audit.new_value::jsonb -> 'reminderDays' = '[60, 30, 7]'::jsonb
    AND audit.previous_value::jsonb ->> 'reminderFrequency' = 'weekly'
    AND audit.new_value::jsonb ->> 'reminderFrequency' = 'monthly'
    AND audit.previous_value::jsonb ->> 'reminderLeadDays' = '7'
    AND audit.new_value::jsonb ->> 'reminderLeadDays' = '14'
    AND audit.previous_value::jsonb ->> 'clientVisible' = 'true'
    AND audit.new_value::jsonb ->> 'clientVisible' = 'false';
  IF audit_count <> 1 THEN
    RAISE EXCEPTION 'The established material fields were not preserved in one audit event.';
  END IF;

  SELECT count(*) INTO audit_count
  FROM public.organisation_audit_events AS audit
  WHERE audit.record_id = target_record_id;
  IF audit_count <> 9 THEN
    RAISE EXCEPTION 'Field, deletion or restoration updates created duplicate audit events.';
  END IF;

  BEGIN
    UPDATE public.organisation_records
    SET contact_id = contact_from_b,
        updated_by = (SELECT auth.uid())
    WHERE id = target_record_id
      AND organisation_id = organisation_a
      AND version = 9;
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Cross-organisation contact assignment unexpectedly succeeded.';
  EXCEPTION
    WHEN check_violation OR foreign_key_violation THEN
      NULL;
  END;

  BEGIN
    UPDATE public.organisation_records
    SET contact_id = missing_contact,
        updated_by = (SELECT auth.uid())
    WHERE id = target_record_id
      AND organisation_id = organisation_a
      AND version = 9;
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'Invalid contact assignment unexpectedly succeeded.';
  EXCEPTION
    WHEN check_violation OR foreign_key_violation THEN
      NULL;
  END;

  UPDATE public.organisation_records
  SET contact_id = contact_b,
      updated_by = (SELECT auth.uid())
  WHERE id = target_record_id
    AND organisation_id = organisation_a
    AND version = 1;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN
    RAISE EXCEPTION 'A stale version update unexpectedly changed the record.';
  END IF;

  EXECUTE 'RESET ROLE';
  IF (SELECT count(*) FROM public.organisation_audit_events AS audit
      WHERE audit.record_id = target_record_id) <> 9
    OR NOT EXISTS (
      SELECT 1
      FROM public.organisation_records
      WHERE id = target_record_id
        AND contact_id = contact_a
        AND version = 9
    )
  THEN
    RAISE EXCEPTION 'A rejected contact update created an audit event or changed the record.';
  END IF;

  PERFORM pg_catalog.set_config(
    'request.jwt.claim.sub',
    'f0000000-0000-4000-8000-000000000004',
    true
  );
  PERFORM pg_catalog.set_config(
    'request.jwt.claims',
    '{"sub":"f0000000-0000-4000-8000-000000000004","role":"authenticated"}',
    true
  );
  EXECUTE 'SET LOCAL ROLE authenticated';
  IF (SELECT count(*) FROM public.organisation_records WHERE id = target_record_id) <> 0
    OR (SELECT count(*) FROM public.organisation_audit_events AS audit
      WHERE audit.record_id = target_record_id) <> 0
  THEN
    RAISE EXCEPTION 'An unassigned assistant could read another organisation''s record history.';
  END IF;
  UPDATE public.organisation_records
  SET contact_id = contact_b,
      updated_by = (SELECT auth.uid())
  WHERE id = target_record_id
    AND organisation_id = organisation_a
    AND version = 9;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN
    RAISE EXCEPTION 'An unassigned assistant changed the responsible contact.';
  END IF;
  EXECUTE 'RESET ROLE';

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
  UPDATE public.organisation_records
  SET contact_id = contact_b,
      updated_by = (SELECT auth.uid())
  WHERE id = target_record_id
    AND organisation_id = organisation_a
    AND version = 9;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN
    RAISE EXCEPTION 'A client user changed the consultant-owned responsible contact.';
  END IF;
  EXECUTE 'RESET ROLE';

  IF (SELECT count(*) FROM public.organisation_audit_events AS audit
      WHERE audit.record_id = target_record_id) <> 9 THEN
    RAISE EXCEPTION 'A rejected assistant or client update created an audit event.';
  END IF;

  DELETE FROM public.organisation_audit_events
  WHERE record_id = target_record_id;
  DELETE FROM public.organisation_records
  WHERE id = target_record_id;
  DELETE FROM public.organisation_contacts
  WHERE id IN (contact_a, contact_b, contact_from_b);
END;
$record_contact_audit_tests$;
