GRANT UPDATE ON TABLE
  public.organisations,
  public.profiles,
  public.platform_roles,
  public.organisation_memberships
TO service_role;

CREATE TABLE public.organisation_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL
    REFERENCES public.organisations (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  email text,
  phone text,
  role_title text,
  authorised boolean NOT NULL DEFAULT true,
  primary_contact boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organisation_contacts_authorised_email_check
    CHECK (NOT authorised OR (email IS NOT NULL AND position('@' IN email) > 1))
);

CREATE INDEX organisation_contacts_organisation_id_idx
  ON public.organisation_contacts (organisation_id);

CREATE UNIQUE INDEX organisation_contacts_one_primary_per_organisation
  ON public.organisation_contacts (organisation_id)
  WHERE active AND authorised AND primary_contact;

CREATE TRIGGER organisation_contacts_set_updated_at
  BEFORE UPDATE ON public.organisation_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.organisation_contacts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.organisation_contacts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.organisation_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.organisation_contacts TO service_role;

CREATE POLICY organisation_contacts_select_active_member
  ON public.organisation_contacts
  FOR SELECT
  TO authenticated
  USING (active AND public.can_access_organisation(organisation_id));

CREATE FUNCTION public.replace_organisation_contacts(
  target_organisation_id uuid,
  contacts_input jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF pg_catalog.jsonb_typeof(contacts_input) <> 'array' THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Contacts must be a JSON array.';
  END IF;

  UPDATE public.organisation_contacts
  SET active = false
  WHERE organisation_id = target_organisation_id
    AND active;

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
  SELECT
    target_organisation_id,
    pg_catalog.btrim(contact.name),
    NULLIF(pg_catalog.btrim(contact.email), ''),
    NULLIF(pg_catalog.btrim(contact.phone), ''),
    NULLIF(pg_catalog.btrim(contact.role_title), ''),
    contact.authorised,
    contact.primary_contact,
    true
  FROM pg_catalog.jsonb_to_recordset(contacts_input) AS contact(
    name text,
    email text,
    phone text,
    role_title text,
    authorised boolean,
    primary_contact boolean
  );
END;
$$;

REVOKE ALL ON FUNCTION public.replace_organisation_contacts(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_organisation_contacts(uuid, jsonb)
  TO service_role;
