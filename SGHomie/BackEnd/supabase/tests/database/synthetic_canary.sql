BEGIN;
SELECT plan(16);

SELECT has_table('public', 'synthetic_canary_runs', 'on-demand synthetic check results have a dedicated table');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid = 'public.synthetic_canary_runs'::regclass),
  'synthetic check results enforce row level security');
SELECT ok(NOT has_table_privilege('anon', 'public.synthetic_canary_runs', 'SELECT'), 'anon cannot read synthetic check results');
SELECT ok(NOT has_table_privilege('authenticated', 'public.synthetic_canary_runs', 'SELECT'), 'authenticated cannot read synthetic check results');
SELECT ok(NOT has_table_privilege('authenticated', 'public.synthetic_canary_runs', 'INSERT'), 'authenticated cannot write synthetic check results');
SELECT ok(has_table_privilege('service_role', 'public.synthetic_canary_runs', 'SELECT'), 'service role can read synthetic check results');
SELECT ok(has_table_privilege('service_role', 'public.synthetic_canary_runs', 'INSERT'), 'service role can write synthetic check results');
SELECT ok(has_table_privilege('service_role', 'public.synthetic_canary_runs', 'DELETE'), 'service role can clean up synthetic check results');
SELECT ok(EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'synthetic_canary_runs_type_completed_idx'),
  'latest check lookup has a type and completion index');
SELECT ok(NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
  AND table_name = 'synthetic_canary_runs'
  AND column_name ~* '(prompt|response|property|user|price|payload|secret|error_text)'),
  'synthetic check results have no content, identity, property, or raw error columns');
SELECT throws_ok($$INSERT INTO public.synthetic_canary_runs
  (canary_type,status,started_at,completed_at,duration_ms,edge_reached,upstream_reached,response_valid,canary_valid)
  VALUES ('arbitrary','unknown',now(),now(),0,false,false,false,false)$$,
  '23514', NULL, 'synthetic check type is constrained');
SELECT throws_ok($$INSERT INTO public.synthetic_canary_runs
  (canary_type,status,started_at,completed_at,duration_ms,failure_category,edge_reached,upstream_reached,response_valid,canary_valid)
  VALUES ('chatbot','invented',now(),now(),0,'NETWORK_UNCERTAIN',false,false,false,false)$$,
  '23514', NULL, 'synthetic check status is constrained');

INSERT INTO public.synthetic_canary_runs
  (canary_type,status,failure_category,started_at,completed_at,duration_ms,edge_reached,upstream_reached,response_valid,canary_valid,created_at)
VALUES ('chatbot','unknown','NETWORK_UNCERTAIN',now() - interval '91 days',now() - interval '91 days',0,false,false,false,false,now() - interval '91 days');
SELECT is((public.cleanup_monitoring_data()->>'synthetic_canary_runs_deleted')::integer, 1,
  'monitoring cleanup removes synthetic check results older than 90 days');
SELECT is((SELECT count(*)::integer FROM public.synthetic_canary_runs WHERE created_at < now() - interval '90 days'), 0,
  'expired synthetic check result is removed');
SELECT ok(NOT has_table_privilege('public', 'public.synthetic_canary_runs', 'SELECT'), 'PUBLIC cannot read synthetic check results');
SELECT ok(has_function_privilege('service_role', 'public.cleanup_monitoring_data()', 'EXECUTE'), 'service role can run the retention cleanup');

SELECT * FROM finish();
ROLLBACK;
