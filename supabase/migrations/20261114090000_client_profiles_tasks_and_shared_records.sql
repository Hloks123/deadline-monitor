ALTER TABLE public.organisation_memberships
  ADD COLUMN is_primary boolean NOT NULL DEFAULT false,
  ADD COLUMN job_title text NOT NULL DEFAULT '';

WITH ranked_memberships AS (
  SELECT
    id,
    pg_catalog.row_number() OVER (
      PARTITION BY organisation_id
      ORDER BY created_at, id
    ) AS position
  FROM public.organisation_memberships
  WHERE role IN ('client_administrator', 'client_user')
)
UPDATE public.organisation_memberships AS membership
SET
  is_primary = ranked_memberships.position = 1,
  role = CASE
    WHEN ranked_memberships.position = 1 THEN 'client_administrator'
    ELSE 'client_user'
  END
FROM ranked_memberships
WHERE membership.id = ranked_memberships.id;

CREATE UNIQUE INDEX organisation_memberships_one_primary_client_user
  ON public.organisation_memberships (organisation_id)
  WHERE is_primary;

CREATE FUNCTION public.assign_first_client_membership_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.role IN ('client_administrator', 'client_user') THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(NEW.organisation_id::text, 0)
    );
    NEW.is_primary := NOT EXISTS (
      SELECT 1
      FROM public.organisation_memberships AS membership
      WHERE membership.organisation_id = NEW.organisation_id
        AND membership.role IN ('client_administrator', 'client_user')
    );
    NEW.role := CASE WHEN NEW.is_primary
      THEN 'client_administrator'
      ELSE 'client_user'
    END;
  ELSE
    NEW.is_primary := false;
    NEW.job_title := '';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER organisation_memberships_assign_first_client_role
  BEFORE INSERT ON public.organisation_memberships
  FOR EACH ROW EXECUTE FUNCTION public.assign_first_client_membership_role();

CREATE FUNCTION public.protect_primary_client_membership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.is_primary THEN
    IF NEW.role NOT IN ('client_administrator', 'client_user') THEN
      RAISE EXCEPTION 'The primary client profile cannot be converted to another role.'
        USING ERRCODE = '23514';
    END IF;
    NEW.is_primary := true;
    NEW.role := 'client_administrator';
  ELSIF NEW.role IN ('client_administrator', 'client_user') THEN
    NEW.is_primary := false;
    NEW.role := 'client_user';
  ELSE
    NEW.is_primary := false;
    NEW.job_title := '';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER organisation_memberships_protect_primary_client_user
  BEFORE UPDATE ON public.organisation_memberships
  FOR EACH ROW EXECUTE FUNCTION public.protect_primary_client_membership();

REVOKE ALL ON FUNCTION public.assign_first_client_membership_role()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_primary_client_membership()
  FROM PUBLIC, anon, authenticated;

CREATE TABLE public.organisation_client_records (
  organisation_id uuid NOT NULL
    REFERENCES public.organisations (id) ON DELETE CASCADE,
  record_id text NOT NULL CHECK (length(btrim(record_id)) > 0),
  source text NOT NULL
    CHECK (source IN ('consultant', 'client')),
  payload jsonb NOT NULL
    CHECK (pg_catalog.jsonb_typeof(payload) = 'object'),
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organisation_id, record_id)
);

CREATE TRIGGER organisation_client_records_set_updated_at
  BEFORE UPDATE ON public.organisation_client_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.organisation_client_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.organisation_client_records
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.organisation_client_records TO authenticated;

CREATE POLICY organisation_client_records_select_members
  ON public.organisation_client_records
  FOR SELECT
  TO authenticated
  USING (public.can_access_organisation(organisation_id));

CREATE FUNCTION public.replace_organisation_client_records(
  target_organisation_id uuid,
  imported_records jsonb,
  actor_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  imported_record jsonb;
  imported_record_id text;
BEGIN
  IF (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'This operation is available only through the trusted server.'
      USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.organisations AS organisation
    WHERE organisation.id = target_organisation_id
      AND organisation.status = 'active'
  ) THEN
    RAISE EXCEPTION 'The organisation is not active.'
      USING ERRCODE = '22023';
  END IF;
  IF actor_user_id IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = actor_user_id
      AND profile.active
  ) THEN
    RAISE EXCEPTION 'The acting user is not active.'
      USING ERRCODE = '22023';
  END IF;
  IF imported_records IS NULL
    OR pg_catalog.jsonb_typeof(imported_records) <> 'array'
  THEN
    RAISE EXCEPTION 'The imported record collection is invalid.'
      USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.jsonb_array_length(imported_records) > 10000 THEN
    RAISE EXCEPTION 'The imported record collection is too large.'
      USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.organisation_client_records AS company_record
  WHERE company_record.organisation_id = target_organisation_id
    AND company_record.source = 'consultant'
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_array_elements(imported_records) AS item(value)
      WHERE item.value ->> 'id' = company_record.record_id
    );

  FOR imported_record IN
    SELECT item.value
    FROM pg_catalog.jsonb_array_elements(imported_records) AS item(value)
  LOOP
    IF pg_catalog.jsonb_typeof(imported_record) <> 'object'
      OR pg_catalog.jsonb_typeof(imported_record -> 'id') <> 'string'
      OR pg_catalog.length(pg_catalog.btrim(imported_record ->> 'id')) = 0
    THEN
      RAISE EXCEPTION 'An imported record has an invalid identifier.'
        USING ERRCODE = '22023';
    END IF;
    imported_record_id := imported_record ->> 'id';

    INSERT INTO public.organisation_client_records (
      organisation_id,
      record_id,
      source,
      payload,
      created_by
    )
    VALUES (
      target_organisation_id,
      imported_record_id,
      'consultant',
      pg_catalog.jsonb_strip_nulls(
        pg_catalog.jsonb_build_object(
          'id', imported_record_id,
          'name', imported_record ->> 'name',
          'organisationId', target_organisation_id,
          'organisation', imported_record ->> 'organisation',
          'category', imported_record ->> 'category',
          'category2', imported_record ->> 'category2',
          'issueDate', imported_record ->> 'issueDate',
          'expiryDate', imported_record ->> 'expiryDate',
          'lastConfirmed', imported_record ->> 'lastConfirmed',
          'status', imported_record ->> 'status',
          'risk', imported_record ->> 'risk',
          'contact', imported_record ->> 'contact',
          'contactEmail', imported_record ->> 'contactEmail',
          'followUp', imported_record ->> 'followUp',
          'referenceNumber', imported_record ->> 'referenceNumber',
          'nextAction', imported_record ->> 'nextAction',
          'notes', imported_record ->> 'notes',
          'reminderFrequency', imported_record ->> 'reminderFrequency',
          'reminderLeadDays', imported_record -> 'reminderLeadDays',
          'clientCreated', false
        )
      ),
      actor_user_id
    )
    ON CONFLICT (organisation_id, record_id) DO UPDATE
    SET
      source = 'consultant',
      payload = EXCLUDED.payload,
      created_by = EXCLUDED.created_by
    WHERE public.organisation_client_records.source = 'consultant';
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_organisation_client_records(uuid, jsonb, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_organisation_client_records(uuid, jsonb, uuid)
  TO service_role;

INSERT INTO public.organisation_client_records (
  organisation_id,
  record_id,
  source,
  payload,
  created_by
)
SELECT
  snapshot.organisation_id,
  record.value ->> 'id',
  'consultant',
  pg_catalog.jsonb_strip_nulls(
    pg_catalog.jsonb_build_object(
      'id', record.value ->> 'id',
      'name', record.value ->> 'name',
      'organisationId', snapshot.organisation_id,
      'organisation', record.value ->> 'organisation',
      'category', record.value ->> 'category',
      'category2', record.value ->> 'category2',
      'issueDate', record.value ->> 'issueDate',
      'expiryDate', record.value ->> 'expiryDate',
      'lastConfirmed', record.value ->> 'lastConfirmed',
      'status', record.value ->> 'status',
      'risk', record.value ->> 'risk',
      'contact', record.value ->> 'contact',
      'contactEmail', record.value ->> 'contactEmail',
      'followUp', record.value ->> 'followUp',
      'referenceNumber', record.value ->> 'referenceNumber',
      'nextAction', record.value ->> 'nextAction',
      'notes', record.value ->> 'notes',
      'reminderFrequency', record.value ->> 'reminderFrequency',
      'reminderLeadDays', record.value -> 'reminderLeadDays',
      'clientCreated', false
    )
  ),
  snapshot.imported_by
FROM public.organisation_workspace_snapshots AS snapshot
CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(
  CASE
    WHEN pg_catalog.jsonb_typeof(snapshot.payload -> 'records') = 'array'
      THEN snapshot.payload -> 'records'
    ELSE '[]'::jsonb
  END
) AS record(value)
WHERE pg_catalog.jsonb_typeof(record.value) = 'object'
  AND pg_catalog.jsonb_typeof(record.value -> 'id') = 'string'
  AND pg_catalog.length(pg_catalog.btrim(record.value ->> 'id')) > 0
ON CONFLICT (organisation_id, record_id) DO UPDATE
SET
  source = 'consultant',
  payload = EXCLUDED.payload,
  created_by = EXCLUDED.created_by;

CREATE TABLE public.organisation_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL
    REFERENCES public.organisations (id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  assigned_to uuid NOT NULL REFERENCES public.profiles (id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  description text NOT NULL DEFAULT ''
    CHECK (length(description) <= 2000),
  due_date date,
  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'pending_acceptance'
    CHECK (
      status IN (
        'pending_acceptance',
        'accepted',
        'rejected',
        'in_progress',
        'completed',
        'cancelled'
      )
    ),
  response_note text NOT NULL DEFAULT ''
    CHECK (length(response_note) <= 1000),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organisation_tasks_creator_membership_fkey
    FOREIGN KEY (organisation_id, created_by)
    REFERENCES public.organisation_memberships (organisation_id, user_id)
    ON DELETE CASCADE,
  CONSTRAINT organisation_tasks_assignee_membership_fkey
    FOREIGN KEY (organisation_id, assigned_to)
    REFERENCES public.organisation_memberships (organisation_id, user_id)
    ON DELETE CASCADE
);

CREATE INDEX organisation_tasks_creator_idx
  ON public.organisation_tasks (organisation_id, created_by, created_at DESC);
CREATE INDEX organisation_tasks_assignee_idx
  ON public.organisation_tasks (organisation_id, assigned_to, due_date);

CREATE TRIGGER organisation_tasks_set_updated_at
  BEFORE UPDATE ON public.organisation_tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.organisation_tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.organisation_tasks
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.organisation_tasks TO authenticated;

CREATE POLICY organisation_tasks_select_participants
  ON public.organisation_tasks
  FOR SELECT
  TO authenticated
  USING (
    public.can_access_organisation(organisation_id)
    AND (
      created_by = (SELECT auth.uid())
      OR assigned_to = (SELECT auth.uid())
    )
  );

COMMENT ON COLUMN public.organisation_memberships.is_primary IS
  'Marks the first client profile in an organisation as its Senior Manager account.';
COMMENT ON TABLE public.organisation_client_records IS
  'Sanitized company-wide monitored-record metadata visible to every active member of the organisation.';
COMMENT ON TABLE public.organisation_tasks IS
  'Private one-to-one company task assignments; only the creator and assignee can read each task.';
