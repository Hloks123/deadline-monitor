CREATE OR REPLACE FUNCTION public.audit_organisation_record_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_label_value text;
  before_values jsonb;
  after_values jsonb;
  event_field text;
BEGIN
  IF pg_catalog.current_setting('app.record_migration_import', true) = '1' THEN
    RETURN NEW;
  END IF;

  SELECT profile.display_name INTO actor_label_value
  FROM public.profiles AS profile
  WHERE profile.id = (SELECT auth.uid());

  IF TG_OP = 'INSERT' THEN
    after_values := pg_catalog.jsonb_build_object(
      'category', NEW.category,
      'category2', NEW.category2,
      'issueDate', NEW.issue_date,
      'expiryDate', NEW.expiry_date,
      'risk', NEW.risk,
      'status', NEW.status,
      'contactId', NEW.contact_id,
      'followUp', NEW.follow_up,
      'reminderDays', NEW.reminder_days,
      'reminderFrequency', NEW.reminder_frequency,
      'reminderLeadDays', NEW.reminder_lead_days,
      'clientVisible', NEW.client_visible,
      'deletedAt', NEW.deleted_at
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
      'issueDate', OLD.issue_date,
      'expiryDate', OLD.expiry_date,
      'risk', OLD.risk,
      'status', OLD.status,
      'contactId', OLD.contact_id,
      'followUp', OLD.follow_up,
      'reminderDays', OLD.reminder_days,
      'reminderFrequency', OLD.reminder_frequency,
      'reminderLeadDays', OLD.reminder_lead_days,
      'clientVisible', OLD.client_visible,
      'deletedAt', OLD.deleted_at
    );
    after_values := pg_catalog.jsonb_build_object(
      'category', NEW.category,
      'category2', NEW.category2,
      'issueDate', NEW.issue_date,
      'expiryDate', NEW.expiry_date,
      'risk', NEW.risk,
      'status', NEW.status,
      'contactId', NEW.contact_id,
      'followUp', NEW.follow_up,
      'reminderDays', NEW.reminder_days,
      'reminderFrequency', NEW.reminder_frequency,
      'reminderLeadDays', NEW.reminder_lead_days,
      'clientVisible', NEW.client_visible,
      'deletedAt', NEW.deleted_at
    );

    event_field := CASE
      WHEN OLD.contact_id IS DISTINCT FROM NEW.contact_id
        AND (before_values - 'contactId') = (after_values - 'contactId')
      THEN 'contact_id'
      ELSE 'record'
    END;

    INSERT INTO public.organisation_audit_events (
      organisation_id, record_id, record_name, actor_id, actor_label,
      action, field, previous_value, new_value, values_redacted, occurred_at
    )
    VALUES (
      NEW.organisation_id, NEW.id, NEW.name, (SELECT auth.uid()),
      COALESCE(actor_label_value, ''),
      'Monitored record updated', event_field,
      before_values::text, after_values::text, true, pg_catalog.now()
    );
  END IF;
  RETURN NEW;
END;
$$;
