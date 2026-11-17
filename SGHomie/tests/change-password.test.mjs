import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { componentHarness, content, deferred, nodes } from './helpers/frontend-component.mjs';
import * as passwordPolicy from '../FrontEnd/src/lib/passwordPolicy.ts';

// Stand-in for the strength meter; the harness does not render child components.
function PasswordStrength() { return null; }

const CURRENT = 'Current-Pass-2026';
const NEXT = 'Synthetic-Pass-2027';
const EMAIL = 'buyer@example.invalid';
const SAME = 'Your new password must be different from your current password.';
const SOURCE_URL = new URL('../FrontEnd/src/components/ChangePasswordForm.tsx', import.meta.url);

const ok = { data: { user: {}, session: {} }, error: null };
const fail = (code, message = 'synthetic server message', status = 400) => ({ data: null, error: { code, message, status } });

// Synthetic Supabase and browser-global doubles; no request leaves the process.
function harness({ signIn = async () => ok, update = async () => ({ data: { user: {} }, error: null }), signOut = async () => ({ error: null }) } = {}) {
  const calls = [];
  const logged = [];
  const stored = [];
  const supabase = { auth: {
    signInWithPassword(args) { calls.push(['signInWithPassword', { ...args }]); return signIn(args); },
    updateUser(args) { calls.push(['updateUser', { ...args }]); return update(args); },
    signOut(...args) { calls.push(['signOut', ...args.map(arg => ({ ...arg }))]); return signOut(...args); },
  } };
  const trap = kind => ({ getItem: () => null, setItem: (...a) => stored.push([kind, ...a]), removeItem: () => {}, clear: () => stored.push([kind, 'clear']) });
  const logger = name => (...a) => logged.push([name, ...a]);
  const app = componentHarness(SOURCE_URL, {
    'lucide-react': {},
    '../lib/supabase': { supabase },
    '../lib/passwordPolicy': passwordPolicy,
    './PasswordStrength': { default: PasswordStrength },
  }, { email: EMAIL }, {
    Error,
    console: { log: logger('log'), warn: logger('warn'), error: logger('error'), info: logger('info'), debug: logger('debug') },
    localStorage: trap('local'), sessionStorage: trap('session'),
  });
  app.render();
  const find = predicate => app.find(predicate);
  const has = predicate => nodes(app.render()).some(predicate);
  const byId = id => find(node => node.props.id === id);
  const input = (id, value) => byId(id).props.onChange({ target: { value } });
  const submit = () => find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  const text = () => content(app.render());
  const fill = (current = CURRENT, next = NEXT, confirm = next) => {
    input('change-password-current', current);
    input('change-password-new', next);
    input('change-password-confirm', confirm);
  };
  const names = () => calls.map(call => call[0]);
  return { ...app, calls, logged, stored, find, has, byId, input, submit, text, fill, names };
}

const values = app => ['current', 'new', 'confirm'].map(name => app.byId(`change-password-${name}`).props.value);

test('FE-CHPW-01 renders three hidden password fields with the right autocomplete and the meter under the new password', () => {
  const app = harness();
  const fields = ['current', 'new', 'confirm'].map(name => app.byId(`change-password-${name}`));
  assert.deepEqual(fields.map(field => field.props.type), ['password', 'password', 'password']);
  assert.deepEqual(fields.map(field => field.props.autoComplete), ['current-password', 'new-password', 'new-password']);
  const all = nodes(app.render());
  const at = id => all.findIndex(node => node.props.id === id);
  const meter = all.findIndex(node => node.type === PasswordStrength);
  assert.ok(meter > at('change-password-new'), 'meter after the new-password field');
  assert.ok(meter < at('change-password-confirm'), 'meter before the confirm field');
  assert.equal(all[meter].props.email, EMAIL);
  assert.equal(all[meter].props.id, 'change-password-strength');
});

test('FE-CHPW-02 one non-submitting show/hide button with aria-pressed reveals all three fields', () => {
  const app = harness();
  const toggles = nodes(app.render()).filter(node => node.type === 'button' && node.props.type === 'button');
  assert.equal(toggles.length, 1);
  assert.equal(toggles[0].props['aria-pressed'], false);
  toggles[0].props.onClick();
  const toggle = app.find(node => node.type === 'button' && node.props.type === 'button');
  assert.equal(toggle.props['aria-pressed'], true);
  assert.deepEqual(['current', 'new', 'confirm'].map(name => app.byId(`change-password-${name}`).props.type), ['text', 'text', 'text']);
});

test('FE-CHPW-03 a policy failure, a mismatch and new-equals-current each block without any SDK call', async () => {
  const policy = harness();
  policy.fill(CURRENT, 'short', 'short');
  await policy.submit();
  assert.deepEqual(policy.names(), []);
  const policyAlert = policy.byId('change-password-new-error');
  assert.equal(policyAlert.props.role, 'alert');
  assert.match(content(policyAlert), /Password does not meet the requirements\./);
  assert.equal(policy.byId('change-password-new').props['aria-invalid'], true);
  assert.match(policy.byId('change-password-new').props['aria-describedby'], /change-password-new-error/);
  assert.match(policy.byId('change-password-new').props['aria-describedby'], /change-password-strength/);
  assert.deepEqual(values(policy), [CURRENT, 'short', 'short']);

  const mismatch = harness();
  mismatch.fill(CURRENT, NEXT, 'Different-Pass-2027');
  await mismatch.submit();
  assert.deepEqual(mismatch.names(), []);
  const mismatchAlert = mismatch.byId('change-password-confirm-error');
  assert.equal(mismatchAlert.props.role, 'alert');
  assert.match(content(mismatchAlert), /Passwords do not match\./);
  assert.equal(mismatch.byId('change-password-confirm').props['aria-invalid'], true);
  assert.equal(mismatch.byId('change-password-confirm').props['aria-describedby'], 'change-password-confirm-error');
  assert.deepEqual(values(mismatch), [CURRENT, NEXT, 'Different-Pass-2027']);

  const same = harness();
  same.fill(CURRENT, CURRENT, CURRENT);
  await same.submit();
  assert.deepEqual(same.names(), []);
  assert.equal(content(same.byId('change-password-new-error')), SAME);
  assert.equal(same.byId('change-password-new-error').props.role, 'alert');
  assert.equal(same.byId('change-password-new').props['aria-invalid'], true);
  assert.deepEqual(values(same), [CURRENT, CURRENT, CURRENT]);
});

test('FE-CHPW-04 policy is checked before match, and match before new-equals-current', async () => {
  const both = harness();
  both.fill(CURRENT, 'short', 'other');
  await both.submit();
  assert.ok(both.has(node => node.props.id === 'change-password-new-error'));
  assert.ok(!both.has(node => node.props.id === 'change-password-confirm-error'));
});

test('FE-CHPW-05 a wrong current password is reported on the current-password field and never reaches updateUser', async () => {
  const app = harness({ signIn: async () => fail('invalid_credentials', 'Invalid login credentials') });
  app.fill();
  await app.submit();
  assert.deepEqual(app.calls, [['signInWithPassword', { email: EMAIL, password: CURRENT }]]);
  const alert = app.byId('change-password-current-error');
  assert.equal(alert.props.role, 'alert');
  assert.equal(content(alert), 'Your current password is incorrect.');
  assert.equal(app.byId('change-password-current').props['aria-invalid'], true);
  assert.equal(app.byId('change-password-current').props['aria-describedby'], 'change-password-current-error');
  assert.deepEqual(values(app), [CURRENT, NEXT, NEXT]);
});

test('FE-CHPW-06 rate limit, network failure and a generic verification error show their message and skip updateUser', async () => {
  const cases = [
    [async () => fail('over_request_rate_limit', 'rate', 429), /Too many attempts\. Please wait a moment and try again\./],
    [async () => fail('anything', 'rate', 429), /Too many attempts\. Please wait a moment and try again\./],
    [async () => ({ data: null, error: { name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 } }), /We couldn't reach the server\. Check your connection and try again\./],
    [async () => { throw new Error('synthetic network failure'); }, /We couldn't reach the server\. Check your connection and try again\./],
    [async () => fail('unexpected_failure', 'Internal detail leak', 500), /couldn't verify your current password/i],
  ];
  for (const [signIn, pattern] of cases) {
    const app = harness({ signIn });
    app.fill();
    await app.submit();
    assert.deepEqual(app.names(), ['signInWithPassword']);
    assert.match(app.text(), pattern);
    assert.equal(app.byId('change-password-error').props.role, 'alert');
    assert.doesNotMatch(app.text(), /Internal detail leak|rate\b/);
    assert.deepEqual(values(app), [CURRENT, NEXT, NEXT]);
  }
});

test('FE-CHPW-07 success verifies then updates, clears the fields, hides them and confirms', async () => {
  const app = harness();
  app.fill();
  app.find(node => node.type === 'button' && node.props.type === 'button').props.onClick();
  await app.submit();
  assert.deepEqual(app.calls.slice(0, 2), [
    ['signInWithPassword', { email: EMAIL, password: CURRENT }],
    ['updateUser', { password: NEXT, current_password: CURRENT }],
  ]);
  assert.deepEqual(values(app), ['', '', '']);
  assert.deepEqual(['current', 'new', 'confirm'].map(name => app.byId(`change-password-${name}`).props.type), ['password', 'password', 'password']);
  const status = app.find(node => node.props.role === 'status' && /updated/.test(content(node)));
  assert.equal(content(status), 'Your password has been updated.');
  assert.ok(!app.has(node => node.props.role === 'alert'));
});

test('FE-CHPW-08 update errors show their message and keep the values', async () => {
  const cases = [
    [fail('same_password', 'New password should be different'), SAME],
    [fail('weak_password', 'Password is known to be weak and easy to guess'), 'Password is known to be weak and easy to guess'],
    [fail('reauthentication_needed', 'Password update requires reauthentication'), 'For your security, sign in again or use Forgot password to change your password.'],
    [fail('session_not_found', 'x', 403), 'Your session has ended. Sign in again to change your password.'],
    [fail('session_expired', 'x', 400), 'Your session has ended. Sign in again to change your password.'],
    [fail('whatever', 'x', 401), 'Your session has ended. Sign in again to change your password.'],
    [fail('whatever', 'x', 403), 'Your session has ended. Sign in again to change your password.'],
    [{ data: null, error: { name: 'AuthSessionMissingError', message: 'Auth session missing!', status: 400 } }, 'Your session has ended. Sign in again to change your password.'],
    [fail('unexpected_failure', 'Internal detail leak', 500), "We couldn't update your password. Please try again."],
  ];
  for (const [result, message] of cases) {
    const app = harness({ update: async () => result });
    app.fill();
    await app.submit();
    assert.deepEqual(app.names(), ['signInWithPassword', 'updateUser']);
    assert.match(app.text(), new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.ok(app.has(node => node.props.role === 'alert' && content(node) === message));
    assert.doesNotMatch(app.text(), /Internal detail leak/);
    assert.deepEqual(values(app), [CURRENT, NEXT, NEXT]);
    assert.ok(!app.has(node => node.props.role === 'status' && /updated/.test(content(node))));
    assert.ok(!app.names().includes('signOut'));
  }
  const thrown = harness({ update: async () => { throw new Error('synthetic'); } });
  thrown.fill();
  await thrown.submit();
  assert.match(thrown.text(), /couldn't update your password/i);
  assert.deepEqual(values(thrown), [CURRENT, NEXT, NEXT]);
});

test('FE-CHPW-09 same_password and weak_password sit on the new-password field', async () => {
  for (const code of ['same_password', 'weak_password']) {
    const app = harness({ update: async () => fail(code, 'Synthetic weak message') });
    app.fill();
    await app.submit();
    assert.equal(app.byId('change-password-new').props['aria-invalid'], true);
    assert.match(app.byId('change-password-new').props['aria-describedby'], /change-password-new-error/);
    assert.equal(app.byId('change-password-new-error').props.role, 'alert');
  }
});

test('FE-CHPW-10 a second submit while the sequence runs makes no extra call', async () => {
  const pending = deferred();
  const app = harness({ signIn: () => pending.promise });
  app.fill();
  const first = app.submit();
  assert.equal(app.find(node => node.type === 'button' && node.props.type === 'submit').props.disabled, true);
  await app.submit();
  assert.equal(app.calls.length, 1);
  pending.resolve(ok);
  await first;
  assert.deepEqual(app.names().filter(name => name === 'signInWithPassword').length, 1);
  assert.deepEqual(app.names().filter(name => name === 'updateUser').length, 1);
  assert.equal(app.find(node => node.type === 'button' && node.props.type === 'submit').props.disabled, false);
});

test('FE-CHPW-11 signOut is called once with scope others after success, and its failure keeps the success state', async () => {
  const app = harness();
  app.fill();
  await app.submit();
  assert.deepEqual(app.calls.map(call => call[0]), ['signInWithPassword', 'updateUser', 'signOut']);
  assert.deepEqual(app.calls[2], ['signOut', { scope: 'others' }]);

  for (const signOut of [async () => ({ error: { message: 'remote failure' } }), async () => { throw new Error('synthetic'); }]) {
    const failing = harness({ signOut });
    failing.fill();
    await failing.submit();
    assert.deepEqual(failing.names(), ['signInWithPassword', 'updateUser', 'signOut']);
    assert.equal(content(failing.find(node => node.props.role === 'status' && /updated/.test(content(node)))), 'Your password has been updated.');
    assert.ok(!failing.has(node => node.props.role === 'alert'));
    assert.deepEqual(values(failing), ['', '', '']);
  }
});

test('FE-CHPW-12 the form never signs out without the others scope and never touches recovery state', () => {
  const source = readFileSync(SOURCE_URL, 'utf8');
  const signOuts = source.match(/signOut\(/g) ?? [];
  assert.equal(signOuts.length, 1);
  assert.match(source, /signOut\(\{ scope: 'others' \}\)/);
  assert.doesNotMatch(source, /authRecovery|RecoveryState|onAuthStateChange|useAuth/);
  assert.doesNotMatch(source, /scope: 'global'|scope: 'local'/);
});

test('FE-CHPW-13 nothing is written to the console or storage on any path', async () => {
  const paths = [
    {},
    { signIn: async () => fail('invalid_credentials') },
    { signIn: async () => { throw new Error('synthetic'); } },
    { update: async () => fail('weak_password', 'weak') },
    { update: async () => { throw new Error('synthetic'); } },
    { signOut: async () => { throw new Error('synthetic'); } },
  ];
  for (const options of paths) {
    const app = harness(options);
    app.fill();
    await app.submit();
    assert.deepEqual(app.logged, []);
    assert.deepEqual(app.stored, []);
  }
  const source = readFileSync(SOURCE_URL, 'utf8');
  assert.doesNotMatch(source, /console\.|localStorage|sessionStorage|indexedDB|document\.cookie/);
});

test('FE-CHPW-14 X to Y then Y to X succeeds, and X to X is refused client-side', async () => {
  let stored = CURRENT;
  const app = harness({
    signIn: async ({ password }) => (password === stored ? ok : fail('invalid_credentials')),
    update: async ({ password }) => {
      if (password === stored) return fail('same_password');
      stored = password;
      return { data: { user: {} }, error: null };
    },
  });
  app.fill(CURRENT, NEXT);
  await app.submit();
  assert.equal(stored, NEXT);
  assert.equal(app.has(node => node.props.role === 'status' && /updated/.test(content(node))), true);
  app.fill(NEXT, CURRENT);
  await app.submit();
  assert.equal(stored, CURRENT);
  assert.equal(app.has(node => node.props.role === 'status' && /updated/.test(content(node))), true);
  const before = app.calls.length;
  app.fill(CURRENT, CURRENT);
  await app.submit();
  assert.equal(app.calls.length, before);
  assert.equal(content(app.byId('change-password-new-error')), SAME);
});

test('FE-CHPW-15 the verification step is documented as client-side and the server setting as the control', () => {
  const source = readFileSync(SOURCE_URL, 'utf8');
  assert.match(source, /client-side check/i);
  assert.match(source, /Require current password/);
});

test('FE-CHPW-16 the shared same-password message is exported from the password policy', () => {
  assert.equal(passwordPolicy.SAME_PASSWORD_MESSAGE, SAME);
});
