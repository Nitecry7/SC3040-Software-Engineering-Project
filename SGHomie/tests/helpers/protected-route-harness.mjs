import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from '../../FrontEnd/node_modules/typescript/lib/typescript.js';

export function protectedRouteHarness(initialAuth) {
  const source = readFileSync(new URL('../../FrontEnd/src/components/ProtectedRoute.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  let auth = initialAuth;
  let locationKey = 'protected-entry';
  const authenticatedLocation = { current: null };
  const notices = [];
  const effects = [];
  const Navigate = 'Navigate';
  const toast = { error: (message, options) => notices.push({ message, id: options?.id }) };
  const Fragment = 'Fragment';
  const react = { default: {}, Fragment: 'Fragment', useRef: () => authenticatedLocation, useEffect: effect => effects.push(effect) };
  const modules = {
    react,
    'react/jsx-runtime': {
      Fragment,
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
    },
    'react-router-dom': { Navigate, useLocation: () => ({ key: locationKey }) },
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
    setLocation: key => { locationKey = key; },
    render: (children = 'PropertyDetails', props = {}) => ProtectedRoute({ children, ...props }),
    setAuth: next => { auth = next; },
    flushEffects: () => effects.splice(0).forEach(effect => effect()),
  };
}

