import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { protectedRouteHarness } from './helpers/protected-route-harness.mjs';

const appSource = readFileSync(new URL('../FrontEnd/src/App.tsx', import.meta.url), 'utf8');

test('unresolved authentication renders loading state without redirecting', () => {
  const app = protectedRouteHarness({ user: null, loading: true, needsProfileSetup: false });
  const rendered = app.render();
  assert.equal(rendered.type, 'div');
  assert.equal(rendered.props.children.type, 'div');
  assert.deepEqual(app.notices, []);
});

for (const page of ['Profile', 'Search', 'SellerDashboard']) {
  test(`fresh anonymous navigation to ${page} still warns after an intentional sign-out`, () => {
    const app = protectedRouteHarness({ user: null, loading: false, authTransition: 'intentional-sign-out' });
    const rendered = app.render(page, page === 'SellerDashboard' ? { requiredRole: 'seller' } : {});
    app.flushEffects();
    assert.equal(rendered.type, 'Navigate');
    assert.equal(rendered.props.to, '/');
    assert.equal(app.notices.length, 1);
    assert.equal(app.notices[0].message, 'Please sign in to access this feature');
  });
}

test('intentional sign-out from another mounted protected page removes content without warning', () => {
  const app = protectedRouteHarness({ user: { id: 'buyer-1' }, loading: false });
  assert.equal(app.render('Search').props.children, 'Search');
  app.flushEffects();
  app.setAuth({ user: null, loading: false, authTransition: 'intentional-sign-out' });
  assert.equal(app.render('Search').type, 'Navigate');
  app.flushEffects();
  assert.deepEqual(app.notices, []);
});

for (const [description, user] of [['missing user', null], ['Supabase anonymous user', { id: 'guest', is_anonymous: true }]]) {
  test(`${description} cannot render PropertyDetails`, () => {
    const app = protectedRouteHarness({ user, loading: false, needsProfileSetup: false });
    const rendered = app.render('PropertyDetails', { signInMessage: 'Sign up or log in to view property details' });
    app.flushEffects();
    assert.equal(rendered.type, 'Navigate');
    assert.equal(rendered.props.to, '/');
    assert.equal(rendered.props.replace, true);
    assert.deepEqual(app.notices, [{
      message: 'Sign up or log in to view property details',
      id: 'protected-route-auth:Sign up or log in to view property details',
    }]);
  });
}

test('registered user can render PropertyDetails without completing the buyer profile', () => {
  const app = protectedRouteHarness({ user: { id: 'buyer-1', is_anonymous: false }, loading: false, needsProfileSetup: true });
  const rendered = app.render('PropertyDetails', { requireProfileSetup: false });
  assert.equal(rendered.type, 'Fragment');
  assert.equal(rendered.props.children, 'PropertyDetails');
  assert.deepEqual(app.notices, []);
});

test('PropertyDetails waits for profile role resolution but ignores profile completion', () => {
  const app = protectedRouteHarness({
    user: { id: 'buyer-1' }, loading: true, profileLoading: true,
    needsProfileSetup: false, isSeller: false, isAdmin: false,
  });
  const duringLookup = app.render('PropertyDetails', { requireProfileSetup: false });
  assert.equal(duringLookup.type, 'div');
  assert.deepEqual(app.notices, []);

  app.setAuth({
    user: { id: 'buyer-1' }, loading: false, profileLoading: false,
    needsProfileSetup: true, isSeller: false, isAdmin: false,
  });
  const resolved = app.render('PropertyDetails', { requireProfileSetup: false });
  assert.equal(resolved.type, 'Fragment');
  assert.equal(resolved.props.children, 'PropertyDetails');
});

test('other protected routes continue to require profile setup', () => {
  const app = protectedRouteHarness({ user: { id: 'buyer-1' }, loading: false, needsProfileSetup: true });
  assert.equal(app.render('Search').type, 'Navigate');
  app.flushEffects();
  assert.deepEqual(app.notices, [{
    message: 'Please complete your profile setup first',
    id: 'protected-route-profile-setup',
  }]);
});

test('unexpected auth loss removes property content without mislabeling it as unauthorized navigation', () => {
  const app = protectedRouteHarness({ user: { id: 'buyer-1' }, loading: false, needsProfileSetup: false });
  const beforeSignOut = app.render('PropertyDetails', { requireProfileSetup: false });
  assert.equal(beforeSignOut.type, 'Fragment');
  assert.equal(beforeSignOut.props.children, 'PropertyDetails');
  app.setAuth({ user: null, loading: false, needsProfileSetup: false, authTransition: 'session-ended' });
  const rendered = app.render('PropertyDetails', { signInMessage: 'Sign up or log in to view property details' });
  app.flushEffects();
  assert.equal(rendered.type, 'Navigate');
  assert.deepEqual(app.notices, []);
});

test('replayed StrictMode effects reuse the same auth toast ID and message', () => {
  const app = protectedRouteHarness({ user: null, loading: false, needsProfileSetup: false });
  app.render('Explore');
  app.flushEffects();
  app.render('Explore');
  app.flushEffects();
  assert.equal(app.notices.length, 2);
  assert.deepEqual(app.notices[0], app.notices[1]);
  assert.equal(app.notices[0].id, 'protected-route-auth:Please sign in to access this feature');
});

test('direct seller dashboard navigation denies a registered buyer', () => {
  const app = protectedRouteHarness({
    user: { id: 'buyer-1', is_anonymous: false }, loading: false,
    needsProfileSetup: false, isSeller: false, isAdmin: false,
  });
  const rendered = app.render('SellerDashboard', { requiredRole: 'seller' });
  app.flushEffects();
  assert.equal(rendered.type, 'Navigate');
  assert.equal(rendered.props.to, '/');
  assert.deepEqual(app.notices, [{ message: 'You do not have access to this page', id: 'protected-route-role:seller' }]);
});

test('seller route waits for profile role resolution instead of assuming buyer', () => {
  const app = protectedRouteHarness({
    user: { id: 'seller-1' }, loading: true, profileLoading: true,
    needsProfileSetup: false, isSeller: false, isAdmin: false,
  });
  const rendered = app.render('SellerDashboard', { requiredRole: 'seller' });
  assert.equal(rendered.type, 'div');
  assert.deepEqual(app.notices, []);
});

test('resolved seller role permits the dashboard and admin is redirected to its dashboard', () => {
  const seller = protectedRouteHarness({
    user: { id: 'seller-1' }, loading: false, needsProfileSetup: false, isSeller: true, isAdmin: false,
  });
  assert.equal(seller.render('SellerDashboard', { requiredRole: 'seller' }).props.children, 'SellerDashboard');

  const admin = protectedRouteHarness({
    user: { id: 'admin-1' }, loading: false, needsProfileSetup: false, isSeller: false, isAdmin: true,
  });
  const rendered = admin.render('SellerDashboard', { requiredRole: 'seller' });
  assert.equal(rendered.type, 'Navigate');
  assert.equal(rendered.props.to, '/admin');
  admin.flushEffects();
  assert.deepEqual(admin.notices, [], 'admins retain the existing redirect without a seller-denied toast');
});

test('seller route itself applies the role guard for direct URLs', () => {
  assert.match(appSource, /path="\/seller"[\s\S]*?<ProtectedRoute requiredRole="seller">[\s\S]*?<SellerDashboard\s*\/>/);
});
