import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from '../FrontEnd/node_modules/typescript/lib/typescript.js';

// Deliberately fake keys exercise client-side configuration guards. JWTs are
// unsigned fixtures, not credentials, and this check is not JWT authentication.
const syntheticJwt = payload => `fixture.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.unsigned`;
const projectUrl = 'https://synthetic-project.supabase.co';
function check(env) {
  const source = readFileSync(new URL('../FrontEnd/src/lib/supabaseConfig.ts', import.meta.url), 'utf8')
    .replaceAll('import.meta.env', 'testEnvironment');
  const exports = {};
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(compiled, { exports, URL, atob, testEnvironment: env });
  return exports.getSupabaseConfigError();
}

for (const [id, env] of [
  ['01', {}],
  ['02', { VITE_SUPABASE_URL: projectUrl }],
  ['03', { VITE_SUPABASE_ANON_KEY: 'sb_publishable_synthetic' }],
  ['04', { VITE_SUPABASE_URL: ' ', VITE_SUPABASE_ANON_KEY: ' ' }],
]) {
  test(`FE-CONFIG-${id} missing or blank project configuration gives setup guidance`, () => {
    assert.match(check(env), /Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY/);
  });
}

test('FE-CONFIG-05 malformed project URL is rejected', () => {
  assert.match(check({ VITE_SUPABASE_URL: 'not a URL', VITE_SUPABASE_ANON_KEY: 'sb_publishable_synthetic' }), /valid Supabase project URL/);
});

for (const [id, url] of [
  ['06', 'ftp://synthetic-project.supabase.co'],
  ['07', 'https://your-project-ref.supabase.co'],
  ['08', 'https://placeholder.supabase.co'],
]) {
  test(`FE-CONFIG-${id} unsupported or placeholder project URL is rejected`, () => {
    assert.match(check({ VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: 'sb_publishable_synthetic' }), /placeholder/);
  });
}

test('FE-CONFIG-09 a privileged Supabase secret key is explicitly rejected in the browser', () => {
  const error = check({ VITE_SUPABASE_URL: projectUrl, VITE_SUPABASE_ANON_KEY: 'sb_secret_synthetic_fixture' });
  assert.match(error, /secret keys must never be used in a browser/);
  assert.doesNotMatch(error, /sb_secret_synthetic_fixture/);
});

for (const [id, key] of [
  ['10', syntheticJwt({ role: 'service_role' })],
  ['11', syntheticJwt({ role: 'authenticated' })],
  ['12', 'no-jwt-payload'],
  ['13', 'fixture.%%%.unsigned'],
  ['14', `fixture.${Buffer.from('not json').toString('base64url')}.unsigned`],
  ['15', syntheticJwt({})],
]) {
  test(`FE-CONFIG-${id} non-anonymous or unreadable legacy key is rejected`, () => {
    assert.match(check({ VITE_SUPABASE_URL: projectUrl, VITE_SUPABASE_ANON_KEY: key }), /publishable key or a legacy anon key/);
  });
}

test('FE-CONFIG-16 publishable configuration is accepted after trimming whitespace', () => {
  assert.equal(check({ VITE_SUPABASE_URL: `  ${projectUrl}  `, VITE_SUPABASE_ANON_KEY: ' sb_publishable_synthetic ' }), null);
});

test('FE-CONFIG-17 a legacy anon-role JWT fixture is accepted', () => {
  assert.equal(check({ VITE_SUPABASE_URL: projectUrl, VITE_SUPABASE_ANON_KEY: syntheticJwt({ role: 'anon' }) }), null);
});

test('FE-CONFIG-18 a local HTTP Supabase URL is supported', () => {
  assert.equal(check({ VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_ANON_KEY: 'sb_publishable_synthetic' }), null);
});
