CREATE OR REPLACE FUNCTION public.monitoring_recent_feedback(p_start timestamptz, p_end timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_start IS NULL OR p_end IS NULL OR p_end <= p_start THEN
    RAISE EXCEPTION 'invalid monitoring range' USING ERRCODE = '22023';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'rating', rating,
      'recorded_at', updated_at,
      'comment', comment_redacted
    ) ORDER BY updated_at DESC)
    FROM (
      SELECT rating, updated_at, comment_redacted
      FROM public.chat_feedback
      WHERE updated_at >= p_start AND updated_at < p_end
        AND comment_redacted IS NOT NULL
        AND length(btrim(comment_redacted)) > 0
        AND comment_expires_at > now()
      ORDER BY updated_at DESC
      LIMIT 20
    ) AS recent
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.monitoring_recent_feedback(timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.monitoring_recent_feedback(timestamptz, timestamptz)
  TO service_role;
