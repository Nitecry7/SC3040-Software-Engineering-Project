import assert from 'node:assert/strict';
import { test } from 'node:test';
import { consumeChatStream } from '../FrontEnd/src/lib/chat.ts';

const userId = '33333333-3333-4333-8333-333333333333';
const conversationId = '22222222-2222-4222-8222-222222222222';
const quota = { tier: 'standard', minute_limit: 2, minute_remaining: 1, daily_limit: 5, daily_remaining: 4,
  daily_reset_at: '2026-10-27T16:00:00.000Z', cooldown_until: null };
const env = { SUPABASE_URL: 'https://database.example', SUPABASE_ANON_KEY: 'public-test-key',
  SUPABASE_SERVICE_ROLE_KEY: 'server-test-only', CHAT_PROVIDER: 'openai', OPENAI_API_KEY: 'provider-test-only', OPENAI_MODEL: 'gpt-6-luna' };
globalThis.Deno = { env: { get(name) { return env[name]; } }, serve() {} };
const { handleRequest } = await import('../BackEnd/supabase/functions/chatbot/index.ts');

function buildFetch(calls) {
  return async (input, init = {}) => {
    const url = new URL(String(input));
    calls.push({ url, init });
    if (url.pathname === '/auth/v1/user') return Response.json({ id: userId, is_anonymous: false });
    if (url.pathname === '/rest/v1/user_profiles') return Response.json({ is_admin: false, is_seller: false, name: null, phone: null,
      preferred_locations: null, preferred_property_type: null });
    if (url.pathname === '/rest/v1/rpc/reserve_chat_user_interaction') return Response.json({ allowed: true, quota });
    if (url.pathname === '/rest/v1/rpc/reserve_chat_provider_call') return Response.json({ allowed: true });
    if (url.pathname === '/rest/v1/chat_interactions' || url.pathname === '/rest/v1/chat_provider_calls') return new Response(null, { status: 201 });
    if (url.pathname === '/rest/v1/chat_interactions') return new Response(null, { status: 204 });
    if (url.pathname === '/v1/chat/completions') return Response.json({ id: 'provider-id', object: 'chat.completion', created: 1,
      model: 'gpt-6-luna-served', choices: [{ index: 0, message: { role: 'assistant', content: 'A concise housing answer.' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 20, completion_tokens: 8, total_tokens: 28 } });
    throw new Error(`Unexpected fetch ${url.pathname}`);
  };
}

const request = (stream) => new Request('https://functions.example/chatbot', { method: 'POST',
  headers: { Authorization: 'Bearer user-session', 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages: [{ role: 'user', content: 'Explain the buying process.' }], stream, conversation_id: conversationId }) });

for (const stream of [false, true]) {
  test(`authenticated AI telemetry returns correlation metadata for ${stream ? 'SSE' : 'JSON'}`, async t => {
    const calls = [];
    t.mock.method(globalThis, 'fetch', buildFetch(calls));
    const response = await handleRequest(request(stream));
    assert.equal(response.status, 200);
    let payload;
    if (stream) {
      let metadata;
      await consumeChatStream(response, () => {}, () => {}, undefined, undefined, value => { metadata = value; });
      assert.ok(metadata);
      assert.equal(metadata.conversation_id, conversationId);
      assert.equal(metadata.interaction_id, metadata.request_id);
      payload = metadata;
    } else {
      payload = await response.json();
      assert.equal(payload.response, 'A concise housing answer.');
      assert.equal(payload.conversation_id, conversationId);
      assert.equal(payload.interaction_id, payload.request_id);
    }
    const callsInserted = calls.filter(call => call.url.pathname === '/rest/v1/chat_provider_calls');
    assert.equal(callsInserted.length, 1);
    const providerCall = JSON.parse(callsInserted[0].init.body)[0];
    assert.equal(providerCall.interaction_id, payload.interaction_id);
    assert.equal(providerCall.resolved_model, 'gpt-6-luna-served');
    const interactionCalls = calls.filter(call => call.url.pathname === '/rest/v1/chat_interactions');
    assert.equal(interactionCalls.length, 2, 'one initial interaction and one finalization');
    const started = JSON.parse(interactionCalls[0].init.body);
    assert.equal(started.request_id, payload.interaction_id);
    assert.equal(started.prompt_version, 'chatbot-v1');
    assert.equal(started.user_message_redacted, 'Explain the buying process.');
    assert.equal(calls.filter(call => call.url.pathname === '/v1/chat/completions').length, 1);
    assert.equal(calls.filter(call => call.url.pathname === '/rest/v1/rpc/reserve_chat_provider_call').length, 1);
  });
}

test('sensitive credential input is stopped before user quota and provider calls', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', buildFetch(calls));
  const sensitive = new Request('https://functions.example/chatbot', { method: 'POST',
    headers: { Authorization: 'Bearer user-session', 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'My NRIC is S1234567D' }], stream: false, conversation_id: conversationId }) });
  const response = await handleRequest(sensitive);
  assert.equal(response.status, 200);
  assert.match((await response.json()).response, /remove passwords, API keys, NRIC\/FIN/i);
  assert.equal(calls.filter(call => call.url.pathname.includes('reserve_chat_')).length, 0);
  assert.equal(calls.filter(call => call.url.pathname === '/v1/chat/completions').length, 0);
  assert.equal(calls.filter(call => call.url.pathname === '/rest/v1/chat_interactions').length, 0);
});

test('quota denial keeps its 429 contract and finalizes metadata without a provider request', async t => {
  const calls = [];
  const base = buildFetch(calls);
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.pathname === '/rest/v1/rpc/reserve_chat_user_interaction') {
      calls.push({ url, init });
      return Response.json({ allowed: false, code: 'CHAT_USER_BURST_LIMIT', retry_after_seconds: 21,
        retry_at: '2026-10-26T00:00:21Z', quota });
    }
    return base(input, init);
  });
  const response = await handleRequest(request(false));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '21');
  const payload = await response.json();
  assert.equal(payload.code, 'CHAT_USER_BURST_LIMIT');
  assert.equal(payload.retry_after_seconds, 21);
  assert.equal(payload.interaction_id, payload.request_id);
  assert.equal(payload.conversation_id, conversationId);
  assert.equal(calls.filter(call => call.url.pathname === '/v1/chat/completions').length, 0);
  assert.equal(calls.filter(call => call.url.pathname === '/rest/v1/chat_provider_calls').length, 0);
  const finalization = calls.find(call => call.url.pathname === '/rest/v1/chat_interactions' && call.init.method === 'PATCH');
  assert.ok(finalization);
  const saved = JSON.parse(finalization.init.body);
  assert.equal(saved.status, 'quota_denied');
  assert.equal(saved.quota_result, 'user_burst_limited');
  assert.equal(saved.user_message_redacted, null);
});
