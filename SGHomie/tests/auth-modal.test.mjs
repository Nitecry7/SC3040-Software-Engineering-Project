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
  app.click('Back to Sign In');
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
