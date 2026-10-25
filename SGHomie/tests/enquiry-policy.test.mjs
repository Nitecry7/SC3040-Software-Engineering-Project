import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(new URL('../BackEnd/supabase/migrations/20261026120000_authenticated_enquiry_insert.sql', import.meta.url), 'utf8');
const initial = readFileSync(new URL('../BackEnd/supabase/migrations/20250328092626_sghomie_initial.sql', import.meta.url), 'utf8');

test('enquiry insert migration removes anonymous inserts and permits authenticated inserts', () => {
  assert.match(migration, /DROP POLICY IF EXISTS "Anyone can create enquiries"\s+ON public\.enquiries/i);
  assert.match(migration, /CREATE POLICY "Authenticated users can create enquiries"\s+ON public\.enquiries\s+FOR INSERT\s+TO authenticated\s+WITH CHECK \([\s\S]*?auth\.uid\(\) IS NOT NULL[\s\S]*?lower\(email\) = lower\(auth\.jwt\(\) ->> 'email'\)[\s\S]*?status = 'PENDING'[\s\S]*?admin_response IS NULL[\s\S]*?\)/i);
  assert.doesNotMatch(migration, /TO\s+anon\s*,?\s*authenticated|TO\s+anon\b/i);
});

test('enquiry read and admin management policies remain unchanged', () => {
  assert.match(initial, /CREATE POLICY "Users can view their own enquiries"[\s\S]*?lower\(email\) = lower\(auth\.jwt\(\) ->> 'email'\)/i);
  assert.match(initial, /CREATE POLICY "Admins can manage all enquiries"[\s\S]*?ON public\.enquiries[\s\S]*?USING \(public\.is_admin\(\)\)[\s\S]*?WITH CHECK \(public\.is_admin\(\)\)/i);
  assert.doesNotMatch(migration, /property_interests/i);
});
