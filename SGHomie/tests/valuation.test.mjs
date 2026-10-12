import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  buildValuationRequest,
  createValuationHandler,
  effectiveRemainingLeaseMonths,
  storeyRangeMidpoint,
  VALUATION_FEATURE_ORDER,
} from '../BackEnd/supabase/functions/_shared/valuation.ts';

const property = {
  id: 'd9b0e75d-a13f-4cad-8b27-c0d426e7a101',
  area_sqft: 1100,
  price: 550000,
  town: 'TAMPINES',
  block_number: '123',
  street_name: 'TAMPINES ST 11',
  flat_type: '4 ROOM',
  flat_model: 'Improved',
  storey_range: '04 TO 06',
  storey_mid: 5,
  remaining_lease_months: 992,
  remaining_lease_as_of_month: '2026-10-01',
  valuation_inputs_source: 'demo',
  demo_batch_id: 'sghomie-test-2026-10-07-2e3e55',
  hdb_verified: false,
  status: 'approved',
};

const upstreamResult = {
  estimated_value: 600000,
  lower_bound: 540000,
  upper_bound: 660000,
  interval_half_width: 60000,
  interval_full_width: 120000,
  coverage_target: 0.9,
  model_version: 'hdb-catboost-2025-12-v1',
  uncertainty_method: 'town_conformal',
  uncertainty_group: 'TAMPINES',
  uncertainty_support: 42,
  used_global_fallback: false,
  price_position: 'within_estimated_market_range',
};

function makeRequest(body = { property_id: property.id }, token = 'user-jwt') {
  return new Request('http://local/functions/v1/valuation', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function dependencies(overrides = {}) {
  const state = { property: structuredClone(property), fetchCalls: [], clientCalls: [] };
  const deps = {
    supabaseUrl: 'http://127.0.0.1:54321',
    supabaseAnonKey: 'local-anon-key',
    renderApiUrl: 'https://valuation.example.test/v1/valuation/predict',
    renderServiceToken: 'server-secret-value',
    allowDemoInputs: 'true',
    allowHostedDemoInputs: undefined,
    now: () => new Date('2026-10-12T03:00:00.000Z'),
    createUserClient(url, anonKey, authorization) {
      state.clientCalls.push({ url, anonKey, authorization });
      return {
        auth: { async getUser() { return { data: { user: { id: 'user-1' } }, error: null }; } },
        from(table) {
          assert.equal(table, 'properties');
          return { select(columns) {
            state.selectedColumns = columns;
            return { eq(column, id) {
              assert.equal(column, 'id');
              state.selectedId = id;
              return { async maybeSingle() { return { data: state.property, error: null }; } };
            } };
          } };
        },
      };
    },
    async fetcher(url, options) {
      state.fetchCalls.push({ url, options });
      return Response.json(upstreamResult);
    },
    timeoutMs: 120_000,
    ...overrides,
  };
  return { deps, state };
}

test('lease reference advances by whole calendar months and rejects invalid states', () => {
  assert.equal(effectiveRemainingLeaseMonths(992, '2026-10-01', { year: 2026, month: 10 }), 992);
  assert.equal(effectiveRemainingLeaseMonths(992, '2026-10-01', { year: 2026, month: 11 }), 991);
  assert.equal(effectiveRemainingLeaseMonths(992, '2026-10-01', { year: 2027, month: 10 }), 980);
  assert.throws(() => effectiveRemainingLeaseMonths(992, '2026-11-01', { year: 2026, month: 10 }), /future/);
  assert.throws(() => effectiveRemainingLeaseMonths(1, '2026-10-01', { year: 2026, month: 11 }), /exhausted/);
  assert.throws(() => effectiveRemainingLeaseMonths(1, '2026-13-01', { year: 2026, month: 11 }), /month/);
  assert.throws(() => effectiveRemainingLeaseMonths(0, '2026-10-01', { year: 2026, month: 10 }), /stored lease/);
});

test('feature mapping follows the CatBoost contract and keeps asking price outside features', () => {
  const mapped = buildValuationRequest(property, { year: 2026, month: 11 });
  assert.deepEqual(Object.keys(mapped.features), VALUATION_FEATURE_ORDER);
  assert.equal(mapped.features.floor_area_sqm, 1100 / 10.7639);
  assert.equal(mapped.features.remaining_lease_months, 991);
  assert.equal(mapped.asking_price, 550000);
  assert.equal('price' in mapped.features, false);
  assert.equal('asking_price' in mapped.features, false);
});

test('demo storey range follows the training midpoint convention', () => {
  assert.equal(storeyRangeMidpoint('04 TO 06'), 5);
  assert.equal(storeyRangeMidpoint('07 TO 08'), 7.5);
  for (const malformed of [null, '', '4 TO 6', '00 TO 02', '08 TO 07', '01 TO 100', ' 04 TO 06']) {
    assert.equal(storeyRangeMidpoint(malformed), null);
  }
});

test('local demo fixtures are eligible only with both explicit local gates', async () => {
  const { deps, state } = dependencies();
  const response = await createValuationHandler(deps)(makeRequest());
  assert.equal(response.status, 200);
  assert.equal(state.fetchCalls.length, 1);
  const upstreamPayload = JSON.parse(state.fetchCalls[0].options.body);
  assert.deepEqual(Object.keys(upstreamPayload).filter((key) => key !== 'coverage' && key !== 'asking_price'), VALUATION_FEATURE_ORDER);
  assert.equal(upstreamPayload.asking_price, 550000);
  assert.equal(upstreamPayload.transaction_year, 2026);
  assert.equal(upstreamPayload.transaction_month, 10);
  assert.equal(state.clientCalls[0].authorization, 'Bearer user-jwt');
  assert.match(state.selectedColumns, /demo_batch_id/);
  assert.match(state.selectedColumns, /status/);

  const hosted = dependencies({ supabaseUrl: 'https://project.supabase.co', allowDemoInputs: 'true' });
  const hostedResponse = await createValuationHandler(hosted.deps)(makeRequest());
  assert.equal(hostedResponse.status, 409);
  assert.equal(hosted.state.fetchCalls.length, 0);

  const hostedFlagMustNotEnableLocal = dependencies({ allowDemoInputs: 'false', allowHostedDemoInputs: 'true' });
  assert.equal((await createValuationHandler(hostedFlagMustNotEnableLocal.deps)(makeRequest())).status, 409);
  assert.equal(hostedFlagMustNotEnableLocal.state.fetchCalls.length, 0);

  const flagOff = dependencies({ allowDemoInputs: 'false' });
  assert.equal((await createValuationHandler(flagOff.deps)(makeRequest())).status, 409);

  const addressVerifiedDemo = dependencies();
  addressVerifiedDemo.state.property.hdb_verified = true;
  assert.equal((await createValuationHandler(addressVerifiedDemo.deps)(makeRequest())).status, 200);

  for (const invalidRange of [null, 'bad range', '07 TO 09']) {
    const invalidDemo = dependencies();
    invalidDemo.state.property.storey_range = invalidRange;
    const rejected = await createValuationHandler(invalidDemo.deps)(makeRequest());
    assert.equal(rejected.status, 409);
    assert.equal(invalidDemo.state.fetchCalls.length, 0);
  }
});

test('hosted demos require the independent hosted flag, canonical provenance and approved status', async () => {
  for (const hostedFlag of [undefined, 'false']) {
    const rejected = dependencies({ supabaseUrl: 'https://project.supabase.co', allowHostedDemoInputs: hostedFlag });
    rejected.state.property.seller_id = 'synthetic-seller-1';
    rejected.state.property.user_id = 'synthetic-user-1';
    assert.equal((await createValuationHandler(rejected.deps)(makeRequest())).status, 409);
    assert.equal(rejected.state.fetchCalls.length, 0);
  }

  for (const batch of ['sghomie-test-2026-10-07-2e3e55', 'sghomie-test-2026-10-07-extra30-12f05f']) {
    for (const verified of [false, true]) {
      const accepted = dependencies({ supabaseUrl: 'https://project.supabase.co', allowHostedDemoInputs: 'true' });
      accepted.state.property.demo_batch_id = batch;
      accepted.state.property.hdb_verified = verified;
      accepted.state.property.seller_id = 'synthetic-seller-1';
      accepted.state.property.user_id = 'synthetic-user-1';
      const response = await createValuationHandler(accepted.deps)(makeRequest());
      assert.equal(response.status, 200);
      assert.equal(accepted.state.fetchCalls.length, 1);
    }
  }

  for (const change of [
    (row) => { row.demo_batch_id = null; },
    (row) => { row.demo_batch_id = 'unapproved-batch'; },
    (row) => { row.status = 'draft'; },
    (row) => { row.status = 'pending'; },
    (row) => { row.flat_type = null; },
    (row) => { row.storey_mid = 6; },
    (row) => { row.storey_range = 'invalid'; },
  ]) {
    const rejected = dependencies({ supabaseUrl: 'https://project.supabase.co', allowHostedDemoInputs: 'true' });
    change(rejected.state.property);
    const response = await createValuationHandler(rejected.deps)(makeRequest());
    assert.equal(response.status, 409);
    assert.equal(rejected.state.fetchCalls.length, 0);
  }
});

test('verified complete seller inputs pass; incomplete and unverified rows fail closed', async () => {
  const seller = dependencies();
  seller.state.property.valuation_inputs_source = 'seller_supplied';
  seller.state.property.hdb_verified = true;
  seller.state.property.demo_batch_id = null;
  seller.state.property.storey_range = null;
  assert.equal((await createValuationHandler(seller.deps)(makeRequest())).status, 200);

  for (const change of [
    (row) => { row.valuation_inputs_source = 'legacy'; },
    (row) => { row.flat_model = null; row.valuation_inputs_source = 'seller_supplied'; row.hdb_verified = true; },
    (row) => { row.valuation_inputs_source = 'seller_supplied'; row.hdb_verified = false; },
    (row) => { row.valuation_inputs_source = 'seller_supplied'; row.hdb_verified = true; row.demo_batch_id = 'sghomie-test-2026-10-07-2e3e55'; },
  ]) {
    const fixture = dependencies();
    change(fixture.state.property);
    const response = await createValuationHandler(fixture.deps)(makeRequest());
    assert.equal(response.status, 409);
    assert.equal(fixture.state.fetchCalls.length, 0);
  }
});

test('caller-scoped property lookup preserves RLS and inaccessible rows are indistinguishable', async () => {
  const fixture = dependencies();
  fixture.deps.createUserClient = (url, key, authorization) => {
    fixture.state.clientCalls.push({ url, key, authorization });
    return {
      auth: { async getUser() { return { data: { user: { id: 'user-1' } }, error: null }; } },
      from() { return { select() { return { eq() { return { async maybeSingle() { return { data: null, error: null }; } }; } }; } }; },
    };
  };
  const response = await createValuationHandler(fixture.deps)(makeRequest());
  assert.equal(response.status, 404);
  assert.equal(fixture.state.fetchCalls.length, 0);
  assert.equal(fixture.state.clientCalls[0].authorization, 'Bearer user-jwt');
});

test('authentication, request shape, lease and upstream response are validated safely', async () => {
  const authFixture = dependencies();
  assert.equal((await createValuationHandler(authFixture.deps)(makeRequest(undefined, ''))).status, 401);
  assert.equal((await createValuationHandler(authFixture.deps)(makeRequest({ property_id: property.id, price: 1 }))).status, 400);
  assert.equal(authFixture.state.fetchCalls.length, 0);

  const rejectedUser = dependencies();
  rejectedUser.deps.createUserClient = () => ({
    auth: { async getUser() { return { data: { user: null }, error: new Error('invalid token') }; } },
    from() { throw new Error('property access must not run'); },
  });
  assert.equal((await createValuationHandler(rejectedUser.deps)(makeRequest())).status, 401);
  assert.equal(rejectedUser.state.fetchCalls.length, 0);

  const invalidLease = dependencies();
  invalidLease.state.property.remaining_lease_as_of_month = '2026-11-01';
  assert.equal((await createValuationHandler(invalidLease.deps)(makeRequest())).status, 409);

  const malformed = dependencies({ fetcher: async () => Response.json({ ...upstreamResult, upper_bound: 'secret upstream detail' }) });
  const response = await createValuationHandler(malformed.deps)(makeRequest());
  assert.equal(response.status, 502);
  const text = await response.text();
  assert.equal(text.includes('secret upstream detail'), false);
  assert.equal(text.includes('server-secret-value'), false);
});

test('canonical seed contains both deterministic batches and removes only obsolete seed signatures', async () => {
  const seed = await readFile(new URL('../BackEnd/supabase/seed.sql', import.meta.url), 'utf8');
  const fixtures = [...seed.matchAll(/^-- fixture: batch=(\S+) id=([0-9a-f-]+) flat_type=(.*?) flat_model=(.*?) storey_range=(\d{2} TO \d{2}) storey_mid=(\d+(?:\.\d+)?) lease=(\d+) block=(\S+) street=(.*?) latitude=([\d.]+) longitude=([\d.]+)$/gm)];
  assert.equal(fixtures.length, 50);
  assert.equal(new Set(fixtures.map((match) => match[2])).size, 50);
  assert.deepEqual(
    Object.fromEntries(['sghomie-test-2026-10-07-2e3e55', 'sghomie-test-2026-10-07-extra30-12f05f'].map((batch) => [
      batch,
      fixtures.filter((match) => match[1] === batch).length,
    ])),
    { 'sghomie-test-2026-10-07-2e3e55': 20, 'sghomie-test-2026-10-07-extra30-12f05f': 30 },
  );
  for (const match of fixtures) {
    const [, batch, id, flatType, flatModel, storeyRange, midpoint, lease, block, street, latitude, longitude] = match;
    const row = seed.split(/\r?\n/).find((line) => line.trimStart().startsWith(`('${id}',`));
    assert.ok(row, `fixture ${id} must have a static SQL row`);
    const [low, high] = storeyRange.split(' TO ').map(Number);
    assert.equal(Number(midpoint), (low + high) / 2, `fixture ${id} midpoint must match its range`);
    assert.match(row, new RegExp(`, '${block}', '${street}', '${flatType}', '${flatModel}', '${storeyRange}', ${midpoint}, ${lease}, DATE '2026-10-01', 'demo', '${batch}', false,`));
    assert.ok(row.includes(`Batch ${batch}`), `fixture ${id} must retain its batch provenance`);
    assert.ok(row.endsWith(`, ${latitude}, ${longitude}, 'approved'),` ) || row.endsWith(`, ${latitude}, ${longitude}, 'approved')`), `fixture ${id} coordinate pair must be preserved`);
  }
  assert.equal((seed.match(/DATE '2026-10-01'/g) ?? []).length, 50);
  assert.match(seed, /ON CONFLICT \(id\) DO UPDATE SET/);
  assert.match(seed, /valuation_inputs_source, demo_batch_id, hdb_verified/);
  assert.match(seed, /demo_batch_id = EXCLUDED\.demo_batch_id/);
  assert.match(seed, /seller_id = NULL/);
  assert.match(seed, /user_id = NULL/);
  assert.match(seed, /seller_name = NULL/);
  assert.match(seed, /seller_phone = NULL/);
  assert.doesNotMatch(seed, /data\/raw|sghomie-demo-listings-2026-10-07\.csv/);
  const deleteSection = seed.split('INSERT INTO public.properties')[0];
  assert.equal((deleteSection.match(/\('(?:Cozy|Spacious|Charming|Modern|Affordable|Waterfront|Renovated)[^']*', 'Block /g) ?? []).length, 9);
  for (const [title, address] of [
    ['Cozy 4-Room HDB in Tampines', 'Block 123 Tampines Street 11'],
    ['Spacious 5-Room HDB in Woodlands', 'Block 456 Woodlands Drive 16'],
    ['Charming 3-Room HDB in Bedok', 'Block 789 Bedok North Road'],
    ['Cozy 3-Room Flat in Ang Mo Kio Central', 'Block 556 Ang Mo Kio Avenue 10'],
    ['Spacious 4-Room with City View', 'Block 342 Ang Mo Kio Avenue 1'],
    ['Modern Executive Apartment in Tampines', 'Block 823 Tampines Street 81'],
    ['Affordable 2-Room Starter Home', 'Block 167 Woodlands Street 11'],
    ['Waterfront 4-Room with Balcony', 'Block 268C Punggol Field'],
    ['Renovated 3-Room near Bedok Mall', 'Block 123 Bedok North Street 2'],
  ]) {
    assert.ok(deleteSection.includes(`('${title}', '${address}', 'Demo Seller')`));
  }
  assert.match(deleteSection, /property\.title = obsolete\.title/);
  assert.match(deleteSection, /property\.detailed_location = obsolete\.detailed_location/);
  assert.match(deleteSection, /property\.seller_name = obsolete\.seller_name/);
  assert.doesNotMatch(deleteSection, /valuation_inputs_source\s*=\s*'demo'/);
});

test('valuation migrations preserve legacy inputs and validate optional storey ranges', async () => {
  const migration = await readFile(new URL('../BackEnd/supabase/migrations/20261012120000_property_valuation_inputs.sql', import.meta.url), 'utf8');
  const storeyMigration = await readFile(new URL('../BackEnd/supabase/migrations/20261013120000_property_storey_range.sql', import.meta.url), 'utf8');
  const coordinateMigration = await readFile(new URL('../BackEnd/supabase/migrations/20261013130000_preserve_explicit_property_coordinates.sql', import.meta.url), 'utf8');
  const provenanceMigration = await readFile(new URL('../BackEnd/supabase/migrations/20261013140000_property_demo_batch_provenance.sql', import.meta.url), 'utf8');
  const approvedDemoMigration = await readFile(new URL('../BackEnd/supabase/migrations/20261013150000_require_approved_demo_valuations.sql', import.meta.url), 'utf8');
  assert.equal(migration.includes('UPDATE public.properties'), false);
  assert.match(migration, /DEFAULT 'legacy'/);
  assert.match(migration, /hdb_verified = false/);
  assert.match(storeyMigration, /ADD COLUMN IF NOT EXISTS storey_range text/);
  assert.match(storeyMigration, /storey_range IS NULL/);
  assert.match(storeyMigration, /storey_mid =/);
  assert.match(coordinateMigration, /NEW\.latitude IS NULL OR NEW\.longitude IS NULL/);
  assert.match(coordinateMigration, /NEW\.latitude IS NOT DISTINCT FROM OLD\.latitude/);
  assert.match(provenanceMigration, /ADD COLUMN IF NOT EXISTS demo_batch_id text/);
  assert.match(provenanceMigration, /demo_batch_id IS NULL[\s\S]*valuation_inputs_source = 'demo'/);
  assert.match(provenanceMigration, /demo_batch_id IS NULL\s+OR/);
  assert.match(provenanceMigration, /demo_batch_id IS NOT NULL[\s\S]*seller_id IS NULL[\s\S]*user_id IS NULL/);
  assert.doesNotMatch(provenanceMigration, /hdb_verified\s*=\s*false/);
  assert.doesNotMatch(provenanceMigration, /NOT VALID/i);
  assert.match(provenanceMigration, /storey_range IS NOT NULL/);
  assert.match(provenanceMigration, /sghomie-test-2026-10-07-2e3e55/);
  assert.match(provenanceMigration, /sghomie-test-2026-10-07-extra30-12f05f/);
  assert.match(approvedDemoMigration, /DROP CONSTRAINT IF EXISTS properties_demo_valuation_inputs_check/);
  assert.match(approvedDemoMigration, /demo_batch_id IS NOT NULL[\s\S]*status = 'approved'/);
  assert.doesNotMatch(approvedDemoMigration, /seller_id|user_id/);
  assert.doesNotMatch(approvedDemoMigration, /NOT VALID/i);
  assert.match(approvedDemoMigration, /flat_type IS NOT NULL[\s\S]*flat_model IS NOT NULL[\s\S]*storey_range IS NOT NULL[\s\S]*storey_mid IS NOT NULL/);
});
