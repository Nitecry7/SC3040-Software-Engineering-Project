import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import test from 'node:test';
import { componentHarness, content, nodes } from './helpers/frontend-component.mjs';

const admin = { id: 'synthetic-admin' };
const pendingProperty = {
  id: 'synthetic-property', title: 'Synthetic HDB', price: 500000,
  location: 'TAMPINES', type: 'HDB', bedrooms: 3, bathrooms: 2,
  area_sqft: 1000, status: 'pending', created_at: '2026-10-01T00:00:00Z',
  seller_id: 'synthetic-seller', image_url: '', seller_name: 'Synthetic Seller',
};
const pendingEnquiry = {
  id: 'synthetic-enquiry', name: 'Synthetic Buyer', email: 'buyer@example.invalid',
  phone: '90000000', message: 'Synthetic viewing request', status: 'PENDING',
  admin_response: null, created_at: '2026-10-01T00:00:00Z',
};

function dashboardHarness({ isAdmin = true, userRows = [] } = {}) {
  const queries = [];
  const mutations = [];
  const navigations = [];
  const errors = [];
  const successes = [];
  const properties = [structuredClone(pendingProperty)];
  const enquiries = [structuredClone(pendingEnquiry)];
  let searchParams = new URLSearchParams();
  const setSearchParams = (next) => {
    searchParams = typeof next === 'function' ? next(searchParams) : next;
  };
  const queryResults = {
    user_profiles: { data: { is_admin: isAdmin }, error: null },
    properties: { data: properties, error: null },
    enquiries: { data: enquiries, error: null },
  };
  const app = componentHarness(new URL('../FrontEnd/src/pages/AdminDashboard.tsx', import.meta.url), {
    'react-router-dom': {
      useNavigate: () => (...args) => navigations.push(args),
      useSearchParams: () => [searchParams, setSearchParams],
    },
    '../contexts/AuthContext': { useAuth: () => ({ user: admin }) },
    '../lib/supabase': {
      supabase: {
        from(table) {
          const query = { table };
          const builder = {
            select(columns) { query.columns = columns; return builder; },
            eq(column, value) { query.filter = [column, value]; return builder; },
            order(column, options) { query.order = [column, options]; return Promise.resolve(queryResults[table]); },
            single() { return Promise.resolve(queryResults[table]); },
            update(values) { mutations.push({ table, operation: 'update', values }); return builder; },
            delete() { mutations.push({ table, operation: 'delete' }); return builder; },
            then(resolve, reject) { return Promise.resolve({ error: null }).then(resolve, reject); },
          };
          queries.push(query);
          return builder;
        },
        functions: { invoke: async name => {
          assert.equal(name, 'get-admin-users');
          return { data: { data: userRows }, error: null };
        } },
      },
    },
    '../lib/monitoringDashboard': { parseMonitoringBadge: () => null },
    '../lib/adminDashboardState': {
      parseAdminDashboardUrl: params => ({
        tab: params.get('tab') || 'users', view: params.get('view') || 'overview', range: params.get('range') || '7d',
      }),
      normalizeAdminDashboardUrl: () => null,
      selectAdminTab: (set, tab) => set(current => {
        const next = new URLSearchParams(current);
        if (tab === 'users') next.delete('tab'); else next.set('tab', tab);
        return next;
      }),
      selectMonitoringView: () => {},
      selectMonitoringRange: () => {},
    },
    'lucide-react': {},
    'react-hot-toast': { default: {
      success: message => successes.push(message), error: message => errors.push(message),
    } },
  }, {}, { window: { location: { reload() {} } } });
  return { ...app, queries, mutations, navigations, errors, successes };
}

test('FE-ADMIN-01 non-admin dashboard access redirects before loading privileged directory data', async () => {
  const app = dashboardHarness({ isAdmin: false });
  app.render();
  await app.effects();
  await setImmediate();

  assert.deepEqual(app.navigations, [['/']]);
  assert.equal(app.queries.some(query => query.table === 'properties' || query.table === 'enquiries'), false);
  assert.deepEqual(app.errors, ['Access denied. Admin privileges required.']);
  assert.match(content(app.render()), /Access Denied/);
});

test('FE-ADMIN-02 administrator can approve a pending listing and send an enquiry response', async () => {
  const app = dashboardHarness();
  app.render();
  await app.effects();
  await setImmediate();

  const propertyTab = nodes(app.render()).find(node => node.type === 'button' && content(node).includes('Manage Properties'));
  propertyTab.props.onClick();
  const propertyRow = nodes(app.render()).find(node => node.type === 'tr' && content(node).includes(pendingProperty.title));
  assert.ok(propertyRow, 'pending listing appears in the properties tab');
  const approve = nodes(propertyRow).find(node => node.type === 'button');
  await approve.props.onClick();
  assert.deepEqual(JSON.parse(JSON.stringify(app.mutations[0])), {
    table: 'properties', operation: 'update', values: { status: 'approved' },
  });
  assert.match(content(app.render()), /Approved/);

  nodes(app.render()).find(node => node.type === 'button' && content(node).includes('Manage Enquiries')).props.onClick();
  nodes(app.render()).find(node => node.type === 'button' && content(node) === 'Respond').props.onClick();
  const responseBox = nodes(app.render()).find(node => node.type === 'textarea');
  responseBox.props.onChange({ target: { value: 'Please share your preferred viewing time.' } });
  const send = nodes(app.render()).find(node => node.type === 'button' && content(node).includes('Send Response'));
  await send.props.onClick();

  assert.deepEqual(JSON.parse(JSON.stringify(app.mutations[1])), {
    table: 'enquiries', operation: 'update', values: {
      status: 'RESPONDED', admin_response: 'Please share your preferred viewing time.',
      updated_at: app.mutations[1].values.updated_at,
    },
  });
  assert.ok(Number.isFinite(Date.parse(app.mutations[1].values.updated_at)));
  assert.deepEqual(app.successes, ['Property approved successfully', 'Response sent successfully']);
  assert.match(content(app.render()), /RESPONDED/);
});

test('FE-ADMIN-03 administrator can reject and then delete a listing', async () => {
  const app = dashboardHarness();
  app.render();
  await app.effects();
  await setImmediate();
  nodes(app.render()).find(node => node.type === 'button' && content(node).includes('Manage Properties')).props.onClick();

  const pendingRow = nodes(app.render()).find(node => node.type === 'tr' && content(node).includes(pendingProperty.title));
  await nodes(pendingRow).filter(node => node.type === 'button')[1].props.onClick();
  assert.deepEqual(JSON.parse(JSON.stringify(app.mutations[0])), {
    table: 'properties', operation: 'update', values: { status: 'rejected' },
  });
  assert.match(content(app.render()), /Rejected/);

  const rejectedRow = nodes(app.render()).find(node => node.type === 'tr' && content(node).includes(pendingProperty.title));
  await nodes(rejectedRow).find(node => node.type === 'button').props.onClick();
  assert.deepEqual(JSON.parse(JSON.stringify(app.mutations[1])), {
    table: 'properties', operation: 'delete',
  });
  assert.deepEqual(app.successes, ['Property rejected successfully', 'Property deleted successfully']);
});

test('FE-ADMIN-04 user tab displays the directory fields returned by the authorized endpoint', async () => {
  const app = dashboardHarness({ userRows: [{
    id: 'synthetic-seller', name: 'Synthetic Seller', email: 'seller@example.invalid',
    is_seller: true, property_count: 2,
  }] });
  app.render();
  await app.effects();
  await setImmediate();

  assert.match(content(app.render()), /Synthetic Seller/);
  assert.match(content(app.render()), /seller@example\.invalid/);
  assert.match(content(app.render()), /Seller/);
  assert.match(content(app.render()), /2 properties/);
});
