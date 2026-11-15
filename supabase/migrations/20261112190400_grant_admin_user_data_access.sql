GRANT SELECT ON TABLE
  public.profiles,
  public.platform_roles,
  public.organisation_memberships,
  public.organisations
TO service_role;

GRANT INSERT ON TABLE
  public.platform_roles,
  public.organisation_memberships
TO service_role;
