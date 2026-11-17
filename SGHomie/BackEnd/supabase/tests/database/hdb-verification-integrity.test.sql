-- Synthetic identities and listings only. Every fixture is rolled back.
-- Invariant: a listing with hdb_verified = true carries location fields that
-- match the verification that set them, after every write by a signed-in user.
-- Each assertion reads the stored row, so it observes the result of all
-- BEFORE triggers on public.properties.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT plan(40);

INSERT INTO auth.users (id, email) VALUES
 ('60000000-0000-4000-8000-000000000001', 'verify-seller-a@example.invalid'),
 ('60000000-0000-4000-8000-000000000002', 'verify-seller-b@example.invalid');
INSERT INTO public.user_profiles (id, is_seller, is_admin) VALUES
 ('60000000-0000-4000-8000-000000000001', true, false),
 ('60000000-0000-4000-8000-000000000002', true, false);

-- Verification tokens. Centroids for reference: BEDOK 1.3236/103.9273,
-- TAMPINES 1.3496/103.9454. No token coordinate equals a centroid.
--   ...01 original address, BEDOK
--   ...02 new address in another town (TAMPINES)
--   ...03 new address in the same town (BEDOK), different coordinates
--   ...04 address in another town (TAMPINES) whose coordinates equal ...01
--   ...05 address whose lookup returned no town (stored as PENDING)
--   ...06 expired token for seller A
--   ...07 current token issued to seller B
INSERT INTO public.hdb_location_verifications
 (token, seller_id, postal_code, block_number, street_name, town, built_year, latitude, longitude, verified_at, expires_at)
VALUES
 ('80000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', '111111', '11', 'ALPHA ROAD', 'BEDOK', 1990, 1.3300, 103.9400, '2026-11-01 00:00:00+00', now() + interval '15 minutes'),
 ('80000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000001', '222222', '22', 'BETA AVENUE', 'TAMPINES', 2005, 1.3600, 103.9600, '2026-11-02 00:00:00+00', now() + interval '15 minutes'),
 ('80000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000001', '333333', '33', 'GAMMA STREET', 'BEDOK', 1995, 1.3350, 103.9450, '2026-11-03 00:00:00+00', now() + interval '15 minutes'),
 ('80000000-0000-4000-8000-000000000004', '60000000-0000-4000-8000-000000000001', '444444', '44', 'DELTA CLOSE', 'TAMPINES', 2010, 1.3300, 103.9400, '2026-11-04 00:00:00+00', now() + interval '15 minutes'),
 ('80000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000001', '555555', '55', 'EPSILON DRIVE', '', 2001, 1.3400, 103.9000, '2026-11-05 00:00:00+00', now() + interval '15 minutes'),
 ('80000000-0000-4000-8000-000000000006', '60000000-0000-4000-8000-000000000001', '666666', '66', 'ZETA WALK', 'BEDOK', 1999, 1.3310, 103.9410, '2026-11-06 00:00:00+00', now() - interval '1 minute'),
 ('80000000-0000-4000-8000-000000000007', '60000000-0000-4000-8000-000000000002', '777777', '77', 'ETA PLACE', 'BEDOK', 2000, 1.3320, 103.9420, '2026-11-07 00:00:00+00', now() + interval '15 minutes');

-- Unverified legacy listing, inserted before any role switch (trusted write).
INSERT INTO public.properties
 (id, title, price, location, type, image_url, bedrooms, bathrooms, area_sqft, detailed_location, seller_id, status)
VALUES
 ('70000000-0000-4000-8000-000000000013', 'Synthetic legacy listing', 400000, 'BEDOK', 'HDB', '', 3, 2, 900, 'Legacy original text', '60000000-0000-4000-8000-000000000001', 'draft');

-- Verified listing with no stored detailed location, written by a trusted write.
INSERT INTO public.properties
 (id, title, price, location, type, image_url, bedrooms, bathrooms, area_sqft, detailed_location, seller_id, status,
  hdb_verified, postal_code, block_number, street_name, town, latitude, longitude, location_verified_at)
VALUES
 ('70000000-0000-4000-8000-000000000014', 'Synthetic verified listing without detailed location', 400000, 'BEDOK', 'HDB', '', 3, 2, 900, NULL,
  '60000000-0000-4000-8000-000000000001', 'draft',
  true, '111111', '11', 'ALPHA ROAD', 'BEDOK', 1.3300, 103.9400, '2026-11-01 00:00:00+00');

SELECT set_config('request.jwt.claims', '{"sub":"60000000-0000-4000-8000-000000000001","email":"verify-seller-a@example.invalid","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

-- Verified fixtures are created through real token-bound inserts by seller A.
-- Ids ...02 to ...10 start from token ...01; id ...11 starts from token ...05.
-- The client-supplied detailed_location equals the canonical value for token ...01.
SELECT lives_ok($$INSERT INTO public.properties
 (id, title, price, location, type, image_url, bedrooms, bathrooms, area_sqft, detailed_location, seller_id, status, hdb_verification_token)
 VALUES
 ('70000000-0000-4000-8000-000000000002', 'Synthetic main', 400000, 'BEDOK', 'HDB', '', 3, 2, 900, 'Block 11 ALPHA ROAD', auth.uid(), 'draft', '80000000-0000-4000-8000-000000000001'),
 ('70000000-0000-4000-8000-000000000003', 'Synthetic location case', 400000, 'BEDOK', 'HDB', '', 3, 2, 900, 'Block 11 ALPHA ROAD', auth.uid(), 'draft', '80000000-0000-4000-8000-000000000001'),
 ('70000000-0000-4000-8000-000000000004', 'Synthetic year case', 400000, 'BEDOK', 'HDB', '', 3, 2, 900, 'Block 11 ALPHA ROAD', auth.uid(), 'draft', '80000000-0000-4000-8000-000000000001'),
 ('70000000-0000-4000-8000-000000000005', 'Synthetic address text case', 400000, 'BEDOK', 'HDB', '', 3, 2, 900, 'Block 11 ALPHA ROAD', auth.uid(), 'draft', '80000000-0000-4000-8000-000000000001'),
 ('70000000-0000-4000-8000-000000000006', 'Synthetic town case', 400000, 'BEDOK', 'HDB', '', 3, 2, 900, 'Block 11 ALPHA ROAD', auth.uid(), 'draft', '80000000-0000-4000-8000-000000000001'),
 ('70000000-0000-4000-8000-000000000007', 'Synthetic guarded column case', 400000, 'BEDOK', 'HDB', '', 3, 2, 900, 'Block 11 ALPHA ROAD', auth.uid(), 'draft', '80000000-0000-4000-8000-000000000001'),
 ('70000000-0000-4000-8000-000000000008', 'Synthetic other town reverification', 400000, 'BEDOK', 'HDB', '', 3, 2, 900, 'Block 11 ALPHA ROAD', auth.uid(), 'draft', '80000000-0000-4000-8000-000000000001'),
 ('70000000-0000-4000-8000-000000000009', 'Synthetic same town reverification', 400000, 'BEDOK', 'HDB', '', 3, 2, 900, 'Block 11 ALPHA ROAD', auth.uid(), 'draft', '80000000-0000-4000-8000-000000000001'),
 ('70000000-0000-4000-8000-000000000010', 'Synthetic same coordinates reverification', 400000, 'BEDOK', 'HDB', '', 3, 2, 900, 'Block 11 ALPHA ROAD', auth.uid(), 'draft', '80000000-0000-4000-8000-000000000001'),
 ('70000000-0000-4000-8000-000000000011', 'Synthetic no-town listing', 400000, 'BEDOK', 'HDB', '', 3, 2, 900, 'Block 55 EPSILON DRIVE', auth.uid(), 'draft', '80000000-0000-4000-8000-000000000005'),
 ('70000000-0000-4000-8000-000000000012', 'Synthetic trusted write case', 400000, 'BEDOK', 'HDB', '', 3, 2, 900, 'Block 11 ALPHA ROAD', auth.uid(), 'draft', '80000000-0000-4000-8000-000000000001')$$,
 'HV-F1 verified fixture listings are created through token-bound inserts');

-- Test 4: a verified insert stores the token values, not client-supplied ones.
SELECT lives_ok($$INSERT INTO public.properties
 (id, title, price, location, type, image_url, bedrooms, bathrooms, area_sqft, seller_id, status,
  town, built_year, detailed_location, postal_code, block_number, street_name, latitude, longitude, hdb_verification_token)
 VALUES
 ('70000000-0000-4000-8000-000000000001', 'Synthetic client values', 400000, 'YISHUN', 'HDB', '', 3, 2, 900, auth.uid(), 'draft',
  'YISHUN', 1970, 'Client supplied text', '999999', '99', 'CLIENT ROAD', 1.0, 104.0, '80000000-0000-4000-8000-000000000001')$$,
 'HV-04a insert with client-supplied location fields and a valid token succeeds');
SELECT ok(COALESCE((SELECT postal_code = '111111' AND block_number = '11' AND street_name = 'ALPHA ROAD'
 AND location = 'BEDOK' AND town = 'BEDOK' AND built_year = 1990
 AND latitude = 1.3300 AND longitude = 103.9400
 AND hdb_verified AND hdb_verification_token IS NULL
 FROM public.properties WHERE id = '70000000-0000-4000-8000-000000000001'), false),
 'HV-04b verified insert stores the token postal code, block, street, location, town, built year and coordinates');
SELECT is((SELECT detailed_location FROM public.properties WHERE id = '70000000-0000-4000-8000-000000000001'),
 'Block 11 ALPHA ROAD'::text,
 'HV-04c verified insert stores the canonical detailed location built from the token');

-- Tests 2, 3 and 5: permitted edits keep the row verified and keep coordinates.
SELECT lives_ok($$UPDATE public.properties SET price = 450000, description = 'Synthetic description edit'
 WHERE id = '70000000-0000-4000-8000-000000000002'$$,
 'HV-02a owner can edit price and description on a verified listing');
SELECT ok(COALESCE((SELECT price = 450000 AND description = 'Synthetic description edit' AND hdb_verified
 FROM public.properties WHERE id = '70000000-0000-4000-8000-000000000002'), false),
 'HV-02b price and description edit is stored and the listing stays verified');
SELECT lives_ok($$UPDATE public.properties SET location = 'BEDOK', town = 'BEDOK', built_year = 1990,
 detailed_location = 'Block 11 ALPHA ROAD', postal_code = '111111', block_number = '11', street_name = 'ALPHA ROAD',
 latitude = 1.33, longitude = 103.94, hdb_verified = true, location_verified_at = '2026-11-01 00:00:00+00',
 hdb_verification_token = NULL, status = 'pending'
 WHERE id = '70000000-0000-4000-8000-000000000002'$$,
 'HV-03a update that resends unchanged location fields succeeds');
SELECT ok(COALESCE((SELECT hdb_verified AND location = 'BEDOK' AND town = 'BEDOK' AND built_year = 1990
 AND detailed_location = 'Block 11 ALPHA ROAD' AND postal_code = '111111'
 FROM public.properties WHERE id = '70000000-0000-4000-8000-000000000002'), false),
 'HV-03b resent unchanged location fields leave the verified row unchanged');
SELECT ok(COALESCE((SELECT latitude = 1.3300 AND longitude = 103.9400
 FROM public.properties WHERE id = '70000000-0000-4000-8000-000000000002'), false),
 'HV-05 coordinates are unchanged after permitted edits');

-- Test 1: location, built year, detailed location and a differing town cannot
-- be changed on a verified listing without a current verification.
SELECT throws_ok($$UPDATE public.properties SET location = 'TAMPINES'
 WHERE id = '70000000-0000-4000-8000-000000000003'$$,
 'P0001', 'A current HDB postal-code verification is required',
 'HV-01a location change on a verified listing requires a current verification');
SELECT throws_ok($$UPDATE public.properties SET built_year = 1999
 WHERE id = '70000000-0000-4000-8000-000000000004'$$,
 'P0001', 'A current HDB postal-code verification is required',
 'HV-01b built year change on a verified listing requires a current verification');
SELECT throws_ok($$UPDATE public.properties SET detailed_location = 'Rewritten address text'
 WHERE id = '70000000-0000-4000-8000-000000000005'$$,
 'P0001', 'A current HDB postal-code verification is required',
 'HV-01c detailed location change on a verified listing requires a current verification');
SELECT throws_ok($$UPDATE public.properties SET town = 'TAMPINES'
 WHERE id = '70000000-0000-4000-8000-000000000006'$$,
 'P0001', 'A current HDB postal-code verification is required',
 'HV-01d town differing from the row location requires a current verification');

-- Test 12: each previously guarded column still requires a verification.
SELECT throws_ok($$UPDATE public.properties SET postal_code = '999999'
 WHERE id = '70000000-0000-4000-8000-000000000007'$$,
 'P0001', 'A current HDB postal-code verification is required',
 'HV-12a postal code change requires a current verification');
SELECT throws_ok($$UPDATE public.properties SET block_number = '99'
 WHERE id = '70000000-0000-4000-8000-000000000007'$$,
 'P0001', 'A current HDB postal-code verification is required',
 'HV-12b block number change requires a current verification');
SELECT throws_ok($$UPDATE public.properties SET street_name = 'CLIENT ROAD'
 WHERE id = '70000000-0000-4000-8000-000000000007'$$,
 'P0001', 'A current HDB postal-code verification is required',
 'HV-12c street name change requires a current verification');
SELECT throws_ok($$UPDATE public.properties SET latitude = 1.5
 WHERE id = '70000000-0000-4000-8000-000000000007'$$,
 'P0001', 'A current HDB postal-code verification is required',
 'HV-12d latitude change requires a current verification');
SELECT throws_ok($$UPDATE public.properties SET longitude = 104.0
 WHERE id = '70000000-0000-4000-8000-000000000007'$$,
 'P0001', 'A current HDB postal-code verification is required',
 'HV-12e longitude change requires a current verification');
SELECT throws_ok($$UPDATE public.properties SET hdb_verified = false
 WHERE id = '70000000-0000-4000-8000-000000000007'$$,
 'P0001', 'A current HDB postal-code verification is required',
 'HV-12f verified flag change requires a current verification');
SELECT throws_ok($$UPDATE public.properties SET location_verified_at = '2026-12-01 00:00:00+00'
 WHERE id = '70000000-0000-4000-8000-000000000007'$$,
 'P0001', 'A current HDB postal-code verification is required',
 'HV-12g verification timestamp change requires a current verification');

-- Test 13: a token issued to another seller and an expired token are rejected.
SELECT throws_ok($$UPDATE public.properties SET hdb_verification_token = '80000000-0000-4000-8000-000000000007'
 WHERE id = '70000000-0000-4000-8000-000000000007'$$,
 'P0001', 'The HDB postal-code verification is invalid or expired',
 'HV-13a token issued to another seller is rejected on a verified listing');
SELECT throws_ok($$UPDATE public.properties SET hdb_verification_token = '80000000-0000-4000-8000-000000000006'
 WHERE id = '70000000-0000-4000-8000-000000000007'$$,
 'P0001', 'The HDB postal-code verification is invalid or expired',
 'HV-13b expired token is rejected on a verified listing');
SELECT ok(COALESCE((SELECT postal_code = '111111' AND block_number = '11' AND street_name = 'ALPHA ROAD'
 AND latitude = 1.3300 AND longitude = 103.9400 AND hdb_verified
 AND location_verified_at = '2026-11-01 00:00:00+00'::timestamptz
 FROM public.properties WHERE id = '70000000-0000-4000-8000-000000000007'), false),
 'HV-12h rejected writes leave the verified address fields unchanged');

-- Test 6: reverification to a new address in another town replaces every
-- location field and both coordinates together.
SELECT lives_ok($$UPDATE public.properties SET hdb_verification_token = '80000000-0000-4000-8000-000000000002',
 location = 'TAMPINES', town = 'TAMPINES', detailed_location = '22 BETA AVENUE 1'
 WHERE id = '70000000-0000-4000-8000-000000000008'$$,
 'HV-06a reverification to a new address in another town succeeds');
SELECT ok(COALESCE((SELECT postal_code = '222222' AND block_number = '22' AND street_name = 'BETA AVENUE'
 AND location = 'TAMPINES' AND town = 'TAMPINES' AND built_year = 2005
 AND latitude = 1.3600 AND longitude = 103.9600
 AND location_verified_at = '2026-11-02 00:00:00+00'::timestamptz
 AND hdb_verified AND hdb_verification_token IS NULL
 FROM public.properties WHERE id = '70000000-0000-4000-8000-000000000008'), false),
 'HV-06b reverification stores the new token postal code, block, street, location, town, built year, coordinates and timestamp');
SELECT is((SELECT detailed_location FROM public.properties WHERE id = '70000000-0000-4000-8000-000000000008'),
 'Block 22 BETA AVENUE'::text,
 'HV-06c reverification stores the canonical detailed location for the new block and street');

-- Test 7: reverification within the same town keeps the new token coordinates.
SELECT lives_ok($$UPDATE public.properties SET hdb_verification_token = '80000000-0000-4000-8000-000000000003',
 location = 'BEDOK', town = 'BEDOK', detailed_location = '33 GAMMA STREET'
 WHERE id = '70000000-0000-4000-8000-000000000009'$$,
 'HV-07a reverification to a new address in the same town succeeds');
SELECT ok(COALESCE((SELECT postal_code = '333333' AND latitude = 1.3350 AND longitude = 103.9450
 FROM public.properties WHERE id = '70000000-0000-4000-8000-000000000009'), false),
 'HV-07b same-town reverification stores the new token coordinates, not the old ones or the town centroid');

-- Test 8: a new address in another town whose coordinates equal the old ones
-- keeps the token coordinates instead of a town centroid.
SELECT lives_ok($$UPDATE public.properties SET hdb_verification_token = '80000000-0000-4000-8000-000000000004',
 location = 'TAMPINES', town = 'TAMPINES', detailed_location = '44 DELTA CLOSE'
 WHERE id = '70000000-0000-4000-8000-000000000010'$$,
 'HV-08a reverification to another town with unchanged coordinates succeeds');
SELECT ok(COALESCE((SELECT latitude = 1.3300 AND longitude = 103.9400
 FROM public.properties WHERE id = '70000000-0000-4000-8000-000000000010'), false),
 'HV-08b reverification keeps the token coordinates rather than a town centroid');
SELECT ok(COALESCE((SELECT postal_code = '444444' AND block_number = '44' AND street_name = 'DELTA CLOSE'
 AND location = 'TAMPINES' AND town = 'TAMPINES' AND built_year = 2010
 AND location_verified_at = '2026-11-04 00:00:00+00'::timestamptz AND hdb_verified
 FROM public.properties WHERE id = '70000000-0000-4000-8000-000000000010'), false),
 'HV-08c reverification stores the new token address fields');

-- Test 10: a verified listing without a town accepts an ordinary edit that
-- also resends town equal to location, as the seller edit form does.
SELECT ok(COALESCE((SELECT location = 'PENDING' AND town IS NULL AND hdb_verified
 FROM public.properties WHERE id = '70000000-0000-4000-8000-000000000011'), false),
 'HV-10a verified fixture without a town is stored with location PENDING and a null town');
SELECT lives_ok($$UPDATE public.properties SET price = 500000, location = 'PENDING', town = 'PENDING'
 WHERE id = '70000000-0000-4000-8000-000000000011'$$,
 'HV-10b price edit that resends town equal to location succeeds on a listing without a town');
SELECT ok(COALESCE((SELECT price = 500000 AND hdb_verified AND location = 'PENDING'
 AND latitude = 1.3400 AND longitude = 103.9000
 FROM public.properties WHERE id = '70000000-0000-4000-8000-000000000011'), false),
 'HV-10c listing without a town stays verified with unchanged coordinates after the edit');

-- Test 11: an unverified legacy listing keeps its current edit behaviour.
SELECT lives_ok($$UPDATE public.properties SET location = 'TAMPINES', town = 'TAMPINES', built_year = 1985,
 detailed_location = 'Legacy edited text'
 WHERE id = '70000000-0000-4000-8000-000000000013'$$,
 'HV-11a owner can edit location, town, built year and detailed location on an unverified listing');
SELECT ok(COALESCE((SELECT location = 'TAMPINES' AND town = 'TAMPINES' AND built_year = 1985
 AND detailed_location = 'Legacy edited text' AND NOT hdb_verified
 FROM public.properties WHERE id = '70000000-0000-4000-8000-000000000013'), false),
 'HV-11b unverified listing stores the edited location fields and stays unverified');

-- An absent and an empty detailed location are treated as equal on a verified
-- listing, as the seller edit form resends an absent value as an empty string.
SELECT lives_ok($$UPDATE public.properties SET price = 460000, detailed_location = ''
 WHERE id = '70000000-0000-4000-8000-000000000014'$$,
 'HV-14a edit that resends an absent detailed location as empty succeeds on a verified listing');
SELECT ok(COALESCE((SELECT price = 460000 AND hdb_verified
 FROM public.properties WHERE id = '70000000-0000-4000-8000-000000000014'), false),
 'HV-14b price edit is stored and the listing stays verified');
RESET ROLE;

-- Test 9: a write with no signed-in user keeps the trusted-write bypass.
SELECT set_config('request.jwt.claims', '{}', true);
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT lives_ok($$UPDATE public.properties SET built_year = 1980, detailed_location = 'Trusted write text',
 postal_code = '888888', latitude = 1.31
 WHERE id = '70000000-0000-4000-8000-000000000012'$$,
 'HV-09a write without a signed-in user is not blocked by the verification guard');
SELECT ok(COALESCE((SELECT built_year = 1980 AND detailed_location = 'Trusted write text'
 AND postal_code = '888888' AND latitude = 1.31 AND hdb_verified
 FROM public.properties WHERE id = '70000000-0000-4000-8000-000000000012'), false),
 'HV-09b write without a signed-in user is stored as supplied');

SELECT * FROM finish();
ROLLBACK;
