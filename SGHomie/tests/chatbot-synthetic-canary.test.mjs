import assert from 'node:assert/strict';
import test from 'node:test';
import { runSyntheticChatbotCanary } from '../BackEnd/supabase/functions/chatbot/syntheticCanary.ts';

const reply = (content) => ({ choices: [{ message: { role: 'assistant', content } }] });
const configured = (completion) => ({ provider: 'openrouter', model: 'openrouter/free', client: {
  chat: { completions: { create: completion } },
} });

test('chatbot synthetic check uses only a fixed prompt and reports safe pass metadata', async () => {
  let params;
  let reserved = 0;
  const result = await runSyntheticChatbotCanary({
    createProvider: () => configured(async (input) => { params = input; return reply('SGHOMIE_CANARY_OK'); }),
    reserveProviderCapacity: async () => { reserved += 1; },
    requestId: () => 'd4e6be0e-1849-4fc8-9425-04200fc76c21',
    now: (() => { let time = 10; return () => time += 5; })(),
  });
  assert.equal(reserved, 1);
  assert.equal(params.messages[0].content, 'Reply with exactly this text and nothing else: SGHOMIE_CANARY_OK');
  assert.deepEqual({ temperature: params.temperature, max_tokens: params.max_tokens, stream: params.stream },
    { temperature: 0, max_tokens: 16, stream: false });
  assert.deepEqual(result, {
    status: 'success', failure_category: null, request_id: 'd4e6be0e-1849-4fc8-9425-04200fc76c21',
    provider: 'openrouter', model: 'openrouter/free', edge_reached: true, upstream_reached: true,
    response_valid: true, canary_valid: true, duration_ms: 5,
  });
  assert.doesNotMatch(JSON.stringify(result), /SGHOMIE_CANARY_OK|Reply with exactly/);
});

test('chatbot synthetic check classifies bad output, capacity limits and uncertain provider failures safely', async () => {
  const wrong = await runSyntheticChatbotCanary({ createProvider: () => configured(async () => reply('private provider output')),
    reserveProviderCapacity: async () => {} });
  assert.equal(wrong.status, 'failure');
  assert.equal(wrong.failure_category, 'CANARY_VALIDATION_FAILURE');
  assert.doesNotMatch(JSON.stringify(wrong), /private provider output/);

  const empty = await runSyntheticChatbotCanary({ createProvider: () => configured(async () => reply('  ')),
    reserveProviderCapacity: async () => {} });
  assert.equal(empty.failure_category, 'INVALID_PROVIDER_RESPONSE');
  const capacity = await runSyntheticChatbotCanary({ createProvider: () => configured(async () => reply('unused')),
    reserveProviderCapacity: async () => { throw Object.assign(new Error('private capacity detail'), { name: 'ChatQuotaError' }); } });
  assert.equal(capacity.status, 'unknown');
  assert.equal(capacity.failure_category, 'GLOBAL_CAPACITY_LIMITED');
  const timeout = await runSyntheticChatbotCanary({ createProvider: () => configured(async () => {
    throw Object.assign(new Error('private timeout detail'), { name: 'AbortError' });
  }), reserveProviderCapacity: async () => {} });
  assert.equal(timeout.status, 'unknown');
  assert.equal(timeout.failure_category, 'PROVIDER_TIMEOUT');
  assert.doesNotMatch(JSON.stringify([capacity, timeout]), /private/);
});

test('chatbot synthetic check does not call the provider when configuration or global capacity is unavailable', async () => {
  let providerCalls = 0;
  const configuration = await runSyntheticChatbotCanary({ createProvider: () => { throw Object.assign(new Error('secret'), { name: 'ChatProviderConfigError' }); }, reserveProviderCapacity: async () => {} });
  assert.equal(configuration.failure_category, 'CONFIGURATION_FAILURE');
  const unavailable = await runSyntheticChatbotCanary({ createProvider: () => configured(async () => { providerCalls += 1; return reply('no'); }),
    reserveProviderCapacity: async () => { throw Object.assign(new Error('private database'), { name: 'ChatQuotaUnavailableError' }); } });
  assert.equal(unavailable.failure_category, 'GLOBAL_CAPACITY_UNAVAILABLE');
  assert.equal(providerCalls, 0);
});
