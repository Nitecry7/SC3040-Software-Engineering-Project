/*
  Durable rate limiting for the public chatbot Edge Function.

  Only the server-side service role can call the counter function. The rate
  key is HMAC'd by the Edge Function before it reaches this table, so raw IP
  addresses are not stored here.
*/

CREATE TABLE IF NOT EXISTS public.chatbot_rate_limits (
  window_start timestamptz NOT NULL,
  rate_key text NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (window_start, rate_key)
);

ALTER TABLE public.chatbot_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.chatbot_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.chatbot_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_chatbot_rate_limit(
  requested_window_start timestamptz,
  requested_rate_key text,
  maximum_requests integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_request_count integer;
BEGIN
  IF maximum_requests < 1 OR requested_rate_key IS NULL OR requested_rate_key = '' THEN
    RETURN false;
  END IF;

  INSERT INTO public.chatbot_rate_limits (window_start, rate_key, request_count)
  VALUES (requested_window_start, requested_rate_key, 1)
  ON CONFLICT (window_start, rate_key)
  DO UPDATE SET request_count = public.chatbot_rate_limits.request_count + 1
  RETURNING request_count INTO current_request_count;

  -- Keep this table bounded without requiring another scheduled job.
  DELETE FROM public.chatbot_rate_limits
  WHERE window_start < now() - interval '10 minutes';

  RETURN current_request_count <= maximum_requests;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_chatbot_rate_limit(timestamptz, text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_chatbot_rate_limit(timestamptz, text, integer)
  TO service_role;
