/*
  The image cleanup schedule is managed in Supabase Dashboard Cron now.
  Remove the earlier SQL/Vault-managed job if that migration was already
  applied. Do not drop pg_cron or Vault extensions because other project jobs
  may depend on them.
*/

DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  IF to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE $query$
      SELECT jobid
      FROM cron.job
      WHERE jobname = 'cleanup-unlinked-property-images-every-30-minutes'
    $query$ INTO existing_job_id;

    IF existing_job_id IS NOT NULL THEN
      EXECUTE format('SELECT cron.unschedule(%s)', existing_job_id);
    END IF;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.invoke_property_image_cleanup();
