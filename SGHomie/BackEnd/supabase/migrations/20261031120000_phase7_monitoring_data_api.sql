-- Safe, service-only operational observations for valuation and admin checks.

CREATE TABLE public.valuation_events (
  request_id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL CHECK (status IN ('success', 'failure')),
  failure_category text CHECK (failure_category IS NULL OR failure_category IN (
    'AUTH_FAILURE', 'PROPERTY_NOT_FOUND', 'PROPERTY_LOOKUP_FAILURE',
    'FEATURE_PREPARATION_FAILURE', 'TIMEOUT', 'RENDER_UNAVAILABLE',
    'INVALID_PREDICTION_SCHEMA', 'INVALID_INTERVAL', 'MODEL_VERSION_MISMATCH',
    'EDGE_UNAVAILABLE', 'INVALID_REQUEST'
  )),
  model_version text CHECK (model_version IS NULL OR model_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'),
  prediction_sanity text NOT NULL CHECK (prediction_sanity IN ('passed', 'failed', 'not_checked')),
  canary boolean NOT NULL DEFAULT false,
  total_edge_ms double precision CHECK (total_edge_ms IS NULL OR (total_edge_ms >= 0 AND total_edge_ms < 'Infinity'::double precision)),
  authentication_ms double precision CHECK (authentication_ms IS NULL OR (authentication_ms >= 0 AND authentication_ms < 'Infinity'::double precision)),
  database_lookup_ms double precision CHECK (database_lookup_ms IS NULL OR (database_lookup_ms >= 0 AND database_lookup_ms < 'Infinity'::double precision)),
  request_construction_ms double precision CHECK (request_construction_ms IS NULL OR (request_construction_ms >= 0 AND request_construction_ms < 'Infinity'::double precision)),
  render_fetch_ms double precision CHECK (render_fetch_ms IS NULL OR (render_fetch_ms >= 0 AND render_fetch_ms < 'Infinity'::double precision))
);

CREATE INDEX valuation_events_created_idx ON public.valuation_events (created_at DESC);
CREATE INDEX valuation_events_failure_idx ON public.valuation_events (created_at DESC, failure_category)
  WHERE status = 'failure';

CREATE TABLE public.service_health_checks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  checked_at timestamptz NOT NULL DEFAULT now(),
  service text NOT NULL CHECK (service IN ('render_model')),
  status text NOT NULL CHECK (status IN ('healthy', 'warning', 'critical', 'unknown')),
  source text NOT NULL CHECK (source = 'admin_view'),
  duration_ms double precision CHECK (duration_ms IS NULL OR (duration_ms >= 0 AND duration_ms < 'Infinity'::double precision)),
  expected_model_version text CHECK (expected_model_version IS NULL OR expected_model_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'),
  loaded_model_version text CHECK (loaded_model_version IS NULL OR loaded_model_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'),
  failure_category text CHECK (failure_category IS NULL OR failure_category IN ('MODEL_NOT_READY', 'MODEL_VERSION_MISMATCH'))
);

CREATE INDEX service_health_checks_checked_idx ON public.service_health_checks (checked_at DESC);

CREATE TABLE public.system_alerts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  severity text NOT NULL CHECK (severity IN ('warning', 'critical')),
  source text NOT NULL CHECK (source IN ('render_model', 'valuation')),
  category text NOT NULL CHECK (category IN ('model_not_ready', 'model_version_mismatch', 'prediction_schema_invalid', 'prediction_interval_invalid')),
  state text NOT NULL DEFAULT 'active' CHECK (state IN ('active', 'acknowledged', 'resolved')),
  first_detected_at timestamptz NOT NULL DEFAULT now(),
  last_detected_at timestamptz NOT NULL DEFAULT now(),
  occurrence_count bigint NOT NULL DEFAULT 1 CHECK (occurrence_count > 0),
  latest_request_id uuid,
  acknowledged_admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  CHECK ((state = 'active' AND acknowledged_admin_id IS NULL AND acknowledged_at IS NULL AND resolved_at IS NULL)
      OR (state = 'acknowledged' AND acknowledged_at IS NOT NULL AND resolved_at IS NULL)
      OR (state = 'resolved' AND resolved_at IS NOT NULL)),
  CHECK ((category = 'prediction_interval_invalid' AND severity = 'warning')
      OR (category <> 'prediction_interval_invalid' AND severity = 'critical')),
  CHECK ((source = 'render_model' AND category IN ('model_not_ready', 'model_version_mismatch'))
      OR (source = 'valuation' AND category IN ('prediction_schema_invalid', 'prediction_interval_invalid')))
);

CREATE UNIQUE INDEX system_alerts_one_unresolved_idx ON public.system_alerts (source, category)
  WHERE state IN ('active', 'acknowledged');
CREATE INDEX system_alerts_state_detected_idx ON public.system_alerts (state, last_detected_at DESC);
CREATE INDEX system_alerts_resolved_idx ON public.system_alerts (resolved_at)
  WHERE state = 'resolved';

ALTER TABLE public.valuation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.valuation_events, public.service_health_checks, public.system_alerts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.valuation_events, public.service_health_checks, public.system_alerts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.service_health_checks_id_seq, public.system_alerts_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.record_monitoring_alert(
  p_severity text,
  p_source text,
  p_category text,
  p_request_id uuid DEFAULT NULL
)
RETURNS public.system_alerts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_alert public.system_alerts;
BEGIN
  IF p_severity IS NULL OR p_source IS NULL OR p_category IS NULL
    OR p_severity NOT IN ('warning', 'critical')
    OR p_source NOT IN ('render_model', 'valuation')
    OR p_category NOT IN ('model_not_ready', 'model_version_mismatch', 'prediction_schema_invalid', 'prediction_interval_invalid')
    OR (p_source = 'render_model' AND p_category NOT IN ('model_not_ready', 'model_version_mismatch'))
    OR (p_source = 'valuation' AND p_category NOT IN ('prediction_schema_invalid', 'prediction_interval_invalid'))
    OR (p_category = 'prediction_interval_invalid' AND p_severity <> 'warning')
    OR (p_category <> 'prediction_interval_invalid' AND p_severity <> 'critical') THEN
    RAISE EXCEPTION 'invalid monitoring alert' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.system_alerts (severity, source, category, latest_request_id)
  VALUES (p_severity, p_source, p_category, p_request_id)
  ON CONFLICT (source, category) WHERE state IN ('active', 'acknowledged')
  DO UPDATE SET
    severity = EXCLUDED.severity,
    last_detected_at = clock_timestamp(),
    occurrence_count = public.system_alerts.occurrence_count + 1,
    latest_request_id = COALESCE(EXCLUDED.latest_request_id, public.system_alerts.latest_request_id)
  RETURNING * INTO v_alert;
  RETURN v_alert;
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_monitoring_alert(
  p_alert_id bigint,
  p_action text,
  p_admin_id uuid
)
RETURNS public.system_alerts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_alert public.system_alerts;
BEGIN
  IF p_action IS NULL OR p_action NOT IN ('acknowledge', 'resolve') OR p_admin_id IS NULL THEN
    RAISE EXCEPTION 'invalid alert action' USING ERRCODE = '22023';
  END IF;
  IF p_action = 'acknowledge' THEN
    UPDATE public.system_alerts SET state = 'acknowledged', acknowledged_admin_id = p_admin_id,
      acknowledged_at = now() WHERE id = p_alert_id AND state = 'active' RETURNING * INTO v_alert;
  ELSE
    UPDATE public.system_alerts SET state = 'resolved', resolved_at = now()
      WHERE id = p_alert_id AND state IN ('active', 'acknowledged') RETURNING * INTO v_alert;
  END IF;
  IF v_alert.id IS NULL THEN
    RAISE EXCEPTION 'alert not found or invalid transition' USING ERRCODE = 'P0002';
  END IF;
  RETURN v_alert;
END;
$$;

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
BEGIN
  DELETE FROM public.valuation_events WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_valuation = ROW_COUNT;
  DELETE FROM public.service_health_checks WHERE checked_at < now() - interval '90 days';
  GET DIAGNOSTICS v_health = ROW_COUNT;
  DELETE FROM public.system_alerts WHERE state = 'resolved' AND resolved_at < now() - interval '90 days';
  GET DIAGNOSTICS v_alerts = ROW_COUNT;
  RETURN jsonb_build_object('valuation_events_deleted', v_valuation,
    'service_health_checks_deleted', v_health, 'resolved_alerts_deleted', v_alerts);
END;
$$;

CREATE OR REPLACE FUNCTION public.monitoring_percentiles(p_values double precision[])
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  WITH valid AS (
    SELECT value FROM unnest(COALESCE(p_values, ARRAY[]::double precision[])) AS v(value)
    WHERE value >= 0 AND value < 'Infinity'::double precision
  ), stats AS (
    SELECT count(*)::integer AS sample_count,
      percentile_cont(0.50) WITHIN GROUP (ORDER BY value) AS p50,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY value) AS p95,
      percentile_cont(0.99) WITHIN GROUP (ORDER BY value) AS p99
    FROM valid
  )
  SELECT jsonb_build_object(
    'sample_count', sample_count,
    'p50', CASE WHEN sample_count >= 5 THEN jsonb_build_object('state', 'available', 'value_ms', p50) ELSE jsonb_build_object('state', 'insufficient_samples', 'value_ms', NULL) END,
    'p95', CASE WHEN sample_count >= 20 THEN jsonb_build_object('state', 'available', 'value_ms', p95) ELSE jsonb_build_object('state', 'insufficient_samples', 'value_ms', NULL) END,
    'p99', CASE WHEN sample_count >= 100 THEN jsonb_build_object('state', 'available', 'value_ms', p99) ELSE jsonb_build_object('state', 'insufficient_samples', 'value_ms', NULL) END
  ) FROM stats;
$$;

CREATE OR REPLACE FUNCTION public.monitoring_safe_chat_error_category(p_error_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT CASE
    WHEN p_error_code IN (
      'provider_error', 'client_cancelled', 'incomplete_timeout', 'CHAT_QUOTA_UNAVAILABLE',
      'CHAT_USER_BURST_LIMIT', 'CHAT_USER_DAILY_LIMIT', 'CHAT_COOLDOWN_ACTIVE',
      'CHAT_GLOBAL_CAPACITY'
    ) THEN p_error_code
    WHEN p_error_code ~ '^provider_http_[1-5][0-9]{2}$' THEN p_error_code
    ELSE 'OTHER'
  END;
$$;

CREATE OR REPLACE FUNCTION public.monitoring_duration_stats(p_metric text, p_start timestamptz, p_end timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_values double precision[];
BEGIN
  IF p_start IS NULL OR p_end IS NULL OR p_end <= p_start THEN
    RAISE EXCEPTION 'invalid monitoring range' USING ERRCODE = '22023';
  END IF;
  CASE p_metric
    WHEN 'valuation_total_edge' THEN SELECT array_agg(total_edge_ms) INTO v_values FROM public.valuation_events WHERE created_at >= p_start AND created_at < p_end AND total_edge_ms IS NOT NULL AND total_edge_ms >= 0 AND total_edge_ms < 'Infinity'::double precision;
    WHEN 'valuation_authentication' THEN SELECT array_agg(authentication_ms) INTO v_values FROM public.valuation_events WHERE created_at >= p_start AND created_at < p_end AND authentication_ms IS NOT NULL AND authentication_ms >= 0 AND authentication_ms < 'Infinity'::double precision;
    WHEN 'valuation_database_lookup' THEN SELECT array_agg(database_lookup_ms) INTO v_values FROM public.valuation_events WHERE created_at >= p_start AND created_at < p_end AND database_lookup_ms IS NOT NULL AND database_lookup_ms >= 0 AND database_lookup_ms < 'Infinity'::double precision;
    WHEN 'valuation_request_construction' THEN SELECT array_agg(request_construction_ms) INTO v_values FROM public.valuation_events WHERE created_at >= p_start AND created_at < p_end AND request_construction_ms IS NOT NULL AND request_construction_ms >= 0 AND request_construction_ms < 'Infinity'::double precision;
    WHEN 'valuation_render_fetch' THEN SELECT array_agg(render_fetch_ms) INTO v_values FROM public.valuation_events WHERE created_at >= p_start AND created_at < p_end AND render_fetch_ms IS NOT NULL AND render_fetch_ms >= 0 AND render_fetch_ms < 'Infinity'::double precision;
    WHEN 'chat_total_interaction' THEN SELECT array_agg(total_latency_ms::double precision) INTO v_values FROM public.chat_interactions WHERE created_at >= p_start AND created_at < p_end AND total_latency_ms >= 0;
    WHEN 'chat_provider' THEN SELECT array_agg(provider_latency_ms::double precision) INTO v_values FROM public.chat_interactions WHERE created_at >= p_start AND created_at < p_end AND provider_latency_ms >= 0;
    WHEN 'chat_tool' THEN SELECT array_agg(tool_latency_ms::double precision) INTO v_values FROM public.chat_interactions WHERE created_at >= p_start AND created_at < p_end AND tool_latency_ms >= 0;
    WHEN 'chat_first_output' THEN SELECT array_agg(first_output_event_ms::double precision) INTO v_values FROM public.chat_interactions WHERE created_at >= p_start AND created_at < p_end AND first_output_event_ms >= 0;
    WHEN 'provider_call' THEN SELECT array_agg(latency_ms::double precision) INTO v_values FROM public.chat_provider_calls c JOIN public.chat_interactions i USING (interaction_id) WHERE i.created_at >= p_start AND i.created_at < p_end AND c.latency_ms >= 0;
    WHEN 'render_total' THEN RETURN jsonb_build_object('state', 'unavailable');
    WHEN 'catboost_prediction' THEN RETURN jsonb_build_object('state', 'unavailable');
    WHEN 'conformal_interval' THEN RETURN jsonb_build_object('state', 'unavailable');
    ELSE RAISE EXCEPTION 'unsupported monitoring metric' USING ERRCODE = '22023';
  END CASE;
  RETURN public.monitoring_percentiles(v_values);
END;
$$;

CREATE OR REPLACE FUNCTION public.monitoring_dashboard_summary(p_range text DEFAULT '24h')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_now timestamptz := now();
  v_local_date date := (now() AT TIME ZONE 'Asia/Singapore')::date;
  v_start timestamptz;
  v_bucket text;
  v_bucket_start timestamptz;
  v_series jsonb := '[]'::jsonb;
  v_range jsonb;
  v_metric_names text[] := ARRAY['valuation_total_edge','valuation_authentication','valuation_database_lookup','valuation_request_construction','valuation_render_fetch','chat_total_interaction','chat_provider','chat_tool','chat_first_output','provider_call','render_total','catboost_prediction','conformal_interval'];
  v_name text;
  v_metrics jsonb := '{}'::jsonb;
  v_bucket_end timestamptz;
  v_cursor timestamptz;
  v_count bigint;
  v_success bigint;
  v_chat_count bigint;
  v_chat_success bigint;
BEGIN
  CASE p_range
    WHEN '1h' THEN v_start := v_now - interval '1 hour'; v_bucket := '5 minutes'; v_bucket_start := v_start;
    WHEN '24h' THEN v_start := v_now - interval '24 hours'; v_bucket := '1 hour'; v_bucket_start := v_start;
    WHEN '7d' THEN v_start := ((v_local_date - 6)::timestamp AT TIME ZONE 'Asia/Singapore'); v_bucket := '1 day'; v_bucket_start := (v_local_date - 6)::timestamp AT TIME ZONE 'Asia/Singapore';
    WHEN '30d' THEN v_start := ((v_local_date - 29)::timestamp AT TIME ZONE 'Asia/Singapore'); v_bucket := '1 day'; v_bucket_start := (v_local_date - 29)::timestamp AT TIME ZONE 'Asia/Singapore';
    ELSE RAISE EXCEPTION 'invalid monitoring range' USING ERRCODE = '22023';
  END CASE;

  FOREACH v_name IN ARRAY v_metric_names LOOP
    v_metrics := v_metrics || jsonb_build_object(v_name, public.monitoring_duration_stats(v_name, v_start, v_now));
  END LOOP;

  v_cursor := v_bucket_start;
  WHILE v_cursor < v_now LOOP
    IF p_range IN ('7d','30d') THEN
      v_bucket_end := ((v_cursor AT TIME ZONE 'Asia/Singapore')::date + 1)::timestamp AT TIME ZONE 'Asia/Singapore';
    ELSE
      v_bucket_end := v_cursor + v_bucket::interval;
    END IF;
    IF v_bucket_end > v_now THEN v_bucket_end := v_now; END IF;
    SELECT count(*), count(*) FILTER (WHERE status = 'success') INTO v_count, v_success
      FROM public.valuation_events WHERE created_at >= v_cursor AND created_at < v_bucket_end;
    SELECT count(*), count(*) FILTER (WHERE status = 'success') INTO v_chat_count, v_chat_success
      FROM public.chat_interactions WHERE created_at >= v_cursor AND created_at < v_bucket_end;
    v_series := v_series || jsonb_build_array(jsonb_build_object(
      'bucket_start', v_cursor,
      'label', CASE WHEN p_range IN ('7d','30d') AND (v_cursor AT TIME ZONE 'Asia/Singapore')::date = v_local_date THEN 'Today so far' ELSE NULL END,
      'request_count', v_count,
      'success_count', v_success,
      'failure_count', v_count - v_success,
      'total_edge', public.monitoring_duration_stats('valuation_total_edge', v_cursor, v_bucket_end),
      'chatbot_request_count', v_chat_count,
      'chatbot_success_count', v_chat_success,
      'chatbot_failure_count', v_chat_count - v_chat_success,
      'chatbot_total_interaction', public.monitoring_duration_stats('chat_total_interaction', v_cursor, v_bucket_end)
    ));
    v_cursor := v_bucket_end;
  END LOOP;

  SELECT jsonb_build_object('start', v_start, 'end', v_now, 'range', p_range) INTO v_range;
  RETURN jsonb_build_object(
    'version', 2,
    'generated_at', v_now,
    'range', v_range,
    'aggregation_timezone', 'Asia/Singapore',
    'metrics', v_metrics,
    'valuation', jsonb_build_object(
      'recorded_events', (SELECT count(*) FROM public.valuation_events WHERE created_at >= v_start AND created_at < v_now),
      'successful_events', (SELECT count(*) FROM public.valuation_events WHERE created_at >= v_start AND created_at < v_now AND status = 'success'),
      'failed_events', (SELECT count(*) FROM public.valuation_events WHERE created_at >= v_start AND created_at < v_now AND status = 'failure'),
      'failure_categories', (SELECT COALESCE(jsonb_object_agg(failure_category, category_count), '{}'::jsonb) FROM (SELECT failure_category, count(*) AS category_count FROM public.valuation_events WHERE created_at >= v_start AND created_at < v_now AND failure_category IS NOT NULL GROUP BY failure_category) q),
      'prediction_sanity_failures', (SELECT count(*) FROM public.valuation_events WHERE created_at >= v_start AND created_at < v_now AND prediction_sanity = 'failed'),
      'series', v_series
    ),
    'chatbot', jsonb_build_object(
      'recorded_interactions', (SELECT count(*) FROM public.chat_interactions WHERE created_at >= v_start AND created_at < v_now),
      'successful_interactions', (SELECT count(*) FROM public.chat_interactions WHERE created_at >= v_start AND created_at < v_now AND status = 'success'),
      'failure_categories', (SELECT COALESCE(jsonb_object_agg(category, category_count), '{}'::jsonb) FROM (SELECT public.monitoring_safe_chat_error_category(error_code) AS category, count(*) AS category_count FROM public.chat_interactions WHERE created_at >= v_start AND created_at < v_now AND error_code IS NOT NULL GROUP BY category) q),
      'quota_outcomes', (SELECT COALESCE(jsonb_object_agg(quota_result, outcome_count), '{}'::jsonb) FROM (SELECT quota_result, count(*) AS outcome_count FROM public.chat_interactions WHERE created_at >= v_start AND created_at < v_now AND quota_result IS NOT NULL GROUP BY quota_result) q),
      'provider_calls', (SELECT count(*) FROM public.chat_provider_calls c JOIN public.chat_interactions i USING (interaction_id) WHERE i.created_at >= v_start AND i.created_at < v_now),
      'provider_statuses', (SELECT COALESCE(jsonb_object_agg(q.provider_status, q.status_count), '{}'::jsonb) FROM (SELECT c.status AS provider_status, count(*) AS status_count FROM public.chat_provider_calls c JOIN public.chat_interactions i USING (interaction_id) WHERE i.created_at >= v_start AND i.created_at < v_now GROUP BY c.status) q),
      'feedback_count', (SELECT count(*) FROM public.chat_feedback WHERE updated_at >= v_start AND updated_at < v_now),
      'feedback_ratings', (SELECT COALESCE(jsonb_object_agg(rating, rating_count), '{}'::jsonb) FROM (SELECT rating, count(*) AS rating_count FROM public.chat_feedback WHERE updated_at >= v_start AND updated_at < v_now GROUP BY rating) q)
    ),
    'alerts', (SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.last_detected_at DESC), '[]'::jsonb) FROM (SELECT id,severity,source,category,state,first_detected_at,last_detected_at,occurrence_count,latest_request_id,acknowledged_at,resolved_at FROM public.system_alerts ORDER BY last_detected_at DESC LIMIT 50) a),
    'active_unacknowledged_alert_count', (SELECT count(*) FROM public.system_alerts WHERE state = 'active' AND severity IN ('warning','critical')),
    'health', (SELECT COALESCE(jsonb_agg(to_jsonb(h) ORDER BY h.checked_at DESC), '[]'::jsonb) FROM (SELECT checked_at,service,status,source,duration_ms,expected_model_version,loaded_model_version,failure_category FROM public.service_health_checks ORDER BY checked_at DESC LIMIT 20) h),
    'retention', jsonb_build_object(
      'target_days', 90,
      'cleanup_scheduling', 'not_verified',
      'oldest_valuation_event_at', (SELECT min(created_at) FROM public.valuation_events),
      'oldest_service_health_check_at', (SELECT min(checked_at) FROM public.service_health_checks),
      'oldest_resolved_alert_at', (SELECT min(resolved_at) FROM public.system_alerts WHERE state = 'resolved')
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_monitoring_alert(text,text,text,uuid),
  public.transition_monitoring_alert(bigint,text,uuid), public.cleanup_monitoring_data(),
  public.monitoring_percentiles(double precision[]), public.monitoring_duration_stats(text,timestamptz,timestamptz),
  public.monitoring_safe_chat_error_category(text), public.monitoring_dashboard_summary(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_monitoring_alert(text,text,text,uuid),
  public.transition_monitoring_alert(bigint,text,uuid), public.cleanup_monitoring_data(),
  public.monitoring_dashboard_summary(text) TO service_role;

