import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from '../FrontEnd/node_modules/typescript/lib/typescript.js';

const source = readFileSync(new URL('../FrontEnd/src/components/SessionExpiryModal.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;
const effects = [];
const refs = [];
const documentMock = { body: {}, activeElement: null };
const windowMock = { setInterval: () => 1, clearInterval() {} };
class HTMLElementMock { focus() { documentMock.activeElement = this; } }
const hooks = {
  useEffect: effect => effects.push(effect),
  useRef: () => { const ref = { current: null }; refs.push(ref); return ref; },
  useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
};
const jsx = (type, props) => ({ type, props });
const exports = {};
runInNewContext(compiled, {
  exports,
  document: documentMock,
  window: windowMock,
  HTMLElement: HTMLElementMock,
  Date,
  require(name) {
    if (name === 'react') return { ...hooks, default: hooks };
    if (name === 'react-dom') return { createPortal: tree => tree };
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'lucide-react') return { X: 'X' };
    assert.fail(`Unexpected import: ${name}`);
  },
});

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}

function content(tree) {
  if (tree == null || typeof tree === 'boolean') return '';
  if (Array.isArray(tree)) return tree.map(content).join(' ');
  return typeof tree === 'object' ? content(tree.props?.children) : String(tree);
}

test('expiry warning uses accessible dialog semantics and explains the deadline', () => {
  const tree = exports.default({
    expiresAt: Date.now() + 5 * 60_000, error: null, busy: false,
    onStaySignedIn() {}, onSignOut() {}, onDismiss() {},
  });
  const dialog = nodes(tree).find(node => node.props?.role === 'dialog');
  assert.ok(dialog);
  assert.equal(dialog.props['aria-modal'], 'true');
  assert.equal(dialog.props['aria-labelledby'], 'session-expiry-title');
  assert.equal(dialog.props['aria-describedby'], 'session-expiry-description');
  assert.match(content(dialog), /Your session is about to expire/);
  assert.match(content(dialog), /signed out in\s+5\s+minutes/);
  assert.match(dialog.props.className, /max-w-lg/);
  assert.match(dialog.props.className, /sm:p-8/);
  assert.ok(nodes(dialog).filter(node => node.type === 'button').every(button => button.props.className.includes('focus-visible:ring-2')));
});

test('warning exposes Stay signed in, Sign out, close, and a recoverable verification error', () => {
  const calls = [];
  const tree = exports.default({
    expiresAt: Date.now() + 60_000,
    error: 'We could not verify your session. Please try again.',
    busy: false,
    onStaySignedIn: () => calls.push('stay'),
    onSignOut: () => calls.push('signout'),
    onDismiss: () => calls.push('dismiss'),
  });
  const elements = nodes(tree);
  const stay = elements.find(node => node.type === 'button' && content(node.props.children).includes('Stay signed in'));
  const signOut = elements.find(node => node.type === 'button' && content(node.props.children) === 'Sign out');
  const close = elements.find(node => node.type === 'button' && node.props['aria-label'] === 'Close session warning');
  assert.ok(stay && signOut && close);
  assert.match(content(tree), /We could not verify your session/);
  stay.props.onClick(); signOut.props.onClick(); close.props.onClick();
  assert.deepEqual(calls, ['stay', 'signout', 'dismiss']);
});

test('warning moves focus inside, traps Tab navigation, and Escape dismisses without other actions', () => {
  const calls = [];
  const tree = exports.default({
    expiresAt: Date.now() + 60_000, error: null, busy: false,
    onStaySignedIn() {}, onSignOut() {}, onDismiss: () => calls.push('dismiss'),
  });
  const elements = nodes(tree);
  const dialogRef = refs.at(-2);
  const stayRef = refs.at(-1);
  const controls = elements.filter(node => node.type === 'button').map(() => new HTMLElementMock());
  let keyHandler;
  dialogRef.current = {
    querySelectorAll: () => controls,
    addEventListener: (_type, handler) => { keyHandler = handler; },
    removeEventListener() {},
  };
  stayRef.current = controls[2];
  const cleanup = effects.at(-1)();
  assert.equal(documentMock.activeElement, controls[2]);

  documentMock.activeElement = controls[2];
  let prevented = false;
  keyHandler({ key: 'Tab', shiftKey: false, preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(documentMock.activeElement, controls[0]);

  prevented = false;
  keyHandler({ key: 'Tab', shiftKey: true, preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(documentMock.activeElement, controls[2]);
  keyHandler({ key: 'Escape', preventDefault() {} });
  assert.deepEqual(calls, ['dismiss']);
  cleanup();
});

