ALTER TABLE public.data_migration_items
  DROP CONSTRAINT IF EXISTS data_migration_items_entity_type_check;
ALTER TABLE public.data_migration_items
  ADD CONSTRAINT data_migration_items_entity_type_check
  CHECK (entity_type IN ('contact', 'record', 'communication', 'audit_event'));

ALTER TABLE public.data_migration_items
  DROP CONSTRAINT IF EXISTS data_migration_items_target_table_check;
ALTER TABLE public.data_migration_items
  ADD CONSTRAINT data_migration_items_target_table_check
  CHECK (target_table IN (
    'organisation_contacts',
    'organisation_records',
    'organisation_communications',
    'organisation_audit_events'
  ));
ALTER TABLE public.data_migration_items
  ADD COLUMN mapping_method text,
  ADD COLUMN mapping_status text CHECK (
    mapping_status IS NULL OR mapping_status IN (
      'matched', 'created', 'ambiguous', 'unresolved'
    )
  ),
  ADD COLUMN warning text;

CREATE INDEX data_migration_items_contact_mapping_idx
  ON public.data_migration_items (organisation_id, entity_type, legacy_id)
  WHERE entity_type = 'contact';

CREATE FUNCTION public.commit_local_record_migration_with_contacts(
  target_run_id uuid,
  source_checksum_input text,
  contacts_input jsonb,
  records_input jsonb,
  communications_input jsonb,
  audit_events_input jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  run_row public.data_migration_runs%ROWTYPE;
  item jsonb;
  legacy_contact_id text;
  selected_contact_id uuid;
  target_ids uuid[];
  match_count integer;
  method_value text;
  status_value text;
  warning_value text;
  normalized_email text;
  normalized_phone text;
  normalized_name text;
  contact_import_count integer := 0;
  core_result jsonb;
BEGIN
  IF (SELECT auth.uid()) IS NULL
    OR NOT public.has_platform_role(ARRAY['main_consultant']::text[])
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Only a main consultant can import monitored records.';
  END IF;

  IF pg_catalog.jsonb_typeof(contacts_input) <> 'array'
    OR pg_catalog.jsonb_typeof(records_input) <> 'array'
    OR pg_catalog.jsonb_typeof(communications_input) <> 'array'
    OR pg_catalog.jsonb_typeof(audit_events_input) <> 'array'
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Migration data must contain contact, record, communication and audit arrays.';
  END IF;

  SELECT *
  INTO run_row
  FROM public.data_migration_runs
  WHERE id = target_run_id
    AND initiated_by = (SELECT auth.uid())
  FOR UPDATE;

  IF NOT FOUND OR run_row.source_checksum <> source_checksum_input THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Migration run or reviewed source checksum is invalid.';
  END IF;

  IF run_row.status = 'previewed' THEN
    IF COALESCE((run_row.source_counts ->> 'contacts')::integer, 0)
      <> pg_catalog.jsonb_array_length(contacts_input)
    THEN
      RAISE EXCEPTION USING
        ERRCODE = '22023',
        MESSAGE = 'Contact data does not match the reviewed preview.';
    END IF;

    FOR item IN SELECT value FROM pg_catalog.jsonb_array_elements(contacts_input)
    LOOP
      legacy_contact_id := item ->> 'legacy_id';
      selected_contact_id := NULL;
      method_value := NULL;
      warning_value := NULL;
      normalized_email := NULLIF(
        pg_catalog.lower(pg_catalog.btrim(item ->> 'email')),
        ''
      );
      normalized_phone := NULLIF(
        pg_catalog.regexp_replace(
          COALESCE(item ->> 'phone', ''),
          '[^0-9+]',
          '',
          'g'
        ),
        ''
      );
      normalized_name := pg_catalog.lower(
        pg_catalog.regexp_replace(
          pg_catalog.btrim(item ->> 'name'),
          '[[:space:]]+',
          ' ',
          'g'
        )
      );

      PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtext(run_row.organisation_id::text),
        pg_catalog.hashtext(
          COALESCE(normalized_email, normalized_phone, normalized_name)
        )
      );

      SELECT pg_catalog.array_agg(DISTINCT mapping.target_id)
      INTO target_ids
      FROM public.data_migration_items AS mapping
      JOIN public.data_migration_runs AS previous_run
        ON previous_run.id = mapping.migration_run_id
       AND previous_run.organisation_id = mapping.organisation_id
      WHERE mapping.organisation_id = run_row.organisation_id
        AND mapping.entity_type = 'contact'
        AND mapping.legacy_id = legacy_contact_id
        AND mapping.target_table = 'organisation_contacts'
        AND mapping.status = 'imported'
        AND mapping.target_id IS NOT NULL;

      IF pg_catalog.cardinality(target_ids) = 1 THEN
        SELECT contact.id INTO selected_contact_id
        FROM public.organisation_contacts AS contact
        WHERE contact.id = target_ids[1]
          AND contact.organisation_id = run_row.organisation_id
          AND contact.active;
        IF selected_contact_id IS NOT NULL THEN
          method_value := 'existing_mapping';
        ELSE
          warning_value := 'The previously mapped contact is no longer active.';
        END IF;
      ELSIF COALESCE(pg_catalog.cardinality(target_ids), 0) > 1 THEN
        warning_value := 'Previous migration runs map this contact to different canonical contacts.';
      END IF;

      IF method_value IS NULL AND warning_value IS NULL AND normalized_email IS NOT NULL THEN
        SELECT pg_catalog.count(*), (pg_catalog.array_agg(contact.id))[1]
        INTO match_count, selected_contact_id
        FROM public.organisation_contacts AS contact
        WHERE contact.organisation_id = run_row.organisation_id
          AND contact.active
          AND pg_catalog.lower(pg_catalog.btrim(contact.email)) = normalized_email;
        IF match_count = 1 THEN
          method_value := 'email';
        ELSIF match_count > 1 THEN
          selected_contact_id := NULL;
          warning_value := 'More than one contact in this organisation has the same normalized email.';
        END IF;
      END IF;

      IF method_value IS NULL AND warning_value IS NULL AND normalized_phone IS NOT NULL THEN
        SELECT pg_catalog.count(*), (pg_catalog.array_agg(contact.id))[1]
        INTO match_count, selected_contact_id
        FROM public.organisation_contacts AS contact
        WHERE contact.organisation_id = run_row.organisation_id
          AND contact.active
          AND pg_catalog.regexp_replace(
            COALESCE(contact.phone, ''),
            '[^0-9+]',
            '',
            'g'
          ) = normalized_phone;
        IF match_count = 1 THEN
          method_value := 'phone';
        ELSIF match_count > 1 THEN
          selected_contact_id := NULL;
          warning_value := 'More than one contact in this organisation has the same normalized phone number.';
        END IF;
      END IF;

      IF method_value IS NULL AND warning_value IS NULL THEN
        SELECT pg_catalog.count(*), (pg_catalog.array_agg(contact.id))[1]
        INTO match_count, selected_contact_id
        FROM public.organisation_contacts AS contact
        WHERE contact.organisation_id = run_row.organisation_id
          AND contact.active
          AND pg_catalog.lower(
            pg_catalog.regexp_replace(
              pg_catalog.btrim(contact.name),
              '[[:space:]]+',
              ' ',
              'g'
            )
          ) = normalized_name;
        IF match_count = 1 THEN
          method_value := 'name';
        ELSIF match_count > 1 THEN
          selected_contact_id := NULL;
          warning_value := 'More than one contact in this organisation has the same normalized name.';
        END IF;
      END IF;

      IF method_value IS NULL AND warning_value IS NULL THEN
        IF pg_catalog.length(pg_catalog.btrim(item ->> 'name')) = 0
          OR (
            normalized_email IS NOT NULL
            AND (
              position('@' IN normalized_email) < 2
              OR position('.' IN normalized_email) = 0
            )
          )
        THEN
          warning_value := 'The unmatched legacy contact does not contain valid data for safe creation.';
        ELSE
          INSERT INTO public.organisation_contacts (
            organisation_id,
            name,
            email,
            phone,
            role_title,
            authorised,
            primary_contact,
            active
          )
          VALUES (
            run_row.organisation_id,
            pg_catalog.regexp_replace(
              pg_catalog.btrim(item ->> 'name'),
              '[[:space:]]+',
              ' ',
              'g'
            ),
            normalized_email,
            NULLIF(
              pg_catalog.regexp_replace(
                pg_catalog.btrim(COALESCE(item ->> 'phone', '')),
                '[[:space:]]+',
                ' ',
                'g'
              ),
              ''
            ),
            NULLIF(
              pg_catalog.regexp_replace(
                pg_catalog.btrim(COALESCE(item ->> 'role_title', '')),
                '[[:space:]]+',
                ' ',
                'g'
              ),
              ''
            ),
            COALESCE((item ->> 'authorised')::boolean, false)
              AND normalized_email IS NOT NULL,
            COALESCE((item ->> 'primary_contact')::boolean, false)
              AND COALESCE((item ->> 'authorised')::boolean, false)
              AND normalized_email IS NOT NULL
              AND NOT EXISTS (
                SELECT 1
                FROM public.organisation_contacts AS existing
                WHERE existing.organisation_id = run_row.organisation_id
                  AND existing.active
                  AND existing.authorised
                  AND existing.primary_contact
              ),
            true
          )
          RETURNING id INTO selected_contact_id;
          method_value := 'created';
        END IF;
      END IF;

      status_value := CASE
        WHEN selected_contact_id IS NOT NULL THEN 'imported'
        ELSE 'skipped'
      END;

      INSERT INTO public.data_migration_items (
        organisation_id,
        migration_run_id,
        entity_type,
        legacy_id,
        legacy_checksum,
        target_table,
        target_id,
        status,
        error_code,
        error_message,
        imported_at,
        mapping_method,
        mapping_status,
        warning
      )
      VALUES (
        run_row.organisation_id,
        run_row.id,
        'contact',
        legacy_contact_id,
        item ->> 'checksum',
        'organisation_contacts',
        selected_contact_id,
        status_value,
        CASE WHEN selected_contact_id IS NULL THEN 'contact_unresolved' END,
        warning_value,
        CASE WHEN selected_contact_id IS NOT NULL THEN pg_catalog.now() END,
        method_value,
        CASE
          WHEN method_value = 'created' THEN 'created'
          WHEN method_value IS NOT NULL THEN 'matched'
          WHEN warning_value LIKE 'More than one%' OR warning_value LIKE 'Previous migration%' THEN 'ambiguous'
          ELSE 'unresolved'
        END,
        warning_value
      );
      IF selected_contact_id IS NOT NULL THEN
        contact_import_count := contact_import_count + 1;
      END IF;
    END LOOP;
  END IF;

  core_result := public.commit_local_record_migration(
    target_run_id,
    source_checksum_input,
    records_input,
    communications_input,
    audit_events_input
  );

  FOR item IN SELECT value FROM pg_catalog.jsonb_array_elements(records_input)
  LOOP
    SELECT mapping.target_id INTO selected_contact_id
    FROM public.data_migration_items AS mapping
    WHERE mapping.migration_run_id = run_row.id
      AND mapping.entity_type = 'contact'
      AND mapping.legacy_id = NULLIF(item ->> 'legacy_contact_id', '')
      AND mapping.status = 'imported'
    LIMIT 1;

    UPDATE public.organisation_records AS record
    SET contact_id = selected_contact_id,
        legacy_contact_id = NULL
    WHERE record.organisation_id = run_row.organisation_id
      AND record.legacy_source = 'doc-monitor-localstorage-v1'
      AND record.legacy_id = item ->> 'legacy_id'
      AND (
        record.contact_id IS DISTINCT FROM selected_contact_id
        OR record.legacy_contact_id IS NOT NULL
      );
  END LOOP;

  SELECT pg_catalog.count(*)::integer INTO contact_import_count
  FROM public.data_migration_items
  WHERE migration_run_id = run_row.id
    AND entity_type = 'contact'
    AND status = 'imported';

  UPDATE public.data_migration_runs
  SET imported_counts = imported_counts || pg_catalog.jsonb_build_object(
        'contacts', contact_import_count
      ),
      validation_summary = validation_summary || pg_catalog.jsonb_build_object(
        'contactImport', pg_catalog.jsonb_build_object(
          'importedMappings', contact_import_count,
          'unresolvedMappings', (
            SELECT pg_catalog.count(*)
            FROM public.data_migration_items
            WHERE migration_run_id = run_row.id
              AND entity_type = 'contact'
              AND status <> 'imported'
          )
        )
      )
  WHERE id = run_row.id;

  RETURN core_result || pg_catalog.jsonb_build_object(
    'contactMappingsImported', contact_import_count
  );
END;
$$;

ALTER TABLE public.organisation_records
  ALTER COLUMN client_visible SET DEFAULT true;

CREATE OR REPLACE FUNCTION public.audit_organisation_record_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_label_value text;
  before_values jsonb;
  after_values jsonb;
BEGIN
  IF pg_catalog.current_setting('app.record_migration_import', true) = '1' THEN
    RETURN NEW;
  END IF;

  SELECT profile.display_name INTO actor_label_value
  FROM public.profiles AS profile
  WHERE profile.id = (SELECT auth.uid());

  IF TG_OP = 'INSERT' THEN
    after_values := pg_catalog.jsonb_build_object(
      'category', NEW.category,
      'category2', NEW.category2,
      'issueDate', NEW.issue_date,
      'expiryDate', NEW.expiry_date,
      'risk', NEW.risk,
      'status', NEW.status,
      'contactId', NEW.contact_id,
      'followUp', NEW.follow_up,
      'reminderDays', NEW.reminder_days,
      'reminderFrequency', NEW.reminder_frequency,
      'reminderLeadDays', NEW.reminder_lead_days,
      'clientVisible', NEW.client_visible
    );
    INSERT INTO public.organisation_audit_events (
      organisation_id, record_id, record_name, actor_id, actor_label,
      action, field, new_value, values_redacted, occurred_at
    )
    VALUES (
      NEW.organisation_id, NEW.id, NEW.name, (SELECT auth.uid()),
      COALESCE(actor_label_value, ''),
      'Monitored record created', 'record',
      after_values::text, true, pg_catalog.now()
    );
  ELSE
    before_values := pg_catalog.jsonb_build_object(
      'category', OLD.category,
      'category2', OLD.category2,
      'issueDate', OLD.issue_date,
      'expiryDate', OLD.expiry_date,
      'risk', OLD.risk,
      'status', OLD.status,
      'contactId', OLD.contact_id,
      'followUp', OLD.follow_up,
      'reminderDays', OLD.reminder_days,
      'reminderFrequency', OLD.reminder_frequency,
      'reminderLeadDays', OLD.reminder_lead_days,
      'clientVisible', OLD.client_visible
    );
    after_values := pg_catalog.jsonb_build_object(
      'category', NEW.category,
      'category2', NEW.category2,
      'issueDate', NEW.issue_date,
      'expiryDate', NEW.expiry_date,
      'risk', NEW.risk,
      'status', NEW.status,
      'contactId', NEW.contact_id,
      'followUp', NEW.follow_up,
      'reminderDays', NEW.reminder_days,
      'reminderFrequency', NEW.reminder_frequency,
      'reminderLeadDays', NEW.reminder_lead_days,
      'clientVisible', NEW.client_visible
    );
    INSERT INTO public.organisation_audit_events (
      organisation_id, record_id, record_name, actor_id, actor_label,
      action, field, previous_value, new_value, values_redacted, occurred_at
    )
    VALUES (
      NEW.organisation_id, NEW.id, NEW.name, (SELECT auth.uid()),
      COALESCE(actor_label_value, ''),
      'Monitored record updated', 'record',
      before_values::text, after_values::text, true, pg_catalog.now()
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.sync_organisation_record_client_projection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  record_row public.organisation_records%ROWTYPE;
  organisation_name text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.organisation_client_records
    WHERE organisation_id = OLD.organisation_id
      AND record_id = OLD.id::text
      AND source = 'consultant';
    RETURN OLD;
  END IF;

  record_row := NEW;
  SELECT organisation.name INTO organisation_name
  FROM public.organisations AS organisation
  WHERE organisation.id = record_row.organisation_id;

  IF NOT record_row.client_visible OR record_row.deleted_at IS NOT NULL THEN
    DELETE FROM public.organisation_client_records
    WHERE organisation_id = record_row.organisation_id
      AND record_id = record_row.id::text
      AND source = 'consultant';
    RETURN NEW;
  END IF;

  INSERT INTO public.organisation_client_records (
    organisation_id, record_id, source, payload, created_by
  )
  VALUES (
    record_row.organisation_id,
    record_row.id::text,
    'consultant',
    pg_catalog.jsonb_strip_nulls(pg_catalog.jsonb_build_object(
      'id', record_row.id,
      'name', record_row.name,
      'organisationId', record_row.organisation_id,
      'organisation', organisation_name,
      'category', record_row.category,
      'category2', record_row.category2,
      'issueDate', record_row.issue_date,
      'expiryDate', record_row.expiry_date,
      'lastConfirmed', record_row.last_confirmed,
      'status', record_row.status,
      'risk', record_row.risk,
      'contact', record_row.contact_name,
      'contactEmail', record_row.contact_email,
      'followUp', record_row.follow_up,
      'referenceNumber', record_row.reference_number,
      'nextAction', record_row.next_action,
      'reminderFrequency', record_row.reminder_frequency,
      'reminderLeadDays', record_row.reminder_lead_days,
      'clientCreated', false
    )),
    record_row.created_by
  )
  ON CONFLICT (organisation_id, record_id) DO UPDATE
  SET source = 'consultant',
      payload = EXCLUDED.payload,
      created_by = EXCLUDED.created_by
  WHERE public.organisation_client_records.source = 'consultant';
  RETURN NEW;
END;
$$;

CREATE TRIGGER organisation_records_sync_client_projection
  AFTER INSERT OR UPDATE OR DELETE ON public.organisation_records
  FOR EACH ROW EXECUTE FUNCTION public.sync_organisation_record_client_projection();

CREATE OR REPLACE FUNCTION public.reconcile_local_record_migration(target_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  run_row public.data_migration_runs%ROWTYPE;
  expected_counts jsonb;
  actual_counts jsonb;
  is_reconciled boolean;
BEGIN
  IF (SELECT auth.uid()) IS NULL
    OR NOT public.has_platform_role(ARRAY['main_consultant']::text[])
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Only a main consultant can reconcile monitored-record migrations.';
  END IF;

  SELECT *
  INTO run_row
  FROM public.data_migration_runs
  WHERE id = target_run_id
    AND initiated_by = (SELECT auth.uid())
  FOR UPDATE;

  IF NOT FOUND OR run_row.status NOT IN (
    'completed', 'reconciled', 'reconciliation_required'
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Only a completed migration can be reconciled.';
  END IF;

  expected_counts := pg_catalog.jsonb_build_object(
    'records',
    (SELECT count(*) FROM public.data_migration_items
      WHERE migration_run_id = run_row.id AND entity_type = 'record'
        AND status = 'imported'),
    'communications',
    (SELECT count(*) FROM public.data_migration_items
      WHERE migration_run_id = run_row.id AND entity_type = 'communication'
        AND status = 'imported'),
    'auditEvents',
    (SELECT count(*) FROM public.data_migration_items
      WHERE migration_run_id = run_row.id AND entity_type = 'audit_event'
        AND status = 'imported')
  );
  actual_counts := pg_catalog.jsonb_build_object(
    'records',
    (SELECT count(*)
      FROM public.data_migration_items AS item
      JOIN public.organisation_records AS target
        ON target.id = item.target_id
       AND target.organisation_id = item.organisation_id
      WHERE item.migration_run_id = run_row.id
        AND item.entity_type = 'record' AND item.status = 'imported'),
    'communications',
    (SELECT count(*)
      FROM public.data_migration_items AS item
      JOIN public.organisation_communications AS target
        ON target.id = item.target_id
       AND target.organisation_id = item.organisation_id
      WHERE item.migration_run_id = run_row.id
        AND item.entity_type = 'communication' AND item.status = 'imported'),
    'auditEvents',
    (SELECT count(*)
      FROM public.data_migration_items AS item
      JOIN public.organisation_audit_events AS target
        ON target.id = item.target_id
       AND target.organisation_id = item.organisation_id
      WHERE item.migration_run_id = run_row.id
        AND item.entity_type = 'audit_event' AND item.status = 'imported')
  );

  IF run_row.source_counts ? 'contacts' THEN
    expected_counts := expected_counts || pg_catalog.jsonb_build_object(
      'contacts',
      (SELECT count(*) FROM public.data_migration_items
        WHERE migration_run_id = run_row.id AND entity_type = 'contact'
          AND status = 'imported')
    );
    actual_counts := actual_counts || pg_catalog.jsonb_build_object(
      'contacts',
      (SELECT count(*)
        FROM public.data_migration_items AS item
        JOIN public.organisation_contacts AS target
          ON target.id = item.target_id
         AND target.organisation_id = item.organisation_id
        WHERE item.migration_run_id = run_row.id
          AND item.entity_type = 'contact' AND item.status = 'imported')
    );
  END IF;

  is_reconciled := expected_counts = actual_counts
    AND expected_counts = run_row.imported_counts;

  UPDATE public.data_migration_runs
  SET status = CASE
        WHEN is_reconciled THEN 'reconciled'
        ELSE 'reconciliation_required'
      END,
      reconciliation_summary = pg_catalog.jsonb_build_object(
        'expected', expected_counts,
        'actual', actual_counts,
        'matched', is_reconciled
      ),
      reconciled_at = pg_catalog.now()
  WHERE id = run_row.id;

  RETURN pg_catalog.jsonb_build_object(
    'runId', run_row.id,
    'status', CASE
      WHEN is_reconciled THEN 'reconciled'
      ELSE 'reconciliation_required'
    END,
    'expected', expected_counts,
    'actual', actual_counts,
    'matched', is_reconciled
  );
END;
$$;

REVOKE ALL ON FUNCTION public.commit_local_record_migration_with_contacts(
  uuid, text, jsonb, jsonb, jsonb, jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_local_record_migration_with_contacts(
  uuid, text, jsonb, jsonb, jsonb, jsonb
) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.sync_organisation_record_client_projection()
  FROM PUBLIC, anon, authenticated;
