import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { componentHarness, content, deferred, nodes } from './helpers/frontend-component.mjs';
import * as passwordPolicy from '../FrontEnd/src/lib/passwordPolicy.ts';

// Stand-in for the strength meter; the harness does not render child components.
function PasswordStrength() { return null; }

const GOOD = 'Synthetic-Pass-2026';
const user = { id: 'buyer-1', email: 'buyer@example.invalid' };

// Synthetic auth, recovery and Supabase doubles; no request leaves the process.
async function harness({ recovery = { kind: 'recovery' }, auth = { user, authLoading: false }, update = async () => ({ data: {}, error: null }) } = {}) {
  let state = recovery;
  const listeners = new Set();
  const updates = [];
  const events = [];
  let cleared = 0;
  const app = componentHarness(new URL('../FrontEnd/src/pages/ResetPassword.tsx', import.meta.url), {
    'react-router-dom': { Link: 'Link' },
    'lucide-react': {},
    '../contexts/AuthContext': { useAuth: () => auth },
    '../lib/supabase': { supabase: { auth: { updateUser(attributes) { updates.push(attributes); return update(attributes); } } } },
    '../lib/authRecovery': {
      getRecoveryState: () => state,
      clearRecoveryState() { cleared++; state = null; listeners.forEach(listener => listener()); },
      subscribeRecoveryState(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    },
    '../lib/passwordPolicy': passwordPolicy,
    '../components/PasswordStrength': { default: PasswordStrength },
  }, {}, {
    Error, Event: class { constructor(type) { this.type = type; } },
    window: { dispatchEvent: event => events.push(event.type) },
  });
  app.render();
  await app.effects();
  const find = predicate => app.find(predicate);
  const has = predicate => nodes(app.render()).some(predicate);
  const input = (id, value) => find(node => node.props.id === id).props.onChange({ target: { value } });
  const submit = () => find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  const text = () => content(app.render());
  const fill = (password = GOOD, confirm = password) => { input('new-password', password); input('confirm-new-password', confirm); };
  return { ...app, updates, events, cleared: () => cleared, find, has, input, submit, text, fill, auth };
}

const hasForm = app => app.has(node => node.props.id === 'new-password');

test('FE-RESET-01 recovery state with a session shows the form with checklist, meter, show/hide and autocomplete', async () => {
  const app = await harness();
  assert.ok(hasForm(app));
  assert.equal(app.find(node => node.props.id === 'new-password').props.autoComplete, 'new-password');
  assert.equal(app.find(node => node.props.id === 'confirm-new-password').props.autoComplete, 'new-password');
  assert.equal(app.find(node => node.type === PasswordStrength).props.email, 'buyer@example.invalid');
  const toggle = app.find(node => node.type === 'button' && node.props['aria-label'] === 'Show passwords');
  assert.equal(toggle.props['aria-pressed'], false);
  toggle.props.onClick();
  assert.equal(app.find(node => node.props.id === 'new-password').props.type, 'text');
  assert.equal(app.find(node => node.props.id === 'confirm-new-password').props.type, 'text');
});

test('FE-RESET-02 recovery state while the session is still loading shows a waiting message and no form', async () => {
  const app = await harness({ auth: { user: null, authLoading: true } });
  assert.match(app.text(), /Checking your reset link/);
  assert.ok(!hasForm(app));
});

test('FE-RESET-03 an expired link shows the expired message and a button that opens the request view', async () => {
  const app = await harness({ recovery: { kind: 'error', reason: 'expired' }, auth: { user: null, authLoading: false } });
  assert.match(app.text(), /expired/i);
  assert.ok(!hasForm(app));
  app.find(node => node.type === 'button' && /new reset link/i.test(content(node))).props.onClick();
  assert.deepEqual(app.events, ['open-forgot-password']);
});

test('FE-RESET-04 an invalid link and a recovery state with no session after loading both show the invalid message', async () => {
  for (const options of [
    { recovery: { kind: 'error', reason: 'invalid' }, auth: { user: null, authLoading: false } },
    { recovery: { kind: 'recovery' }, auth: { user: null, authLoading: false } },
    { recovery: { kind: 'recovery' }, auth: { user: { id: 'guest', is_anonymous: true }, authLoading: false } },
  ]) {
    const app = await harness(options);
    assert.match(app.text(), /not valid/i);
    assert.ok(!hasForm(app));
    assert.ok(app.has(node => node.type === 'button' && /new reset link/i.test(content(node))));
  }
});

test('FE-RESET-05 no recovery state: signed in links to Profile, signed out offers sign in, and no form appears', async () => {
  const signedIn = await harness({ recovery: null });
  assert.ok(!hasForm(signedIn));
  assert.equal(signedIn.find(node => node.type === 'Link').props.to, '/profile');
  const signedOut = await harness({ recovery: null, auth: { user: null, authLoading: false } });
  assert.ok(!hasForm(signedOut));
  assert.ok(!signedOut.has(node => node.type === 'Link' && node.props.to === '/profile'));
  signedOut.find(node => node.type === 'button' && /sign in/i.test(content(node))).props.onClick();
  assert.deepEqual(signedOut.events, ['toggle-auth-modal']);
});

test('FE-RESET-06 a password that breaks the policy blocks the call and shows the alert', async () => {
  const app = await harness();
  app.fill('short', 'short');
  await app.submit();
  assert.equal(app.updates.length, 0);
  const alert = app.find(node => node.props.id === 'new-password-policy-error');
  assert.equal(alert.props.role, 'alert');
  assert.equal(app.find(node => node.props.id === 'new-password').props['aria-invalid'], true);
  assert.match(app.find(node => node.props.id === 'new-password').props['aria-describedby'], /new-password-policy-error/);
});

test('FE-RESET-07 a mismatch blocks the call; policy is checked before match', async () => {
  const app = await harness();
  app.fill(GOOD, 'Different-Pass-2026');
  await app.submit();
  assert.equal(app.updates.length, 0);
  assert.equal(app.find(node => node.props.id === 'confirm-new-password-error').props.role, 'alert');
  assert.equal(app.find(node => node.props.id === 'confirm-new-password').props['aria-invalid'], true);
  const both = await harness();
  both.fill('short', 'other');
  await both.submit();
  assert.ok(both.has(node => node.props.id === 'new-password-policy-error'));
  assert.ok(!both.has(node => node.props.id === 'confirm-new-password-error'));
});

test('FE-RESET-08 success calls updateUser with only the password, clears the state and shows the done view', async () => {
  const app = await harness();
  app.fill();
  await app.submit();
  assert.deepEqual(app.updates.map(update => ({ ...update })), [{ password: GOOD }]);
  assert.equal(app.cleared(), 1);
  assert.ok(!hasForm(app));
  assert.match(app.text(), /password has been updated/i);
  assert.ok(app.has(node => node.type === 'Link'));
});

test('FE-RESET-09 same_password, weak_password and a generic error keep the form and the values', async () => {
  const cases = [
    [{ code: 'same_password', message: 'New password should be different' }, /Choose a password you haven't used for this account\./],
    [{ code: 'weak_password', message: 'Password is known to be weak and easy to guess' }, /Password is known to be weak and easy to guess/],
    [{ code: 'unexpected_failure', message: 'Internal detail leak' }, /couldn't update your password/i],
  ];
  for (const [error, pattern] of cases) {
    const app = await harness({ update: async () => ({ data: null, error }) });
    app.fill();
    await app.submit();
    assert.match(app.text(), pattern);
    assert.equal(app.find(node => node.props.id === 'reset-error').props.role, 'alert');
    assert.ok(hasForm(app));
    assert.equal(app.find(node => node.props.id === 'new-password').props.value, GOOD);
    assert.equal(app.find(node => node.props.id === 'confirm-new-password').props.value, GOOD);
    assert.equal(app.cleared(), 0);
    if (error.code === 'unexpected_failure') assert.doesNotMatch(app.text(), /Internal detail leak/);
  }
});

test('FE-RESET-10 a thrown failure keeps the form with the generic message', async () => {
  const app = await harness({ update: async () => { throw new Error('synthetic network failure'); } });
  app.fill();
  await app.submit();
  assert.match(app.text(), /couldn't update your password/i);
  assert.ok(hasForm(app));
  assert.equal(app.cleared(), 0);
});

test('FE-RESET-11 a second submit while the update is in flight sends nothing', async () => {
  const pending = deferred();
  const app = await harness({ update: () => pending.promise });
  app.fill();
  const first = app.submit();
  assert.equal(app.find(node => node.type === 'button' && node.props.type === 'submit').props.disabled, true);
  await app.submit();
  assert.equal(app.updates.length, 1);
  pending.resolve({ data: {}, error: null });
  await first;
  assert.equal(app.updates.length, 1);
});

test('FE-RESET-12 the page never asks for a current password and imports no sign-in call', () => {
  const source = readFileSync(new URL('../FrontEnd/src/pages/ResetPassword.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /current-password|signInWithPassword|console\./);
});

// ---- Routing: the page is public and the redirect helper exists ----

const appSource = readFileSync(new URL('../FrontEnd/src/App.tsx', import.meta.url), 'utf8');
const supabaseSource = readFileSync(new URL('../FrontEnd/src/lib/supabase.ts', import.meta.url), 'utf8');

test('FE-RESET-13 /reset-password is a lazy public route outside ProtectedRoute', () => {
  assert.match(appSource, /const ResetPassword = lazy\(\(\) => import\('\.\/pages\/ResetPassword'\)\)/);
  assert.match(appSource, /<Route\s+path="\/reset-password"\s+element=\{<ResetPassword\s*\/>\}\s*\/>/);
  const route = appSource.match(/<Route\s+path="\/reset-password"[\s\S]*?\/>/)[0];
  assert.doesNotMatch(route, /ProtectedRoute/);
});

test('FE-RESET-14 a captured redirect on another path navigates to /reset-password once, inside the router', () => {
  assert.match(appSource, /captureAuthRedirect|getRecoveryState/);
  assert.match(appSource, /navigate\('\/reset-password'/);
  assert.match(appSource, /clearRecoveryState/);
  assert.ok(appSource.indexOf('<Router>') < appSource.indexOf('<RecoveryRedirect'));
});

test('FE-RESET-15 the redirect is captured before the Supabase client is created', () => {
  assert.match(supabaseSource, /import \{ captureAuthRedirect \} from '\.\/authRecovery'/);
  assert.ok(supabaseSource.indexOf('captureAuthRedirect()') !== -1);
  assert.ok(supabaseSource.indexOf('captureAuthRedirect()') < supabaseSource.indexOf('createClient('));
});

test('FE-RESET-16 leaving /reset-password clears any recovery state, not only errors', () => {
  const route = appSource.match(/function RecoveryRedirect\(\)[\s\S]*?\r?\n}\r?\n/)[0];
  assert.match(route, /visitedResetPage\.current && state\)/);
  assert.doesNotMatch(route, /kind === 'error'/);
  assert.match(route, /clearRecoveryState\(\)/);
});
