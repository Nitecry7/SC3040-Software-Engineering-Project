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
      'feedback_id', interaction_id,
      'rating', rating,
      'recorded_at', updated_at,
      'comment', CASE
        WHEN comment_expires_at > now() AND length(btrim(comment_redacted)) > 0 THEN comment_redacted
        ELSE NULL
      END
    ) ORDER BY updated_at DESC, interaction_id DESC)
    FROM (
      SELECT interaction_id, rating, updated_at, comment_redacted, comment_expires_at
      FROM public.chat_feedback
      WHERE updated_at >= p_start AND updated_at < p_end
      ORDER BY updated_at DESC, interaction_id DESC
      LIMIT 20
    ) AS recent
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.monitoring_recent_feedback(timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.monitoring_recent_feedback(timestamptz, timestamptz)
  TO service_role;

CREATE OR REPLACE FUNCTION public.monitoring_feedback_prior_message_count(p_feedback_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(SUM(
    (prior.user_message_redacted IS NOT NULL)::integer
    + (prior.assistant_message_redacted IS NOT NULL)::integer
  ), 0)::integer
  FROM public.chat_feedback AS feedback
  JOIN public.chat_interactions AS target
    ON target.interaction_id = feedback.interaction_id
  JOIN public.chat_interactions AS prior
    ON prior.conversation_id = target.conversation_id
   AND prior.created_at < target.created_at
   AND prior.content_expires_at > now()
  WHERE feedback.interaction_id = p_feedback_id
    AND target.conversation_id IS NOT NULL
    AND target.content_expires_at > now();
$$;

REVOKE ALL ON FUNCTION public.monitoring_feedback_prior_message_count(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.monitoring_feedback_prior_message_count(uuid)
  TO service_role;
