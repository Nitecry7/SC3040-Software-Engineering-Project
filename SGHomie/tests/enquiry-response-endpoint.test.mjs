import assert from 'node:assert/strict';
import test from 'node:test';
import { edgeRequest, loadEdgeFunction } from './helpers/edge-function.mjs';

// Synthetic identities and email delivery stub; no messages are sent.
const env = { SUPABASE_URL: 'https://database.example.test', SUPABASE_ANON_KEY: 'fixture-anon', SUPABASE_SERVICE_ROLE_KEY: 'fixture-service', GMAIL_USER: 'fixture@example.test', GMAIL_APP_PASSWORD: 'fixture-password' };
const enquiryId = '11111111-1111-4111-8111-111111111111';
const body = { enquiryId, response: 'A fixture response' };

async function fixture(options = {}) {
  const operations = []; const emails = [];
  const { handler } = await loadEdgeFunction('send-enquiry-response', {
    env,
    createClient(url, key, config) {
      operations.push({ type: 'client', key, config });
      return {
        auth: { getUser: async () => ({ data: { user: options.invalidAuth ? null : { id: 'fixture-admin' } }, error: null }) },
        from(table) {
          if (table === 'user_profiles') return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { is_admin: options.admin !== false }, error: null }) }) }) };
          assert.equal(table, 'enquiries');
          return {
            select: () => ({ eq: (column, id) => { operations.push({ type: 'read', column, id }); return { single: async () => ({ data: { id, name: 'Fixture User', email: 'recipient@example.test' }, error: options.readFailure ? new Error('fixture-read-failed') : null }) }; } }),
            update: values => ({ eq: async (column, id) => { operations.push({ type: 'update', values, column, id }); return { error: options.updateFailure ? new Error('fixture-update-failed') : null }; } }),
          };
        },
      };
    },
    SMTPClient: class {
      async send(message) { emails.push(message); if (options.emailFailure) throw new Error('fixture-smtp-failed'); }
    },
  });
  return { handler, operations, emails };
}
const request = (payload = body, headers = { Authorization: 'Bearer fixture-jwt' }) => edgeRequest(payload, { headers });

test('BE-ENQ-01 preflight is available without authentication or external operations', async () => {
  const f = await fixture();
  assert.equal((await f.handler(edgeRequest({}, { method: 'OPTIONS' }))).status, 200);
  assert.equal(f.operations.length, 0);
});

test('BE-ENQ-02 anonymous callers cannot read enquiries write responses or send email', async () => {
  const f = await fixture();
  assert.equal((await f.handler(request(body, {}))).status, 401);
  assert.equal(f.operations.length, 0); assert.equal(f.emails.length, 0);
});

test('BE-ENQ-03 invalid sessions and non-admins are denied before enquiry access or email', async () => {
  for (const [options, status] of [[{ invalidAuth: true }, 401], [{ admin: false }, 403]]) {
    const f = await fixture(options);
    assert.equal((await f.handler(request())).status, status);
    assert.equal(f.operations.filter(op => ['read', 'update'].includes(op.type)).length, 0);
    assert.equal(f.emails.length, 0);
  }
});

test('BE-ENQ-04 authenticated admin can respond with caller validation before service-role enquiry access', async () => {
  const f = await fixture();
  const r = await f.handler(request());
  assert.equal(r.status, 200);
  assert.equal(f.operations[0].key, 'fixture-anon');
  assert.equal(f.operations[0].config.global.headers.Authorization, 'Bearer fixture-jwt');
  assert.equal(f.operations.find(op => op.type === 'update').values.status, 'RESPONDED');
  assert.equal(f.operations.find(op => op.type === 'update').id, enquiryId);
  assert.equal(f.emails.length, 1); assert.equal(f.emails[0].to, 'recipient@example.test');
  assert.match(f.emails[0].text, /A fixture response/);
  assert.ok(!JSON.stringify(await r.json()).includes('fixture-service'));
});

test('BE-ENQ-05 enquiry read or update failure prevents email and returns failure', async () => {
  for (const options of [{ readFailure: true }, { updateFailure: true }]) {
    const f = await fixture(options);
    assert.equal((await f.handler(request())).status, 500);
    assert.equal(f.emails.length, 0);
  }
});
