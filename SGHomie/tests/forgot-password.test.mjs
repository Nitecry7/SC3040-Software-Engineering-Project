import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { componentHarness, content, deferred } from './helpers/frontend-component.mjs';

// Synthetic responses only; no Supabase request or email is ever sent.
const CONFIRMATION = "If an account exists for that address, we've sent a link to reset your password. Check your inbox and your junk or spam folder.";
const NETWORK = "We couldn't send the request. Check your connection and try again.";

function harness(respond = async () => ({ data: {}, error: null }), props = {}) {
  const calls = [];
  const logs = [];
  let backs = 0;
  const log = (...args) => logs.push(args);
  const app = componentHarness(new URL('../FrontEnd/src/components/ForgotPasswordForm.tsx', import.meta.url), {
    'lucide-react': {},
    '../lib/supabase': { supabase: { auth: {
      resetPasswordForEmail(email, options) { calls.push({ email, options }); return respond(email, options); },
    } } },
  }, { onBack: () => { backs++; }, ...props }, {
    Error, console: { error: log, log, warn: log, info: log, debug: log },
    window: { location: { origin: 'https://synthetic.example.invalid' } },
  });
  const input = value => app.find(node => node.props.id === 'forgot-email').props.onChange({ target: { value } });
  const submit = () => app.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  const text = () => content(app.render());
  return { ...app, calls, logs, backs: () => backs, input, submit, text };
}

test('FE-FORGOT-01 submitting calls resetPasswordForEmail with the email and the reset-password redirect', async () => {
  const app = harness();
  app.input('buyer@example.invalid');
  await app.submit();
  assert.equal(app.calls.length, 1);
  assert.equal(app.calls[0].email, 'buyer@example.invalid');
  assert.deepEqual({ ...app.calls[0].options }, { redirectTo: 'https://synthetic.example.invalid/reset-password' });
});

test('FE-FORGOT-02 the confirmation is identical for success, an unknown address and a rate limit', async () => {
  const outcomes = [
    { data: {}, error: null },
    { data: null, error: { name: 'AuthApiError', status: 400, code: 'user_not_found', message: 'User not found' } },
    { data: null, error: { name: 'AuthApiError', status: 429, code: 'over_email_send_rate_limit', message: 'rate limit' } },
    { data: null, error: { name: 'AuthApiError', status: 500, message: 'Error sending recovery email' } },
  ];
  const texts = [];
  for (const outcome of outcomes) {
    const app = harness(async () => outcome);
    app.input('someone@example.invalid');
    await app.submit();
    texts.push(app.text());
  }
  for (const text of texts) assert.ok(text.includes(CONFIRMATION), text);
  assert.equal(new Set(texts).size, 1);
  for (const text of texts) assert.doesNotMatch(text, /rate|not found|unknown|registered/i);
});

test('FE-FORGOT-03 a thrown network failure shows the retry message and not the confirmation', async () => {
  const app = harness(async () => { throw new Error('synthetic fetch failure'); });
  app.input('buyer@example.invalid');
  await app.submit();
  const text = app.text();
  assert.ok(text.includes(NETWORK));
  assert.ok(!text.includes(CONFIRMATION));
  assert.doesNotMatch(text, /synthetic fetch failure/);
});

test('FE-FORGOT-04 a returned network error (status 0) also shows the retry message', async () => {
  const app = harness(async () => ({ data: null, error: { name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' } }));
  app.input('buyer@example.invalid');
  await app.submit();
  assert.ok(app.text().includes(NETWORK));
});

test('FE-FORGOT-05 a second submit while the request is in flight sends nothing and the button is disabled', async () => {
  const pending = deferred();
  const app = harness(() => pending.promise);
  app.input('buyer@example.invalid');
  const first = app.submit();
  assert.equal(app.find(node => node.type === 'button' && node.props.type === 'submit').props.disabled, true);
  await app.submit();
  assert.equal(app.calls.length, 1);
  pending.resolve({ data: {}, error: null });
  await first;
  assert.equal(app.calls.length, 1);
  assert.equal(app.find(node => node.type === 'button' && node.props.type === 'submit').props.disabled, false);
});

test('FE-FORGOT-06 nothing is logged, including for errors and network failures', async () => {
  for (const respond of [
    async () => ({ data: null, error: { status: 429, message: 'buyer@example.invalid rate limited' } }),
    async () => { throw new Error('buyer@example.invalid failed'); },
    async () => ({ data: {}, error: null }),
  ]) {
    const app = harness(respond);
    app.input('buyer@example.invalid');
    await app.submit();
    assert.deepEqual(app.logs, []);
  }
});

test('FE-FORGOT-07 the email field is prefilled, typed as email and autocompletes', () => {
  const app = harness(undefined, { initialEmail: 'prefill@example.invalid' });
  const field = app.find(node => node.props.id === 'forgot-email');
  assert.equal(field.props.type, 'email');
  assert.equal(field.props.autoComplete, 'email');
  assert.equal(field.props.value, 'prefill@example.invalid');
});

test('FE-FORGOT-08 the back control calls onBack and the dialog title is present', () => {
  const app = harness();
  app.find(node => node.type === 'button' && content(node) === 'Back to sign in').props.onClick();
  assert.equal(app.backs(), 1);
  assert.equal(app.find(node => node.props.id === 'auth-modal-title').type, 'h2');
});

test('FE-FORGOT-09 the form does not retry automatically', () => {
  const source = readFileSync(new URL('../FrontEnd/src/components/ForgotPasswordForm.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /setTimeout|setInterval/);
  assert.doesNotMatch(source, /console\./);
});

// ---- AuthModal integration: the entry point and the view switch ----

import { webcrypto } from 'node:crypto';
import * as passwordPolicy from '../FrontEnd/src/lib/passwordPolicy.ts';
import { nodes } from './helpers/frontend-component.mjs';

// Stand-ins for child components; the harness does not render them.
function ForgotPasswordForm() { return null; }
function PasswordStrength() { return null; }

async function modal() {
  const events = new Map();
  const app = componentHarness(new URL('../FrontEnd/src/components/AuthModal.tsx', import.meta.url), {
    'lucide-react': {},
    '../lib/passwordPolicy': passwordPolicy,
    './PasswordStrength': { default: PasswordStrength },
    './ForgotPasswordForm': { default: ForgotPasswordForm },
    '../lib/supabase': { supabase: { auth: {} } },
    'react-hot-toast': { default: { success() {}, error() {} } },
  }, {}, {
    Error, crypto: webcrypto, TextEncoder,
    window: {
      addEventListener: (name, handler) => events.set(name, handler),
      removeEventListener: name => events.delete(name),
      sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    },
  });
  app.render();
  await app.effects();
  const button = label => app.find(node => node.type === 'button' && (content(node) === label || node.props['aria-label'] === label));
  const has = predicate => nodes(app.render()).some(predicate);
  const input = (id, value) => app.find(node => node.type === 'input' && node.props.id === id).props.onChange({ target: { value } });
  return { ...app, events, button, has, input, open: () => events.get('toggle-auth-modal')() };
}

test('FE-FORGOT-10 sign-in mode offers Forgot password and register mode does not', async () => {
  const app = await modal();
  app.open();
  assert.ok(app.has(node => node.type === 'button' && content(node) === 'Forgot password?'));
  app.button("Don't have an account? Register").props.onClick();
  assert.ok(!app.has(node => node.type === 'button' && content(node) === 'Forgot password?'));
});

test('FE-FORGOT-11 Forgot password swaps in the request form with the typed email and a way back', async () => {
  const app = await modal();
  app.open();
  app.input('email', 'buyer@example.invalid');
  app.button('Forgot password?').props.onClick();
  const form = app.find(node => node.type === ForgotPasswordForm);
  assert.equal(form.props.initialEmail, 'buyer@example.invalid');
  assert.ok(!app.has(node => node.type === 'form'));
  form.props.onBack();
  assert.ok(!app.has(node => node.type === ForgotPasswordForm));
  assert.match(content(app.render()), /Sign in to your account/);
});

test('FE-FORGOT-12 the open-forgot-password event opens the closed modal on the request view', async () => {
  const app = await modal();
  assert.equal(app.render(), null);
  app.events.get('open-forgot-password')();
  assert.ok(app.has(node => node.type === ForgotPasswordForm));
});

test('FE-FORGOT-13 closing the modal resets the request view', async () => {
  const app = await modal();
  app.open();
  app.button('Forgot password?').props.onClick();
  app.button('Close authentication popup').props.onClick();
  app.open();
  assert.ok(!app.has(node => node.type === ForgotPasswordForm));
  assert.match(content(app.render()), /Sign in to your account/);
});

test('FE-FORGOT-14 password and email inputs carry the right autocomplete hints', async () => {
  const app = await modal();
  app.open();
  const field = id => app.find(node => node.type === 'input' && node.props.id === id).props.autoComplete;
  assert.equal(field('email'), 'email');
  assert.equal(field('password'), 'current-password');
  app.button("Don't have an account? Register").props.onClick();
  assert.equal(field('email'), 'email');
  assert.equal(field('password'), 'new-password');
  assert.equal(field('confirmPassword'), 'new-password');
});
