const USER_ID = '11111111-1111-4111-8111-111111111111';
const QUOTA = {
  tier: 'standard', minute_limit: 2, minute_remaining: 1, daily_limit: 5, daily_remaining: 4,
  daily_reset_at: '2026-10-29T16:00:00.000Z', cooldown_until: null,
};
const ADDRESS = {
  postalCode: '560123', blockNumber: '123', streetName: 'TEST AVENUE', displayAddress: '123 TEST AVENUE',
  town: 'ANG MO KIO', builtYear: 2000, latitude: 1.3, longitude: 103.8, verificationToken: 'synthetic-eval-token',
};

const environment = {
  SUPABASE_URL: 'https://database.eval.invalid',
  SUPABASE_ANON_KEY: 'synthetic-public-key',
  SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-key',
  CHAT_PROVIDER: 'openai',
  OPENAI_API_KEY: 'synthetic-provider-key',
  OPENAI_MODEL: 'gpt-6-luna',
};
let toolCallSequence = 0;

globalThis.Deno ??= { env: { get: name => environment[name] }, serve() {} };
const { handleRequest } = await import('../../BackEnd/supabase/functions/chatbot/index.ts');

function assistantMessage(script) {
  if (script.kind === 'tool') {
    return {
      role: 'assistant', content: null,
      tool_calls: [{
        id: `eval-tool-${++toolCallSequence}`,
        type: 'function',
        function: { name: script.name ?? 'search_listings', arguments: JSON.stringify(script.arguments ?? {}) },
      }],
    };
  }
  const content = script.kind === 'seller_details'
    ? JSON.stringify({ details: script.details })
    : script.kind === 'seller_price'
      ? JSON.stringify({ suggested_price: script.price })
      : script.content ?? '';
  return { role: 'assistant', content };
}

function profileFor(role) {
  return {
    is_admin: role === 'admin', is_seller: role === 'seller', name: null, phone: null,
    preferred_locations: null, preferred_property_type: null,
  };
}

function makeFixtureFetch(definition, step, calls) {
  const scripts = [...(step.provider ?? definition.provider ?? [])];
  const propertyRows = new Map();
  const privateRows = new Map();
  const profile = profileFor(step.role ?? definition.role ?? 'buyer');
  const listings = step.listings ?? definition.listings ?? [];

  return async (input, init = {}) => {
    const url = new URL(String(input));
    const method = (init.method ?? 'GET').toUpperCase();
    const headers = new Headers(init.headers ?? {});
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });

    if (url.pathname.endsWith('/auth/v1/user')) return Response.json({ id: USER_ID, is_anonymous: false });
    if (url.pathname.endsWith('/rest/v1/user_profiles')) return Response.json(profile);
    if (url.pathname.endsWith('/rest/v1/rpc/reserve_chat_user_interaction')) {
      return Response.json({ allowed: true, quota: QUOTA });
    }
    if (url.pathname.endsWith('/rest/v1/rpc/reserve_chat_provider_call')) return Response.json({ allowed: true });
    if (url.pathname.endsWith('/rest/v1/chat_interactions')) return new Response(null, { status: method === 'PATCH' ? 204 : 201 });
    if (url.pathname.endsWith('/rest/v1/chat_provider_calls')) return new Response(null, { status: 201 });

    if (url.pathname.endsWith('/functions/v1/lookup-hdb-location')) {
      return Response.json({ valid: true, address: ADDRESS });
    }

    if (url.hostname === 'api.openai.com' && url.pathname.endsWith('/v1/chat/completions')) {
      const script = scripts.shift();
      if (!script) throw new Error('Evaluation fixture omitted a provider response');
      const message = assistantMessage(script);
      return Response.json({
        id: 'synthetic-eval-completion', object: 'chat.completion', created: 1,
        model: 'gpt-6-luna-eval-served', choices: [{ index: 0, message, finish_reason: message.tool_calls ? 'tool_calls' : 'stop' }],
        usage: { prompt_tokens: 20, completion_tokens: 8, total_tokens: 28 },
      });
    }

    if (url.pathname.endsWith('/rest/v1/properties')) {
      if (url.searchParams.get('status') === 'eq.approved' && method === 'GET') {
        return Response.json(listings, { headers: { 'Content-Range': `0-${Math.max(0, listings.length - 1)}/${listings.length}` } });
      }
      if (method === 'GET') return Response.json([...propertyRows.values()]);
      if (method === 'POST') {
        if (step.fail_property_write) return Response.json({ message: 'synthetic write rejection' }, { status: 403 });
        const row = { ...body, id: body.id ?? 'synthetic-draft-id' };
        propertyRows.set(row.id, row);
        return Response.json(row, { status: 201, headers: { 'Content-Type': 'application/json' } });
      }
      if (method === 'PATCH') {
        const id = url.searchParams.get('id')?.replace(/^eq\./, '');
        const row = { ...(propertyRows.get(id) ?? {}), ...body, id };
        propertyRows.set(id, row);
        return Response.json(row);
      }
      if (method === 'DELETE') {
        propertyRows.delete(url.searchParams.get('id')?.replace(/^eq\./, ''));
        return new Response(null, { status: 204 });
      }
    }

    if (url.pathname.endsWith('/rest/v1/property_private_details')) {
      if (method === 'POST' && step.fail_private_write) return Response.json({ message: 'synthetic private write rejection' }, { status: 403 });
      if (method === 'POST') {
        privateRows.set(body.property_id, body);
        return new Response(null, { status: 201 });
      }
      if (method === 'GET') return Response.json([...privateRows.values()]);
    }

    throw new Error(`Unexpected evaluation fixture request ${method} ${url.pathname}`);
  };
}

function countWhere(calls, path, predicate = () => true) {
  return calls.filter(call => call.url.pathname.endsWith(path) && predicate(call)).length;
}

function queryFilterSnapshot(url) {
  const result = {};
  const and = url.searchParams.get('and') ?? '';
  const location = and.match(/(?:location|town)\.in\.\(([^)]*)\)/);
  if (location) result.locations = [...location[1].matchAll(/"([^"]+)"/g)].map(match => match[1]);
  for (const [field, expression] of [['min_price', 'gte'], ['max_price', 'lte'], ['min_bedrooms', 'gte'], ['min_bathrooms', 'gte'], ['min_area_sqft', 'gte']]) {
    const match = and.match(new RegExp(`${field === 'min_price' || field === 'max_price' ? 'price' : field === 'min_bedrooms' ? 'bedrooms' : field === 'min_bathrooms' ? 'bathrooms' : 'area_sqft'}\\.${expression}\\.(\\d+)`));
    if (match) result[field] = Number(match[1]);
  }
  const order = url.searchParams.get('order');
  if (order) result.sort_by = ({ 'price.asc': 'price_asc', 'price.desc': 'price_desc', 'area_sqft.desc': 'area_desc', 'created_at.desc': 'newest' })[order] ?? order;
  return result;
}

export async function executeDeterministicStep(definition, step = definition) {
  const calls = [];
  const originalFetch = globalThis.fetch;
  const requestData = step.request ?? definition.request ?? { message: 'Explain the buying process.' };
  const role = step.role ?? definition.role ?? 'buyer';
  const hasRegisteredUser = role !== 'anonymous';
  globalThis.fetch = makeFixtureFetch(definition, step, calls);
  try {
    const request = new Request('https://functions.eval.invalid/chatbot', {
      method: 'POST',
      headers: {
        ...(hasRegisteredUser ? { Authorization: 'Bearer synthetic-eval-user-session' } : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...requestData, stream: false, conversation_id: '55555555-5555-4555-8555-555555555555' }),
    });
    const response = await handleRequest(request);
    let payload;
    try { payload = await response.json(); } catch { payload = {}; }
    const providerCalls = calls.filter(call => call.url.hostname === 'api.openai.com' && call.url.pathname.endsWith('/v1/chat/completions'));
    const searchCalls = calls.filter(call => call.url.pathname.endsWith('/rest/v1/properties')
      && call.method === 'GET' && call.url.searchParams.get('limit') === '3');
    const propertyWrites = countWhere(calls, '/rest/v1/properties', call => ['POST', 'PATCH', 'DELETE'].includes(call.method));
    const privateWrites = countWhere(calls, '/rest/v1/property_private_details', call => ['POST', 'PATCH', 'DELETE'].includes(call.method));
    const recommendation = payload.recommendations;
    const responseText = typeof payload.response === 'string' ? payload.response : '';
    const toolMessages = providerCalls.flatMap(call => {
      const messages = call.body?.messages ?? [];
      return messages.filter(message => message.role === 'tool').map(message => message.content ?? '');
    });
    const systemPrompts = providerCalls.flatMap(call => call.body?.messages ?? [])
      .filter(message => message.role === 'system').map(message => message.content ?? '');
    return {
      status: response.status,
      response: responseText,
      recommendationFilters: recommendation?.filters ?? (searchCalls.length ? queryFilterSnapshot(searchCalls.at(-1).url) : undefined),
      listingIds: recommendation?.listings?.map(listing => listing.id) ?? [],
      providerCalls: providerCalls.length,
      providerToolNames: providerCalls.flatMap(call => (call.body?.tools ?? []).map(tool => tool.function?.name)),
      searchCalls: searchCalls.length,
      searchQueries: searchCalls.map(call => queryFilterSnapshot(call.url)),
      userQuotaReservations: countWhere(calls, '/rest/v1/rpc/reserve_chat_user_interaction'),
      providerQuotaReservations: countWhere(calls, '/rest/v1/rpc/reserve_chat_provider_call'),
      hdbLookups: countWhere(calls, '/functions/v1/lookup-hdb-location'),
      propertyWrites,
      propertyInserts: countWhere(calls, '/rest/v1/properties', call => call.method === 'POST'),
      propertyUpdates: countWhere(calls, '/rest/v1/properties', call => call.method === 'PATCH'),
      propertyDeletes: countWhere(calls, '/rest/v1/properties', call => call.method === 'DELETE'),
      privateWrites,
      toolMessages,
      providerMessages: providerCalls.flatMap(call => (call.body?.messages ?? []).map(message => message.content ?? '')),
      systemPrompts,
      sellerFlow: payload.seller_flow,
      savedDraft: /draft listing is \*\*saved\*\*/i.test(responseText),
      malformedRequest: Boolean(payload.error),
    };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

export async function executeCase(definition) {
  const steps = definition.steps ?? [definition];
  const observations = [];
  for (const step of steps) observations.push(await executeDeterministicStep(definition, step));
  return observations.length === 1 ? observations[0] : { steps: observations };
}

export const fixtureEnvironment = environment;
