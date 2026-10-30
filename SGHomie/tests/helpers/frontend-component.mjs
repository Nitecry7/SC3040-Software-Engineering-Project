import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from '../../FrontEnd/node_modules/typescript/lib/typescript.js';

// Exercises component event handlers and observable JSX with isolated service
// doubles. This does not simulate browser layout or native form validation.
export function componentHarness(file, dependencies = {}, props = {}, globals = {}) {
  const state = [];
  const effects = [];
  let cursor = 0;
  const memo = (callback, dependencies) => {
    const slot = cursor++;
    if (!state[slot] || dependencies.some((value, index) => value !== state[slot].dependencies[index])) {
      state[slot] = { dependencies, value: callback() };
    }
    return state[slot].value;
  };
  const hooks = {
    useMemo: memo,
    useCallback: (callback, dependencies) => memo(() => callback, dependencies),
    useState(initial) {
      const slot = cursor++;
      if (!(slot in state)) state[slot] = typeof initial === 'function' ? initial() : initial;
      return [state[slot], next => { state[slot] = typeof next === 'function' ? next(state[slot]) : next; }];
    },
    useRef(initial) {
      const slot = cursor++;
      if (!(slot in state)) state[slot] = { current: initial };
      return state[slot];
    },
    useEffect(callback, dependencies) {
      const slot = cursor++;
      if (!state[slot] || !dependencies || dependencies.some((value, index) => value !== state[slot][index])) {
        state[slot] = dependencies;
        effects.push(callback);
      }
    },
  };
  const jsx = (type, props) => ({ type, props: props ?? {} });
  const modules = {
    react: { ...hooks, default: hooks },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    ...dependencies,
  };
  const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  runInNewContext(compiled, {
    exports, console: { error() {} },
    require(name) { assert.ok(name in modules, `Unexpected import: ${name}`); return modules[name]; },
    ...globals,
  });
  function render() { cursor = 0; return exports.default(props); }
  function find(predicate) {
    const match = nodes(render()).find(predicate);
    assert.ok(match, 'Expected element to be rendered');
    return match;
  }
  return {
    render, find, exports,
    async effects() { for (const effect of effects.splice(0)) await effect(); },
  };
}

export function nodes(value) {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (value === null || typeof value !== 'object') return [];
  return [value, ...nodes(value.props?.children)];
}

export function content(value) {
  if (Array.isArray(value)) return value.map(content).join('');
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  return typeof value === 'object' ? content(value.props?.children) : String(value);
}

export function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
