-- Privacy-conscious chatbot telemetry and caller-owned response feedback.

CREATE TABLE public.chat_interactions (
  interaction_id uuid PRIMARY KEY,
  request_id uuid NOT NULL UNIQUE CHECK (request_id = interaction_id),
  conversation_id uuid,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL CHECK (status IN (
    'started', 'success', 'quota_denied', 'sensitive_input_blocked',
    'provider_error', 'tool_error', 'internal_error', 'aborted'
  )),
  error_code text,
  provider text CHECK (provider IS NULL OR provider IN ('openrouter', 'openai')),
  requested_model text,
  resolved_model text,
  prompt_version text NOT NULL,
  streaming boolean NOT NULL,
  tool_name text,
  tool_called boolean NOT NULL DEFAULT false,
  tool_success boolean,
  tool_result_count integer CHECK (tool_result_count IS NULL OR tool_result_count >= 0),
  input_token_count integer CHECK (input_token_count IS NULL OR input_token_count >= 0),
  output_token_count integer CHECK (output_token_count IS NULL OR output_token_count >= 0),
  total_token_count integer CHECK (total_token_count IS NULL OR total_token_count >= 0),
  total_latency_ms integer CHECK (total_latency_ms IS NULL OR total_latency_ms >= 0),
  provider_latency_ms integer CHECK (provider_latency_ms IS NULL OR provider_latency_ms >= 0),
  tool_latency_ms integer CHECK (tool_latency_ms IS NULL OR tool_latency_ms >= 0),
  first_output_event_ms integer CHECK (first_output_event_ms IS NULL OR first_output_event_ms >= 0),
  quota_tier text CHECK (quota_tier IS NULL OR quota_tier IN ('standard', 'tester', 'privileged')),
  quota_result text,
  fallback_used boolean NOT NULL DEFAULT false,
  user_message_redacted text,
  assistant_message_redacted text,
  content_expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

CREATE TABLE public.chat_provider_calls (
  interaction_id uuid NOT NULL REFERENCES public.chat_interactions(interaction_id) ON DELETE CASCADE,
  sequence integer NOT NULL CHECK (sequence > 0),
  provider text NOT NULL CHECK (provider IN ('openrouter', 'openai')),
  requested_model text NOT NULL,
  resolved_model text,
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  latency_ms integer CHECK (latency_ms IS NULL OR latency_ms >= 0),
  input_token_count integer CHECK (input_token_count IS NULL OR input_token_count >= 0),
  output_token_count integer CHECK (output_token_count IS NULL OR output_token_count >= 0),
  total_token_count integer CHECK (total_token_count IS NULL OR total_token_count >= 0),
  status text NOT NULL CHECK (status IN ('success', 'provider_error', 'capacity_denied')),
  error_code text,
  PRIMARY KEY (interaction_id, sequence)
);

CREATE TABLE public.chat_feedback (
  interaction_id uuid PRIMARY KEY REFERENCES public.chat_interactions(interaction_id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  rating text NOT NULL CHECK (rating IN ('positive', 'negative')),
  reasons text[] NOT NULL DEFAULT '{}',
  comment_redacted text,
  comment_expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality(reasons) <= 7),
  CHECK (reasons <@ ARRAY['incorrect', 'not_relevant', 'unsupported', 'did_not_follow', 'too_verbose', 'too_vague', 'other']::text[]),
  CHECK (rating = 'negative' OR (cardinality(reasons) = 0 AND comment_redacted IS NULL))
);

CREATE INDEX chat_interactions_user_created_idx ON public.chat_interactions (user_id, created_at DESC);
CREATE INDEX chat_interactions_conversation_created_idx ON public.chat_interactions (conversation_id, created_at);
CREATE INDEX chat_interactions_content_expiry_idx ON public.chat_interactions (content_expires_at)
  WHERE user_message_redacted IS NOT NULL OR assistant_message_redacted IS NOT NULL;
CREATE INDEX chat_interactions_model_prompt_idx ON public.chat_interactions (prompt_version, provider, resolved_model, created_at DESC);
CREATE INDEX chat_provider_calls_interaction_idx ON public.chat_provider_calls (interaction_id, sequence);
CREATE INDEX chat_feedback_updated_idx ON public.chat_feedback (updated_at DESC);

ALTER TABLE public.chat_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_provider_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_feedback ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.chat_interactions, public.chat_provider_calls, public.chat_feedback FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_interactions, public.chat_provider_calls, public.chat_feedback TO service_role;

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
    v_comment := regexp_replace(v_comment, '\m(?:\+65[ -]?)?[89][0-9]{3}[ -]?[0-9]{4}\M', '[PHONE_REDACTED]', 'gi');
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

CREATE OR REPLACE FUNCTION public.cleanup_chat_content()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_interactions integer;
  v_feedback integer;
  v_incomplete integer;
BEGIN
  UPDATE public.chat_interactions
  SET status = 'internal_error', error_code = 'incomplete_timeout', completed_at = now(),
      user_message_redacted = NULL, assistant_message_redacted = NULL,
      user_id = NULL, conversation_id = NULL
  WHERE status = 'started' AND created_at < now() - interval '1 hour';
  GET DIAGNOSTICS v_incomplete = ROW_COUNT;

  UPDATE public.chat_interactions
  SET user_message_redacted = NULL,
      assistant_message_redacted = NULL,
      user_id = NULL,
      conversation_id = NULL
  WHERE content_expires_at <= now()
    AND (user_id IS NOT NULL OR conversation_id IS NOT NULL
      OR user_message_redacted IS NOT NULL OR assistant_message_redacted IS NOT NULL);
  GET DIAGNOSTICS v_interactions = ROW_COUNT;

  UPDATE public.chat_feedback
  SET comment_redacted = NULL,
      user_id = NULL
  WHERE comment_expires_at <= now() AND (comment_redacted IS NOT NULL OR user_id IS NOT NULL);
  GET DIAGNOSTICS v_feedback = ROW_COUNT;

  RETURN jsonb_build_object('incomplete_interactions_closed', v_incomplete,
    'interaction_content_cleared', v_interactions, 'feedback_comments_cleared', v_feedback);
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_chat_content() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_chat_content() TO service_role;
