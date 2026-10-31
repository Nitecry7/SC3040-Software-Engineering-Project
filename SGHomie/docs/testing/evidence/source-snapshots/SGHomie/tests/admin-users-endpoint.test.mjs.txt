import assert from 'node:assert/strict';
import test from 'node:test';
import { edgeRequest, loadEdgeFunction } from './helpers/edge-function.mjs';

// Synthetic admin/profile fixtures only; no real account data is read.
const env = { SUPABASE_URL: 'https://database.example.test', SUPABASE_ANON_KEY: 'fixture-anon', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service' };
async function fixture(options = {}) {
  const operations = [];
  const { handler } = await loadEdgeFunction('get-admin-users', {
    env: { ...env, ...options.env },
    createClient(url, key, config) {
      operations.push({ type: 'client', key, config });
      if (key === env.SUPABASE_ANON_KEY) return { auth: { getUser: async () => ({ data: { user: options.invalidAuth ? null : { id: 'fixture-admin' } }, error: null }) } };
      assert.equal(key, env.SUPABASE_SERVICE_ROLE_KEY);
      return {
        auth: { admin: { getUserById: async id => {
          operations.push({ type: 'email', id });
          if (options.emailThrows) throw new Error('fixture-email-failed');
          return { data: { user: { email: `${id}@example.test` } }, error: options.emailError ? new Error('fixture-email-failed') : null };
        } } },
        from(table) {
          return { select(columns) {
            if (columns === 'is_admin') return { eq: (column, id) => {
              operations.push({ type: 'role', column, id });
              return { maybeSingle: async () => ({ data: options.noProfile ? null : { is_admin: options.admin !== false }, error: options.roleError ? new Error('fixture-role-failed') : null }) };
            } };
            operations.push({ type: 'read', table });
            if (table === 'user_profiles') return Promise.resolve({ data: [{ id: 'fixture-seller' }, { id: 'fixture-buyer' }], error: options.profileError ? new Error('fixture-profile-failed') : null });
            assert.equal(table, 'user_property_counts');
            return Promise.resolve({ data: [{ seller_id: 'fixture-seller', property_count: '3' }], error: options.countError ? new Error('fixture-count-failed') : null });
          } };
        },
      };
    },
  });
  return { handler, operations };
}
const request = () => edgeRequest({}, { headers: { Authorization: 'Bearer fixture-session' } });

test('BE-ADM-01 CORS preflight does not initialize any Supabase client', async () => {
  const f = await fixture();
  assert.equal((await f.handler(edgeRequest({}, { method: 'OPTIONS' }))).status, 204);
  assert.equal(f.operations.length, 0);
});

test('BE-ADM-02 missing or invalid sessions cannot initialize the privileged client', async () => {
  const missing = await fixture();
  assert.equal((await missing.handler(edgeRequest({}))).status, 401);
  assert.equal(missing.operations.length, 0);
  const invalid = await fixture({ invalidAuth: true });
  assert.equal((await invalid.handler(request())).status, 401);
  assert.deepEqual(invalid.operations.map(op => op.key), ['fixture-anon']);
});

test('BE-ADM-03 buyer seller and absent profile cannot enumerate users counts or auth emails', async () => {
  for (const options of [{ admin: false }, { noProfile: true }]) {
    const f = await fixture(options);
    assert.equal((await f.handler(request())).status, 403);
    assert.equal(f.operations.filter(op => ['read', 'email'].includes(op.type)).length, 0);
    assert.equal(f.operations.find(op => op.type === 'role').id, 'fixture-admin');
  }
});

test('BE-ADM-04 admin enumeration preserves profiles joins counts and adds emails only after authorization', async () => {
  const f = await fixture();
  const r = await f.handler(request());
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { data: [
    { id: 'fixture-seller', email: 'fixture-seller@example.test', property_count: 3 },
    { id: 'fixture-buyer', email: 'fixture-buyer@example.test', property_count: 0 },
  ], status: 'success' });
  assert.equal(f.operations[0].config.global.headers.Authorization, 'Bearer fixture-session');
  assert.ok(f.operations.findIndex(op => op.type === 'role') < f.operations.findIndex(op => op.type === 'read'));
});

test('BE-ADM-05 per-user auth email errors and throws degrade to Unknown without dropping profiles', async () => {
  for (const options of [{ emailError: true }, { emailThrows: true }]) {
    const f = await fixture(options);
    const r = await f.handler(request());
    assert.equal(r.status, 200);
    const result = await r.json();
    assert.equal(result.data.length, 2);
    assert.ok(result.data.every(row => row.email === 'Unknown'));
    assert.equal(result.data[0].property_count, 3);
  }
});

test('BE-ADM-06 required configuration role and database failures return errors instead of success', async () => {
  for (const options of [{ env: { SUPABASE_SERVICE_ROLE_KEY: undefined } }, { roleError: true }, { profileError: true }, { countError: true }]) {
    const f = await fixture(options);
    const r = await f.handler(request());
    assert.equal(r.status, 500); assert.equal((await r.json()).status, 'error');
    assert.equal(f.operations.filter(op => op.type === 'email').length, 0);
  }
});
