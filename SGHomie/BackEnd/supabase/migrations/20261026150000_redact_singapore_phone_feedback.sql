-- Extend best-effort Singapore phone redaction for stored feedback comments.
-- Keep this as a new migration because the original Phase 4 migration may be applied.

CREATE OR REPLACE FUNCTION public.submit_chat_feedback(
  p_interaction_id uuid,
  p_rating text,
  p_reasons text[] DEFAULT '{}',
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_reasons text[] := COALESCE(p_reasons, '{}');
  v_comment text := p_comment;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authenticated user required' USING ERRCODE = '28000';
  END IF;
  IF p_rating NOT IN ('positive', 'negative') OR cardinality(v_reasons) > 7
    OR NOT (v_reasons <@ ARRAY['incorrect', 'not_relevant', 'unsupported', 'did_not_follow', 'too_verbose', 'too_vague', 'other']::text[])
    OR (p_rating = 'positive' AND (cardinality(v_reasons) > 0 OR p_comment IS NOT NULL))
    OR length(p_comment) > 1000 THEN
    RAISE EXCEPTION 'invalid feedback' USING ERRCODE = '22023';
  END IF;
  IF v_comment IS NOT NULL THEN
    v_comment := regexp_replace(v_comment, '\m(?:sk-(?:proj-)?[A-Za-z0-9_-]{16,}|Bearer[[:space:]]+[A-Za-z0-9._~+/-]{16,}|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,})\M', '[TOKEN_REDACTED]', 'gi');
    v_comment := regexp_replace(v_comment, '\m[STFG][0-9]{7}[A-Z]\M', '[NRIC_REDACTED]', 'gi');
    v_comment := regexp_replace(v_comment, '\m[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\M', '[EMAIL_REDACTED]', 'gi');
    v_comment := regexp_replace(v_comment, '(^|[^[:alnum:]$])((?:\+?65[ -]?)?[689][0-9]{3}[ -]?[0-9]{4})(?=$|[^[:alnum:]])', '\1[PHONE_REDACTED]', 'gi');
    v_comment := regexp_replace(v_comment, '(?:[0-9][ -]?){12,18}[0-9]', '[CARD_REDACTED]', 'g');
    v_comment := regexp_replace(v_comment, '\m(?:password|passcode|secret)[[:space:]]*[:=][[:space:]]*\S+', '[CREDENTIAL_REDACTED]', 'gi');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_interactions AS i
    WHERE i.interaction_id = p_interaction_id AND i.user_id = v_user_id
      AND i.status = 'success' AND i.content_expires_at > now()
  ) THEN
    RAISE EXCEPTION 'eligible interaction not found' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.chat_feedback (interaction_id, user_id, rating, reasons, comment_redacted)
  VALUES (p_interaction_id, v_user_id, p_rating, v_reasons, v_comment)
  ON CONFLICT (interaction_id) DO UPDATE
  SET rating = EXCLUDED.rating,
      reasons = EXCLUDED.reasons,
      comment_redacted = EXCLUDED.comment_redacted,
      comment_expires_at = now() + interval '30 days',
      updated_at = now();
  RETURN jsonb_build_object('saved', true, 'rating', p_rating, 'reasons', v_reasons);
END;
$$;

REVOKE ALL ON FUNCTION public.submit_chat_feedback(uuid, text, text[], text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.submit_chat_feedback(uuid, text, text[], text) TO authenticated;
