-- Persist only bounded, on-demand synthetic monitoring outcomes. Never store prompts,
-- generated text, property/user IDs, model inputs, predictions, or provider errors.
CREATE TABLE public.synthetic_canary_runs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  canary_type text NOT NULL CHECK (canary_type IN ('chatbot', 'valuation')),
  status text NOT NULL CHECK (status IN ('success', 'failure', 'unknown')),
  failure_category text CHECK (failure_category IS NULL OR failure_category IN (
    'CONFIGURATION_FAILURE', 'PROVIDER_CONFIGURATION_FAILURE', 'PROVIDER_UNAVAILABLE',
    'PROVIDER_TIMEOUT', 'PROVIDER_RATE_LIMITED', 'INVALID_PROVIDER_RESPONSE',
    'CANARY_VALIDATION_FAILURE', 'GLOBAL_CAPACITY_LIMITED', 'GLOBAL_CAPACITY_UNAVAILABLE',
    'NETWORK_UNCERTAIN', 'CHATBOT_EDGE_FAILURE', 'VALUATION_EDGE_FAILURE',
    'AUTH_FAILURE', 'PROPERTY_FIXTURE_UNAVAILABLE', 'PROPERTY_NOT_FOUND',
    'FEATURE_PREPARATION_FAILURE', 'INVALID_PREDICTION_SCHEMA', 'INVALID_INTERVAL',
    'REQUEST_ID_MISMATCH', 'MODEL_VERSION_MISMATCH', 'MODEL_VERSION_UNCONFIGURED'
  )),
  started_at timestamptz NOT NULL,
  completed_at timestamptz NOT NULL,
  duration_ms numeric(12,2) NOT NULL CHECK (duration_ms >= 0),
  request_id uuid,
  expected_model_version text CHECK (expected_model_version IS NULL OR length(expected_model_version) <= 128),
  observed_model_version text CHECK (observed_model_version IS NULL OR length(observed_model_version) <= 128),
  provider text CHECK (provider IS NULL OR provider IN ('openai', 'openrouter')),
  model text CHECK (model IS NULL OR length(model) <= 120),
  edge_reached boolean NOT NULL,
  upstream_reached boolean NOT NULL,
  response_valid boolean NOT NULL,
  canary_valid boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (completed_at >= started_at),
  CHECK ((status = 'success' AND failure_category IS NULL AND canary_valid)
    OR (status <> 'success' AND failure_category IS NOT NULL))
);

CREATE INDEX synthetic_canary_runs_type_completed_idx
  ON public.synthetic_canary_runs (canary_type, completed_at DESC);

ALTER TABLE public.synthetic_canary_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.synthetic_canary_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.synthetic_canary_runs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.synthetic_canary_runs_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.cleanup_monitoring_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_valuation integer;
  v_health integer;
  v_alerts integer;
  v_canaries integer;
BEGIN
  DELETE FROM public.valuation_events WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_valuation = ROW_COUNT;
  DELETE FROM public.service_health_checks WHERE checked_at < now() - interval '90 days';
  GET DIAGNOSTICS v_health = ROW_COUNT;
  DELETE FROM public.system_alerts WHERE state = 'resolved' AND resolved_at < now() - interval '90 days';
  GET DIAGNOSTICS v_alerts = ROW_COUNT;
  DELETE FROM public.synthetic_canary_runs WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_canaries = ROW_COUNT;
  RETURN jsonb_build_object('valuation_events_deleted', v_valuation,
    'service_health_checks_deleted', v_health, 'resolved_alerts_deleted', v_alerts,
    'synthetic_canary_runs_deleted', v_canaries);
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_monitoring_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_monitoring_data() TO service_role;
