GRANT SELECT ON TABLE
  public.organisation_records,
  public.organisation_communications,
  public.organisation_audit_events,
  public.data_migration_runs,
  public.data_migration_items
TO authenticated;
