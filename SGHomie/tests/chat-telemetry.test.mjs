import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  CHAT_PROMPT_VERSION, createChatTelemetry, createTelemetryStore, detectSensitiveInput, observeChatStream, redactTelemetryText,
} from '../BackEnd/supabase/functions/chatbot/telemetry.ts';

const userMessage = 'I want homes under $500000 near postal code 560123 and block 123';
const identity = { interactionId: '11111111-1111-4111-8111-111111111111', conversationId: '22222222-2222-4222-8222-222222222222', userId: '33333333-3333-4333-8333-333333333333' };

function harness(options = {}) {
  const rows = { started: [], finished: [], calls: [] };
  let time = 100;
  const store = options.store ?? {
    async start(row) { rows.started.push(row); },
    async finish(id, row) { rows.finished.push({ id, row }); },
    async providerCalls(calls) { rows.calls.push(...calls); },
  };
  const telemetry = createChatTelemetry({ ...identity, store, provider: 'openrouter', model: 'openrouter/free', streaming: false,
    messages: [{ role: 'user', content: userMessage }], now: () => time, isoNow: () => '2026-10-26T00:00:00.000Z' });
  return { rows, telemetry, tick(ms = 10) { time += ms; } };
}

test('sensitive-input blocking catches clear credentials but allows ordinary housing values', () => {
  assert.equal(detectSensitiveInput('my API key is sk-proj-abcdefghijklmnop012345'), 'credential');
  assert.equal(detectSensitiveInput('Authorization: Bearer eyJabcdefgh.abcdefgh.abcdefgh'), 'credential');
  assert.equal(detectSensitiveInput('My NRIC is S1234567D'), 'nric_fin');
  assert.equal(detectSensitiveInput('card 4111 1111 1111 1111'), 'payment_card');
  for (const value of ['$500000', 'postal code 560123', 'block 123', 'asking $888000']) assert.equal(detectSensitiveInput(value), null);
});

test('best-effort redaction masks personal and credential values without changing housing context', () => {
  const result = redactTelemetryText('Call +65 9123 4567, email home@example.com, NRIC S1234567D; password:abc123; budget $500000 at 560123');
  assert.match(result, /\[PHONE_REDACTED\]/);
  assert.match(result, /\[EMAIL_REDACTED\]/);
  assert.match(result, /\[NRIC_REDACTED\]/);
  assert.match(result, /\[CREDENTIAL_REDACTED\]/);
  assert.match(result, /\$500000 at 560123/);
});

test('Singapore phone redaction covers fixed-line, mobile and country-code forms without masking housing numbers', () => {
  for (const phone of ['69304030', '91234567', '81234567', '6930 4030', '9123 4567', '8123 4567', '6930-4030',
    '+65 6930 4030', '+65 9123 4567', '65 8123 4567', '+65-6930-4030', '65-9123-4567']) {
    assert.equal(redactTelemetryText(phone), '[PHONE_REDACTED]', `expected synthetic fixture ${phone} to be redacted`);
  }
  const housing = 'budget $500000, postal code 560123, Block 123, 4-room, price 600000, year 2026, renovation $69304030';
  assert.equal(redactTelemetryText(housing), housing);
});

test('telemetry persistence retries once idempotently and logs only safe operation metadata', async t => {
  const persisted = { interactions: new Map(), calls: new Map(), finishes: new Map() };
  const counts = { start: 0, providerCalls: 0, finish: 0 };
  const store = {
    async start(row) {
      counts.start++;
      if (counts.start === 1) throw new Error('synthetic phone 69304030 must not be logged');
      persisted.interactions.set(row.interaction_id, row);
    },
    async providerCalls(rows) {
      counts.providerCalls++;
      if (counts.providerCalls === 1) throw new Error('synthetic phone 69304030 must not be logged');
      for (const row of rows) persisted.calls.set(`${row.interaction_id}:${row.sequence}`, row);
    },
    async finish(id, row) {
      counts.finish++;
      if (counts.finish === 1) throw new Error('synthetic phone 69304030 must not be logged');
      persisted.finishes.set(id, row);
    },
  };
  const logs = [];
  t.mock.method(console, 'warn', (...args) => logs.push(args));
  const h = harness({ store });
  await h.telemetry.start();
  const provider = { chat: { completions: { async create() {
    return { model: 'served/model', choices: [{ message: { content: 'Safe answer' } }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } };
  } } } };
  await h.telemetry.providerClient(provider, async () => {}).chat.completions.create({ model: 'requested/model', messages: [] });
  await h.telemetry.finish({ status: 'success' });
  await h.telemetry.finish({ status: 'success' });

  assert.deepEqual(counts, { start: 2, providerCalls: 2, finish: 2 });
  assert.equal(persisted.interactions.size, 1);
  assert.equal(persisted.calls.size, 1);
  assert.equal(persisted.finishes.size, 1);
  assert.ok(logs.length >= 3);
  assert.ok(logs.every(([, metadata]) => metadata.event === 'chat_telemetry_write'
    && ['start', 'provider_calls', 'finalize'].includes(metadata.operation)));
  assert.doesNotMatch(JSON.stringify(logs), /69304030|synthetic phone/);
  assert.equal(h.telemetry.feedbackEligible(), true);
});

test('persistent interaction-start failure is logged safely and does not block quota or provider use', async t => {
  let attempts = 0;
  const logs = [];
  t.mock.method(console, 'warn', (...args) => logs.push(args));
  const h = harness({ store: {
    async start() { attempts++; throw new Error('synthetic phone 69304030 must not be logged'); },
    async finish() {}, async providerCalls() {},
  } });
  await h.telemetry.start();
  let permits = 0;
  let providerCalls = 0;
  const provider = { chat: { completions: { async create() { providerCalls++; return { choices: [{ message: { content: 'answer' } }] }; } } } };
  await h.telemetry.providerClient(provider, async () => { permits++; }).chat.completions.create({ model: 'fixture', messages: [] });
  await h.telemetry.finish({ status: 'success' });
  assert.equal(attempts, 2);
  assert.equal(permits, 1);
  assert.equal(providerCalls, 1);
  assert.equal(h.telemetry.feedbackEligible(), false);
  assert.equal(logs.at(-1)[1].outcome, 'failed');
  assert.doesNotMatch(JSON.stringify(logs), /69304030|synthetic phone/);
});

test('persistent provider-call and finalization write failures are bounded and remain non-authoritative', async t => {
  let providerWriteAttempts = 0;
  let finalizeAttempts = 0;
  const logs = [];
  t.mock.method(console, 'warn', (...args) => logs.push(args));
  const h = harness({ store: {
    async start() {},
    async providerCalls() { providerWriteAttempts++; throw new Error('private provider write detail'); },
    async finish() { finalizeAttempts++; throw new Error('private finalization detail'); },
  } });
  await h.telemetry.start();
  const provider = { chat: { completions: { async create() {
    return { model: 'served/model', choices: [{ message: { content: 'answer' } }] };
  } } } };
  await h.telemetry.providerClient(provider, async () => {}).chat.completions.create({ model: 'fixture', messages: [] });
  await assert.doesNotReject(h.telemetry.finish({ status: 'success' }));
  assert.equal(providerWriteAttempts, 2);
  assert.equal(finalizeAttempts, 2);
  assert.equal(logs.filter(([, meta]) => meta.operation === 'provider_calls' && meta.outcome === 'failed').length, 1);
  assert.equal(logs.filter(([, meta]) => meta.operation === 'finalize' && meta.outcome === 'failed').length, 1);
  assert.doesNotMatch(JSON.stringify(logs), /private provider|private finalization/);
});

test('PostgREST telemetry writes use idempotent interaction and provider-call keys', async () => {
  const calls = [];
  const store = createTelemetryStore({ from(table) {
    return {
      upsert(value, options) { calls.push({ table, method: 'upsert', value, options }); return Promise.resolve({ error: null }); },
      update(value) { return { eq(column, id) { calls.push({ table, method: 'update', value, column, id }); return Promise.resolve({ error: null }); } }; },
    };
  } });
  const interaction = { interaction_id: identity.interactionId };
  const call = { interaction_id: identity.interactionId, sequence: 1 };
  await store.start(interaction);
  await store.providerCalls([call]);
  await store.finish(identity.interactionId, { status: 'success' });
  assert.deepEqual(calls.map(({ table, method }) => [table, method]), [
    ['chat_interactions', 'upsert'], ['chat_provider_calls', 'upsert'], ['chat_interactions', 'update'],
  ]);
  assert.equal(calls[0].options.onConflict, 'interaction_id');
  assert.equal(calls[1].options.onConflict, 'interaction_id,sequence');
  assert.equal(calls[2].column, 'interaction_id');
});

test('provider calls retain per-call model, usage, status and monotonic latency', async () => {
  const h = harness();
  await h.telemetry.start();
  h.telemetry.setQuota({ tier: 'standard', minute_limit: 2, minute_remaining: 1, daily_limit: 5, daily_remaining: 4,
    daily_reset_at: '2026-10-27T16:00:00Z', cooldown_until: null });
  const providerCalls = [];
  const client = { chat: { completions: { async create(params) {
    providerCalls.push(params);
    h.tick(35);
    return { model: 'served/model-v2', choices: [{ message: { content: 'answer' } }],
      usage: { prompt_tokens: 12, completion_tokens: 5, total_tokens: 17 } };
  } } } };
  const observed = h.telemetry.providerClient(client, async () => {});
  await observed.chat.completions.create({ model: 'openrouter/free', messages: [] });
  await observed.chat.completions.create({ model: 'openrouter/free', messages: [] });
  h.telemetry.setAssistant('A useful answer.');
  h.telemetry.noteOutput();
  await h.telemetry.finish({ status: 'success' });
  assert.equal(providerCalls.length, 2);
  assert.equal(h.rows.started[0].prompt_version, CHAT_PROMPT_VERSION);
  assert.equal(h.rows.started[0].request_id, identity.interactionId);
  assert.equal(h.rows.calls.length, 2);
  assert.equal(h.rows.calls[0].resolved_model, 'served/model-v2');
  assert.equal(h.rows.calls[0].input_token_count, 12);
  assert.equal(h.rows.finished[0].row.input_token_count, 24);
  assert.equal(h.rows.finished[0].row.provider_latency_ms, 70);
  assert.equal(h.rows.finished[0].row.first_output_event_ms, 70);
  assert.equal(h.rows.finished[0].row.quota_tier, 'standard');
  assert.equal(h.rows.finished[0].row.status, 'success');
});

test('missing provider usage stays null and telemetry storage failures never fail chat', async () => {
  const h = harness({ store: { async start() { throw new Error('DB unavailable'); }, async finish() { throw new Error('DB unavailable'); }, async providerCalls() { throw new Error('DB unavailable'); } } });
  await h.telemetry.start();
  const client = { chat: { completions: { async create() { h.tick(); return { model: 'served/model', choices: [{ message: { content: 'ok' } }] }; } } } };
  await h.telemetry.providerClient(client, async () => {}).chat.completions.create({ model: 'openrouter/free', messages: [] });
  await assert.doesNotReject(h.telemetry.finish({ status: 'success' }));
});

test('provider failure remains visible unless the application explicitly uses a fallback', async () => {
  const failed = harness();
  await failed.telemetry.start();
  const provider = { chat: { completions: { async create() { throw Object.assign(new Error('provider error'), { status: 503 }); } } } };
  await assert.rejects(failed.telemetry.providerClient(provider, async () => {}).chat.completions.create({ model: 'fixture', messages: [] }));
  await failed.telemetry.finish({ status: 'success' });
  assert.equal(failed.rows.finished[0].row.status, 'provider_error');
  assert.equal(failed.rows.finished[0].row.error_code, 'provider_http_503');
  assert.equal(failed.rows.calls[0].status, 'provider_error');

  const fallback = harness();
  await fallback.telemetry.start();
  await assert.rejects(fallback.telemetry.providerClient(provider, async () => {}).chat.completions.create({ model: 'fixture', messages: [] }));
  fallback.telemetry.setFallback();
  fallback.telemetry.setAssistant('Verified deterministic fallback.');
  await fallback.telemetry.finish({ status: 'success' });
  assert.equal(fallback.rows.finished[0].row.status, 'success');
  assert.equal(fallback.rows.finished[0].row.fallback_used, true);
});

test('tool success and failure retain bounded outcome metadata', async () => {
  const h = harness();
  await h.telemetry.start();
  const result = await h.telemetry.recordTool('search_listings', async () => { h.tick(7); return { listings: [{ id: 'one' }, { id: 'two' }] }; }, value => value.listings.length);
  assert.equal(result.listings.length, 2);
  await h.telemetry.recordTool('search_listings', async () => ({ error: 'invalid arguments' }), undefined, value => !('error' in value));
  await assert.rejects(h.telemetry.recordTool('search_listings', async () => { h.tick(4); throw new Error('private query details'); }));
  await h.telemetry.finish({ status: 'tool_error' });
  assert.equal(h.rows.finished[0].row.tool_name, 'search_listings');
  assert.equal(h.rows.finished[0].row.tool_success, false);
  assert.equal(h.rows.finished[0].row.tool_result_count, null);
  assert.equal(h.rows.finished[0].row.tool_latency_ms, 4);
});

test('stream completion finalizes once and records first application output timing', async () => {
  const h = harness();
  await h.telemetry.start();
  const encoder = new TextEncoder();
  const response = new ReadableStream({ start(controller) {
    controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"hello"}}]}\n\n'));
    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
    controller.close();
  } });
  const reader = observeChatStream(response, h.telemetry).getReader();
  while (!(await reader.read()).done) {}
  await h.telemetry.finish({ status: 'success' });
  assert.equal(h.rows.finished.length, 1);
  assert.equal(h.rows.finished[0].row.status, 'success');
  assert.equal(h.rows.finished[0].row.first_output_event_ms, 0);
});

test('stream cancellation is recorded as aborted rather than success', async () => {
  const h = harness();
  await h.telemetry.start();
  const stream = new ReadableStream({ pull() {}, cancel() {} });
  const reader = observeChatStream(stream, h.telemetry).getReader();
  await reader.cancel();
  await h.telemetry.finish({ status: 'success' });
  assert.equal(h.rows.finished.length, 1);
  assert.equal(h.rows.finished[0].row.status, 'aborted');
  assert.equal(h.rows.finished[0].row.error_code, 'client_cancelled');
});

test('seller telemetry omits user and assistant conversation text', async () => {
  const h = harness();
  const telemetry = createChatTelemetry({ ...identity, messages: [{ role: 'user', content: 'private seller details' }],
    includeUserContent: false, store: { async start(row) { h.rows.started.push(row); }, async finish(id, row) { h.rows.finished.push({ id, row }); }, async providerCalls() {} } });
  await telemetry.start();
  telemetry.setAssistant('Private address and unit details');
  await telemetry.finish({ status: 'success' });
  assert.equal(h.rows.started[0].user_message_redacted, null);
  assert.equal(h.rows.finished[0].row.assistant_message_redacted, null);
});

test('migration denies direct telemetry access and scopes feedback and cleanup', async () => {
  const sql = await readFile(new URL('../BackEnd/supabase/migrations/20261026140000_chat_telemetry_privacy_feedback.sql', import.meta.url), 'utf8');
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /REVOKE ALL ON public\.chat_interactions, public\.chat_provider_calls, public\.chat_feedback FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /i\.user_id = v_user_id/);
  assert.match(sql, /ON CONFLICT \(interaction_id\) DO UPDATE/);
  assert.match(sql, /interval '30 days'/);
  assert.match(sql, /p_rating = 'positive' AND \(cardinality\(v_reasons\) > 0 OR p_comment IS NOT NULL\)/);
  assert.doesNotMatch(sql, /p_comment_redacted/);
  assert.match(sql, /WHERE content_expires_at <= now\(\)\s+AND \(user_id IS NOT NULL OR conversation_id IS NOT NULL/);
  assert.match(sql, /WHERE comment_expires_at <= now\(\) AND \(comment_redacted IS NOT NULL OR user_id IS NOT NULL\)/);
  assert.match(sql, /cleanup_chat_content\(\)/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.cleanup_chat_content\(\) TO service_role/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.submit_chat_feedback/);
  assert.doesNotMatch(sql, /GRANT SELECT[^;]*TO authenticated/i);
  const component = await readFile(new URL('../FrontEnd/src/components/Chatbot.tsx', import.meta.url), 'utf8');
  assert.match(component, /Some chat messages and feedback may be stored in redacted form/);
  assert.match(component, /submit_chat_feedback/);
  assert.match(component, /Helpful response/);
  assert.match(component, /Unhelpful response/);
  assert.match(component, /FEEDBACK_REASONS/);
  assert.match(component, /maxLength=\{1000\}/);
});

test('follow-up migration extends SQL feedback redaction without weakening the original RPC boundary', async () => {
  const sql = await readFile(new URL('../BackEnd/supabase/migrations/20261026150000_redact_singapore_phone_feedback.sql', import.meta.url), 'utf8');
  assert.ok(sql.includes('(^|[^[:alnum:]$])((?:\\+?65[ -]?)?[689][0-9]{3}[ -]?[0-9]{4})(?=$|[^[:alnum:]])'));
  assert.ok(sql.includes("'\\1[PHONE_REDACTED]'"));
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /SET search_path = pg_catalog, pg_temp/);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.submit_chat_feedback/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.submit_chat_feedback\(uuid, text, text\[\], text\) TO authenticated/);
});
