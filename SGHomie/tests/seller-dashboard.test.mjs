import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { setImmediate } from 'node:timers/promises';
import test from 'node:test';
import { componentHarness, content, nodes } from './helpers/frontend-component.mjs';

function sellerHarness({
  session = null,
  addressLookup = { data: null, error: null },
  propertyRows = [],
  privateDetails = [],
  confirmResult = true,
} = {}) {
  const calls = [];
  const functionCalls = [];
  const errors = [];
  const successes = [];
  const searchParams = new URLSearchParams();
  const app = componentHarness(new URL('../FrontEnd/src/pages/SellerDashboard.tsx', import.meta.url), {
    'react-router-dom': {
      useNavigate: () => () => {},
      useSearchParams: () => [searchParams, () => {}],
    },
    '../contexts/AuthContext': { useAuth: () => ({ user: { id: 'synthetic-seller' }, isAdmin: false }) },
    '../lib/supabase': {
      supabase: {
        from(table) {
          const query = { table };
          const builder = {
            select(...args) { calls.push([table, 'select', ...args]); return builder; },
            eq(...args) { calls.push([table, 'eq', ...args]); return builder; },
            order: async (...args) => { calls.push([table, 'order', ...args]); return { data: table === 'properties' ? propertyRows : [], error: null }; },
            in: async (...args) => { calls.push([table, 'in', ...args]); return { data: privateDetails, error: null }; },
            insert(...args) {
              calls.push([table, 'insert', ...args]);
              if (table === 'properties') {
                const row = args[0][0];
                return { select: () => ({ single: async () => ({ data: row, error: null }) }) };
              }
              return Promise.resolve({ error: null });
            },
            update(...args) { calls.push([table, 'update', ...args]); return builder; },
            delete() { calls.push([table, 'delete']); return builder; },
            upsert: async (...args) => { calls.push([table, 'upsert', ...args]); return { error: null }; },
            then(resolve, reject) { return Promise.resolve({ error: null }).then(resolve, reject); },
          };
          return builder;
        },
        storage: { from: () => ({
          upload: async (...args) => { calls.push(['storage', 'upload', ...args]); return { error: null }; },
          getPublicUrl: path => ({ data: { publicUrl: `https://storage.example.invalid/${path}` } }),
          remove: async paths => { calls.push(['storage', 'remove', paths]); return { error: null }; },
        }) },
        auth: { getSession: async () => ({ data: { session } }) },
      },
      functionsSupabase: { functions: {
        setAuth(token) { functionCalls.push(['setAuth', token]); },
        invoke: async (...args) => { functionCalls.push(args); return addressLookup; },
      } },
    },
    '../components/LocationMapPreview': { default: 'LocationMapPreview' },
    'lucide-react': {},
    'react-hot-toast': { default: {
      success: message => successes.push(message), error: message => errors.push(message),
    } },
  }, {}, {
    crypto: webcrypto,
    URL: { createObjectURL: () => 'blob:synthetic-image' },
    window: {
      addEventListener() {},
      removeEventListener() {},
      location: { reload() {} },
    },
    confirm: () => confirmResult,
  });
  return { ...app, calls, functionCalls, errors, successes };
}

function formField(app, labelText) {
  const find = node => {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) return node.map(find).find(Boolean) || null;
    if (node.type === 'div') {
      const children = Array.isArray(node.props.children) ? node.props.children : [node.props.children];
      const label = children.find(child => child?.type === 'label' && content(child).includes(labelText));
      const control = children.find(child => child?.type === 'input' || child?.type === 'select' || child?.type === 'textarea');
      if (label && control) return control;
    }
    return find(node.props?.children);
  };
  const control = find(app.render());
  assert.ok(control, `field ${labelText} exists`);
  return control;
}

test('FE-SELLER-01 seller listing form stays disabled until the address is verified and unit is valid', async () => {
  const app = sellerHarness();
  app.render();
  await app.effects();
  await setImmediate();

  nodes(app.render()).find(node => node.type === 'button' && content(node).includes('Add Property')).props.onClick();
  const submit = nodes(app.render()).find(node => node.type === 'button' && node.props.type === 'submit');
  assert.equal(submit.props.disabled, true);
  assert.match(content(app.render()), /Verify HDB address/);
  assert.equal(app.calls.some(call => ['insert', 'update'].includes(call[1])), false);
  assert.deepEqual(app.errors, []);
});

test('FE-SELLER-02 missing or malformed postal code cannot invoke address verification', async () => {
  const app = sellerHarness();
  app.render();
  await app.effects();
  await setImmediate();
  nodes(app.render()).find(node => node.type === 'button' && content(node).includes('Add Property')).props.onClick();

  const lookup = nodes(app.render()).find(node => node.type === 'button' && content(node) === 'Find Address');
  await lookup.props.onClick();

  assert.deepEqual(app.errors, ['Enter a valid 6-digit Singapore postal code']);
  assert.deepEqual(app.functionCalls, []);
  assert.equal(app.calls.some(call => ['insert', 'update'].includes(call[1])), false);
});

test('FE-SELLER-03 verified address lookup populates trusted location fields and unit access', async () => {
  const addressLookup = { data: { valid: true, address: {
    postalCode: '560123', blockNumber: '123', streetName: 'Synthetic Street', town: 'ANG MO KIO',
    builtYear: 1998, latitude: 1.37, longitude: 103.85, verificationToken: 'synthetic-token',
    verificationExpiresAt: '2099-01-01T00:00:00.000Z',
  } }, error: null };
  const app = sellerHarness({ session: { access_token: 'synthetic-access-token' }, addressLookup });
  app.render();
  await app.effects();
  await setImmediate();
  nodes(app.render()).find(node => node.type === 'button' && content(node).includes('Add Property')).props.onClick();

  const postalCode = nodes(app.render()).find(node => node.type === 'input' && node.props.placeholder === 'e.g. 560123');
  postalCode.props.onChange({ target: { value: '56a0123' } });
  assert.equal(nodes(app.render()).find(node => node.type === 'input' && node.props.placeholder === 'e.g. 560123').props.value, '560123');
  await nodes(app.render()).find(node => node.type === 'button' && content(node) === 'Find Address').props.onClick();

  assert.deepEqual(JSON.parse(JSON.stringify(app.functionCalls)), [
    ['setAuth', 'synthetic-access-token'],
    ['lookup-hdb-location', { body: { postalCode: '560123' } }],
  ]);
  assert.match(content(app.render()), /Block 123 Synthetic Street/);
  assert.match(content(app.render()), /Verified/);
  const unitNumber = nodes(app.render()).find(node => node.type === 'input' && node.props.placeholder === 'e.g. #08-123');
  assert.equal(unitNumber.props.disabled, false);
  assert.deepEqual(app.errors, []);
  assert.deepEqual(app.successes, ['HDB address verified and map updated']);
});

test('FE-SELLER-04 verified seller form uploads its image and submits an owner-bound pending listing', async () => {
  const addressLookup = { data: { valid: true, address: {
    postalCode: '560123', blockNumber: '123', streetName: 'Synthetic Street', town: 'ANG MO KIO',
    builtYear: 1998, latitude: 1.37, longitude: 103.85, verificationToken: 'synthetic-token',
    verificationExpiresAt: '2099-01-01T00:00:00.000Z',
  } }, error: null };
  const app = sellerHarness({ session: { access_token: 'synthetic-access-token' }, addressLookup });
  app.render();
  await app.effects();
  await setImmediate();
  nodes(app.render()).find(node => node.type === 'button' && content(node).includes('Add Property')).props.onClick();

  const field = labelText => formField(app, labelText);
  field('Postal Code').props.onChange({ target: { value: '560123' } });
  await nodes(app.render()).find(node => node.type === 'button' && content(node) === 'Find Address').props.onClick();
  field('Unit Number').props.onChange({ target: { value: '#08-123' } });
  field('Unit Number').props.onBlur();
  field('Title').props.onChange({ target: { value: 'Synthetic Ang Mo Kio HDB' } });
  field('Price (SGD)').props.onChange({ target: { value: '500000' } });
  field('Bedrooms').props.onChange({ target: { value: '3' } });
  field('Bathrooms').props.onChange({ target: { value: '2' } });
  field('Area (sqft)').props.onChange({ target: { value: '1000' } });
  field('Seller Name').props.onChange({ target: { value: 'Synthetic Seller' } });
  nodes(app.render()).find(node => node.type === 'input' && node.props['aria-label'] === 'Phone number')
    .props.onChange({ target: { value: '91234567' } });
  field('Description').props.onChange({ target: { value: 'Synthetic listing for automated testing.' } });

  const image = nodes(app.render()).find(node => node.type === 'input' && node.props.type === 'file' && !node.props.multiple);
  image.props.onChange({ target: { files: [{ name: 'synthetic.png', type: 'image/png', size: 1024 }], value: '' } });
  await nodes(app.render()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });

  const inserted = app.calls.find(call => call[0] === 'properties' && call[1] === 'insert')?.[2]?.[0];
  assert.ok(inserted);
  assert.match(inserted.id, /^[0-9a-f-]{36}$/i);
  assert.equal(inserted.title, 'Synthetic Ang Mo Kio HDB');
  assert.equal(inserted.price, 500000);
  assert.equal(inserted.bedrooms, 3);
  assert.equal(inserted.status, 'pending');
  assert.equal(inserted.hdb_verification_token, 'synthetic-token');
  assert.equal(inserted.seller_id, 'synthetic-seller');
  assert.match(inserted.image_url, /^https:\/\/storage\.example\.invalid\//);
  assert.deepEqual(app.calls.filter(call => call[0] === 'storage' && call[1] === 'upload').length, 1);
  assert.ok(app.calls.some(call => call[0] === 'property_private_details' && call[1] === 'insert'
    && call[2].property_id === inserted.id && call[2].unit_number === '#08-123'));
  assert.deepEqual(app.successes, ['HDB address verified and map updated', 'Property submitted for approval']);
  assert.deepEqual(app.errors, []);
});

test('FE-SELLER-05 seller can edit a loaded listing and retain its private unit details', async () => {
  const existing = {
    id: 'synthetic-owned-listing', title: 'Existing listing', price: 450000,
    location: 'BEDOK', type: 'HDB', bedrooms: 3, bathrooms: 2, area_sqft: 950,
    description: 'Existing synthetic listing', image_url: 'https://images.example.invalid/existing.jpg',
    photos: [], detailed_location: 'Block 10 Example Road', built_year: 1995,
    seller_name: 'Synthetic Seller', seller_phone: '+65 91234567', latitude: 1.33, longitude: 103.93,
    postal_code: '123456', block_number: '10', street_name: 'Example Road', hdb_verified: true,
    location_verified_at: '2026-01-01T00:00:00Z', status: 'draft', seller_id: 'synthetic-seller',
  };
  const app = sellerHarness({ propertyRows: [existing], privateDetails: [{ property_id: existing.id, unit_number: '#08-123' }] });
  app.render();
  await app.effects();
  await setImmediate();

  const row = nodes(app.render()).find(node => node.type === 'tr' && content(node).includes(existing.title));
  const edit = nodes(row).find(node => node.type === 'button');
  edit.props.onClick();
  formField(app, 'Title').props.onChange({ target: { value: 'Updated synthetic listing' } });
  formField(app, 'Unit Number').props.onBlur();
  await nodes(app.render()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });

  const propertyUpdate = app.calls.find(call => call[0] === 'properties' && call[1] === 'update');
  assert.equal(propertyUpdate[2].title, 'Updated synthetic listing');
  assert.ok(app.calls.some(call => call[0] === 'properties' && call[1] === 'eq'
    && call[2] === 'id' && call[3] === existing.id));
  assert.ok(app.calls.some(call => call[0] === 'property_private_details' && call[1] === 'upsert'
    && call[2].property_id === existing.id && call[2].unit_number === '#08-123'));
  assert.deepEqual(app.successes, ['Property updated successfully']);
  assert.deepEqual(app.errors, []);
});

test('FE-SELLER-06 cancelling a delete confirmation leaves the property untouched', async () => {
  const existing = {
    id: 'synthetic-owned-listing', title: 'Existing listing', price: 450000,
    location: 'BEDOK', type: 'HDB', bedrooms: 3, bathrooms: 2, area_sqft: 950,
    description: 'Existing synthetic listing', image_url: 'https://images.example.invalid/existing.jpg',
    photos: [], seller_id: 'synthetic-seller', status: 'draft', hdb_verified: true,
  };
  const app = sellerHarness({ propertyRows: [existing], confirmResult: false });
  app.render();
  await app.effects();
  await setImmediate();
  const row = nodes(app.render()).find(node => node.type === 'tr' && content(node).includes(existing.title));
  await nodes(row).filter(node => node.type === 'button')[1].props.onClick();

  assert.equal(app.calls.some(call => call[0] === 'properties' && call[1] === 'delete'), false);
  assert.match(content(app.render()), /Existing listing/);
  assert.deepEqual(app.successes, []);
});
