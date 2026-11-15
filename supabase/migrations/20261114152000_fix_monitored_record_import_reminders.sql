DO $fix_import_reminder_array$
DECLARE
  function_definition text;
BEGIN
  function_definition := pg_catalog.pg_get_functiondef(
    'public.commit_local_record_migration(uuid,text,jsonb,jsonb,jsonb)'::regprocedure
  );

  IF pg_catalog.strpos(function_definition, 'reminder_day::integer') > 0 THEN
    function_definition := pg_catalog.replace(
      function_definition,
      'reminder_day::integer',
      'value::integer'
    );
    EXECUTE function_definition;
  ELSIF pg_catalog.strpos(function_definition, 'value::integer') = 0 THEN
    RAISE EXCEPTION
      'The monitored-record import function has an unexpected reminder array implementation.';
  END IF;
END;
$fix_import_reminder_array$;
