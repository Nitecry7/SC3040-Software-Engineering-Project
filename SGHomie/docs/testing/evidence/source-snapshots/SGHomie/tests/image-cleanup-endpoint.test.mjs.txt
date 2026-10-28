import assert from 'node:assert/strict';
import test from 'node:test';
import { edgeRequest, loadEdgeFunction } from './helpers/edge-function.mjs';

// Synthetic storage/database fixtures; this suite never contacts real storage.
const env = { SUPABASE_URL: 'https://database.example.test', SUPABASE_SERVICE_ROLE_KEY: 'fixture-server' };
const object = name => ({ name, id: `fixture-${name}`, metadata: { size: 12 } });
const publicUrl = path => `https://database.example.test/storage/v1/object/public/property-images/${path}`;

async function fixture(options = {}) {
  const deletes = []; const reads = []; const clients = [];
  const properties = options.properties ?? [];
  const storage = {
    async list(path, { offset, limit }) {
      reads.push({ path, offset, limit });
      if (options.listError) return { data: null, error: new Error('fixture-list-failed') };
      return { data: (options.objects?.[path] ?? []).slice(offset, offset + limit), error: null };
    },
    async remove(paths) { deletes.push([...paths]); return { error: options.removeError ? new Error('fixture-remove-failed') : null }; },
  };
  const { handler } = await loadEdgeFunction('cleanup-unlinked-property-images', {
    env: { ...env, ...options.env },
    createClient(url, key) {
      clients.push({ url, key });
      return { storage: { from: bucket => { assert.equal(bucket, 'property-images'); return storage; } },
        from: table => { assert.equal(table, 'properties'); return { select: columns => {
          assert.equal(columns, 'image_url, photos');
          const result = (start = 0, end = 999) => ({ data: properties.slice(start, end + 1), error: options.propertyError ? new Error('fixture-property-failed') : null });
          const query = { then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); },
            order(column, settings) { assert.equal(column, 'id'); assert.equal(settings.ascending, true); return query; },
            range: async (start, end) => result(start, end) };
          return query;
        } }; } };
    },
  });
  return { handler, deletes, reads, clients };
}
const request = headers => edgeRequest({}, { headers: { apikey: 'fixture-server', ...headers } });

test('BE-IMG-01 preflight and unsupported methods never initialize storage', async () => {
  const f = await fixture();
  assert.equal((await f.handler(edgeRequest({}, { method: 'OPTIONS' }))).status, 200);
  assert.equal((await f.handler(edgeRequest({}, { method: 'GET' }))).status, 405);
  assert.equal(f.clients.length, 0);
});

test('BE-IMG-02 anonymous and user-level callers cannot invoke privileged cleanup', async () => {
  const f = await fixture();
  for (const headers of [{}, { apikey: 'fixture-anon' }, { Authorization: 'Bearer fixture-user' }]) {
    assert.equal((await f.handler(edgeRequest({}, { headers }))).status, 401);
  }
  assert.equal(f.clients.length, 0); assert.equal(f.deletes.length, 0);
});

test('BE-IMG-03 configured server keys work through apikey and Bearer authentication', async () => {
  for (const headers of [{ apikey: 'fixture-server' }, { Authorization: 'Bearer fixture-server' }]) {
    const f = await fixture();
    assert.equal((await f.handler(edgeRequest({}, { headers }))).status, 200);
    assert.equal(f.clients[0].key, 'fixture-server');
  }
  const f = await fixture({ env: { SUPABASE_SERVICE_ROLE_KEY: undefined, SUPABASE_SECRET_KEYS: '{"default":"fixture-new-secret","ignored":7}' } });
  assert.equal((await f.handler(edgeRequest({}, { headers: { apikey: 'fixture-new-secret' } }))).status, 200);
  assert.equal(f.clients[0].key, 'fixture-new-secret');
});

test('BE-IMG-04 public signed encoded and legacy linked paths are preserved while external URLs do not protect unrelated files', async () => {
  const f = await fixture({ properties: [{ image_url: publicUrl('seller/main%20photo.jpg'), photos: [
    'https://database.example.test/storage/v1/object/sign/property-images/seller/signed.jpg?token=fixture',
    'property-images/seller/legacy.jpg', publicUrl('seller/main%20photo.jpg'), 'https://external.example.test/unrelated.jpg', null] }],
  objects: { '': [{ name: 'seller', id: null, metadata: null }], seller: ['main photo.jpg', 'signed.jpg', 'legacy.jpg', 'unrelated.jpg'].map(object) } });
  const r = await f.handler(request());
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, bucket: 'property-images', linkedCount: 3, scannedCount: 4, deletedCount: 1 });
  assert.deepEqual(f.deletes, [['seller/unrelated.jpg']]);
});

test('BE-IMG-05 paginated storage traversal and 100-object deletion batches cover every orphan exactly once', async () => {
  const objects = Array.from({ length: 1001 }, (_, i) => object(`fixture-${i}.jpg`));
  const f = await fixture({ objects: { '': objects } });
  const result = await (await f.handler(request())).json();
  assert.equal(result.scannedCount, 1001); assert.equal(result.deletedCount, 1001);
  assert.deepEqual(f.reads.map(read => read.offset), [0, 1000]);
  assert.deepEqual(f.deletes.map(batch => batch.length), [...Array(10).fill(100), 1]);
  assert.equal(new Set(f.deletes.flat()).size, 1001);
});

test('BE-IMG-06 images linked by properties beyond the first database page are never deleted', async () => {
  const properties = Array.from({ length: 1000 }, () => ({ image_url: null, photos: [] }));
  properties.push({ image_url: publicUrl('must-survive.jpg'), photos: [] });
  const f = await fixture({ properties, objects: { '': [object('must-survive.jpg'), object('orphan.jpg')] } });
  const result = await (await f.handler(request())).json();
  assert.equal(result.linkedCount, 1);
  assert.deepEqual(f.deletes, [['orphan.jpg']]);
});

test('BE-IMG-07 database and storage listing failures stop before any deletion', async () => {
  for (const options of [{ propertyError: true }, { listError: true }]) {
    const f = await fixture({ ...options, objects: { '': [object('orphan.jpg')] } });
    assert.equal((await f.handler(request())).status, 500); assert.equal(f.deletes.length, 0);
  }
});

test('BE-IMG-08 failed deletion returns an error rather than a successful cleanup count', async () => {
  const f = await fixture({ removeError: true, objects: { '': [object('orphan.jpg')] } });
  const r = await f.handler(request());
  assert.equal(r.status, 500); assert.equal((await r.json()).ok, undefined);
});
