import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from '../FrontEnd/node_modules/typescript/lib/typescript.js';

const appSource = readFileSync(new URL('../FrontEnd/src/App.tsx', import.meta.url), 'utf8');

function protectedRouteHarness(initialAuth) {
  const source = readFileSync(new URL('../FrontEnd/src/components/ProtectedRoute.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let auth = initialAuth;
  const notices = [];
  const effects = [];
  const Navigate = 'Navigate';
  const toast = { error: (message, options) => notices.push({ message, id: options?.id }) };
  const Fragment = 'Fragment';
  const react = { default: {}, Fragment: 'Fragment', useEffect: effect => effects.push(effect) };
  const modules = {
    react,
    'react/jsx-runtime': {
      Fragment,
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
    },
    'react-router-dom': { Navigate },
    '../contexts/AuthContext': { useAuth: () => auth },
    'react-hot-toast': { default: toast },
  };
  const exports = {};
  runInNewContext(compiled, { exports, require: name => {
    assert.ok(name in modules, `Unexpected import: ${name}`);
    return modules[name];
  } });
  const ProtectedRoute = exports.default;
  return {
    notices,
    render: (children = 'PropertyDetails', props = {}) => ProtectedRoute({ children, ...props }),
    setAuth: next => { auth = next; },
    flushEffects: () => effects.splice(0).forEach(effect => effect()),
  };
}

test('unresolved authentication renders loading state without redirecting', () => {
  const app = protectedRouteHarness({ user: null, loading: true, needsProfileSetup: false });
  const rendered = app.render();
  assert.equal(rendered.type, 'div');
  assert.equal(rendered.props.children.type, 'div');
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

test('reactive sign-out removes property content and applies the guest gate on rerender', () => {
  const app = protectedRouteHarness({ user: { id: 'buyer-1' }, loading: false, needsProfileSetup: false });
  const beforeSignOut = app.render('PropertyDetails', { requireProfileSetup: false });
  assert.equal(beforeSignOut.type, 'Fragment');
  assert.equal(beforeSignOut.props.children, 'PropertyDetails');
  app.setAuth({ user: null, loading: false, needsProfileSetup: false });
  const rendered = app.render('PropertyDetails', { signInMessage: 'Sign up or log in to view property details' });
  app.flushEffects();
  assert.equal(rendered.type, 'Navigate');
  assert.deepEqual(app.notices, [{
    message: 'Sign up or log in to view property details',
    id: 'protected-route-auth:Sign up or log in to view property details',
  }]);
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
