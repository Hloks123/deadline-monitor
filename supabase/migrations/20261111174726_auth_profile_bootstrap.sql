-- Create a profile for each Auth user without granting tenant access.
CREATE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email, active)
  VALUES (
    NEW.id,
    pg_catalog.btrim(
      COALESCE(
        NULLIF(pg_catalog.btrim(NEW.raw_user_meta_data ->> 'display_name'), ''),
        NULLIF(pg_catalog.btrim(NEW.raw_user_meta_data ->> 'full_name'), ''),
        NULLIF(
          pg_catalog.btrim(
            pg_catalog.split_part(COALESCE(NEW.email, ''), '@', 1)
          ),
          ''
        ),
        'New user'
      )
    ),
    NEW.email,
    true
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_auth_user() IS
  'Trusted Auth trigger that creates a profile only; it never grants tenant access. Organisation access comes only from trusted organisation_memberships rows.';

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

COMMENT ON TABLE public.organisation_memberships IS
  'Tenant access is granted only through trusted organisation_memberships rows; Auth profile creation does not grant membership.';

-- A linked profile must be an active member of the responsible person's organisation.
CREATE FUNCTION public.validate_responsible_person_profile_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.organisation_memberships AS membership
    WHERE membership.organisation_id = NEW.organisation_id
      AND membership.user_id = NEW.profile_id
      AND membership.active
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'Responsible-person profile must be an active member of the organisation.';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_responsible_person_profile_membership() IS
  'Rejects responsible-person profile links without an active membership in the same organisation.';

REVOKE ALL ON FUNCTION public.validate_responsible_person_profile_membership()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER responsible_people_validate_profile_membership
  BEFORE INSERT OR UPDATE OF organisation_id, profile_id
  ON public.responsible_people
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_responsible_person_profile_membership();