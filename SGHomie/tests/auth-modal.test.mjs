import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from '../FrontEnd/node_modules/typescript/lib/typescript.js';

// Exercise the real component with isolated hooks and mocked authentication.
// These tests never create accounts or send verification emails.
const source = readFileSync(new URL('../FrontEnd/src/components/AuthModal.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props.children)];
}

function content(tree) {
  if (tree == null || typeof tree === 'boolean') return '';
  if (Array.isArray(tree)) return tree.map(content).join('');
  return typeof tree === 'object' ? content(tree.props.children) : String(tree);
}

function harness(result = { data: { session: null }, error: null }) {
  const state = [];
  const events = new Map();
  const successes = [];
  const errors = [];
  const requests = [];
  let hookIndex = 0;
  let mounted = false;
  const hooks = {
    useState(initial) {
      const index = hookIndex++;
      if (!(index in state)) state[index] = initial;
      return [state[index], next => { state[index] = typeof next === 'function' ? next(state[index]) : next; }];
    },
    useEffect(callback) { if (!mounted) callback(); },
  };
  const jsx = (type, props) => ({ type, props });
  const authRequest = method => async credentials => {
    requests.push({ method, ...credentials });
    return result;
  };
  const modules = {
    react: { ...hooks, default: hooks },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'react-router-dom': { useNavigate: () => () => {} },
    'lucide-react': {},
    '../lib/supabase': { supabase: { auth: {
      signUp: authRequest('register'), signInWithPassword: authRequest('signIn'),
    } } },
    'react-hot-toast': { default: { success: message => successes.push(message), error: message => errors.push(message) } },
  };
  const exports = {};
  runInNewContext(compiled, {
    exports, Error, console: { error() {} },
    window: { addEventListener: (name, callback) => events.set(name, callback), removeEventListener: name => events.delete(name) },
    require(name) { assert.ok(name in modules, `Unexpected import: ${name}`); return modules[name]; },
  });
  function render() {
    hookIndex = 0;
    const tree = exports.default();
    mounted = true;
    return tree;
  }
  function find(predicate) {
    const match = nodes(render()).find(predicate);
    assert.ok(match, 'Expected element to be rendered');
    return match;
  }
  const app = {
    render, requests, successes, errors,
    toggle() { events.get('toggle-auth-modal')(); },
    click(label) { find(node => node.type === 'button' && (content(node) === label || node.props['aria-label'] === label)).props.onClick(); },
    input(id, value) { find(node => node.type === 'input' && node.props.id === id).props.onChange({ target: { value } }); },
    value(id) { return find(node => node.type === 'input' && node.props.id === id).props.value; },
    submit() { return find(node => node.type === 'form').props.onSubmit({ preventDefault() {} }); },
  };
  render();
  app.toggle();
  return app;
}

async function register(app) {
  app.click("Don't have an account? Register");
  assert.match(content(app.render()), /Register/);
  assert.doesNotMatch(content(app.render()), /Sign up/i);
  app.input('email', 'buyer@example.invalid');
  app.input('password', 'test-password');
  app.input('confirmPassword', 'test-password');
  await app.submit();
}

test('registration keeps a persistent verification confirmation and returns to sign in', async () => {
  const app = harness();
  await register(app);
  for (let render = 0; render < 3; render++) {
    const tree = app.render();
    assert.match(content(tree), /Verification email sent/);
    assert.match(content(tree), /buyer@example.invalid/);
    assert.ok(nodes(tree).some(node => node.props.role === 'status'));
    assert.ok(!nodes(tree).some(node => node.type === 'form'));
  }
  assert.deepEqual(app.successes, []);
  assert.deepEqual(app.errors, []);
  assert.equal(app.requests.length, 1);
  assert.equal(app.requests[0].method, 'register');
  app.click('Go to Sign In');
  assert.match(content(app.render()), /Sign in to your account/);
  assert.equal(app.value('email'), 'buyer@example.invalid');
  assert.equal(app.value('password'), '');
});

test('failed registration keeps the form and entered email available to retry', async () => {
  const app = harness({ data: { session: null }, error: new Error('Registration failed') });
  await register(app);
  assert.equal(app.value('email'), 'buyer@example.invalid');
  assert.doesNotMatch(content(app.render()), /Verification email sent/);
  assert.deepEqual(app.errors, ['Registration failed']);
  assert.deepEqual(app.successes, []);
});

test('closing confirmation clears it before reopening registration', async () => {
  const app = harness();
  await register(app);
  app.click('Close authentication popup');
  assert.equal(app.render(), null);
  app.toggle();
  assert.doesNotMatch(content(app.render()), /Verification email sent/);
  assert.equal(app.value('email'), '');
  assert.equal(app.value('password'), '');
});

test('auto-confirmed registration acknowledges the session without claiming an email was sent', async () => {
  const app = harness({ data: { session: { access_token: 'mock-session' } }, error: null });
  await register(app);
  assert.match(content(app.render()), /Registration successful/);
  assert.match(content(app.render()), /you're signed in/);
  assert.doesNotMatch(content(app.render()), /Verification email sent/);
  app.click('Done');
  assert.equal(app.render(), null);
});

test('successful sign in still closes the modal', async () => {
  const app = harness({ data: { session: {} }, error: null });
  app.input('email', 'buyer@example.invalid');
  app.input('password', 'test-password');
  await app.submit();
  assert.equal(app.requests[0].method, 'signIn');
  assert.equal(app.render(), null);
  assert.deepEqual(app.successes, ['Successfully signed in!']);
  assert.deepEqual(app.errors, []);
});

const hasInput = (app, id) => nodes(app.render()).some(node => node.type === 'input' && node.props.id === id);
const inputNode = (app, id) => nodes(app.render()).find(node => node.type === 'input' && node.props.id === id);
const isToggle = node => node.type === 'button' && /^Show passwords?$/.test(node.props['aria-label'] ?? '');
const toggleNode = app => nodes(app.render()).find(isToggle);
const hasAlert = app => nodes(app.render()).some(node => node.props.role === 'alert');

test('sign-up mode renders a confirm-password field and sign-in mode does not', () => {
  const app = harness();
  assert.equal(hasInput(app, 'confirmPassword'), false);
  app.click("Don't have an account? Register");
  assert.equal(hasInput(app, 'confirmPassword'), true);
  assert.equal(inputNode(app, 'confirmPassword').props.type, 'password');
  app.click('Already have an account? Sign in');
  assert.equal(hasInput(app, 'confirmPassword'), false);
});

test('mismatched passwords show an associated alert, keep values and make no request', async () => {
  const app = harness();
  app.click("Don't have an account? Register");
  app.input('email', 'buyer@example.invalid');
  app.input('password', 'test-password');
  app.input('confirmPassword', 'different-password');
  await app.submit();
  assert.equal(app.requests.length, 0);
  assert.deepEqual(app.errors, []);
  const tree = app.render();
  const alert = nodes(tree).find(node => node.props.role === 'alert');
  assert.ok(alert, 'Expected an alert');
  assert.equal(content(alert), 'Passwords do not match.');
  const field = inputNode(app, 'confirmPassword');
  assert.equal(field.props['aria-invalid'], true);
  assert.equal(field.props['aria-describedby'], alert.props.id);
  assert.equal(app.value('password'), 'test-password');
  assert.equal(app.value('confirmPassword'), 'different-password');
  assert.equal(app.value('email'), 'buyer@example.invalid');
  assert.match(content(tree), /Register/);
});

test('an empty confirm field counts as a mismatch', async () => {
  const app = harness();
  app.click("Don't have an account? Register");
  app.input('email', 'buyer@example.invalid');
  app.input('password', 'test-password');
  await app.submit();
  assert.equal(app.requests.length, 0);
  assert.equal(hasAlert(app), true);
});

test('editing a password field clears the mismatch message', async () => {
  const app = harness();
  app.click("Don't have an account? Register");
  app.input('email', 'buyer@example.invalid');
  app.input('password', 'a');
  app.input('confirmPassword', 'b');
  await app.submit();
  assert.equal(hasAlert(app), true);
  app.input('confirmPassword', 'a');
  assert.equal(hasAlert(app), false);
  assert.notEqual(inputNode(app, 'confirmPassword').props['aria-invalid'], true);
});

test('matching passwords call signUp with only email and password', async () => {
  const app = harness();
  await register(app);
  assert.deepEqual(app.requests, [{ method: 'register', email: 'buyer@example.invalid', password: 'test-password' }]);
  assert.equal(hasAlert(app), false);
});

test('passwords start hidden and one show/hide control toggles both sign-up fields', () => {
  const app = harness();
  app.click("Don't have an account? Register");
  assert.equal(inputNode(app, 'password').props.type, 'password');
  assert.equal(inputNode(app, 'confirmPassword').props.type, 'password');
  assert.equal(nodes(app.render()).filter(isToggle).length, 1);
  assert.equal(toggleNode(app).props['aria-pressed'], false);
  toggleNode(app).props.onClick();
  assert.equal(inputNode(app, 'password').props.type, 'text');
  assert.equal(inputNode(app, 'confirmPassword').props.type, 'text');
  assert.equal(toggleNode(app).props['aria-pressed'], true);
  toggleNode(app).props.onClick();
  assert.equal(inputNode(app, 'password').props.type, 'password');
  assert.equal(inputNode(app, 'confirmPassword').props.type, 'password');
  assert.equal(toggleNode(app).props['aria-pressed'], false);
});

test('the show/hide control is a non-submitting button with a name that does not change with state', () => {
  const app = harness();
  assert.equal(toggleNode(app).props.type, 'button');
  assert.equal(toggleNode(app).props['aria-label'], 'Show password');
  toggleNode(app).props.onClick();
  assert.equal(toggleNode(app).props['aria-label'], 'Show password');
  assert.equal(toggleNode(app).props['aria-pressed'], true);
  app.click("Don't have an account? Register");
  assert.equal(toggleNode(app).props.type, 'button');
  assert.equal(toggleNode(app).props['aria-label'], 'Show passwords');
});

test('switching mode hides passwords and clears confirm and the mismatch message', async () => {
  const app = harness();
  app.click("Don't have an account? Register");
  app.input('password', 'a');
  app.input('confirmPassword', 'b');
  toggleNode(app).props.onClick();
  await app.submit();
  assert.equal(hasAlert(app), true);
  app.click('Already have an account? Sign in');
  assert.equal(inputNode(app, 'password').props.type, 'password');
  app.click("Don't have an account? Register");
  assert.equal(app.value('confirmPassword'), '');
  assert.equal(inputNode(app, 'confirmPassword').props.type, 'password');
  assert.equal(toggleNode(app).props['aria-pressed'], false);
  assert.equal(hasAlert(app), false);
});

test('closing the modal hides passwords and clears confirm and the mismatch message', async () => {
  const app = harness();
  app.click("Don't have an account? Register");
  app.input('password', 'a');
  app.input('confirmPassword', 'b');
  toggleNode(app).props.onClick();
  await app.submit();
  app.click('Close authentication popup');
  app.toggle();
  assert.equal(app.value('confirmPassword'), '');
  assert.equal(app.value('password'), '');
  assert.equal(inputNode(app, 'password').props.type, 'password');
  assert.equal(toggleNode(app).props['aria-pressed'], false);
  assert.equal(hasAlert(app), false);
});
