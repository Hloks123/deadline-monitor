-- Finalize platform and organisation-scoped role semantics.

CREATE TABLE public.platform_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('administrator', 'main_consultant')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_roles_user_role_key UNIQUE (user_id, role)
);

COMMENT ON TABLE public.platform_roles IS
  'Trusted global platform roles. Authenticated users cannot insert, update, or delete platform-role rows.';

CREATE TRIGGER platform_roles_set_updated_at
  BEFORE UPDATE ON public.platform_roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.platform_roles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.platform_roles FROM PUBLIC, anon, authenticated;

-- Legacy tenant roles do not prove global authority. Preserve the existing
-- consultant/admin assignment only within its current organisation.
ALTER TABLE public.organisation_memberships
  DROP CONSTRAINT organisation_memberships_role_check;

UPDATE public.organisation_memberships
SET role = 'assistant_consultant'
WHERE role IN ('administrator', 'consultant');

ALTER TABLE public.organisation_memberships
  ADD CONSTRAINT organisation_memberships_role_check
  CHECK (role IN ('assistant_consultant', 'client_administrator', 'client_user'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.organisations
    GROUP BY pg_catalog.lower(pg_catalog.btrim(name))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Organisation names must be unique ignoring case and surrounding whitespace before this migration can continue.';
  END IF;
END;
$$;

CREATE UNIQUE INDEX organisations_normalized_name_key
  ON public.organisations (pg_catalog.lower(pg_catalog.btrim(name)));

CREATE OR REPLACE FUNCTION public.has_platform_role(target_roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS profile
      JOIN public.platform_roles AS platform_role
        ON platform_role.user_id = profile.id
      WHERE profile.id = (SELECT auth.uid())
        AND profile.active
        AND platform_role.active
        AND platform_role.role = ANY (target_roles)
    );
$$;

CREATE OR REPLACE FUNCTION public.get_current_platform_roles()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    array_agg(platform_role.role ORDER BY platform_role.role),
    ARRAY[]::text[]
  )
  FROM public.platform_roles AS platform_role
  JOIN public.profiles AS profile
    ON profile.id = platform_role.user_id
  WHERE platform_role.user_id = (SELECT auth.uid())
    AND platform_role.active
    AND profile.active;
$$;

COMMENT ON FUNCTION public.get_current_platform_roles() IS
  'Returns only the current authenticated user''s own active platform roles.';

CREATE OR REPLACE FUNCTION public.can_access_organisation(
  target_organisation_id uuid
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
      FROM public.profiles AS profile
      WHERE profile.id = (SELECT auth.uid())
        AND profile.active
    )
    AND EXISTS (
      SELECT 1
      FROM public.organisations AS organisation
      WHERE organisation.id = target_organisation_id
        AND organisation.status = 'active'
        AND (
          public.has_platform_role(ARRAY['main_consultant']::text[])
          OR EXISTS (
            SELECT 1
            FROM public.organisation_memberships AS membership
            WHERE membership.organisation_id = organisation.id
              AND membership.user_id = (SELECT auth.uid())
              AND membership.active
              AND membership.role IN (
                'assistant_consultant',
                'client_administrator',
                'client_user'
              )
          )
        )
    );
$$;

COMMENT ON FUNCTION public.can_access_organisation(uuid) IS
  'Main consultants can access all active organisations; assistants and client users require an active organisation membership. Platform administrators receive no automatic operational tenant access.';

CREATE OR REPLACE FUNCTION public.is_active_member(
  target_organisation_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.can_access_organisation(target_organisation_id);
$$;

CREATE OR REPLACE FUNCTION public.has_organisation_role(
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
      FROM public.profiles AS profile
      JOIN public.organisation_memberships AS membership
        ON membership.user_id = profile.id
      JOIN public.organisations AS organisation
        ON organisation.id = membership.organisation_id
      WHERE profile.id = (SELECT auth.uid())
        AND profile.active
        AND membership.organisation_id = target_organisation_id
        AND membership.active
        AND membership.role = ANY (allowed_roles)
        AND organisation.status = 'active'
    );
$$;

DROP POLICY organisations_select_active_member
  ON public.organisations;
CREATE POLICY organisations_select_active_member
  ON public.organisations
  FOR SELECT
  TO authenticated
  USING (public.can_access_organisation(id));

DROP POLICY organisation_memberships_select_self_or_authorised_role
  ON public.organisation_memberships;
CREATE POLICY organisation_memberships_select_self_or_authorised_role
  ON public.organisation_memberships
  FOR SELECT
  TO authenticated
  USING (
    (
      user_id = (SELECT auth.uid())
      AND public.can_access_organisation(organisation_id)
    )
    OR (
      public.has_platform_role(ARRAY['main_consultant']::text[])
      AND EXISTS (
        SELECT 1
        FROM public.organisations AS organisation
        WHERE organisation.id = organisation_memberships.organisation_id
          AND organisation.status = 'active'
      )
    )
  );

REVOKE ALL ON TABLE public.platform_roles FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.has_platform_role(text[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_platform_role(text[]) TO authenticated;
REVOKE ALL ON FUNCTION public.get_current_platform_roles()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_platform_roles() TO authenticated;
REVOKE ALL ON FUNCTION public.can_access_organisation(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_organisation(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_organisation_role(uuid, text[])
  TO authenticated;
