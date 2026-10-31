import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import test from 'node:test';
import { componentHarness, content, nodes } from './helpers/frontend-component.mjs';

const userId = 'synthetic-buyer-42';

function initialSetupHarness({ result = { error: null } } = {}) {
  const writes = [];
  const successes = [];
  const errors = [];
  let completed = 0;
  const app = componentHarness(new URL('../FrontEnd/src/components/InitialProfileSetup.tsx', import.meta.url), {
    '../lib/supabase': { supabase: { from(table) {
      assert.equal(table, 'user_profiles');
      return { upsert: async row => { writes.push(row); return result; } };
    } } },
    'react-hot-toast': { default: {
      success: message => successes.push(message),
      error: message => errors.push(message),
    } },
  }, { userId, onComplete: () => { completed++; } });
  const form = () => nodes(app.render()).find(node => node.type === 'form');
  const inputs = () => nodes(app.render()).filter(node => node.type === 'input');
  const selects = () => nodes(app.render()).filter(node => node.type === 'select');
  return {
    ...app, writes, successes, errors, completed: () => completed,
    setName(value) { inputs()[0].props.onChange({ target: { value } }); },
    setFamilyMembers(value) { inputs()[1].props.onChange({ target: { value } }); },
    setSelect(index, value) { selects()[index].props.onChange({ target: { value } }); },
    submit() { return form().props.onSubmit({ preventDefault() {} }); },
  };
}

test('FE-PROFILE-SETUP-01 saves the completed profile against the authenticated user and completes once', async () => {
  const app = initialSetupHarness();
  app.setName('Synthetic Buyer');
  app.setFamilyMembers('3');
  app.setSelect(0, '6001-9000');
  app.setSelect(1, '4 ROOM');
  app.setSelect(2, 'TAMPINES');

  await app.submit();

  assert.deepEqual(JSON.parse(JSON.stringify(app.writes)), [{
    id: userId,
    name: 'Synthetic Buyer',
    income_range: '6001-9000',
    preferred_property_type: '4 ROOM',
    preferred_locations: ['TAMPINES'],
    family_members: 3,
  }]);
  assert.equal(app.completed(), 1);
  assert.deepEqual(app.successes, ['Profile setup completed!']);
  assert.deepEqual(app.errors, []);
  assert.equal(app.find(node => node.props.type === 'submit').props.disabled, false);
});

test('FE-PROFILE-SETUP-02 a rejected profile write keeps setup open and does not call completion', async () => {
  const app = initialSetupHarness({ result: { error: new Error('synthetic RLS denial') } });
  app.setName('Synthetic Buyer');
  await app.submit();

  assert.equal(app.completed(), 0);
  assert.deepEqual(app.successes, []);
  assert.deepEqual(app.errors, ['Failed to set up profile']);
  assert.match(content(app.render()), /Complete Your Profile/);
});

function profileHarness({ profile = null, queryError = null } = {}) {
  const writes = [];
  const inserts = [];
  const successes = [];
  const errors = [];
  const navigations = [];
  let hookIndex = 0;
  const state = [];
  const authUser = {
    id: userId, email: 'buyer@example.invalid', created_at: '2026-01-01T00:00:00Z', user_metadata: {},
  };
  const query = {
    select() { return query; },
    eq(column, value) { assert.equal(column, 'id'); assert.equal(value, userId); return query; },
    maybeSingle: async () => ({ data: profile, error: queryError }),
    insert(rows) { inserts.push(rows); return {
      select: () => ({ single: async () => ({ data: { ...rows[0], id: userId }, error: null }) }),
    }; },
    upsert: async row => { writes.push(row); return { error: null }; },
  };
  const app = componentHarness(new URL('../FrontEnd/src/pages/Profile.tsx', import.meta.url), {
    '../contexts/AuthContext': { useAuth: () => ({ user: authUser, signOut: async () => {} }) },
    'react-router-dom': { useNavigate: () => path => navigations.push(path) },
    '../lib/supabase': { supabase: { from(table) { assert.equal(table, 'user_profiles'); return query; } } },
    'lucide-react': {},
    'react-hot-toast': { default: {
      success: message => successes.push(message), error: message => errors.push(message),
    } },
  });
  return { ...app, writes, inserts, successes, errors, navigations };
}

test('FE-PROFILE-01 missing buyer profile is initialized with safe empty preferences', async () => {
  const app = profileHarness();
  app.render();
  await app.effects();
  await setImmediate();

  assert.deepEqual(JSON.parse(JSON.stringify(app.inserts)), [[{
    id: userId, name: null, income_range: null, preferred_locations: [],
    preferred_property_type: null, family_members: null,
  }]]);
  assert.match(content(app.render()), /Welcome!/);
  assert.doesNotMatch(content(app.render()), /Loading profile/);
  assert.deepEqual(app.errors, []);
});

test('FE-PROFILE-02 saved profile edits retain user ownership and update the displayed profile', async () => {
  const existing = {
    id: userId, name: 'Original Buyer', income_range: '3001-6000',
    preferred_locations: ['BEDOK'], preferred_property_type: '3 ROOM', family_members: 2,
  };
  const app = profileHarness({ profile: existing });
  app.render();
  await app.effects();
  await setImmediate();
  app.find(node => node.type === 'button' && content(node).includes('Edit Profile')).props.onClick();
  app.find(node => node.props.id === 'name').props.onChange({ target: { value: 'Updated Buyer' } });
  await app.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });

  assert.deepEqual(JSON.parse(JSON.stringify(app.writes)), [{ ...existing, name: 'Updated Buyer' }]);
  assert.match(content(app.render()), /Updated Buyer/);
  assert.deepEqual(app.successes, ['Profile updated successfully']);
  assert.deepEqual(app.errors, []);
});
