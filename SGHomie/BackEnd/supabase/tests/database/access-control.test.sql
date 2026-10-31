-- Synthetic identities and listings only. Every fixture is rolled back.
-- Black-box role operations exercise actual PostgreSQL RLS and trigger branches.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT plan(47);

INSERT INTO auth.users (id, email) VALUES
 ('10000000-0000-4000-8000-000000000001', 'seller-a@example.invalid'),
 ('10000000-0000-4000-8000-000000000002', 'seller-b@example.invalid'),
 ('10000000-0000-4000-8000-000000000003', 'buyer@example.invalid'),
 ('10000000-0000-4000-8000-000000000004', 'admin@example.invalid');
INSERT INTO public.user_profiles (id, is_seller, is_admin) VALUES
 ('10000000-0000-4000-8000-000000000001', true, false),
 ('10000000-0000-4000-8000-000000000002', true, false),
 ('10000000-0000-4000-8000-000000000003', false, false),
 ('10000000-0000-4000-8000-000000000004', false, true);
INSERT INTO public.properties
 (id, title, price, location, type, image_url, bedrooms, bathrooms, area_sqft, seller_id, status)
VALUES
 ('20000000-0000-4000-8000-000000000001', 'Synthetic approved', 400000, 'BEDOK', 'HDB', '', 3, 2, 900, '10000000-0000-4000-8000-000000000001', 'approved'),
 ('20000000-0000-4000-8000-000000000002', 'Synthetic draft A', 400000, 'BEDOK', 'HDB', '', 3, 2, 900, '10000000-0000-4000-8000-000000000001', 'draft'),
 ('20000000-0000-4000-8000-000000000003', 'Synthetic draft B', 400000, 'BEDOK', 'HDB', '', 3, 2, 900, '10000000-0000-4000-8000-000000000002', 'draft');
INSERT INTO public.property_private_details (property_id, unit_number) VALUES
 ('20000000-0000-4000-8000-000000000002', '#01-01'),
 ('20000000-0000-4000-8000-000000000003', '#02-02');
INSERT INTO public.enquiries (id, name, email, phone, message) VALUES
 ('30000000-0000-4000-8000-000000000001', 'Synthetic buyer', 'BUYER@example.invalid', '80000000', 'Synthetic message'),
 ('30000000-0000-4000-8000-000000000002', 'Synthetic other', 'other@example.invalid', '80000000', 'Synthetic message');
INSERT INTO public.hdb_location_verifications
 (token, seller_id, postal_code, block_number, street_name, town, latitude, longitude, expires_at)
VALUES
 ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '123456', '123', 'SYNTHETIC ROAD', 'BEDOK', 1.32, 103.93, now() + interval '15 minutes'),
 ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '123456', '123', 'SYNTHETIC ROAD', 'BEDOK', 1.32, 103.93, now() - interval '1 minute');
INSERT INTO storage.objects (id, bucket_id, name, owner) VALUES
 ('50000000-0000-4000-8000-000000000001', 'property-images', '10000000-0000-4000-8000-000000000001/20000000-0000-4000-8000-000000000002/synthetic-a.png', '10000000-0000-4000-8000-000000000001'),
 ('50000000-0000-4000-8000-000000000002', 'property-images', '10000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000003/synthetic-b.png', '10000000-0000-4000-8000-000000000002');

SELECT ok((SELECT public FROM storage.buckets WHERE id='property-images'),
 'DB-37 property image bucket is public for approved listing URLs');
SELECT is((SELECT file_size_limit FROM storage.buckets WHERE id='property-images'),
 10485760::bigint, 'DB-38 property image bucket enforces its 10 MB object limit');
SELECT is((SELECT allowed_mime_types FROM storage.buckets WHERE id='property-images'),
 ARRAY['image/jpeg', 'image/png', 'image/webp']::text[],
 'DB-47 property image bucket permits only supported image MIME types');

SELECT ok((SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN
 ('public.user_profiles'::regclass, 'public.properties'::regclass, 'public.enquiries'::regclass,
  'public.property_private_details'::regclass, 'public.hdb_location_verifications'::regclass)),
 'DB-01 sensitive application tables have RLS enabled');
SELECT ok(NOT has_table_privilege('authenticated', 'public.hdb_location_verifications', 'SELECT'),
 'DB-02 authenticated users cannot read verification tokens');
SELECT ok(NOT has_table_privilege('anon', 'public.hdb_location_verifications', 'INSERT'),
 'DB-03 anonymous users cannot mint verification tokens');

SET LOCAL ROLE anon;
SELECT is((SELECT count(*) FROM public.properties), 1::bigint, 'DB-04 anonymous users see approved listings only');
SELECT is((SELECT count(*) FROM public.user_profiles), 0::bigint, 'DB-05 anonymous users cannot read profiles');
SELECT is((SELECT count(*) FROM public.enquiries), 0::bigint, 'DB-06 anonymous users cannot read enquiries');
SELECT throws_ok($$INSERT INTO public.enquiries (name,email,phone,message) VALUES
 ('Synthetic public', 'public@example.invalid', '80000000', 'Synthetic public message')$$,
 '42501', NULL, 'DB-07 anonymous visitors cannot submit an enquiry under the authenticated policy');
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001","email":"seller-a@example.invalid","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.user_profiles), 1::bigint, 'DB-08 seller reads own profile only');
SELECT throws_ok($$UPDATE public.user_profiles SET is_admin=true WHERE id=auth.uid()$$,
 'P0001', NULL, 'DB-09 seller cannot escalate to administrator');
SELECT is((SELECT count(*) FROM public.properties), 2::bigint, 'DB-10 seller sees approved and own draft');
SELECT is((SELECT count(*) FROM public.properties WHERE id='20000000-0000-4000-8000-000000000003'),
 0::bigint, 'DB-11 seller cannot read another seller draft');
WITH changed AS (UPDATE public.properties SET price=1
 WHERE id='20000000-0000-4000-8000-000000000003' RETURNING id)
SELECT is((SELECT count(*) FROM changed),
 0::bigint, 'DB-12 seller cannot update another seller listing');
WITH changed AS (UPDATE public.properties SET price=410000
 WHERE id='20000000-0000-4000-8000-000000000002' RETURNING price)
SELECT is((SELECT max(price) FROM changed), 410000::numeric,
 'DB-13 seller can edit price on own draft without new address verification');
SELECT throws_ok($$UPDATE public.properties SET status='approved'
 WHERE id='20000000-0000-4000-8000-000000000002'$$,
 '42501', NULL, 'DB-14 seller cannot approve own draft');
SELECT is((SELECT count(*) FROM public.property_private_details), 1::bigint, 'DB-15 seller reads own private unit only');
SELECT throws_ok($$INSERT INTO public.properties
 (title,price,location,type,image_url,bedrooms,bathrooms,area_sqft,seller_id,status)
 VALUES ('Synthetic unverified',400000,'BEDOK','HDB','',3,2,900,auth.uid(),'draft')$$,
 'P0001', 'A current HDB postal-code verification is required', 'DB-16 unverified seller insert is rejected');
SELECT throws_ok($$UPDATE public.properties SET hdb_verification_token='40000000-0000-4000-8000-000000000002'
 WHERE id='20000000-0000-4000-8000-000000000002'$$,
 'P0001', 'The HDB postal-code verification is invalid or expired', 'DB-17 expired verification token is rejected');
SELECT lives_ok($$UPDATE public.properties SET hdb_verification_token='40000000-0000-4000-8000-000000000001',
 latitude=0, longitude=0, postal_code='000000'
 WHERE id='20000000-0000-4000-8000-000000000002'$$,
 'DB-18 valid seller-bound token applies trusted address');
SELECT ok((SELECT hdb_verified AND latitude=1.32 AND longitude=103.93 AND postal_code='123456'
 AND hdb_verification_token IS NULL FROM public.properties WHERE id='20000000-0000-4000-8000-000000000002'),
 'DB-19 verified address overwrites spoofed fields and clears bearer token');
SELECT lives_ok($$INSERT INTO storage.objects (bucket_id, name, owner)
 VALUES ('property-images', auth.uid()::text || '/20000000-0000-4000-8000-000000000002/synthetic-new.png', auth.uid())$$,
 'DB-39 seller can upload an image under their own storage folder');
SELECT throws_ok($$INSERT INTO storage.objects (bucket_id, name, owner)
 VALUES ('property-images', '10000000-0000-4000-8000-000000000002/20000000-0000-4000-8000-000000000003/forbidden.png', auth.uid())$$,
 '42501', NULL, 'DB-40 seller cannot upload into another seller storage folder');
SELECT is((SELECT count(*) FROM storage.objects WHERE bucket_id='property-images'), 2::bigint,
 'DB-41 seller can see only their own property image metadata');
WITH changed AS (UPDATE storage.objects SET metadata='{"updated":"synthetic"}'::jsonb
 WHERE id='50000000-0000-4000-8000-000000000002' RETURNING id)
SELECT is((SELECT count(*) FROM changed), 0::bigint,
 'DB-42 seller cannot update another seller image metadata');
SELECT lives_ok($$UPDATE storage.objects SET metadata='{"updated":"synthetic"}'::jsonb
 WHERE id='50000000-0000-4000-8000-000000000001'$$,
 'DB-43 seller can update their own image metadata');
WITH removed AS (DELETE FROM storage.objects
 WHERE id='50000000-0000-4000-8000-000000000002' RETURNING id)
SELECT is((SELECT count(*) FROM removed), 0::bigint,
 'DB-44 seller cannot delete another seller image');
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002","email":"seller-b@example.invalid","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok($$UPDATE public.properties SET hdb_verification_token='40000000-0000-4000-8000-000000000001'
 WHERE id='20000000-0000-4000-8000-000000000003'$$,
 'P0001', 'The HDB postal-code verification is invalid or expired', 'DB-20 another seller cannot reuse verification token');
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003","email":"buyer@example.invalid","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.properties), 1::bigint, 'DB-21 buyer sees approved properties only');
SELECT is((SELECT count(*) FROM public.property_private_details), 0::bigint, 'DB-22 buyer cannot read private unit numbers');
SELECT is((SELECT count(*) FROM storage.objects WHERE bucket_id='property-images'), 0::bigint,
 'DB-45 buyer cannot read seller image metadata');
SELECT is((SELECT count(*) FROM public.enquiries), 1::bigint, 'DB-23 buyer sees own enquiries with case-insensitive email matching');
WITH changed AS (UPDATE public.enquiries SET admin_response='spoofed', status='RESPONDED'
 WHERE id='30000000-0000-4000-8000-000000000001' RETURNING id)
SELECT is((SELECT count(*) FROM changed),
 0::bigint, 'DB-24 buyer cannot answer own enquiry as administrator');
SELECT lives_ok($$INSERT INTO public.property_interests (property_id,user_id)
 VALUES ('20000000-0000-4000-8000-000000000001',auth.uid())$$,
 'DB-25 buyer can record own property interest');
SELECT throws_ok($$INSERT INTO public.property_interests (property_id,user_id)
 VALUES ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002')$$,
 '42501', NULL, 'DB-26 buyer cannot impersonate another user interest');
SELECT throws_ok($$INSERT INTO public.property_interests (property_id,user_id)
 VALUES ('20000000-0000-4000-8000-000000000001',auth.uid())$$,
 '23505', NULL, 'DB-27 duplicate property interest is rejected');
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004","email":"admin@example.invalid","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.properties), 3::bigint, 'DB-28 administrator can review all listings');
SELECT is((SELECT count(*) FROM public.property_private_details), 2::bigint, 'DB-29 administrator can inspect private units');
WITH changed AS (UPDATE public.properties SET status='approved'
 WHERE id='20000000-0000-4000-8000-000000000003' RETURNING status)
SELECT is((SELECT max(status) FROM changed), 'approved',
 'DB-30 administrator can approve a pending review item');
SELECT throws_ok($$UPDATE public.user_profiles SET is_seller=true WHERE id=auth.uid()$$,
 'P0001', 'An administrator cannot also be a seller', 'DB-31 administrator and seller roles remain exclusive');
WITH changed AS (UPDATE public.enquiries SET admin_response='Synthetic admin response',status='RESPONDED'
 WHERE id='30000000-0000-4000-8000-000000000001' RETURNING admin_response)
SELECT is((SELECT max(admin_response) FROM changed), 'Synthetic admin response',
 'DB-32 administrator can answer enquiries');
SELECT is((SELECT count(*) FROM storage.objects WHERE bucket_id='property-images'), 3::bigint,
 'DB-46 administrator can inspect property image metadata across sellers');
RESET ROLE;

-- Execute the PostgreSQL operator behind PostgREST imatch. SDK query-string
-- serialization is covered separately; these fixtures are deliberately synthetic.
SELECT ok('Synthetic 4-room HDB' ~* '(^|[^0-9])4[-[:space:]]+room([^[:alpha:]]|$)',
 'DB-33 4 ROOM pattern matches hyphenated listing text');
SELECT ok('Synthetic 4 ROOM HDB' ~* '(^|[^0-9])4[-[:space:]]+room([^[:alpha:]]|$)',
 'DB-34 4 ROOM pattern accepts case and whitespace variant');
SELECT ok(NOT ('Synthetic 14-room HDB' ~* '(^|[^0-9])4[-[:space:]]+room([^[:alpha:]]|$)')
 AND NOT ('Synthetic 4-roommate note' ~* '(^|[^0-9])4[-[:space:]]+room([^[:alpha:]]|$)'),
 'DB-35 room-type pattern excludes numeric and word suffix false matches');
SELECT ok('Synthetic Executive Apartment' ~* '(^|[^[:alpha:]])executive([^[:alpha:]]|$)'
 AND NOT ('Synthetic executivehouse' ~* '(^|[^[:alpha:]])executive([^[:alpha:]]|$)'),
 'DB-36 executive pattern is valid PostgreSQL case-insensitive regex');

SELECT * FROM finish();
ROLLBACK;
