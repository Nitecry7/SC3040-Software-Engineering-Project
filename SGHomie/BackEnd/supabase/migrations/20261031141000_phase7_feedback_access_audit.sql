CREATE TABLE public.feedback_access_audit (
  admin_id uuid NOT NULL,
  feedback_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN (
    'view_transcript', 'export_markdown', 'export_text', 'export_json', 'copy_for_analysis'
  )),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Audit history must outlive feedback and interaction cleanup/deletion.
-- UUIDs are intentionally stored without foreign keys or cascade dependencies.
CREATE INDEX feedback_access_audit_feedback_created_idx
  ON public.feedback_access_audit (feedback_id, created_at DESC);
CREATE INDEX feedback_access_audit_admin_created_idx
  ON public.feedback_access_audit (admin_id, created_at DESC);

ALTER TABLE public.feedback_access_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.feedback_access_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.feedback_access_audit TO service_role;

CREATE OR REPLACE FUNCTION public.cleanup_feedback_access_audit()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.feedback_access_audit
  WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_feedback_access_audit() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_feedback_access_audit() TO service_role;
