-- Server-authoritative chatbot usage policy and bounded quota state.
-- Tier/configuration and usage tables are not directly exposed through the Data API.

CREATE TABLE public.chat_quota_tier_config (
  tier text PRIMARY KEY CHECK (tier IN ('standard', 'tester', 'privileged')),
  burst_limit integer NOT NULL CHECK (burst_limit > 0),
  daily_limit integer CHECK (daily_limit IS NULL OR daily_limit > 0),
  abuse_threshold integer NOT NULL CHECK (abuse_threshold > 0),
  abuse_window_seconds integer NOT NULL CHECK (abuse_window_seconds > 0),
  cooldown_seconds integer NOT NULL CHECK (cooldown_seconds > 0)
);

INSERT INTO public.chat_quota_tier_config
  (tier, burst_limit, daily_limit, abuse_threshold, abuse_window_seconds, cooldown_seconds)
VALUES
  ('standard', 2, 5, 5, 600, 900),
  ('tester', 10, 25, 5, 600, 900),
  ('privileged', 20, NULL, 5, 600, 900);

CREATE TABLE public.chat_quota_assignments (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tier text NOT NULL REFERENCES public.chat_quota_tier_config(tier),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chat_provider_capacity_config (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  minute_limit integer NOT NULL CHECK (minute_limit > 0),
  daily_limit integer NOT NULL CHECK (daily_limit > 0)
);

INSERT INTO public.chat_provider_capacity_config (singleton, minute_limit, daily_limit)
VALUES (true, 18, 45);

CREATE TABLE public.chat_user_quota_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  minute_window_started_at timestamptz NOT NULL DEFAULT now(),
  minute_count integer NOT NULL DEFAULT 0 CHECK (minute_count >= 0),
  singapore_day date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Singapore')::date,
  daily_count integer NOT NULL DEFAULT 0 CHECK (daily_count >= 0),
  abuse_window_started_at timestamptz NOT NULL DEFAULT now(),
  abuse_count integer NOT NULL DEFAULT 0 CHECK (abuse_count >= 0),
  cooldown_until timestamptz
);

CREATE TABLE public.chat_provider_capacity_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  minute_window_started_at timestamptz NOT NULL DEFAULT now(),
  minute_count integer NOT NULL DEFAULT 0 CHECK (minute_count >= 0),
  singapore_day date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Singapore')::date,
  daily_count integer NOT NULL DEFAULT 0 CHECK (daily_count >= 0)
);

ALTER TABLE public.chat_quota_tier_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_quota_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_provider_capacity_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_user_quota_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_provider_capacity_state ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.chat_quota_tier_config, public.chat_quota_assignments,
  public.chat_provider_capacity_config, public.chat_user_quota_state,
  public.chat_provider_capacity_state FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reserve_chat_user_interaction()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_now timestamptz;
  v_today date;
  v_tier text;
  v_config public.chat_quota_tier_config%ROWTYPE;
  v_state public.chat_user_quota_state%ROWTYPE;
  v_daily_reset timestamptz;
  v_minute_reset timestamptz;
  v_retry integer;
  v_code text;
BEGIN
  v_now := clock_timestamp();
  v_today := (v_now AT TIME ZONE 'Asia/Singapore')::date;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authenticated user required' USING ERRCODE = '28000';
  END IF;

  SELECT a.tier INTO v_tier
  FROM public.chat_quota_assignments AS a
  WHERE a.user_id = v_user_id;
  v_tier := COALESCE(v_tier, 'standard');

  SELECT * INTO STRICT v_config
  FROM public.chat_quota_tier_config AS c
  WHERE c.tier = v_tier;

  INSERT INTO public.chat_user_quota_state (user_id, singapore_day)
  VALUES (v_user_id, v_today)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO STRICT v_state
  FROM public.chat_user_quota_state AS s
  WHERE s.user_id = v_user_id
  FOR UPDATE;

  v_daily_reset := ((v_today + 1)::timestamp AT TIME ZONE 'Asia/Singapore');
  IF v_state.singapore_day <> v_today THEN
    UPDATE public.chat_user_quota_state
    SET singapore_day = v_today, daily_count = 0
    WHERE user_id = v_user_id;
    v_state.daily_count := 0;
    v_state.singapore_day := v_today;
  END IF;
  IF v_now - v_state.minute_window_started_at >= interval '1 minute' THEN
    UPDATE public.chat_user_quota_state
    SET minute_window_started_at = v_now, minute_count = 0
    WHERE user_id = v_user_id;
    v_state.minute_window_started_at := v_now;
    v_state.minute_count := 0;
  END IF;
  v_minute_reset := v_state.minute_window_started_at + interval '1 minute';

  IF v_state.cooldown_until IS NOT NULL AND v_state.cooldown_until > v_now THEN
    RETURN jsonb_build_object('allowed', false, 'code', 'CHAT_COOLDOWN_ACTIVE',
      'retry_after_seconds', GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_state.cooldown_until - v_now)))::integer),
      'retry_at', v_state.cooldown_until,
      'quota', jsonb_build_object('tier', v_tier, 'minute_limit', v_config.burst_limit,
        'minute_remaining', GREATEST(v_config.burst_limit - v_state.minute_count, 0),
        'daily_limit', v_config.daily_limit,
        'daily_remaining', CASE WHEN v_config.daily_limit IS NULL THEN NULL ELSE GREATEST(v_config.daily_limit - v_state.daily_count, 0) END,
        'daily_reset_at', ((v_today + 1)::timestamp AT TIME ZONE 'Asia/Singapore'),
        'cooldown_until', v_state.cooldown_until));
  END IF;

  IF v_config.daily_limit IS NOT NULL AND v_state.daily_count >= v_config.daily_limit THEN
    RETURN jsonb_build_object('allowed', false, 'code', 'CHAT_USER_DAILY_LIMIT',
      'retry_at', v_daily_reset, 'quota', jsonb_build_object(
        'tier', v_tier, 'minute_limit', v_config.burst_limit,
        'minute_remaining', GREATEST(v_config.burst_limit - v_state.minute_count, 0),
        'daily_limit', v_config.daily_limit, 'daily_remaining', 0,
        'daily_reset_at', v_daily_reset, 'cooldown_until', NULL));
  END IF;

  IF v_state.minute_count >= v_config.burst_limit THEN
    IF v_now - v_state.abuse_window_started_at >= make_interval(secs => v_config.abuse_window_seconds) THEN
      v_state.abuse_window_started_at := v_now;
      v_state.abuse_count := 0;
    END IF;
    v_state.abuse_count := v_state.abuse_count + 1;
    IF v_state.abuse_count >= v_config.abuse_threshold THEN
      v_state.cooldown_until := v_now + make_interval(secs => v_config.cooldown_seconds);
      v_code := 'CHAT_COOLDOWN_ACTIVE';
    ELSE
      v_code := 'CHAT_USER_BURST_LIMIT';
    END IF;
    UPDATE public.chat_user_quota_state
    SET abuse_window_started_at = v_state.abuse_window_started_at,
        abuse_count = v_state.abuse_count,
        cooldown_until = v_state.cooldown_until
    WHERE user_id = v_user_id;
    v_retry := CASE WHEN v_state.cooldown_until > v_now
      THEN GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_state.cooldown_until - v_now)))::integer)
      ELSE GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_minute_reset - v_now)))::integer) END;
    RETURN jsonb_build_object('allowed', false, 'code', v_code,
      'retry_after_seconds', v_retry,
      'retry_at', CASE WHEN v_state.cooldown_until > v_now THEN v_state.cooldown_until ELSE v_minute_reset END,
      'quota', jsonb_build_object('tier', v_tier, 'minute_limit', v_config.burst_limit,
        'minute_remaining', 0, 'daily_limit', v_config.daily_limit,
        'daily_remaining', CASE WHEN v_config.daily_limit IS NULL THEN NULL ELSE GREATEST(v_config.daily_limit - v_state.daily_count, 0) END,
        'daily_reset_at', v_daily_reset, 'cooldown_until', v_state.cooldown_until));
  END IF;

  UPDATE public.chat_user_quota_state
  SET minute_count = v_state.minute_count + 1,
      daily_count = CASE WHEN singapore_day = v_today THEN daily_count + 1 ELSE 1 END
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object('allowed', true, 'quota', jsonb_build_object(
    'tier', v_tier, 'minute_limit', v_config.burst_limit,
    'minute_remaining', GREATEST(v_config.burst_limit - v_state.minute_count - 1, 0),
    'daily_limit', v_config.daily_limit,
    'daily_remaining', CASE WHEN v_config.daily_limit IS NULL THEN NULL ELSE GREATEST(v_config.daily_limit - v_state.daily_count - 1, 0) END,
    'daily_reset_at', v_daily_reset, 'cooldown_until', NULL));
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_chat_provider_call()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_now timestamptz;
  v_today date;
  v_config public.chat_provider_capacity_config%ROWTYPE;
  v_state public.chat_provider_capacity_state%ROWTYPE;
  v_daily_reset timestamptz;
  v_minute_reset timestamptz;
BEGIN
  v_now := clock_timestamp();
  v_today := (v_now AT TIME ZONE 'Asia/Singapore')::date;
  v_daily_reset := ((v_today + 1)::timestamp AT TIME ZONE 'Asia/Singapore');
  SELECT * INTO STRICT v_config FROM public.chat_provider_capacity_config WHERE singleton = true;
  INSERT INTO public.chat_provider_capacity_state (singleton, singapore_day)
  VALUES (true, v_today) ON CONFLICT (singleton) DO NOTHING;
  SELECT * INTO STRICT v_state FROM public.chat_provider_capacity_state WHERE singleton = true FOR UPDATE;

  IF v_state.singapore_day <> v_today THEN
    UPDATE public.chat_provider_capacity_state SET singapore_day = v_today, daily_count = 0 WHERE singleton = true;
    v_state.daily_count := 0;
    v_state.singapore_day := v_today;
  END IF;
  IF v_now - v_state.minute_window_started_at >= interval '1 minute' THEN
    UPDATE public.chat_provider_capacity_state SET minute_window_started_at = v_now, minute_count = 0 WHERE singleton = true;
    v_state.minute_window_started_at := v_now;
    v_state.minute_count := 0;
  END IF;
  v_minute_reset := v_state.minute_window_started_at + interval '1 minute';

  IF v_state.minute_count >= v_config.minute_limit OR v_state.daily_count >= v_config.daily_limit THEN
    RETURN jsonb_build_object('allowed', false, 'code', 'CHAT_GLOBAL_CAPACITY',
      'retry_at', CASE WHEN v_state.daily_count >= v_config.daily_limit THEN v_daily_reset ELSE v_minute_reset END,
      'retry_after_seconds', CASE WHEN v_state.daily_count >= v_config.daily_limit
        THEN GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_daily_reset - v_now)))::integer)
        ELSE GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_minute_reset - v_now)))::integer) END);
  END IF;

  UPDATE public.chat_provider_capacity_state
  SET minute_count = v_state.minute_count + 1, daily_count = v_state.daily_count + 1
  WHERE singleton = true;
  RETURN jsonb_build_object('allowed', true);
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_chat_user_interaction() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.reserve_chat_user_interaction() TO authenticated;
REVOKE ALL ON FUNCTION public.reserve_chat_provider_call() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_chat_provider_call() TO service_role;

COMMENT ON TABLE public.chat_quota_tier_config IS 'Trusted configurable per-user chatbot policy; initial values are application policy, not provider guarantees.';
COMMENT ON TABLE public.chat_provider_capacity_config IS 'Trusted project-wide provider-call reserve, intentionally below configured provider capacity.';
COMMENT ON TABLE public.chat_user_quota_state IS 'Bounded current quota and abuse state: one row per registered user.';
COMMENT ON TABLE public.chat_provider_capacity_state IS 'Bounded current project capacity state: one singleton row.';
