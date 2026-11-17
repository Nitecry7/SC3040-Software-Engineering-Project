import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyCanaryText, runSyntheticChatbotCanary } from '../BackEnd/supabase/functions/chatbot/syntheticCanary.ts';

const TOKEN = 'SGHOMIE_CANARY_OK';
const CANARY_PROMPT = `Output only the following token. Do not add quotes, punctuation, formatting, reasoning or any other text.\n${TOKEN}`;
const reply =(content) => ({ choices: [{ message: { role: 'assistant', content } }] });
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
  assert.equal(params.messages[0].content, CANARY_PROMPT);
  assert.deepEqual({ temperature: params.temperature, max_tokens: params.max_tokens, stream: params.stream },
    { temperature: 0, max_tokens: 128, stream: false });
  assert.deepEqual(result, {
    status: 'success', failure_category: null, request_id: 'd4e6be0e-1849-4fc8-9425-04200fc76c21',
    provider: 'openrouter', model: 'openrouter/free', edge_reached: true, upstream_reached: true,
    response_valid: true, canary_valid: true, duration_ms: 5,
  });
  assert.doesNotMatch(JSON.stringify(result), /SGHOMIE_CANARY_OK|Output only the following token/);
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

const run = (completion, extra = {}) => runSyntheticChatbotCanary({ createProvider: () => configured(completion),
  reserveProviderCapacity: async () => {}, ...extra });

test('classifier returns one class per case', () => {
  assert.equal(classifyCanaryText(TOKEN), 'exact');
  assert.equal(classifyCanaryText('  SGHOMIE_CANARY_OK\n'), 'exact');
  assert.equal(classifyCanaryText('"SGHOMIE_CANARY_OK"'), 'wrapped');
  assert.equal(classifyCanaryText('SGHOMIE_CANARY_'), 'truncated');
  assert.equal(classifyCanaryText('Sure: SGHOMIE_CANARY_OK'), 'contains');
  assert.equal(classifyCanaryText('hello there'), 'unrelated');
  assert.equal(classifyCanaryText(''), 'empty');
  assert.equal(classifyCanaryText('   \n'), 'empty');
  assert.equal(classifyCanaryText(undefined), 'empty');
});

test('classifier accepts only cosmetic wrapping', () => {
  for (const text of [`"${TOKEN}"`, `'${TOKEN}'`, `\u201C${TOKEN}\u201D`, `\u2018${TOKEN}\u2019`, `\`${TOKEN}\``,
    `\`\`\`\n${TOKEN}\n\`\`\``, `**${TOKEN}**`, `__${TOKEN}__`, `_${TOKEN}_`, `${TOKEN}.`, `\n\n"${TOKEN}"\n`, `"${TOKEN}".`])
    assert.equal(classifyCanaryText(text), 'wrapped', text);
});

test('classifier rejects extra words, other case, repeats and altered tokens', () => {
  assert.equal(classifyCanaryText(`Sure: ${TOKEN}`), 'contains');
  assert.equal(classifyCanaryText(`${TOKEN} Hope that helps.`), 'contains');
  assert.equal(classifyCanaryText(`${TOKEN}! Thanks.`), 'contains');
  assert.equal(classifyCanaryText(`${TOKEN} ${TOKEN}`), 'contains');
  assert.equal(classifyCanaryText('sghomie_canary_ok'), 'unrelated');
  assert.equal(classifyCanaryText('SGHOMIE_CANARY_OX'), 'unrelated');
  assert.equal(classifyCanaryText('SGHOMIE CANARY OK'), 'unrelated');
});

test('classifier marks proper prefixes truncated and not the full token', () => {
  assert.equal(classifyCanaryText('SGHOMIE_CANARY_'), 'truncated');
  assert.equal(classifyCanaryText('SGHOMIE'), 'truncated');
  assert.notEqual(classifyCanaryText(TOKEN), 'truncated');
});

test('a wrapped reply passes and other classes fail with unchanged categories', async () => {
  const wrapped = await run(async () => reply(`\`${TOKEN}\`.`));
  assert.equal(wrapped.status, 'success');
  assert.equal(wrapped.canary_valid, true);
  assert.equal(wrapped.failure_category, null);
  for (const text of [`Sure: ${TOKEN}`, 'SGHOMIE_CANARY_', 'something else']) {
    const result = await run(async () => reply(text));
    assert.equal(result.status, 'failure');
    assert.equal(result.canary_valid, false);
    assert.equal(result.failure_category, 'CANARY_VALIDATION_FAILURE');
  }
  const empty = await run(async () => reply(''));
  assert.equal(empty.failure_category, 'INVALID_PROVIDER_RESPONSE');
});

test('diagnostics are bounded and reported through onDiagnostics only', async () => {
  const seen = [];
  const withReply = (content, extra = {}) => async () => ({ model: 'vendor/model-1:free',
    choices: [{ message: { role: 'assistant', content }, ...extra }] });
  const result = await run(withReply(TOKEN, { finish_reason: 'stop' }), { onDiagnostics: (d) => seen.push(d) });
  assert.deepEqual(seen[0], { validation: 'exact', finish_reason: 'stop', served_model: 'vendor/model-1:free', output_chars: 17 });
  assert.equal('diagnostics' in result, false);
  for (const [raw, mapped] of [['length', 'length'], ['content_filter', 'content_filter'], ['tool_calls', 'tool_calls'],
    ['weird_reason', 'other'], [undefined, null]]) {
    await run(withReply(TOKEN, { finish_reason: raw }), { onDiagnostics: (d) => seen.push(d) });
    assert.equal(seen.at(-1).finish_reason, mapped);
  }
  await run(async () => ({ model: 'bad model with spaces!', choices: [{ message: { content: 'x' } }] }), { onDiagnostics: (d) => seen.push(d) });
  assert.equal(seen.at(-1).served_model, null);
  await run(withReply('a'.repeat(50000)), { onDiagnostics: (d) => seen.push(d) });
  assert.equal(seen.at(-1).output_chars, 9999);
  assert.equal(seen.at(-1).validation, 'unrelated');
});

test('neither the result nor the diagnostics contain provider text', async () => {
  const seen = [];
  const long = `PRIVATE_MARKER_ZZZ ${'lorem ipsum '.repeat(200)}`;
  const result = await run(async () => reply(long), { onDiagnostics: (d) => seen.push(d) });
  const text = JSON.stringify([result, seen]);
  assert.doesNotMatch(text, /PRIVATE_MARKER_ZZZ|lorem/);
  assert.doesNotMatch(text, /Output only the following token/);
});
