import assert from 'node:assert/strict';
import test from 'node:test';
import { content } from './helpers/frontend-component.mjs';
import { protectedRouteHarness } from './helpers/protected-route-harness.mjs';

// All user IDs here are synthetic fixtures; authorization is still enforced by RLS.
function route(auth) {
  // Main now emits notices in an effect and tracks navigation with useRef.
  // Reuse its harness while retaining all five original contract scenarios.
  const app = protectedRouteHarness(auth);
  const tree = app.render('Protected account content');
  app.flushEffects();
  return { tree, errors: app.notices.map(notice => notice.message) };
}

test('FE-ROUTE-01 pending authentication shows loading and withholds protected content', () => {
  const { tree, errors } = route({ loading: true, user: null, needsProfileSetup: false });
  assert.match(content(tree), /Loading/);
  assert.doesNotMatch(content(tree), /Protected account content/);
  assert.deepEqual(errors, []);
});

test('FE-ROUTE-02 an unauthenticated visitor is redirected with replacement history', () => {
  const { tree, errors } = route({ loading: false, user: null, needsProfileSetup: false });
  assert.equal(tree.type, 'Navigate');
  assert.equal(tree.props.to, '/');
  assert.equal(tree.props.replace, true);
  assert.deepEqual(errors, ['Please sign in to access this feature']);
});

test('FE-ROUTE-03 an incomplete authenticated profile cannot open protected content', () => {
  const { tree, errors } = route({ loading: false, user: { id: 'synthetic-buyer' }, needsProfileSetup: true });
  assert.equal(tree.type, 'Navigate');
  assert.equal(tree.props.to, '/');
  assert.deepEqual(errors, ['Please complete your profile setup first']);
});

test('FE-ROUTE-04 a complete authenticated profile receives protected content', () => {
  const { tree, errors } = route({ loading: false, user: { id: 'synthetic-buyer' }, needsProfileSetup: false });
  assert.equal(content(tree), 'Protected account content');
  assert.deepEqual(errors, []);
});

test('FE-ROUTE-05 loading takes precedence over an existing incomplete session', () => {
  const { tree, errors } = route({ loading: true, user: { id: 'synthetic-buyer' }, needsProfileSetup: true });
  assert.match(content(tree), /Loading/);
  assert.deepEqual(errors, []);
});
