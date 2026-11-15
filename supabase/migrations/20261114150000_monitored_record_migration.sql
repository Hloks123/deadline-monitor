CREATE TABLE public.organisation_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL
    REFERENCES public.organisations (id) ON DELETE CASCADE,
  legacy_source text,
  legacy_id text,
  legacy_checksum text,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
  category text NOT NULL CHECK (category IN (
    'COIDA', 'SARS', 'Vehicles', 'Company Documents', 'CIPC', 'Insurance',
    'Employees', 'Contracts', 'Property', 'Professional Registrations',
    'Health and Safety', 'Municipal', 'Other'
  )),
  category2 text NOT NULL DEFAULT '',
  issue_date date,
  expiry_date date NOT NULL,
  status text NOT NULL CHECK (status IN (
    'Current', 'Due soon', 'Expired', 'Awaiting client',
    'Awaiting confirmation', 'Completed', 'Paused'
  )),
  risk text NOT NULL CHECK (risk IN ('Low', 'Medium', 'High')),
  escalation_level text NOT NULL CHECK (escalation_level IN (
    'Normal', 'Follow-up required', 'Escalated', 'Critical'
  )),
  contact_id uuid REFERENCES public.organisation_contacts (id) ON DELETE SET NULL,
  legacy_contact_id text,
  contact_name text NOT NULL DEFAULT '',
  contact_email text NOT NULL DEFAULT '',
  follow_up date,
  reference_number text,
  next_action text,
  notes text,
  reminder_frequency text CHECK (reminder_frequency IS NULL OR reminder_frequency IN (
    'daily', 'weekly', 'monthly', 'custom'
  )),
  reminder_lead_days integer CHECK (
    reminder_lead_days IS NULL OR reminder_lead_days BETWEEN 0 AND 365
  ),
  client_created boolean NOT NULL DEFAULT false,
  client_visible boolean NOT NULL DEFAULT false,
  last_confirmed date,
  confirmed_by text,
  confirmation_method text,
  data_source text,
  reminder_days integer[] NOT NULL DEFAULT ARRAY[60, 30, 14, 7, 0],
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organisation_records_legacy_identity_check CHECK (
    (legacy_source IS NULL AND legacy_id IS NULL AND legacy_checksum IS NULL)
    OR (
      legacy_source IS NOT NULL
      AND length(btrim(legacy_source)) BETWEEN 1 AND 100
      AND legacy_id IS NOT NULL
      AND length(btrim(legacy_id)) BETWEEN 1 AND 200
      AND legacy_checksum IS NOT NULL
      AND legacy_checksum ~ '^[0-9a-f]{64}$'
    )
  ),
  CONSTRAINT organisation_records_reminder_days_count_check
    CHECK (cardinality(reminder_days) <= 12)
);

CREATE UNIQUE INDEX organisation_records_legacy_identity_key
  ON public.organisation_records (organisation_id, legacy_source, legacy_id)
  WHERE legacy_id IS NOT NULL;
CREATE INDEX organisation_records_organisation_expiry_idx
  ON public.organisation_records (organisation_id, expiry_date)
  WHERE deleted_at IS NULL;
CREATE INDEX organisation_records_organisation_status_idx
  ON public.organisation_records (organisation_id, status)
  WHERE deleted_at IS NULL;
CREATE INDEX organisation_records_organisation_contact_idx
  ON public.organisation_records (organisation_id, contact_id)
  WHERE contact_id IS NOT NULL;

CREATE TABLE public.organisation_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL
    REFERENCES public.organisations (id) ON DELETE CASCADE,
  record_id uuid NOT NULL
    REFERENCES public.organisation_records (id) ON DELETE CASCADE,
  legacy_source text,
  legacy_id text,
  legacy_checksum text,
  legacy_record_id text,
  unique_key text,
  communication_type text NOT NULL CHECK (
    communication_type IN ('Reminder', 'Follow-up')
  ),
  recipient text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  outcome text NOT NULL DEFAULT '',
  delivery_status text NOT NULL CHECK (delivery_status IN (
    'Draft', 'Approved', 'Sent', 'Delivered', 'Failed', 'Bounced', 'Suppressed'
  )),
  next_follow_up date,
  occurred_at timestamptz,
  legacy_date_text text NOT NULL DEFAULT '',
  related_task_id text,
  message_version text,
  reviewer text,
  decision text CHECK (decision IS NULL OR decision IN (
    'approved', 'suppressed', 'draft'
  )),
  reviewed_at timestamptz,
  failure_reason text,
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organisation_communications_legacy_identity_check CHECK (
    (legacy_source IS NULL AND legacy_id IS NULL AND legacy_checksum IS NULL)
    OR (
      legacy_source IS NOT NULL
      AND length(btrim(legacy_source)) BETWEEN 1 AND 100
      AND legacy_id IS NOT NULL
      AND length(btrim(legacy_id)) BETWEEN 1 AND 200
      AND legacy_checksum IS NOT NULL
      AND legacy_checksum ~ '^[0-9a-f]{64}$'
    )
  )
);

CREATE UNIQUE INDEX organisation_communications_legacy_identity_key
  ON public.organisation_communications (organisation_id, legacy_source, legacy_id)
  WHERE legacy_id IS NOT NULL;
CREATE INDEX organisation_communications_organisation_record_date_idx
  ON public.organisation_communications (organisation_id, record_id, occurred_at DESC);
CREATE INDEX organisation_communications_organisation_follow_up_idx
  ON public.organisation_communications (organisation_id, next_follow_up)
  WHERE next_follow_up IS NOT NULL;

CREATE TABLE public.organisation_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL
    REFERENCES public.organisations (id) ON DELETE CASCADE,
  record_id uuid REFERENCES public.organisation_records (id) ON DELETE SET NULL,
  legacy_source text,
  legacy_id text,
  legacy_checksum text,
  legacy_record_id text,
  entity_type text,
  entity_id text,
  entity_name text,
  record_name text NOT NULL DEFAULT '',
  actor_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  actor_label text NOT NULL DEFAULT '',
  action text NOT NULL CHECK (length(btrim(action)) BETWEEN 1 AND 500),
  field text,
  previous_value text,
  new_value text,
  values_redacted boolean NOT NULL DEFAULT false,
  occurred_at timestamptz,
  legacy_date_text text NOT NULL DEFAULT '',
  context text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organisation_audit_events_legacy_identity_check CHECK (
    (legacy_source IS NULL AND legacy_id IS NULL AND legacy_checksum IS NULL)
    OR (
      legacy_source IS NOT NULL
      AND length(btrim(legacy_source)) BETWEEN 1 AND 100
      AND legacy_id IS NOT NULL
      AND length(btrim(legacy_id)) BETWEEN 1 AND 200
      AND legacy_checksum IS NOT NULL
      AND legacy_checksum ~ '^[0-9a-f]{64}$'
    )
  )
);

CREATE UNIQUE INDEX organisation_audit_events_legacy_identity_key
  ON public.organisation_audit_events (organisation_id, legacy_source, legacy_id)
  WHERE legacy_id IS NOT NULL;
CREATE INDEX organisation_audit_events_organisation_date_idx
  ON public.organisation_audit_events (organisation_id, occurred_at DESC);
CREATE INDEX organisation_audit_events_organisation_record_idx
  ON public.organisation_audit_events (organisation_id, record_id)
  WHERE record_id IS NOT NULL;

CREATE TABLE public.data_migration_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL
    REFERENCES public.organisations (id) ON DELETE CASCADE,
  initiated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  source_type text NOT NULL CHECK (source_type = 'browser_local_storage'),
  source_legacy_client_id text NOT NULL
    CHECK (length(btrim(source_legacy_client_id)) BETWEEN 1 AND 200),
  source_device_id uuid,
  source_checksum text NOT NULL CHECK (source_checksum ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'previewed' CHECK (status IN (
    'previewed', 'completed', 'reconciled', 'reconciliation_required'
  )),
  source_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  imported_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  skipped_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  failed_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  reconciliation_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_summary jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  reconciled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT data_migration_runs_organisation_id_id_key
    UNIQUE (organisation_id, id)
);

CREATE TABLE public.data_migration_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL,
  migration_run_id uuid NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN (
    'record', 'communication', 'audit_event'
  )),
  legacy_id text NOT NULL CHECK (length(btrim(legacy_id)) BETWEEN 1 AND 200),
  legacy_checksum text NOT NULL CHECK (legacy_checksum ~ '^[0-9a-f]{64}$'),
  target_table text NOT NULL CHECK (target_table IN (
    'organisation_records',
    'organisation_communications',
    'organisation_audit_events'
  )),
  target_id uuid,
  status text NOT NULL CHECK (status IN ('imported', 'skipped', 'failed')),
  error_code text,
  error_message text,
  imported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT data_migration_items_run_organisation_fkey
    FOREIGN KEY (organisation_id, migration_run_id)
    REFERENCES public.data_migration_runs (organisation_id, id)
    ON DELETE CASCADE,
  CONSTRAINT data_migration_items_run_entity_legacy_key
    UNIQUE (migration_run_id, entity_type, legacy_id)
);

CREATE INDEX data_migration_runs_organisation_started_idx
  ON public.data_migration_runs (organisation_id, started_at DESC);
CREATE INDEX data_migration_items_run_status_idx
  ON public.data_migration_items (migration_run_id, status, entity_type);
CREATE INDEX data_migration_items_target_idx
  ON public.data_migration_items (organisation_id, target_table, target_id);

CREATE FUNCTION public.bump_organisation_record_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.organisation_id IS DISTINCT FROM OLD.organisation_id
    OR NEW.legacy_source IS DISTINCT FROM OLD.legacy_source
    OR NEW.legacy_id IS DISTINCT FROM OLD.legacy_id
    OR NEW.legacy_checksum IS DISTINCT FROM OLD.legacy_checksum
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Organisation scope and source identity cannot be changed.';
  END IF;

  NEW.version := OLD.version + 1;
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER organisation_records_bump_version
  BEFORE UPDATE ON public.organisation_records
  FOR EACH ROW EXECUTE FUNCTION public.bump_organisation_record_version();

CREATE FUNCTION public.validate_organisation_record_contact()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.contact_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.organisation_contacts AS contact
    WHERE contact.id = NEW.contact_id
      AND contact.organisation_id = NEW.organisation_id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Record contact must belong to the same organisation.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER organisation_records_validate_contact_scope
  BEFORE INSERT OR UPDATE ON public.organisation_records
  FOR EACH ROW EXECUTE FUNCTION public.validate_organisation_record_contact();

CREATE FUNCTION public.bump_organisation_communication_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.organisation_id IS DISTINCT FROM OLD.organisation_id
    OR NEW.record_id IS DISTINCT FROM OLD.record_id
    OR NEW.legacy_source IS DISTINCT FROM OLD.legacy_source
    OR NEW.legacy_id IS DISTINCT FROM OLD.legacy_id
    OR NEW.legacy_checksum IS DISTINCT FROM OLD.legacy_checksum
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Organisation scope and source identity cannot be changed.';
  END IF;

  NEW.version := OLD.version + 1;
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER organisation_communications_bump_version
  BEFORE UPDATE ON public.organisation_communications
  FOR EACH ROW EXECUTE FUNCTION public.bump_organisation_communication_version();

CREATE FUNCTION public.validate_organisation_record_reference()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.record_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.organisation_records AS record
    WHERE record.id = NEW.record_id
      AND record.organisation_id = NEW.organisation_id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'Referenced record must belong to the same organisation.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER organisation_audit_events_validate_record_scope
  BEFORE INSERT OR UPDATE
  ON public.organisation_audit_events
  FOR EACH ROW EXECUTE FUNCTION public.validate_organisation_record_reference();
CREATE TRIGGER organisation_communications_validate_record_scope
  BEFORE INSERT OR UPDATE
  ON public.organisation_communications
  FOR EACH ROW EXECUTE FUNCTION public.validate_organisation_record_reference();

CREATE TRIGGER data_migration_runs_set_updated_at
  BEFORE UPDATE ON public.data_migration_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.organisation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organisation_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organisation_audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_migration_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_migration_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.organisation_records,
  public.organisation_communications,
  public.organisation_audit_events,
  public.data_migration_runs,
  public.data_migration_items
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.data_migration_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.organisation_records,
  public.organisation_communications,
  public.organisation_audit_events,
  public.data_migration_runs,
  public.data_migration_items
TO service_role;

GRANT INSERT (
  organisation_id, name, category, category2, issue_date, expiry_date, status,
  risk, escalation_level, contact_id, legacy_contact_id, contact_name,
  contact_email, follow_up, reference_number, next_action, notes,
  reminder_frequency, reminder_lead_days, client_created, client_visible,
  last_confirmed, confirmed_by, confirmation_method, data_source,
  reminder_days, created_by, updated_by
) ON public.organisation_records TO authenticated;
GRANT UPDATE (
  name, category, category2, issue_date, expiry_date, status, risk,
  escalation_level, contact_id, legacy_contact_id, contact_name,
  contact_email, follow_up, reference_number, next_action, notes,
  reminder_frequency, reminder_lead_days, client_created, client_visible,
  last_confirmed, confirmed_by, confirmation_method, data_source,
  reminder_days, updated_by, deleted_at, deleted_by
) ON public.organisation_records TO authenticated;
GRANT INSERT (
  organisation_id, record_id, communication_type, recipient, subject, message,
  outcome, delivery_status, next_follow_up, occurred_at, legacy_date_text,
  related_task_id, message_version, reviewer, decision, reviewed_at,
  failure_reason, created_by, updated_by
) ON public.organisation_communications TO authenticated;
GRANT UPDATE (
  communication_type, recipient, subject, message, outcome, delivery_status,
  next_follow_up, occurred_at, legacy_date_text, related_task_id,
  message_version, reviewer, decision, reviewed_at, failure_reason, updated_by
) ON public.organisation_communications TO authenticated;
GRANT INSERT (
  organisation_id, initiated_by, source_type, source_legacy_client_id,
  source_device_id, source_checksum, source_counts, skipped_counts,
  validation_summary, error_summary
) ON public.data_migration_runs TO authenticated;

CREATE POLICY organisation_records_consultant_access
  ON public.organisation_records
  FOR SELECT
  TO authenticated
  USING (
    public.can_access_organisation(organisation_id)
    AND (
      public.has_platform_role(ARRAY['main_consultant']::text[])
      OR public.has_organisation_role(
        organisation_id,
        ARRAY['assistant_consultant']::text[]
      )
    )
  );
CREATE POLICY organisation_records_consultant_insert
  ON public.organisation_records
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_access_organisation(organisation_id)
    AND created_by = (SELECT auth.uid())
    AND updated_by = (SELECT auth.uid())
    AND (
      public.has_platform_role(ARRAY['main_consultant']::text[])
      OR public.has_organisation_role(
        organisation_id,
        ARRAY['assistant_consultant']::text[]
      )
    )
  );
CREATE POLICY organisation_records_consultant_update
  ON public.organisation_records
  FOR UPDATE
  TO authenticated
  USING (
    public.can_access_organisation(organisation_id)
    AND (
      public.has_platform_role(ARRAY['main_consultant']::text[])
      OR public.has_organisation_role(
        organisation_id,
        ARRAY['assistant_consultant']::text[]
      )
    )
  )
  WITH CHECK (
    public.can_access_organisation(organisation_id)
    AND updated_by = (SELECT auth.uid())
    AND (
      public.has_platform_role(ARRAY['main_consultant']::text[])
      OR public.has_organisation_role(
        organisation_id,
        ARRAY['assistant_consultant']::text[]
      )
    )
  );

CREATE POLICY organisation_communications_consultant_access
  ON public.organisation_communications
  FOR SELECT
  TO authenticated
  USING (
    public.can_access_organisation(organisation_id)
    AND (
      public.has_platform_role(ARRAY['main_consultant']::text[])
      OR public.has_organisation_role(
        organisation_id,
        ARRAY['assistant_consultant']::text[]
      )
    )
  );
CREATE POLICY organisation_communications_consultant_insert
  ON public.organisation_communications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_access_organisation(organisation_id)
    AND created_by = (SELECT auth.uid())
    AND updated_by = (SELECT auth.uid())
    AND (
      public.has_platform_role(ARRAY['main_consultant']::text[])
      OR public.has_organisation_role(
        organisation_id,
        ARRAY['assistant_consultant']::text[]
      )
    )
  );
CREATE POLICY organisation_communications_consultant_update
  ON public.organisation_communications
  FOR UPDATE
  TO authenticated
  USING (
    public.can_access_organisation(organisation_id)
    AND (
      public.has_platform_role(ARRAY['main_consultant']::text[])
      OR public.has_organisation_role(
        organisation_id,
        ARRAY['assistant_consultant']::text[]
      )
    )
  )
  WITH CHECK (
    public.can_access_organisation(organisation_id)
    AND updated_by = (SELECT auth.uid())
    AND (
      public.has_platform_role(ARRAY['main_consultant']::text[])
      OR public.has_organisation_role(
        organisation_id,
        ARRAY['assistant_consultant']::text[]
      )
    )
  );

CREATE POLICY organisation_audit_events_consultant_select
  ON public.organisation_audit_events
  FOR SELECT
  TO authenticated
  USING (
    public.can_access_organisation(organisation_id)
    AND (
      public.has_platform_role(ARRAY['main_consultant']::text[])
      OR public.has_organisation_role(
        organisation_id,
        ARRAY['assistant_consultant']::text[]
      )
    )
  );
CREATE POLICY organisation_audit_events_consultant_insert
  ON public.organisation_audit_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_access_organisation(organisation_id)
    AND (
      public.has_platform_role(ARRAY['main_consultant']::text[])
      OR public.has_organisation_role(
        organisation_id,
        ARRAY['assistant_consultant']::text[]
      )
    )
  );

CREATE FUNCTION public.audit_organisation_record_change()
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

  SELECT display_name
  INTO actor_label_value
  FROM public.profiles
  WHERE id = (SELECT auth.uid());

  IF TG_OP = 'INSERT' THEN
    after_values := pg_catalog.jsonb_build_object(
      'category', NEW.category,
      'category2', NEW.category2,
      'expiryDate', NEW.expiry_date,
      'risk', NEW.risk,
      'status', NEW.status
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
      'expiryDate', OLD.expiry_date,
      'risk', OLD.risk,
      'status', OLD.status
    );
    after_values := pg_catalog.jsonb_build_object(
      'category', NEW.category,
      'category2', NEW.category2,
      'expiryDate', NEW.expiry_date,
      'risk', NEW.risk,
      'status', NEW.status
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

CREATE TRIGGER organisation_records_audit_change
  AFTER INSERT OR UPDATE ON public.organisation_records
  FOR EACH ROW EXECUTE FUNCTION public.audit_organisation_record_change();

CREATE POLICY data_migration_runs_main_consultant_access
  ON public.data_migration_runs
  FOR SELECT
  TO authenticated
  USING (
    public.can_access_organisation(organisation_id)
    AND public.has_platform_role(ARRAY['main_consultant']::text[])
  );
CREATE POLICY data_migration_runs_main_consultant_insert
  ON public.data_migration_runs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.can_access_organisation(organisation_id)
    AND initiated_by = (SELECT auth.uid())
    AND public.has_platform_role(ARRAY['main_consultant']::text[])
  );
CREATE POLICY data_migration_items_main_consultant_select
  ON public.data_migration_items
  FOR SELECT
  TO authenticated
  USING (
    public.can_access_organisation(organisation_id)
    AND public.has_platform_role(ARRAY['main_consultant']::text[])
  );

CREATE FUNCTION public.commit_local_record_migration(
  target_run_id uuid,
  source_checksum_input text,
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
  target_id uuid;
  target_record_id uuid;
  stored_checksum text;
  legacy_record_id text;
  record_count integer := 0;
  communication_count integer := 0;
  audit_event_count integer := 0;
BEGIN
  IF (SELECT auth.uid()) IS NULL
    OR NOT public.has_platform_role(ARRAY['main_consultant']::text[])
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Only a main consultant can import monitored records.';
  END IF;

  IF pg_catalog.jsonb_typeof(records_input) <> 'array'
    OR pg_catalog.jsonb_typeof(communications_input) <> 'array'
    OR pg_catalog.jsonb_typeof(audit_events_input) <> 'array'
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Migration data must contain record, communication and audit arrays.';
  END IF;

  SELECT *
  INTO run_row
  FROM public.data_migration_runs
  WHERE id = target_run_id
    AND initiated_by = (SELECT auth.uid())
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '42501',
      MESSAGE = 'Migration run is unavailable.';
  END IF;

  IF run_row.source_checksum <> source_checksum_input THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Migration payload does not match the reviewed preview.';
  END IF;

  IF run_row.status IN ('completed', 'reconciled', 'reconciliation_required') THEN
    RETURN pg_catalog.jsonb_build_object(
      'runId', run_row.id,
      'status', run_row.status,
      'importedCounts', run_row.imported_counts,
      'skippedCounts', run_row.skipped_counts,
      'reconciliation', run_row.reconciliation_summary
    );
  END IF;

  IF run_row.status <> 'previewed'
    OR (run_row.source_counts ->> 'records')::integer
      <> pg_catalog.jsonb_array_length(records_input)
    OR (run_row.source_counts ->> 'communications')::integer
      <> pg_catalog.jsonb_array_length(communications_input)
    OR (run_row.source_counts ->> 'auditEvents')::integer
      <> pg_catalog.jsonb_array_length(audit_events_input)
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Migration payload does not match the reviewed preview.';
  END IF;

  PERFORM pg_catalog.set_config('app.record_migration_import', '1', true);

  FOR item IN SELECT value FROM pg_catalog.jsonb_array_elements(records_input)
  LOOP
    INSERT INTO public.organisation_records (
      organisation_id, legacy_source, legacy_id, legacy_checksum, name,
      category, category2, issue_date, expiry_date, status, risk,
      escalation_level, legacy_contact_id, contact_name, contact_email,
      follow_up, reference_number, next_action, notes, reminder_frequency,
      reminder_lead_days, client_created, last_confirmed, confirmed_by,
      confirmation_method, data_source, reminder_days, created_by, updated_by
    )
    VALUES (
      run_row.organisation_id,
      'doc-monitor-localstorage-v1',
      item ->> 'legacy_id',
      item ->> 'checksum',
      item ->> 'name',
      item ->> 'category',
      COALESCE(item ->> 'category2', ''),
      NULLIF(item ->> 'issue_date', '')::date,
      (item ->> 'expiry_date')::date,
      item ->> 'status',
      item ->> 'risk',
      item ->> 'escalation_level',
      NULLIF(item ->> 'legacy_contact_id', ''),
      COALESCE(item ->> 'contact_name', ''),
      COALESCE(item ->> 'contact_email', ''),
      NULLIF(item ->> 'follow_up', '')::date,
      NULLIF(item ->> 'reference_number', ''),
      NULLIF(item ->> 'next_action', ''),
      NULLIF(item ->> 'notes', ''),
      NULLIF(item ->> 'reminder_frequency', ''),
      NULLIF(item ->> 'reminder_lead_days', '')::integer,
      COALESCE((item ->> 'client_created')::boolean, false),
      NULLIF(item ->> 'last_confirmed', '')::date,
      NULLIF(item ->> 'confirmed_by', ''),
      NULLIF(item ->> 'confirmation_method', ''),
      NULLIF(item ->> 'data_source', ''),
      COALESCE(
        ARRAY(
          SELECT value::integer
          FROM pg_catalog.jsonb_array_elements_text(item -> 'reminder_days')
            AS reminder_days(value)
        ),
        ARRAY[]::integer[]
      ),
      (SELECT auth.uid()),
      (SELECT auth.uid())
    )
    ON CONFLICT (organisation_id, legacy_source, legacy_id)
      WHERE legacy_id IS NOT NULL
    DO NOTHING
    RETURNING id INTO target_id;

    IF target_id IS NULL THEN
      SELECT id, legacy_checksum
      INTO target_id, stored_checksum
      FROM public.organisation_records
      WHERE organisation_id = run_row.organisation_id
        AND legacy_source = 'doc-monitor-localstorage-v1'
        AND legacy_id = item ->> 'legacy_id'
      FOR UPDATE;

      IF stored_checksum IS DISTINCT FROM item ->> 'checksum' THEN
        RAISE EXCEPTION USING
          ERRCODE = '23505',
          MESSAGE = 'A legacy record ID already exists with different content.';
      END IF;
    END IF;

    INSERT INTO public.data_migration_items (
      organisation_id, migration_run_id, entity_type, legacy_id,
      legacy_checksum, target_table, target_id, status, imported_at
    )
    VALUES (
      run_row.organisation_id, run_row.id, 'record', item ->> 'legacy_id',
      item ->> 'checksum', 'organisation_records', target_id, 'imported',
      pg_catalog.now()
    );
    record_count := record_count + 1;
  END LOOP;

  FOR item IN SELECT value FROM pg_catalog.jsonb_array_elements(communications_input)
  LOOP
    legacy_record_id := item ->> 'record_legacy_id';
    SELECT id INTO target_record_id
    FROM public.organisation_records
    WHERE organisation_id = run_row.organisation_id
      AND legacy_source = 'doc-monitor-localstorage-v1'
      AND legacy_id = legacy_record_id;

    IF target_record_id IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23503',
        MESSAGE = 'A communication refers to a record that was not imported.';
    END IF;

    INSERT INTO public.organisation_communications (
      organisation_id, record_id, legacy_source, legacy_id, legacy_checksum,
      legacy_record_id, unique_key, communication_type, recipient, subject,
      message, outcome, delivery_status, next_follow_up, occurred_at,
      legacy_date_text, related_task_id, message_version, reviewer, decision,
      reviewed_at, failure_reason, created_by, updated_by
    )
    VALUES (
      run_row.organisation_id,
      target_record_id,
      'doc-monitor-localstorage-v1',
      item ->> 'legacy_id',
      item ->> 'checksum',
      legacy_record_id,
      NULLIF(item ->> 'unique_key', ''),
      item ->> 'communication_type',
      COALESCE(item ->> 'recipient', ''),
      COALESCE(item ->> 'subject', ''),
      COALESCE(item ->> 'message', ''),
      COALESCE(item ->> 'outcome', ''),
      item ->> 'delivery_status',
      NULLIF(item ->> 'next_follow_up', '')::date,
      NULLIF(item ->> 'occurred_at', '')::timestamptz,
      COALESCE(item ->> 'legacy_date_text', ''),
      NULLIF(item ->> 'related_task_id', ''),
      NULLIF(item ->> 'message_version', ''),
      NULLIF(item ->> 'reviewer', ''),
      NULLIF(item ->> 'decision', ''),
      NULLIF(item ->> 'reviewed_at', '')::timestamptz,
      NULLIF(item ->> 'failure_reason', ''),
      (SELECT auth.uid()),
      (SELECT auth.uid())
    )
    ON CONFLICT (organisation_id, legacy_source, legacy_id)
      WHERE legacy_id IS NOT NULL
    DO NOTHING
    RETURNING id INTO target_id;

    IF target_id IS NULL THEN
      SELECT id, legacy_checksum
      INTO target_id, stored_checksum
      FROM public.organisation_communications
      WHERE organisation_id = run_row.organisation_id
        AND legacy_source = 'doc-monitor-localstorage-v1'
        AND legacy_id = item ->> 'legacy_id'
      FOR UPDATE;

      IF stored_checksum IS DISTINCT FROM item ->> 'checksum' THEN
        RAISE EXCEPTION USING
          ERRCODE = '23505',
          MESSAGE = 'A legacy communication ID already exists with different content.';
      END IF;
    END IF;

    INSERT INTO public.data_migration_items (
      organisation_id, migration_run_id, entity_type, legacy_id,
      legacy_checksum, target_table, target_id, status, imported_at
    )
    VALUES (
      run_row.organisation_id, run_row.id, 'communication',
      item ->> 'legacy_id', item ->> 'checksum',
      'organisation_communications', target_id, 'imported', pg_catalog.now()
    );
    communication_count := communication_count + 1;
  END LOOP;

  FOR item IN SELECT value FROM pg_catalog.jsonb_array_elements(audit_events_input)
  LOOP
    legacy_record_id := NULLIF(item ->> 'record_legacy_id', '');
    target_record_id := NULL;
    IF legacy_record_id IS NOT NULL THEN
      SELECT id INTO target_record_id
      FROM public.organisation_records
      WHERE organisation_id = run_row.organisation_id
        AND legacy_source = 'doc-monitor-localstorage-v1'
        AND legacy_id = legacy_record_id;
    END IF;

    IF legacy_record_id IS NOT NULL AND target_record_id IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23503',
        MESSAGE = 'An audit event refers to a record that was not imported.';
    END IF;

    INSERT INTO public.organisation_audit_events (
      organisation_id, record_id, legacy_source, legacy_id, legacy_checksum,
      legacy_record_id, entity_type, entity_id, entity_name, record_name,
      actor_label, action, field, previous_value, new_value, values_redacted,
      occurred_at, legacy_date_text, context
    )
    VALUES (
      run_row.organisation_id,
      target_record_id,
      'doc-monitor-localstorage-v1',
      item ->> 'legacy_id',
      item ->> 'checksum',
      legacy_record_id,
      NULLIF(item ->> 'entity_type', ''),
      NULLIF(item ->> 'entity_id', ''),
      NULLIF(item ->> 'entity_name', ''),
      COALESCE(item ->> 'record_name', ''),
      COALESCE(item ->> 'actor_label', ''),
      item ->> 'action',
      NULLIF(item ->> 'field', ''),
      NULLIF(item ->> 'previous_value', ''),
      NULLIF(item ->> 'new_value', ''),
      COALESCE((item ->> 'values_redacted')::boolean, false),
      NULLIF(item ->> 'occurred_at', '')::timestamptz,
      COALESCE(item ->> 'legacy_date_text', ''),
      NULL
    )
    ON CONFLICT (organisation_id, legacy_source, legacy_id)
      WHERE legacy_id IS NOT NULL
    DO NOTHING
    RETURNING id INTO target_id;

    IF target_id IS NULL THEN
      SELECT id, legacy_checksum
      INTO target_id, stored_checksum
      FROM public.organisation_audit_events
      WHERE organisation_id = run_row.organisation_id
        AND legacy_source = 'doc-monitor-localstorage-v1'
        AND legacy_id = item ->> 'legacy_id'
      FOR UPDATE;

      IF stored_checksum IS DISTINCT FROM item ->> 'checksum' THEN
        RAISE EXCEPTION USING
          ERRCODE = '23505',
          MESSAGE = 'A legacy audit event ID already exists with different content.';
      END IF;
    END IF;

    INSERT INTO public.data_migration_items (
      organisation_id, migration_run_id, entity_type, legacy_id,
      legacy_checksum, target_table, target_id, status, imported_at
    )
    VALUES (
      run_row.organisation_id, run_row.id, 'audit_event', item ->> 'legacy_id',
      item ->> 'checksum', 'organisation_audit_events', target_id, 'imported',
      pg_catalog.now()
    );
    audit_event_count := audit_event_count + 1;
  END LOOP;

  UPDATE public.data_migration_runs
  SET status = 'completed',
      imported_counts = pg_catalog.jsonb_build_object(
        'records', record_count,
        'communications', communication_count,
        'auditEvents', audit_event_count
      ),
      completed_at = pg_catalog.now()
  WHERE id = run_row.id;

  RETURN pg_catalog.jsonb_build_object(
    'runId', run_row.id,
    'status', 'completed',
    'importedCounts', pg_catalog.jsonb_build_object(
      'records', record_count,
      'communications', communication_count,
      'auditEvents', audit_event_count
    ),
    'skippedCounts', run_row.skipped_counts
  );
END;
$$;

CREATE FUNCTION public.reconcile_local_record_migration(target_run_id uuid)
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

REVOKE ALL ON FUNCTION public.bump_organisation_record_version()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_organisation_communication_version()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_organisation_record_contact()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_organisation_record_reference()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_organisation_record_change()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.commit_local_record_migration(
  uuid, text, jsonb, jsonb, jsonb
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconcile_local_record_migration(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commit_local_record_migration(
  uuid, text, jsonb, jsonb, jsonb
) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_local_record_migration(uuid)
  TO authenticated, service_role;
