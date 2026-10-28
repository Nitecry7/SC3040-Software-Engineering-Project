import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from '../FrontEnd/node_modules/typescript/lib/typescript.js';
import React from '../FrontEnd/node_modules/react/index.js';
import * as jsxRuntime from '../FrontEnd/node_modules/react/jsx-runtime.js';
import { renderToStaticMarkup } from '../FrontEnd/node_modules/react-dom/server.js';
import ReactMarkdown from '../FrontEnd/node_modules/react-markdown/index.js';
import remarkGfm from '../FrontEnd/node_modules/remark-gfm/index.js';
import { visibleAssistantText } from '../BackEnd/supabase/functions/_shared/chatOutput.ts';

// Untrusted markdown below is synthetic adversarial input. Render the real
// Markdown implementation with a routing double; no browser or network is used.
const compiled = ts.transpileModule(readFileSync(new URL('../FrontEnd/src/components/ChatMarkdown.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
const modules = {
  'react/jsx-runtime': jsxRuntime,
  'react-markdown': { default: ReactMarkdown },
  'remark-gfm': { default: remarkGfm },
  'react-router-dom': { Link: ({ to, children }) => React.createElement('a', { href: to, 'data-internal-route': true }, children) },
  '../../../BackEnd/supabase/functions/_shared/chatOutput.ts': { visibleAssistantText },
};
runInNewContext(compiled, { exports, require(name) { assert.ok(name in modules, `Unexpected import: ${name}`); return modules[name]; } });
const render = content => renderToStaticMarkup(React.createElement(exports.default, { content }));

test('FE-MARKDOWN-01 raw HTML script and event-handler text cannot produce executable markup', () => {
  const html = render('<script>alert("synthetic")</script>\n\n<img src=x onerror="alert(1)">');
  assert.doesNotMatch(html, /<script|<img|<[^>]+\bonerror=/);
  assert.match(html, /&lt;script&gt;/);
});

test('FE-MARKDOWN-02 JavaScript link destinations are stripped by the Markdown renderer', () => {
  const html = render('[Unsafe](javascript:alert%281%29)');
  assert.doesNotMatch(html, /href="javascript:/i);
  assert.match(html, /Unsafe/);
});

test('FE-MARKDOWN-03 internal property links use application routing', () => {
  const html = render('[Synthetic home](/property/synthetic-id)');
  assert.match(html, /href="\/property\/synthetic-id"/);
  assert.match(html, /data-internal-route="true"/);
  assert.doesNotMatch(html, /target="_blank"/);
});

test('FE-MARKDOWN-04 external links cannot access the opener window', () => {
  const html = render('[External source](https://example.invalid/reference)');
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
  assert.doesNotMatch(html, /data-internal-route/);
});

test('FE-MARKDOWN-05 protocol-relative URLs are treated as external links', () => {
  const html = render('[External source](//example.invalid/reference)');
  assert.match(html, /target="_blank"/);
  assert.doesNotMatch(html, /data-internal-route/);
});

test('FE-MARKDOWN-06 generated image markup becomes a link rather than an embedded photo', () => {
  const html = render('![Synthetic image](https://example.invalid/photo.png)');
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /href="https:\/\/example.invalid\/photo.png"/);
  assert.match(html, /Synthetic image/);
});

test('FE-MARKDOWN-07 internal tool markup is removed before user-visible rendering', () => {
  const html = render('Trusted explanation <tool_call>{"internal":"synthetic"}</tool_call> after');
  assert.match(html, /Trusted explanation/);
  assert.match(html, /after/);
  assert.doesNotMatch(html, /tool_call|internal|synthetic/);
});
