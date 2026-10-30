import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createChatProvider, ChatProviderConfigError } from '../BackEnd/supabase/functions/_shared/chatProvider.ts';
import { createOpenAIClient, OpenAIError } from '../BackEnd/supabase/functions/_shared/openai.ts';
import { SEARCH_LISTINGS_TOOL } from '../BackEnd/supabase/functions/_shared/listings.ts';
import { prepareBuyConversation, generateListingReply, createBuyStream } from '../BackEnd/supabase/functions/chatbot/buy.ts';
import { consumeChatStream } from '../FrontEnd/src/lib/chat.ts';

const env = { OPENROUTER_API_KEY: 'router-key', SUPABASE_URL: 'https://database.example', SUPABASE_ANON_KEY: 'anon-key' };
globalThis.Deno = { env: { get: name => env[name] }, serve() {} };
const { handleRequest } = await import('../BackEnd/supabase/functions/chatbot/index.ts');
const completion = content => ({ id: 'completion-1', object: 'chat.completion', created: 0,
  model: 'gpt-6-luna', choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }] });
const params = { model: 'gpt-6-luna', messages: [{ role: 'system', content: 'Keep this prompt exactly.' },
  { role: 'user', content: 'Find a home' }], tools: [SEARCH_LISTINGS_TOOL],
  tool_choice: { type: 'function', function: { name: 'search_listings' } },
  provider: { require_parameters: true }, max_tokens: 700, temperature: 0.2, stream: false };
const request = body => new Request('https://functions.example/chatbot', { method: 'POST',
  headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('provider switch defaults to existing router, selects separate models and validates config', () => {
  const settings = { OPENROUTER_API_KEY: 'router', OPENAI_API_KEY: 'openai' };
  const select = () => createChatProvider(name => settings[name]);
  assert.equal(select().model, 'openrouter/free');
  assert.equal(select().provider, 'openrouter');
  settings.OPENROUTER_MODEL = 'router-model';
  assert.equal(select().model, 'router-model');
  settings.CHAT_PROVIDER = ' OpenAI ';
  delete settings.OPENROUTER_API_KEY;
  assert.equal(select().model, 'gpt-6-luna');
  settings.OPENAI_MODEL = 'gpt-4.1-mini';
  assert.equal(select().model, 'gpt-4.1-mini');
  settings.OPENAI_API_KEY = ' ';
  assert.throws(select, /OPENAI_API_KEY is not configured/);
  settings.CHAT_PROVIDER = 'another-provider';
  assert.throws(select, ChatProviderConfigError);
});

test('OpenAI preserves prompts, history and tools while adapting only provider parameters', async t => {
  let sent;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer openai-key');
    assert.equal(options.headers['HTTP-Referer'], undefined);
    assert.equal(options.headers['X-Title'], undefined);
    sent = JSON.parse(options.body);
    return Response.json(completion('Hello'));
  });
  const original = structuredClone(params);
  await createOpenAIClient({ apiKey: 'openai-key' }).chat.completions.create(params);
  assert.deepEqual(params, original);
  assert.deepEqual(sent.messages, params.messages);
  assert.deepEqual(sent.tools, params.tools);
  assert.deepEqual(sent.tool_choice, params.tool_choice);
  assert.equal(sent.provider, undefined);
  assert.equal(sent.max_tokens, undefined);
  assert.equal(sent.max_completion_tokens, 700);
  assert.equal(sent.reasoning_effort, 'none');
  assert.equal(sent.temperature, 0.2);
});

test('model overrides handle non-reasoning models and reject incompatible GPT-6 tool models', async t => {
  const sent = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    sent.push(JSON.parse(options.body));
    return Response.json(completion('OK'));
  });
  const client = createOpenAIClient({ apiKey: 'key' });
  await client.chat.completions.create({ ...params, model: 'gpt-4.1-mini' });
  assert.equal(sent[0].reasoning_effort, undefined);
  assert.equal(sent[0].temperature, 0.2);
  await client.chat.completions.create({ ...params, model: 'gpt-5.2' });
  assert.equal(sent[1].temperature, undefined);
  await assert.rejects(client.chat.completions.create({ ...params, model: 'gpt-6-astra' }),
    error => error instanceof OpenAIError && /Responses API/.test(error.message));
  assert.equal(sent.length, 2);
});

test('OpenAI failures retain status and are never retried against OpenRouter', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async url => {
    calls++;
    assert.equal(url, 'https://api.openai.com/v1/chat/completions');
    return Response.json({ error: { message: 'Quota exhausted', code: 'insufficient_quota' } }, { status: 429 });
  });
  await assert.rejects(createOpenAIClient({ apiKey: 'key' }).chat.completions.create(params),
    error => error instanceof OpenAIError && error.status === 429 && error.responseBody.error.code === 'insufficient_quota');
  assert.equal(calls, 1);
});

test('OpenAI streaming retains the frontend SSE contract', async t => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(JSON.parse(options.body).stream, true);
    return new Response('data: {"choices":[{"delta":{"content":"Hello bro"}}]}\n\ndata: [DONE]\n\n');
  });
  const stream = await createOpenAIClient({ apiKey: 'key' }).chat.completions.create({ ...params, stream: true });
  assert.equal(await consumeChatStream(new Response(createBuyStream(stream)), () => {}), 'Hello bro');
});

test('complex buying request executes OpenAI tools, trusted DB search and generated prose', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const sent = JSON.parse(options.body);
    assert.equal(sent.provider, undefined);
    calls++;
    if (calls === 1) {
      assert.deepEqual(sent.tools, [SEARCH_LISTINGS_TOOL]);
      const result = completion(null);
      result.choices[0].message.tool_calls = [{ id: 'call-1', type: 'function', function: {
        name: 'search_listings', arguments: JSON.stringify({ locations: ['SENGKANG'], max_price: 600000, keywords: ['renovated'] }),
      } }];
      result.choices[0].finish_reason = 'tool_calls';
      return Response.json(result);
    }
    assert.equal(sent.tools, undefined);
    assert.equal(JSON.parse(sent.messages[1].content).search_result.total_matches, 0);
    return Response.json(completion('No renovated homes in **Sengkang** match your budget yet. Would you like to adjust the budget?'));
  });
  const client = createOpenAIClient({ apiKey: 'key' });
  const history = [{ role: 'user', content: 'A renovated home in Sengkang under 600k' }];
  let filters;
  const conversation = await prepareBuyConversation({ client, model: 'gpt-6-luna', systemPrompt: 'Same system prompt',
    history, search: async query => { filters = query; return { filters: query, total_matches: 0, listings: [] }; } });
  assert.equal(filters.max_price, 600000);
  assert.deepEqual(filters.locations, ['SENGKANG']);
  const text = await generateListingReply({ client, model: 'gpt-6-luna', history, search: conversation.search });
  assert.match(text, /Sengkang/);
  assert.equal(calls, 2);
});

test('Edge Function sends identical system prompts and tools for both providers', async t => {
  const sent = [];
  const saved = { ...env };
  t.after(() => { for (const key of Object.keys(env)) delete env[key]; Object.assign(env, saved); });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    sent.push({ url, headers: options.headers, body: JSON.parse(options.body) });
    return Response.json(completion('How can I help?'));
  });
  const body = { message: 'Hello bro', stream: false };
  assert.equal((await handleRequest(request(body))).status, 200);
  env.CHAT_PROVIDER = 'openai';
  env.OPENAI_API_KEY = 'openai-key';
  delete env.OPENROUTER_API_KEY;
  const response = await handleRequest(request({ ...body, stream: true }));
  assert.equal(response.status, 200);
  assert.equal(await consumeChatStream(response, () => {}), 'How can I help?');
  assert.equal(sent[0].url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(sent[1].url, 'https://api.openai.com/v1/chat/completions');
  assert.deepEqual(sent[0].body.messages, sent[1].body.messages);
  assert.deepEqual(sent[0].body.tools, sent[1].body.tools);
  assert.equal(sent[1].body.model, 'gpt-6-luna');
});

test('Edge Function reports OpenAI-specific model configuration and safe rate-limit errors', async t => {
  const saved = { ...env };
  t.after(() => { for (const key of Object.keys(env)) delete env[key]; Object.assign(env, saved); });
  Object.assign(env, { CHAT_PROVIDER: 'openai', OPENAI_API_KEY: 'private-key' });
  for (const status of [404, 429]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ error: { message: 'Private upstream diagnostic' } }, { status }));
    const response = await handleRequest(request({ message: 'Hello' }));
    const body = await response.json();
    assert.equal(response.status, status === 429 ? 503 : 502);
    assert.equal(body.code, status === 429 ? 'provider_rate_limited' : 'provider_model_unavailable');
    if (status === 404) assert.match(body.error, /OPENAI_MODEL/);
    assert.doesNotMatch(JSON.stringify(body), /private-key|Private upstream diagnostic|OPENROUTER_MODEL/);
  }
});
