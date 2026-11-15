-- Tenant and identity foundation for Deadline Monitor.

CREATE TABLE public.organisations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  registration_number text,
  service_package text NOT NULL DEFAULT 'starter'
    CHECK (service_package IN ('starter', 'standard', 'managed', 'custom')),
  status text NOT NULL DEFAULT 'pilot'
    CHECK (status IN ('active', 'pilot', 'suspended')),
  timezone text NOT NULL DEFAULT 'Africa/Johannesburg',
  reminder_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.organisations IS
  'Tenant organisations; UUIDs, not names, identify security boundaries.';

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (length(btrim(display_name)) > 0),
  email text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS
  'Application profile for an Auth user; credentials remain owned by Supabase Auth. Initial profile creation will be implemented through a trusted Auth trigger or workflow.';

CREATE TABLE public.organisation_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL
    REFERENCES public.organisations (id) ON DELETE CASCADE,
  user_id uuid NOT NULL
    REFERENCES public.profiles (id) ON DELETE CASCADE,
  role text NOT NULL
    CHECK (role IN ('administrator', 'consultant', 'client_administrator', 'client_user')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organisation_memberships_organisation_user_key
    UNIQUE (organisation_id, user_id)
);

COMMENT ON TABLE public.organisation_memberships IS
  'Active or inactive user membership and role within a tenant organisation.';

CREATE TABLE public.responsible_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL
    REFERENCES public.organisations (id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  email text,
  role_title text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.responsible_people IS
  'People assigned operational responsibility; a login profile is optional. Before write access is enabled, profile_id must be validated against an active membership in the same organisation.';

CREATE INDEX organisation_memberships_user_id_idx
  ON public.organisation_memberships (user_id);

-- The unique (organisation_id, user_id) constraint supplies the organisation_id index.
CREATE INDEX responsible_people_organisation_id_idx
  ON public.responsible_people (organisation_id);

CREATE INDEX responsible_people_profile_id_idx
  ON public.responsible_people (profile_id);

CREATE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_updated_at() IS
  'Sets updated_at consistently before updates to tenant foundation rows.';

CREATE TRIGGER organisations_set_updated_at
  BEFORE UPDATE ON public.organisations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER organisation_memberships_set_updated_at
  BEFORE UPDATE ON public.organisation_memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER responsible_people_set_updated_at
  BEFORE UPDATE ON public.responsible_people
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE FUNCTION public.is_active_member(target_organisation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organisation_memberships AS membership
      WHERE membership.organisation_id = target_organisation_id
        AND membership.user_id = (SELECT auth.uid())
        AND membership.active
    );
$$;

COMMENT ON FUNCTION public.is_active_member(uuid) IS
  'Checks whether the current Auth user has an active membership in a tenant.';

CREATE FUNCTION public.has_organisation_role(
  target_organisation_id uuid,
  allowed_roles text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organisation_memberships AS membership
      WHERE membership.organisation_id = target_organisation_id
        AND membership.user_id = (SELECT auth.uid())
        AND membership.active
        AND membership.role = ANY (allowed_roles)
    );
$$;

COMMENT ON FUNCTION public.has_organisation_role(uuid, text[]) IS
  'Checks an allowed role for the current Auth user in a tenant membership.';

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_active_member(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_organisation_role(uuid, text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_organisation_role(uuid, text[]) TO authenticated;

ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organisation_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responsible_people ENABLE ROW LEVEL SECURITY;

CREATE POLICY organisations_select_active_member
  ON public.organisations
  FOR SELECT
  TO authenticated
  USING (public.is_active_member(id));

CREATE POLICY profiles_select_own
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- Users can see their own row; elevated tenant roles can see tenant memberships.
CREATE POLICY organisation_memberships_select_self_or_authorised_role
  ON public.organisation_memberships
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.has_organisation_role(
      organisation_id,
      ARRAY['administrator', 'consultant', 'client_administrator']::text[]
    )
  );

CREATE POLICY responsible_people_select_active_member
  ON public.responsible_people
  FOR SELECT
  TO authenticated
  USING (public.is_active_member(organisation_id));

REVOKE ALL ON TABLE
  public.organisations,
  public.profiles,
  public.organisation_memberships,
  public.responsible_people
FROM anon, authenticated;

GRANT SELECT ON TABLE public.organisations TO authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT UPDATE (display_name) ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.organisation_memberships TO authenticated;
GRANT SELECT ON TABLE public.responsible_people TO authenticated;