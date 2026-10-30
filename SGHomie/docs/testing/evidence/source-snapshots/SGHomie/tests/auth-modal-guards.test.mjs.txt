import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import test from 'node:test';
import { componentHarness, content } from './helpers/frontend-component.mjs';

// Synthetic auth responses; this suite makes no Supabase requests or email sends.
async function harness({ result = { data: { session: null, user: { identities: [{}] } }, error: null }, storageThrows = false } = {}) {
  const requests = [];
  const errors = [];
  const storage = new Map();
  const events = new Map();
  const app = componentHarness(new URL('../FrontEnd/src/components/AuthModal.tsx', import.meta.url), {
    'lucide-react': {},
    '../lib/supabase': { supabase: { auth: {
      async signUp(credentials) { requests.push(['register', credentials]); return result; },
      async signInWithPassword(credentials) { requests.push(['signIn', credentials]); return result; },
    } } },
    'react-hot-toast': { default: { success() {}, error: value => errors.push(value) } },
  }, {}, {
    Error, crypto: webcrypto, TextEncoder,
    window: {
      addEventListener: (name, handler) => events.set(name, handler),
      removeEventListener: name => events.delete(name),
      sessionStorage: {
        getItem(key) { if (storageThrows) throw new Error('synthetic privacy restriction'); return storage.get(key) ?? null; },
        setItem(key, value) { if (storageThrows) throw new Error('synthetic privacy restriction'); storage.set(key, value); },
        removeItem(key) { storage.delete(key); },
      },
    },
  });
  app.render();
  await app.effects();
  events.get('toggle-auth-modal')();
  const click = label => app.find(node => node.type === 'button' && (content(node) === label || node.props['aria-label'] === label)).props.onClick();
  const input = (id, value) => app.find(node => node.props.id === id).props.onChange({ target: { value } });
  const submit = () => app.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  const register = async (email = 'buyer@example.invalid') => {
    input('email', email);
    input('password', 'synthetic-password');
    await submit();
  };
  click("Don't have an account? Register");
  return { ...app, requests, errors, storage, click, input, submit, register, toggle: () => events.get('toggle-auth-modal')() };
}

test('FE-AUTH-01 current confirmation action returns to sign-in and clears the password', async () => {
  const app = await harness();
  await app.register();
  app.click('Go to Sign In');
  assert.match(content(app.render()), /Sign in to your account/);
  assert.equal(app.find(node => node.props.id === 'email').props.value, 'buyer@example.invalid');
  assert.equal(app.find(node => node.props.id === 'password').props.value, '');
});

test('FE-AUTH-02 repeating registration with case/whitespace variants does not send another request', async () => {
  const app = await harness();
  await app.register();
  app.click('Close authentication popup');
  app.toggle();
  await app.register(' BUYER@example.invalid ');
  assert.equal(app.requests.length, 1);
  assert.match(content(app.render()), /Verification email already sent/);
});

test('FE-AUTH-03 verification guard stores only an email fingerprint', async () => {
  const app = await harness();
  await app.register();
  assert.equal(app.storage.size, 1);
  const [key, value] = [...app.storage][0];
  assert.match(key, /^sghomie:verification-sent:[a-f0-9]{64}$/);
  assert.doesNotMatch(key, /buyer|@/);
  assert.equal(value, 'true');
});

test('FE-AUTH-04 privacy restrictions on session storage retain the in-memory duplicate guard', async () => {
  const app = await harness({ storageThrows: true });
  await app.register();
  app.click('Close authentication popup');
  app.toggle();
  await app.register();
  assert.equal(app.requests.length, 1);
  assert.match(content(app.render()), /Verification email already sent/);
  assert.deepEqual(app.errors, []);
});

for (const [id, error] of [
  ['05', { code: 'user_already_exists' }],
  ['06', { code: 'email_exists' }],
  ['07', { message: 'User already registered' }],
]) {
  test(`FE-AUTH-${id} an existing-account response gives guidance without claiming another email send`, async () => {
    const app = await harness({ result: { data: { user: null, session: null }, error } });
    await app.register();
    assert.match(content(app.render()), /Check your email or sign in/);
    assert.doesNotMatch(content(app.render()), /We've sent a verification link/);
    assert.deepEqual(app.errors, []);
    assert.equal(app.storage.size, 0);
  });
}

test('FE-AUTH-08 an obfuscated existing-account success response gives the same neutral guidance', async () => {
  const app = await harness({ result: { data: { user: { identities: [] }, session: null }, error: null } });
  await app.register();
  assert.match(content(app.render()), /Check your email or sign in/);
  assert.doesNotMatch(content(app.render()), /We've sent a verification link/);
  assert.equal(app.storage.size, 0);
});
