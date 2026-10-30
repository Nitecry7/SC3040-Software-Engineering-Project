-- Monitoring schema, service access, immutable observations, alerts and aggregation.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT plan(65);

INSERT INTO auth.users (id, email) VALUES
  ('71000000-0000-4000-8000-000000000001', 'monitoring-admin@example.invalid');

SELECT ok((SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN
  ('public.valuation_events'::regclass, 'public.service_health_checks'::regclass, 'public.system_alerts'::regclass)),
  'monitoring tables enable RLS');
SELECT ok(NOT has_table_privilege('anon', 'public.valuation_events', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.valuation_events', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.service_health_checks', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.service_health_checks', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.system_alerts', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.system_alerts', 'SELECT')
  AND NOT has_table_privilege('anon', 'public.valuation_events', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.valuation_events', 'INSERT')
  AND NOT has_table_privilege('anon', 'public.service_health_checks', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.service_health_checks', 'INSERT')
  AND NOT has_table_privilege('anon', 'public.system_alerts', 'INSERT')
  AND NOT has_table_privilege('authenticated', 'public.system_alerts', 'INSERT'),
  'ordinary clients cannot read or write monitoring records');
SELECT ok(NOT has_function_privilege('authenticated', 'public.cleanup_monitoring_data()', 'EXECUTE')
  AND has_function_privilege('service_role', 'public.cleanup_monitoring_data()', 'EXECUTE'),
  'cleanup is service-only');
SELECT ok(has_function_privilege('service_role', 'public.monitoring_dashboard_summary(text)', 'EXECUTE'),
  'trusted service can query the bounded dashboard summary');
SELECT ok(NOT has_function_privilege('authenticated', 'public.monitoring_dashboard_summary(text)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.record_monitoring_alert(text,text,text,uuid)', 'EXECUTE')
  AND NOT has_function_privilege('authenticated', 'public.transition_monitoring_alert(bigint,text,uuid)', 'EXECUTE'),
  'ordinary users cannot invoke monitoring aggregation or incident procedures');
SELECT is(public.monitoring_safe_chat_error_category('provider_http_503'), 'provider_http_503',
  'known provider status categories remain available');
SELECT is(public.monitoring_safe_chat_error_category('private-secret-containing-error-code'), 'OTHER',
  'unrecognized chatbot error details are never returned to monitoring');
SELECT ok(NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
  AND table_name='valuation_events' AND column_name IN ('property_id','user_id','address','features','price','raw_error','raw_payload')),
  'valuation monitoring schema excludes private property, user, price and payload fields');
SELECT ok((SELECT indisunique FROM pg_index WHERE indexrelid = 'public.valuation_events_pkey'::regclass),
  'valuation request ID is unique');
SELECT ok((SELECT indisunique AND indpred IS NOT NULL FROM pg_index WHERE indexrelid = 'public.system_alerts_one_unresolved_idx'::regclass),
  'unresolved incidents have a partial unique index');
SELECT is((SELECT count(*) FROM public.system_alerts WHERE source='render_model' AND category='model_not_ready'
  AND state IN ('active','acknowledged')), 1::bigint, 'overlapping observations create one unresolved alert');
SELECT is((SELECT occurrence_count FROM public.system_alerts WHERE source='render_model' AND category='model_not_ready'
  AND state IN ('active','acknowledged')), 24::bigint, 'all concurrent occurrences are counted atomically');

SET LOCAL ROLE authenticated;
SELECT throws_ok($$SELECT * FROM public.valuation_events$$, '42501', NULL,
  'authenticated users cannot read valuation events');
SELECT throws_ok($$INSERT INTO public.system_alerts (severity,source,category) VALUES ('critical','render_model','model_not_ready')$$,
  '42501', NULL, 'authenticated users cannot write alerts');
RESET ROLE;

SET LOCAL ROLE service_role;
INSERT INTO public.valuation_events (request_id, created_at, completed_at, status, prediction_sanity,
  total_edge_ms, authentication_ms)
VALUES ('72000000-0000-4000-8000-000000000001', now() - interval '2 minutes', now(), 'success', 'passed', 10, 1)
ON CONFLICT (request_id) DO NOTHING;
SELECT lives_ok($$INSERT INTO public.service_health_checks (service,status,source)
  VALUES ('render_model','healthy','admin_view')$$, 'trusted service can persist on-demand health observations');
SELECT lives_ok($$SELECT public.record_monitoring_alert('critical','render_model','model_version_mismatch',NULL)$$,
  'trusted service can create confirmed monitoring alerts');
SELECT lives_ok($$INSERT INTO public.valuation_events (request_id,status,prediction_sanity,total_edge_ms)
  VALUES ('72000000-0000-4000-8000-000000000001','failure','failed',999)
  ON CONFLICT (request_id) DO NOTHING$$, 'trusted repeated request ID is an ignored retry');
SELECT is((SELECT status FROM public.valuation_events WHERE request_id='72000000-0000-4000-8000-000000000001'),
  'success', 'first valuation observation remains immutable');
SELECT is((SELECT total_edge_ms FROM public.valuation_events WHERE request_id='72000000-0000-4000-8000-000000000001'),
  10::double precision, 'duplicate request does not overwrite timing');
SELECT throws_ok($$INSERT INTO public.valuation_events (request_id,status,prediction_sanity,total_edge_ms)
  VALUES ('72000000-0000-4000-8000-000000000002','success','passed','Infinity'::double precision)$$,
  '23514', NULL, 'non-finite duration is rejected');
RESET ROLE;

SELECT is(public.monitoring_percentiles(ARRAY[1,2,3,4]::double precision[])->'p50'->>'state',
  'insufficient_samples', 'P50 with 4 valid observations is insufficient');
SELECT is(public.monitoring_percentiles(ARRAY[1,2,3,4,5]::double precision[])->'p50'->>'state',
  'available', 'P50 with 5 valid observations is available');
SELECT is((public.monitoring_percentiles(ARRAY[1,2,3,4,5]::double precision[])->'p50'->>'value_ms')::numeric,
  3::numeric, 'P50 uses continuous interpolation');
SELECT is(public.monitoring_percentiles(ARRAY(SELECT generate_series(1,19)::double precision))->'p95'->>'state',
  'insufficient_samples', 'P95 with 19 valid observations is insufficient');
SELECT is(public.monitoring_percentiles(ARRAY(SELECT generate_series(1,20)::double precision))->'p95'->>'state',
  'available', 'P95 with 20 valid observations is available');
SELECT ok(abs((public.monitoring_percentiles(ARRAY(SELECT generate_series(1,20)::double precision))->'p95'->>'value_ms')::numeric - 19.05) < 0.000001,
  'P95 preserves percentile_cont interpolation semantics');
SELECT is(public.monitoring_percentiles(ARRAY(SELECT generate_series(1,99)::double precision))->'p99'->>'state',
  'insufficient_samples', 'P99 with 99 valid observations is insufficient');
SELECT is(public.monitoring_percentiles(ARRAY(SELECT generate_series(1,100)::double precision))->'p99'->>'state',
  'available', 'P99 with 100 valid observations is available');
SELECT is((public.monitoring_percentiles(ARRAY(SELECT generate_series(1,100)::double precision))->'p50'->>'value_ms')::numeric,
  50.5::numeric, 'P50 continuous interpolation is preserved');
SELECT is((public.monitoring_percentiles(ARRAY(SELECT generate_series(1,100)::double precision))->'p95'->>'value_ms')::numeric,
  95.05::numeric, 'P95 continuous interpolation is preserved');
SELECT is((public.monitoring_percentiles(ARRAY(SELECT generate_series(1,100)::double precision))->'p99'->>'value_ms')::numeric,
  99.01::numeric, 'P99 continuous interpolation is preserved');
SELECT is((public.monitoring_percentiles(ARRAY(SELECT generate_series(1,100)::double precision))->'p50'->>'value_ms')::numeric <=
  (public.monitoring_percentiles(ARRAY(SELECT generate_series(1,100)::double precision))->'p95'->>'value_ms')::numeric
  AND (public.monitoring_percentiles(ARRAY(SELECT generate_series(1,100)::double precision))->'p95'->>'value_ms')::numeric <=
  (public.monitoring_percentiles(ARRAY(SELECT generate_series(1,100)::double precision))->'p99'->>'value_ms')::numeric,
  true, 'P50 is no greater than P95 and P99');
SELECT is((public.monitoring_percentiles(ARRAY[1, 'NaN'::double precision, 'Infinity'::double precision,
  '-Infinity'::double precision, -1, NULL]::double precision[])->>'sample_count')::integer,
  1, 'null, negative, NaN and infinite durations are excluded');
SELECT is(public.monitoring_duration_stats('render_total', now()-interval '1 hour', now())->>'state',
  'unavailable', 'Render-only history is unavailable rather than zero');
SELECT throws_ok($$SELECT public.monitoring_dashboard_summary('2h')$$, '22023', NULL,
  'unsupported dashboard ranges are rejected');
SELECT throws_ok($$SELECT public.transition_monitoring_alert(1,NULL,'71000000-0000-4000-8000-000000000001')$$,
  '22023', NULL, 'database alert transition rejects a null action');
SELECT throws_ok($$INSERT INTO public.system_alerts (severity,source,category) VALUES ('warning','render_model','model_not_ready')$$,
  '23514', NULL, 'database constraints preserve alert severity mapping');
SELECT is((public.monitoring_dashboard_summary('1h')->'range'->>'start')::timestamptz,
  now() - interval '1 hour', '1h is a rolling hour ending at query time');
SELECT is((public.monitoring_dashboard_summary('24h')->'range'->>'start')::timestamptz,
  now() - interval '24 hours', '24h is a rolling day ending at query time');
SELECT is((public.monitoring_dashboard_summary('7d')->'range'->>'start')::timestamptz,
  (((now() AT TIME ZONE 'Asia/Singapore')::date - 6)::timestamp AT TIME ZONE 'Asia/Singapore'),
  '7d begins at Singapore midnight six days before today');
SELECT is((public.monitoring_dashboard_summary('30d')->'range'->>'start')::timestamptz,
  (((now() AT TIME ZONE 'Asia/Singapore')::date - 29)::timestamp AT TIME ZONE 'Asia/Singapore'),
  '30d begins at Singapore midnight twenty-nine days before today');
SELECT is(jsonb_array_length(public.monitoring_dashboard_summary('1h')->'valuation'->'series'), 12,
  '1h uses twelve five-minute buckets');
SELECT is(jsonb_array_length(public.monitoring_dashboard_summary('24h')->'valuation'->'series'), 24,
  '24h uses twenty-four hourly buckets');

SELECT public.record_monitoring_alert('critical','valuation','prediction_schema_invalid',
  '73000000-0000-4000-8000-000000000001');
SELECT public.record_monitoring_alert('critical','valuation','prediction_schema_invalid',
  '73000000-0000-4000-8000-000000000002');
SELECT is((SELECT count(*) FROM public.system_alerts WHERE source='valuation' AND category='prediction_schema_invalid'
  AND state IN ('active','acknowledged')), 1::bigint, 'repeated alert evidence uses one unresolved incident');
SELECT is((SELECT occurrence_count FROM public.system_alerts WHERE source='valuation' AND category='prediction_schema_invalid'),
  2::bigint, 'repeated evidence increments occurrence count');
SELECT is((SELECT latest_request_id FROM public.system_alerts WHERE source='valuation' AND category='prediction_schema_invalid'),
  '73000000-0000-4000-8000-000000000002'::uuid, 'latest relevant request ID replaces the previous one');
SELECT is((SELECT first_detected_at FROM public.system_alerts WHERE source='valuation' AND category='prediction_schema_invalid'),
  (SELECT min(first_detected_at) FROM public.system_alerts WHERE source='valuation' AND category='prediction_schema_invalid'),
  'first detected time remains the incident origin');
SELECT public.transition_monitoring_alert((SELECT id FROM public.system_alerts WHERE category='prediction_schema_invalid'),
  'acknowledge','71000000-0000-4000-8000-000000000001');
SELECT public.record_monitoring_alert('critical','valuation','prediction_schema_invalid',
  '73000000-0000-4000-8000-000000000003');
SELECT is((SELECT state FROM public.system_alerts WHERE category='prediction_schema_invalid'),
  'acknowledged', 'new evidence does not reactivate an acknowledged alert');
SELECT is((SELECT latest_request_id FROM public.system_alerts WHERE category='prediction_schema_invalid'),
  '73000000-0000-4000-8000-000000000003'::uuid, 'acknowledged incident tracks its newest request ID');
SELECT public.transition_monitoring_alert((SELECT id FROM public.system_alerts WHERE category='prediction_schema_invalid'),
  'resolve','71000000-0000-4000-8000-000000000001');
SELECT public.record_monitoring_alert('critical','valuation','prediction_schema_invalid',
  '73000000-0000-4000-8000-000000000004');
SELECT is((SELECT count(*) FROM public.system_alerts WHERE category='prediction_schema_invalid'),
  2::bigint, 'a recurrence after resolution creates a new incident');

INSERT INTO public.valuation_events (request_id,created_at,status,prediction_sanity,total_edge_ms,authentication_ms)
VALUES ('74000000-0000-4000-8000-000000000001',now()-interval '1 day','success','passed',10,NULL),
       ('74000000-0000-4000-8000-000000000002',now()-interval '2 days','failure','not_checked',20,3);
SELECT is((public.monitoring_duration_stats('valuation_total_edge',now()-interval '1 hour',now())->>'sample_count')::integer,
  1, 'short percentile range excludes older observations');
SELECT is((public.monitoring_duration_stats('valuation_total_edge',now()-interval '3 days',now())->>'sample_count')::integer,
  3, 'selected wider range includes only its own valid observations');
SELECT is((public.monitoring_duration_stats('valuation_authentication',now()-interval '3 days',now())->>'sample_count')::integer,
  2, 'timing fields have independent valid sample counts');

INSERT INTO public.chat_interactions (interaction_id,request_id,created_at,status,prompt_version,streaming)
VALUES ('77000000-0000-4000-8000-000000000001','77000000-0000-4000-8000-000000000001',now()-interval '3 seconds','provider_error','chatbot-v2',false);
INSERT INTO public.chat_provider_calls (interaction_id,sequence,provider,requested_model,started_at,completed_at,status)
VALUES ('77000000-0000-4000-8000-000000000001',1,'openrouter','synthetic-test-model',now()-interval '2 seconds',now()-interval '1 second','provider_error');
SELECT is(public.monitoring_dashboard_summary('24h')->'chatbot'->'provider_statuses'->>'provider_error', '1',
  'provider status aggregation counts the joined provider-call status');

DO $$
DECLARE
  today_start timestamptz := (date_trunc('day', now() AT TIME ZONE 'Asia/Singapore') AT TIME ZONE 'Asia/Singapore');
  local_midnight timestamptz := (date_trunc('day', now() AT TIME ZONE 'Asia/Singapore') AT TIME ZONE 'Asia/Singapore') - interval '1 day';
  before_bucket_start timestamptz := ((((date_trunc('day', now() AT TIME ZONE 'Asia/Singapore')::date - 2)::timestamp) AT TIME ZONE 'Asia/Singapore'));
  before_count integer;
  after_count integer;
  before_id uuid := '75000000-0000-4000-8000-000000000001';
  after_id uuid := '75000000-0000-4000-8000-000000000002';
  result jsonb;
BEGIN
  SELECT count(*) INTO before_count FROM public.valuation_events
    WHERE created_at >= before_bucket_start AND created_at < before_bucket_start + interval '1 day';
  SELECT count(*) INTO after_count FROM public.valuation_events
    WHERE created_at >= local_midnight AND created_at < local_midnight + interval '1 day';
  INSERT INTO public.valuation_events (request_id,created_at,status,prediction_sanity)
  VALUES (before_id, local_midnight - interval '1 second','success','passed'),
         (after_id, local_midnight + interval '1 second','success','passed');
  result := public.monitoring_dashboard_summary('7d');
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(result->'valuation'->'series') b
      WHERE (b->>'bucket_start')::timestamptz = local_midnight AND (b->>'request_count')::integer = after_count + 1) THEN
    RAISE EXCEPTION 'post-midnight event missing from the correct Singapore date bucket';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(result->'valuation'->'series') b
      WHERE (b->>'bucket_start')::timestamptz = before_bucket_start
        AND (b->>'request_count')::integer = before_count + 1) THEN
    RAISE EXCEPTION 'pre-midnight event missing from the previous Singapore date bucket';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(result->'valuation'->'series') b
      WHERE b->>'label' = 'Today so far') THEN
    RAISE EXCEPTION 'today bucket label missing';
  END IF;
  IF result->>'aggregation_timezone' <> 'Asia/Singapore' OR local_midnight >= today_start THEN
    RAISE EXCEPTION 'daily buckets do not declare Singapore timezone';
  END IF;
END $$;
SELECT ok(true, 'daily aggregation uses Singapore midnight and labels the current partial bucket Today so far');

INSERT INTO public.valuation_events (request_id,created_at,status,prediction_sanity)
VALUES ('76000000-0000-4000-8000-000000000001',now()-interval '91 days','success','passed');
INSERT INTO public.service_health_checks (checked_at,service,status,source)
VALUES (now()-interval '91 days','render_model','unknown','admin_view');
INSERT INTO public.system_alerts (severity,source,category,state,first_detected_at,last_detected_at,resolved_at)
VALUES ('critical','render_model','model_not_ready','resolved',now()-interval '200 days',now()-interval '100 days',now()-interval '91 days'),
       ('critical','render_model','model_version_mismatch','resolved',now()-interval '200 days',now()-interval '100 days',now()-interval '1 day'),
       ('warning','valuation','prediction_interval_invalid','active',now()-interval '200 days',now()-interval '100 days',NULL);
SELECT set_config('test.monitoring_cleanup', public.cleanup_monitoring_data()::text, true);
SELECT is((current_setting('test.monitoring_cleanup')::jsonb->>'valuation_events_deleted')::integer, 1,
  'cleanup removes valuation events older than 90 days');
SELECT is((current_setting('test.monitoring_cleanup')::jsonb->>'service_health_checks_deleted')::integer, 1,
  'cleanup removes health observations older than 90 days');
SELECT is((current_setting('test.monitoring_cleanup')::jsonb->>'resolved_alerts_deleted')::integer, 1,
  'cleanup ages resolved alerts from resolved_at');
SELECT is((SELECT count(*) FROM public.system_alerts WHERE category='model_version_mismatch' AND state='resolved'), 1::bigint,
  'a recently resolved old incident remains for 90 days after resolution');
SELECT is((SELECT count(*) FROM public.system_alerts WHERE category='prediction_interval_invalid' AND state='active'), 1::bigint,
  'cleanup retains unresolved incidents regardless of age');
SELECT is(public.monitoring_dashboard_summary('24h')->'retention'->>'target_days', '90',
  'dashboard summary exposes the retention target');
SELECT is(public.monitoring_dashboard_summary('24h')->'retention'->>'cleanup_scheduling', 'not_verified',
  'dashboard does not claim cleanup scheduling is verified');
SELECT ok(public.monitoring_dashboard_summary('30d')->'retention' ? 'oldest_valuation_event_at'
  AND public.monitoring_dashboard_summary('30d')->'retention' ? 'oldest_service_health_check_at'
  AND public.monitoring_dashboard_summary('30d')->'retention' ? 'oldest_resolved_alert_at',
  'dashboard exposes oldest-record retention metadata');
SELECT is((public.monitoring_dashboard_summary('30d')->'retention'->>'oldest_valuation_event_at')::timestamptz,
  (SELECT min(created_at) FROM public.valuation_events), 'oldest valuation event metadata matches retained records');
SELECT is((public.monitoring_dashboard_summary('30d')->'retention'->>'oldest_service_health_check_at')::timestamptz,
  (SELECT min(checked_at) FROM public.service_health_checks),
  'oldest health metadata matches observations retained after cleanup');

SELECT * FROM finish();
ROLLBACK;
