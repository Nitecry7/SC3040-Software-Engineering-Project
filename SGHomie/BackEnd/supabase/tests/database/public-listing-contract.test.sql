-- Synthetic identities and listings only. Every fixture is rolled back.
-- Contract: callers who are not signed in can read only an explicit allow-list
-- of columns on public.properties, and only approved rows. Signed-in access is
-- unchanged. Column privileges and row policies are exercised with real roles.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT plan(29);

-- Test helper, removed by the rollback. It runs a query as the current role and
-- returns the rows as jsonb, or {"error": <SQLSTATE>} if the query is refused,
-- so that a refused read is reported as a failed assertion instead of aborting
-- the transaction.
CREATE FUNCTION public.contract_test_probe(query text) RETURNS jsonb
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $fn$
DECLARE
 result jsonb;
BEGIN
 EXECUTE 'SELECT coalesce(jsonb_agg(to_jsonb(q)), ''[]''::jsonb) FROM (' || query || ') AS q' INTO result;
 RETURN result;
EXCEPTION WHEN OTHERS THEN
 RETURN jsonb_build_object('error', SQLSTATE);
END
$fn$;
-- Make the helper callable by anon regardless of environment default privileges.
GRANT EXECUTE ON FUNCTION public.contract_test_probe(text) TO anon;

-- Identities: buyer, owner (seller) and administrator.
INSERT INTO auth.users (id, email) VALUES
 ('90000000-0000-4000-8000-000000000001', 'contract-buyer@example.invalid'),
 ('90000000-0000-4000-8000-000000000002', 'contract-owner@example.invalid'),
 ('90000000-0000-4000-8000-000000000003', 'contract-admin@example.invalid');
INSERT INTO public.user_profiles (id, is_seller, is_admin) VALUES
 ('90000000-0000-4000-8000-000000000001', false, false),
 ('90000000-0000-4000-8000-000000000002', true, false),
 ('90000000-0000-4000-8000-000000000003', false, true);

-- Listings, written before any role switch. The approved row carries a value in
-- every column that is outside the public allow-list.
INSERT INTO public.properties
 (id, title, price, location, type, image_url, bedrooms, bathrooms, area_sqft, description,
  user_id, detailed_location, town, seller_name, seller_phone, built_year, photos, latitude, longitude,
  status, seller_id, postal_code, block_number, street_name)
VALUES
 ('a0000000-0000-4000-8000-000000000001', 'Synthetic approved listing', 400000, 'BEDOK', 'HDB',
  'https://example.invalid/image.jpg', 3, 2, 900, 'Synthetic description text',
  '90000000-0000-4000-8000-000000000002', 'Block 11 SYNTHETIC ROAD', 'BEDOK', 'Synthetic Seller', '80000000', 1990,
  ARRAY['https://example.invalid/photo-1.jpg']::text[], 1.3300, 103.9400,
  'approved', '90000000-0000-4000-8000-000000000002', '111111', '11', 'SYNTHETIC ROAD');
INSERT INTO public.properties
 (id, title, price, location, type, image_url, bedrooms, bathrooms, area_sqft, seller_id, status)
VALUES
 ('a0000000-0000-4000-8000-000000000002', 'Synthetic draft listing', 400000, 'BEDOK', 'HDB', '', 3, 2, 900, '90000000-0000-4000-8000-000000000002', 'draft'),
 ('a0000000-0000-4000-8000-000000000003', 'Synthetic pending listing', 400000, 'BEDOK', 'HDB', '', 3, 2, 900, '90000000-0000-4000-8000-000000000002', 'pending');
INSERT INTO public.properties
 (id, title, price, location, type, image_url, bedrooms, bathrooms, area_sqft, seller_id, status, rejection_reason)
VALUES
 ('a0000000-0000-4000-8000-000000000004', 'Synthetic rejected listing', 400000, 'BEDOK', 'HDB', '', 3, 2, 900, '90000000-0000-4000-8000-000000000002', 'rejected', 'Synthetic rejection reason');

-- Catalog checks, evaluated as the connecting (superuser) role.
-- has_column_privilege is true for every column when a table-wide SELECT exists,
-- so the exact-set check is meaningful only together with the table-level check.
SELECT ok(NOT has_table_privilege('anon', 'public.properties', 'SELECT'),
 'PL-01 anon has no table-wide SELECT on public.properties');
SELECT is((SELECT array_agg(a.attname::text ORDER BY a.attname::text COLLATE "C")
  FROM pg_attribute a
  WHERE a.attrelid = 'public.properties'::regclass AND a.attnum > 0 AND NOT a.attisdropped
   AND has_column_privilege('anon', 'public.properties', a.attnum, 'SELECT')),
 ARRAY['area_sqft', 'bathrooms', 'bedrooms', 'created_at', 'id', 'image_url', 'location',
  'price', 'status', 'title', 'town', 'type']::text[],
 'PL-02 the columns anon can select are exactly the public allow-list');
SELECT ok(has_table_privilege('authenticated', 'public.properties', 'SELECT'),
 'PL-11 authenticated keeps table-wide SELECT on public.properties');

-- Anonymous reads. Each query scopes to the fixture ids so that other rows in
-- the database cannot change the result; row policies still apply.
SET LOCAL ROLE anon;

-- Home page featured listings.
SELECT is(public.contract_test_probe($$SELECT id, image_url, title, type, price, location, bedrooms, bathrooms, area_sqft
  FROM public.properties
  WHERE id IN ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004')
  ORDER BY created_at DESC LIMIT 3$$),
 '[{"id": "a0000000-0000-4000-8000-000000000001", "image_url": "https://example.invalid/image.jpg",
    "title": "Synthetic approved listing", "type": "HDB", "price": 400000, "location": "BEDOK",
    "bedrooms": 3, "bathrooms": 2, "area_sqft": 900}]'::jsonb,
 'PL-03a anon can run the home page query and receives the approved row only');
-- Listing counts page.
SELECT is(public.contract_test_probe($$SELECT id, town, location
  FROM public.properties
  WHERE status = 'approved' AND type = 'HDB'
   AND id IN ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004')
  ORDER BY id LIMIT 500 OFFSET 0$$),
 '[{"id": "a0000000-0000-4000-8000-000000000001", "town": "BEDOK", "location": "BEDOK"}]'::jsonb,
 'PL-03b anon can run the listing count page query and receives the approved row');
-- Exact count that accompanies the chatbot onboarding page request.
SELECT is(public.contract_test_probe($$SELECT count(*) AS n
  FROM public.properties
  WHERE status = 'approved' AND type = 'HDB'
   AND id IN ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002',
    'a0000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000004')$$),
 '[{"n": 1}]'::jsonb,
 'PL-03c anon can run the onboarding exact count query and counts the approved row');

-- Columns outside the allow-list are refused, one assertion per column.
SELECT throws_ok($$SELECT seller_name FROM public.properties$$,
 '42501', NULL, 'PL-04a anon cannot select seller_name');
SELECT throws_ok($$SELECT seller_phone FROM public.properties$$,
 '42501', NULL, 'PL-04b anon cannot select seller_phone');
SELECT throws_ok($$SELECT seller_id FROM public.properties$$,
 '42501', NULL, 'PL-04c anon cannot select seller_id');
SELECT throws_ok($$SELECT user_id FROM public.properties$$,
 '42501', NULL, 'PL-04d anon cannot select user_id');
SELECT throws_ok($$SELECT postal_code FROM public.properties$$,
 '42501', NULL, 'PL-04e anon cannot select postal_code');
SELECT throws_ok($$SELECT block_number FROM public.properties$$,
 '42501', NULL, 'PL-04f anon cannot select block_number');
SELECT throws_ok($$SELECT street_name FROM public.properties$$,
 '42501', NULL, 'PL-04g anon cannot select street_name');
SELECT throws_ok($$SELECT detailed_location FROM public.properties$$,
 '42501', NULL, 'PL-04h anon cannot select detailed_location');
SELECT throws_ok($$SELECT latitude FROM public.properties$$,
 '42501', NULL, 'PL-04i anon cannot select latitude');
SELECT throws_ok($$SELECT longitude FROM public.properties$$,
 '42501', NULL, 'PL-04j anon cannot select longitude');
SELECT throws_ok($$SELECT description FROM public.properties$$,
 '42501', NULL, 'PL-04k anon cannot select description');

-- Selecting every column is refused.
SELECT throws_ok($$SELECT * FROM public.properties$$,
 '42501', NULL, 'PL-05 anon cannot select every column');

-- Allowed columns selected while a private column is used as a filter or order.
SELECT throws_ok($$SELECT id FROM public.properties
  WHERE seller_id = '90000000-0000-4000-8000-000000000002'$$,
 '42501', NULL, 'PL-06a anon cannot filter on seller_id while selecting allowed columns');
SELECT throws_ok($$SELECT id FROM public.properties WHERE description ILIKE '%synthetic%'$$,
 '42501', NULL, 'PL-06b anon cannot filter on description while selecting allowed columns');
SELECT throws_ok($$SELECT id FROM public.properties ORDER BY seller_name$$,
 '42501', NULL, 'PL-06c anon cannot order by seller_name while selecting allowed columns');

-- Row visibility is unchanged: only approved rows are visible.
SELECT is(public.contract_test_probe($$SELECT id, status FROM public.properties
  WHERE id = 'a0000000-0000-4000-8000-000000000001'$$),
 '[{"id": "a0000000-0000-4000-8000-000000000001", "status": "approved"}]'::jsonb,
 'PL-07a anon can see the approved row');
SELECT is(public.contract_test_probe($$SELECT id, status FROM public.properties
  WHERE id = 'a0000000-0000-4000-8000-000000000002'$$),
 '[]'::jsonb, 'PL-07b anon cannot see the draft row');
SELECT is(public.contract_test_probe($$SELECT id, status FROM public.properties
  WHERE id = 'a0000000-0000-4000-8000-000000000003'$$),
 '[]'::jsonb, 'PL-07c anon cannot see the pending row');
SELECT is(public.contract_test_probe($$SELECT id, status FROM public.properties
  WHERE id = 'a0000000-0000-4000-8000-000000000004'$$),
 '[]'::jsonb, 'PL-07d anon cannot see the rejected row');
RESET ROLE;

-- Signed-in buyer: the property details column set and every column.
SELECT set_config('request.jwt.claims', '{"sub":"90000000-0000-4000-8000-000000000001","email":"contract-buyer@example.invalid","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT id, title, price, image_url, bedrooms, bathrooms, area_sqft, description, detailed_location,
  seller_name, seller_phone, built_year, photos, latitude, longitude
  FROM public.properties WHERE id = 'a0000000-0000-4000-8000-000000000001'$$,
 'PL-08a signed-in buyer can select the property details column set of an approved row');
SELECT lives_ok($$SELECT * FROM public.properties WHERE id = 'a0000000-0000-4000-8000-000000000001'$$,
 'PL-08b signed-in buyer can select every column of an approved row');
RESET ROLE;

-- Owner: every column of their own row.
SELECT set_config('request.jwt.claims', '{"sub":"90000000-0000-4000-8000-000000000002","email":"contract-owner@example.invalid","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT * FROM public.properties WHERE id = 'a0000000-0000-4000-8000-000000000002'$$,
 'PL-09 owner can select every column of their own draft row');
RESET ROLE;

-- Administrator: every column.
SELECT set_config('request.jwt.claims', '{"sub":"90000000-0000-4000-8000-000000000003","email":"contract-admin@example.invalid","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT * FROM public.properties$$,
 'PL-10 administrator can select every column');
RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
