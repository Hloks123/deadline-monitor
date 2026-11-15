CREATE TABLE public.organisation_workspace_snapshots (
  organisation_id uuid PRIMARY KEY
    REFERENCES public.organisations (id) ON DELETE CASCADE,
  snapshot_version smallint NOT NULL DEFAULT 1 CHECK (snapshot_version = 1),
  payload jsonb NOT NULL
    CHECK (
      pg_catalog.jsonb_typeof(payload) = 'object'
      AND payload ->> 'version' = '1'
    ),
  imported_by uuid NOT NULL REFERENCES public.profiles (id),
  imported_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.organisation_workspace_snapshots IS
  'Explicitly imported consultant operational data, isolated by organisation. Assistants can read assigned organisations; only main consultants can import.';

CREATE TRIGGER organisation_workspace_snapshots_set_updated_at
  BEFORE UPDATE ON public.organisation_workspace_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.organisation_workspace_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.organisation_workspace_snapshots
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE
  ON TABLE public.organisation_workspace_snapshots TO authenticated;

CREATE POLICY organisation_workspace_snapshots_select_assigned
  ON public.organisation_workspace_snapshots
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

CREATE POLICY organisation_workspace_snapshots_insert_main_consultant
  ON public.organisation_workspace_snapshots
  FOR INSERT
  TO authenticated
  WITH CHECK (
    imported_by = (SELECT auth.uid())
    AND public.has_platform_role(ARRAY['main_consultant']::text[])
    AND public.can_access_organisation(organisation_id)
  );

CREATE POLICY organisation_workspace_snapshots_update_main_consultant
  ON public.organisation_workspace_snapshots
  FOR UPDATE
  TO authenticated
  USING (
    public.has_platform_role(ARRAY['main_consultant']::text[])
    AND public.can_access_organisation(organisation_id)
  )
  WITH CHECK (
    imported_by = (SELECT auth.uid())
    AND public.has_platform_role(ARRAY['main_consultant']::text[])
    AND public.can_access_organisation(organisation_id)
  );
