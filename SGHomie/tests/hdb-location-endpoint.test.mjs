import assert from 'node:assert/strict';
import test from 'node:test';
import { edgeRequest, loadEdgeFunction } from './helpers/edge-function.mjs';

// All addresses, credentials, tokens and records below are synthetic fixtures.
const baseEnv = { SUPABASE_URL: 'https://database.example.test', SUPABASE_ANON_KEY: 'fixture-anon',
  SUPABASE_SERVICE_ROLE_KEY: 'fixture-service', ONEMAP_EMAIL: 'fixture@example.test', ONEMAP_PASSWORD: 'fixture-password' };
const address = { POSTAL: '560123', BLK_NO: '123', ROAD_NAME: 'TEST AVENUE 1', ADDRESS: '123 TEST AVENUE 1', LATITUDE: '1.35', LONGITUDE: '103.85' };
const hdb = { blk_no: '123', street: 'TEST AVE 1', residential: 'Y', year_completed: '2000', bldg_contract_town: 'AMK' };

async function fixture(options = {}) {
  const calls = [];
  const writes = [];
  const env = { ...baseEnv, ...options.env };
  let tokenCount = 0;
  let searchCount = 0;
  const { handler, logs } = await loadEdgeFunction('lookup-hdb-location', {
    env,
    createClient(url, key, config) {
      calls.push({ kind: 'client', key, config });
      assert.equal(url, baseEnv.SUPABASE_URL);
      if (key === baseEnv.SUPABASE_ANON_KEY) return {
        auth: { getUser: async () => options.invalidAuth ? { data: { user: null }, error: new Error('fixture-invalid-jwt') }
          : { data: { user: { id: 'fixture-seller' } }, error: null } },
        from(table) {
          assert.equal(table, 'user_profiles');
          return { select: () => ({ eq: (column, id) => {
            assert.equal(column, 'id'); assert.equal(id, 'fixture-seller');
            return { single: async () => ({ data: { is_seller: options.seller !== false }, error: null }) };
          } }) };
        },
      };
      assert.equal(key, baseEnv.SUPABASE_SERVICE_ROLE_KEY);
      return { from(table) {
        assert.equal(table, 'hdb_location_verifications');
        return {
          delete: () => ({ eq: () => ({ lt: async () => ({ error: null }) }) }),
          insert: row => { writes.push(row); return { select: () => ({ single: async () => ({
            data: options.tokenWriteFailure ? null : { token: 'fixture-verification', expires_at: '2030-01-01T00:00:00Z' },
            error: options.tokenWriteFailure ? new Error('fixture-write-failed') : null,
          }) }) }; },
        };
      } };
    },
    async fetch(input, init = {}) {
      const url = new URL(String(input));
      calls.push({ kind: 'fetch', url, init });
      if (url.pathname.endsWith('/getToken')) {
        tokenCount++;
        assert.equal(init.method, 'POST');
        return options.authFailure ? new Response('upstream-private-message', { status: 503 }) : Response.json({ access_token: `fixture-map-token-${tokenCount}`, expiry_timestamp: 9_999_999_999 });
      }
      if (url.pathname.endsWith('/search')) {
        searchCount++;
        assert.equal(url.searchParams.get('searchVal'), '560123');
        if (options.rejectToken && (searchCount === 1 || options.rejectRefreshed)) return new Response('', { status: 401 });
        return Response.json({ results: options.results ?? [address] });
      }
      assert.equal(url.hostname, 'data.gov.sg');
      if (options.datasetFailure) return Response.json({ success: false, error: { message: 'private-upstream' } });
      const filters = JSON.parse(url.searchParams.get('filters'));
      if (options.fallback && filters.street) return Response.json({ success: true, result: { records: [] } });
      return Response.json({ success: true, result: { records: options.records ?? [hdb] } });
    },
  });
  return { handler, calls, writes, logs, counts: () => ({ tokenCount, searchCount }) };
}
const request = (body = { postalCode: '560123' }, options = {}) => edgeRequest(body, { headers: { Authorization: 'Bearer fixture-session' }, ...options });

test('BE-LOC-01 preflight and unsupported methods do not initialize clients or contact providers', async () => {
  const f = await fixture();
  assert.equal((await f.handler(request({}, { method: 'OPTIONS' }))).status, 200);
  assert.equal((await f.handler(request({}, { method: 'GET' }))).status, 405);
  assert.equal(f.calls.length, 0);
});

test('BE-LOC-02 missing session is rejected before SDK or provider access', async () => {
  const f = await fixture();
  const r = await f.handler(edgeRequest({ postalCode: '560123' }));
  assert.equal(r.status, 401); assert.equal(f.calls.length, 0);
});

test('BE-LOC-03 invalid session and buyer roles fail before address lookup or verification writes', async () => {
  for (const [options, expected] of [[{ invalidAuth: true }, 401], [{ seller: false }, 403]]) {
    const f = await fixture(options);
    assert.equal((await f.handler(request())).status, expected);
    assert.equal(f.calls.filter(call => call.kind === 'fetch').length, 0);
    assert.equal(f.writes.length, 0);
  }
});

test('BE-LOC-04 postal-code equivalence partitions reject malformed inputs before network access', async () => {
  for (const value of ['', '12345', '1234567', 'ABC123', -12345, 123.45, null, {}, ['560123']]) {
    const f = await fixture();
    const r = await f.handler(request({ postalCode: value }));
    assert.equal(r.status, 400, JSON.stringify(value));
    assert.equal((await r.json()).code, 'INVALID_POSTAL_CODE');
    assert.equal(f.calls.filter(call => call.kind === 'fetch').length, 0);
  }
});

test('BE-LOC-05 accepted postal formats normalize and produce seller-bound authoritative verification', async () => {
  for (const body of [{ postalCode: '560 123' }, { postal_code: 560123 }]) {
    const f = await fixture();
    const r = await f.handler(request(body));
    assert.equal(r.status, 200);
    const result = await r.json();
    assert.equal(result.valid, true);
    assert.equal(result.address.postalCode, '560123');
    assert.equal(result.address.town, 'ANG MO KIO');
    assert.equal(result.address.builtYear, 2000);
    assert.equal(result.address.latitude, 1.35);
    assert.equal(result.address.verificationToken, 'fixture-verification');
    assert.equal(f.writes[0].seller_id, 'fixture-seller');
    assert.equal(f.writes[0].postal_code, '560123');
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.ok(!JSON.stringify(result).includes('fixture-service'));
  }
});

test('BE-LOC-06 fuzzy postal matches are rejected without HDB queries or tokens', async () => {
  const f = await fixture({ results: [{ ...address, POSTAL: '560124' }] });
  const r = await f.handler(request());
  assert.equal((await r.json()).code, 'ADDRESS_NOT_FOUND');
  assert.equal(f.calls.filter(call => call.kind === 'fetch' && call.url.hostname === 'data.gov.sg').length, 0);
  assert.equal(f.writes.length, 0);
});

test('BE-LOC-07 street abbreviation fallback still requires the same block and street', async () => {
  const f = await fixture({ fallback: true, records: [{ ...hdb, street: 'OTHER AVE 1' }, { ...hdb, blk_no: '124' }, hdb] });
  const r = await f.handler(request());
  assert.equal((await r.json()).valid, true);
  const queries = f.calls.filter(call => call.kind === 'fetch' && call.url.hostname === 'data.gov.sg');
  assert.equal(queries.length, 2);
  assert.deepEqual(JSON.parse(queries[1].url.searchParams.get('filters')), { blk_no: '123' });
});

test('BE-LOC-08 unknown and nonresidential HDB addresses issue no verification token', async () => {
  for (const [records, code] of [[[], 'NOT_HDB'], [[{ ...hdb, residential: 'N' }], 'NOT_RESIDENTIAL_HDB']]) {
    const f = await fixture({ records });
    const result = await (await f.handler(request())).json();
    assert.equal(result.valid, false); assert.equal(result.code, code); assert.equal(f.writes.length, 0);
  }
});

test('BE-LOC-09 expired OneMap authentication refreshes once and cached fresh tokens are reused', async () => {
  const f = await fixture({ rejectToken: true });
  assert.equal((await (await f.handler(request())).json()).valid, true);
  assert.deepEqual(f.counts(), { tokenCount: 2, searchCount: 2 });
  assert.equal((await (await f.handler(request())).json()).valid, true);
  assert.deepEqual(f.counts(), { tokenCount: 2, searchCount: 3 });
});

test('BE-LOC-10 repeated token rejection stops after one refresh and returns service unavailability', async () => {
  const f = await fixture({ rejectToken: true, rejectRefreshed: true });
  const r = await f.handler(request());
  assert.equal(r.status, 503); assert.deepEqual(f.counts(), { tokenCount: 2, searchCount: 2 });
  assert.equal(f.writes.length, 0);
});

test('BE-LOC-11 upstream authentication and dataset failures cannot become verified addresses', async () => {
  for (const options of [{ authFailure: true }, { datasetFailure: true }, { env: { ONEMAP_PASSWORD: undefined } }]) {
    const f = await fixture(options);
    const r = await f.handler(request());
    assert.equal(r.status, 503); assert.equal(f.writes.length, 0);
    assert.ok(!JSON.stringify(await r.json()).includes('private-upstream'));
  }
});

test('BE-LOC-12 nonfinite coordinates and verification persistence failure fail closed', async () => {
  for (const options of [{ results: [{ ...address, LATITUDE: 'not-a-number' }] }, { tokenWriteFailure: true }]) {
    const f = await fixture(options);
    const r = await f.handler(request());
    assert.equal(r.status, 503); assert.notEqual((await r.json()).valid, true);
  }
});

test('BE-LOC-13 missing blank zero or geographically invalid coordinates cannot be verified as an HDB location', async () => {
  for (const coordinates of [
    { LATITUDE: '', LONGITUDE: '' }, { LATITUDE: null, LONGITUDE: null },
    { LATITUDE: '0', LONGITUDE: '0' }, { LATITUDE: '90', LONGITUDE: '180' },
    { LATITUDE: '1.35', LONGITUDE: '103.39' }, { LATITUDE: '1.61', LONGITUDE: '103.85' },
  ]) {
    const f = await fixture({ results: [{ ...address, ...coordinates }] });
    const r = await f.handler(request());
    assert.equal(r.status, 503, JSON.stringify(coordinates)); assert.equal(f.writes.length, 0);
  }
});
