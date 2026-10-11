import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptySellerDetails, parseSellerContext, parseSellerDetails } from '../BackEnd/supabase/functions/_shared/sellerFlow.ts';
import { collectSellerDetails, priceDecision, suggestSellerPrice, newSellerContext, sellerDetailsPrompt } from '../BackEnd/supabase/functions/chatbot/sell.ts';
import { consumeChatStream } from '../FrontEnd/src/lib/chat.ts';

globalThis.Deno = { env: { get: name => ({ OPENROUTER_API_KEY: 'fixture-key', OPENROUTER_MODEL: 'fixture-model',
  SUPABASE_URL: 'https://database.example', SUPABASE_ANON_KEY: 'fixture-anon' })[name] }, serve() {} };
const { handleRequest } = await import('../BackEnd/supabase/functions/chatbot/index.ts');
const userId = '11111111-1111-4111-8111-111111111111';
const address = { postalCode: '560123', blockNumber: '123', streetName: 'TEST AVENUE', displayAddress: '123 TEST AVENUE',
  town: 'ANG MO KIO', builtYear: 2000, latitude: 1.3, longitude: 103.8, verificationToken: 'fixture-token' };
const details = { unit_number: '#08-123', bedrooms: 3, bathrooms: 2, area_sqft: 1076, description: 'Renovated 4-room flat',
  seller_name: 'Fixture Seller', seller_phone: '+6591234567' };
const completion = content => ({ id: 'fixture-completion', model: 'fixture-model', choices: [{ index: 0, message: { role: 'assistant', content: typeof content === 'string' ? content : JSON.stringify(content) }, finish_reason: 'stop' }] });
const request = body => new Request('https://functions.example/chatbot', { method: 'POST', headers: {
  Authorization: 'Bearer fixture-session', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

function service(t, { extracted = details, estimate = 600000, failPrivate = false, failInsert = false, failEstimate = false, profile = { name: null, phone: null } } = {}) {
  const rows = new Map(); const privateRows = new Map(); const calls = [];
  t.mock.method(globalThis, 'fetch', async (input, init = {}) => {
    const url = new URL(String(input)); const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method, body });
    if (url.pathname.endsWith('/auth/v1/user')) return Response.json({ id: userId });
    if (url.pathname.endsWith('/user_profiles')) return Response.json([{ is_seller: true, is_admin: false, ...profile }]);
    if (url.pathname.endsWith('/lookup-hdb-location')) return Response.json({ valid: true, address });
    if (url.hostname === 'openrouter.ai') {
      if (body.tools?.some(tool => tool.function.name === 'search_listings')) return Response.json(completion('Happy to help with buying. Are you planning to move soon?'));
      if (body.messages[0].content.startsWith('Extract seller')) return Response.json(completion({ details: extracted }));
      if (failEstimate) return Response.json({ error: { message: 'Unavailable' } }, { status: 503 });
      return Response.json(completion({ suggested_price: estimate }));
    }
    if (url.pathname.endsWith('/properties')) {
      if (method === 'POST') {
        if (failInsert) return Response.json({ message: 'Insert rejected' }, { status: 403 });
        assert.equal(body.seller_id, userId); assert.equal(body.user_id, userId);
        assert.equal(body.status, 'draft'); assert.equal(body.unit_number, undefined);
        rows.set(body.id, body); return Response.json(body, { status: 201 });
      }
      if (method === 'PATCH') {
        const id = url.searchParams.get('id').slice(3);
        assert.equal(url.searchParams.get('seller_id'), `eq.${userId}`);
        const row = { ...rows.get(id), ...body }; rows.set(id, row); return Response.json(row);
      }
      if (method === 'DELETE') { rows.delete(url.searchParams.get('id').slice(3)); return new Response(null, { status: 204 }); }
      if (url.searchParams.get('status') === 'eq.approved') return Response.json([{ price: 620000, bedrooms: 3, area_sqft: 1050 }]);
      return Response.json([...rows.values()]);
    }
    if (url.pathname.endsWith('/property_private_details')) {
      if (method === 'POST') {
        if (failPrivate) return Response.json({ message: 'Private write rejected' }, { status: 403 });
        privateRows.set(body.property_id, body); return new Response(null, { status: 201 });
      }
      return Response.json([...privateRows.values()]);
    }
    assert.fail(`Unexpected service call: ${url}`);
  });
  return { rows, privateRows, calls };
}

async function turn(message, context, extra = {}) {
  const response = await handleRequest(request({ message, stream: true, ...(context ? { seller_context: context } : {}), ...extra }));
  if (response.status !== 200) return { response, error: await response.json() };
  let event;
  const text = await consumeChatStream(response, () => {}, () => assert.fail('sell produced buy recommendations'), value => { event = value; });
  return { response, text, event };
}

async function intake() {
  const first = await turn('I want to sell', undefined, { intent: 'sell' });
  assert.equal(first.event.context.stage, 'postal');
  const verified = await turn('560123', first.event.context);
  assert.equal(verified.event.context.stage, 'details');
  const priced = await turn('#08-123, 3 bedrooms, 2 toilets, 100 sqm, renovated 4-room. Fixture Seller, 91234567.', verified.event.context);
  return priced;
}

test('complete sell flow persists confirmed details and private unit before emitting a draft card', async t => {
  const db = service(t);
  const priced = await intake();
  assert.equal(db.rows.size, 0, 'suggesting a price must not save');
  assert.equal(priced.event.context.stage, 'price');
  assert.equal(priced.event.context.suggested_price, 600000);
  assert.match(priced.text, /provisional AI/);
  assert.match(priced.text, /not completed sale prices/);
  const saved = await turn('okay', priced.event.context);
  assert.equal(saved.event.context.stage, 'complete');
  assert.equal(saved.event.draft.price, 600000);
  const row = db.rows.get(saved.event.draft.id);
  assert.equal(row.title, '3-bedroom HDB in ANG MO KIO');
  assert.equal(row.area_sqft, 1076);
  assert.equal(row.bedrooms, 3); assert.equal(row.bathrooms, 2);
  assert.equal(row.description, details.description);
  assert.equal(row.seller_phone, '+6591234567');
  assert.equal(db.privateRows.get(row.id).unit_number, '#08-123');
  assert.deepEqual(saved.event.draft.missing_fields, ['property pictures (at least a main photo)']);
  // Simulate a fresh dashboard query after the chat's memory has gone away.
  const reload = await fetch(`https://database.example/rest/v1/properties?seller_id=eq.${userId}`);
  assert.equal((await reload.json())[0].id, saved.event.draft.id);
  // Retrying the same confirmed turn updates the same row rather than duplicating it.
  const retry = await turn('okay', priced.event.context);
  assert.equal(retry.event.draft.id, row.id); assert.equal(db.rows.size, 1);
});

test('unknown details and no price create a partial draft without inventing a private unit', async t => {
  const db = service(t, { extracted: emptySellerDetails() });
  const priced = await intake();
  assert.equal(priced.event.context.suggested_price, null);
  assert.match(priced.text, /unable to gauge/);
  const saved = await turn('no price in mind', priced.event.context);
  const row = db.rows.get(saved.event.draft.id);
  assert.equal(row.price, 0); assert.equal(row.bedrooms, 0); assert.equal(row.area_sqft, 0);
  assert.equal(saved.event.draft.price, null);
  assert.equal(db.privateRows.size, 0);
  for (const field of ['unit number', 'bedroom count', 'bathroom count', 'floor area', 'description', 'contact name', 'valid contact phone number', 'asking price']) {
    assert.ok(saved.event.draft.missing_fields.includes(field));
  }
  assert.equal(db.calls.filter(call => call.url.hostname === 'openrouter.ai').length, 1, 'sparse details must not request a price');
});

test('user can choose an independent price and pricing-provider failures allow skipping', async t => {
  const db = service(t, { failEstimate: true });
  const priced = await intake();
  assert.equal(priced.event.context.suggested_price, null);
  const saved = await turn('S$725,000', priced.event.context);
  assert.equal(saved.event.draft.price, 725000);
  assert.equal(db.rows.size, 1);
});

test('failed property/private writes never return success or a draft card', async t => {
  for (const failure of ['failInsert', 'failPrivate']) {
    await t.test(failure, async sub => {
      const db = service(sub, { [failure]: true });
      const priced = await intake();
      const result = await turn('okay', priced.event.context);
      assert.equal(result.response.status, 500);
      assert.equal(result.event, undefined);
      assert.equal(db.rows.size, 0);
      assert.doesNotMatch(JSON.stringify(result.error), /saved|fixture-token|Private write/);
    });
  }
});

test('a seller context cannot bypass auth or validation, and Buy escapes an active seller intake', async t => {
  const db = service(t);
  const priced = await intake();
  const invalid = await turn('okay', { ...priced.event.context, postal_code: 'bogus' });
  assert.equal(invalid.response.status, 400); assert.equal(db.rows.size, 0);
  const anonymous = await handleRequest(new Request('https://functions.example/chatbot', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'okay', seller_context: priced.event.context }) }));
  assert.match((await anonymous.json()).response, /log in/);
  const buy = await handleRequest(request({ message: 'I want to buy a house', seller_context: priced.event.context, intent: 'buy' }));
  assert.equal(buy.status, 200);
  const buyerReply = await buy.json();
  assert.equal(buyerReply.response, 'Happy to help with buying. Are you planning to move soon?');
  assert.equal(buyerReply.seller_flow.context, null);
  assert.equal(buyerReply.recommendations, undefined);
  assert.equal(db.rows.size, 0);
  const cancelled = await turn('cancel', priced.event.context);
  assert.equal(cancelled.event.context, null);
});

test('price decisions distinguish acceptance, own prices, unknowns and ambiguous messages', () => {
  assert.deepEqual(priceDecision('okay', 600000), { decided: true, price: 600000 });
  assert.deepEqual(priceDecision('okay', null), { decided: false, price: null });
  assert.deepEqual(priceDecision('use 650k', 600000), { decided: true, price: 650000 });
  assert.deepEqual(priceDecision('750000', null), { decided: true, price: 750000 });
  assert.deepEqual(priceDecision("don't know", 600000), { decided: true, price: null });
  assert.deepEqual(priceDecision('no', null), { decided: true, price: null });
  assert.deepEqual(priceDecision('no', 600000), { decided: false, price: null });
  for (const message of ['oh sure', 'Oh, sure!', 'yeah sure', 'sure, go ahead', 'sounds good to me', 'yes please', 'oh okay lah', 'that works for me', "let's do that"]) {
    assert.deepEqual(priceDecision(message, 600000), { decided: true, price: 600000 }, message);
    assert.deepEqual(priceDecision(message, null), { decided: false, price: null }, message);
  }
  assert.deepEqual(priceDecision('oh sure, but use 650k', 600000), { decided: true, price: 650000 });
  assert.deepEqual(priceDecision("don't use 600k, use 650k", 600000), { decided: true, price: 650000 });
  for (const message of ['not okay', 'oh sure, but I’m not ready', 'oh sure?', 'no thanks', "don't use 600k", 'can we use 650k?', 'use 650k if that works', '#08-123', '3 bedrooms', 'I want 3 bedrooms and 2 toilets', 'use 100 sqm', '91234567', '0', '-500', 'use 100 million']) {
    assert.equal(priceDecision(message, 600000).decided, false, message);
  }
});

test('profile contact details remove redundant questions and survive extraction and natural price acceptance', async t => {
  const db = service(t, { profile: { name: 'Profile Seller', phone: '9123 4567' }, extracted: { ...details, seller_name: null, seller_phone: null } });
  const first = await turn('I want to sell', undefined, { intent: 'sell' });
  const verified = await turn('560123', first.event.context);
  assert.match(verified.text, /contact name and phone number from your profile/);
  assert.doesNotMatch(verified.text, /^- \*\*Contact/m);
  const priced = await turn('#08-123, 3 bedrooms, 2 bathrooms, 100 sqm, renovated.', verified.event.context);
  assert.equal(priced.event.context.details.seller_name, 'Profile Seller');
  assert.equal(priced.event.context.details.seller_phone, '+6591234567');
  assert.doesNotMatch(priced.text, /Say “okay”/);
  const saved = await turn('oh sure', priced.event.context);
  assert.equal(saved.event.draft.price, 600000);
  const row = db.rows.get(saved.event.draft.id);
  assert.equal(row.seller_name, 'Profile Seller');
  assert.equal(row.seller_phone, '+6591234567');
  assert.ok(!saved.event.draft.missing_fields.includes('contact name'));
  assert.ok(!saved.event.draft.missing_fields.includes('valid contact phone number'));
});

test('intake asks only for missing or invalid profile contacts', () => {
  const nameOnly = sellerDetailsPrompt(parseSellerDetails({ seller_name: 'Profile Seller' }));
  assert.match(nameOnly, /^- \*\*Contact phone number/m);
  assert.doesNotMatch(nameOnly, /^- \*\*Contact name/m);
  const phoneOnly = sellerDetailsPrompt(parseSellerDetails({ seller_phone: '+6591234567' }));
  assert.match(phoneOnly, /^- \*\*Contact name/m);
  assert.doesNotMatch(phoneOnly, /^- \*\*Contact phone number/m);
  const missing = sellerDetailsPrompt(parseSellerDetails({ seller_phone: 'bad' }));
  assert.match(missing, /^- \*\*Contact name/m);
  assert.match(missing, /^- \*\*Contact phone number/m);
  assert.doesNotMatch(missing, /from your profile/);
});

test('extraction sends only untrusted seller facts and validates unknown/invalid fields', async () => {
  const client = { chat: { completions: { create: async params => {
    assert.match(params.messages[0].content, /Never invent/);
    assert.match(params.messages[0].content, /4-room flat does NOT imply four bedrooms/);
    assert.deepEqual(JSON.parse(params.messages[1].content).previous_details, emptySellerDetails());
    return completion({ details: { ...details, bedrooms: 'unknown', bathrooms: -1, unit_number: 'not a unit', seller_phone: '123' } });
  } } } };
  const extracted = await collectSellerDetails(client, 'fixture', emptySellerDetails(), '4-room flat, don’t know bedrooms');
  assert.equal(extracted.bedrooms, null); assert.equal(extracted.bathrooms, null);
  assert.equal(extracted.unit_number, null); assert.equal(extracted.seller_phone, null);
  assert.equal(parseSellerDetails({ unit_number: '08-123', seller_phone: '9123 4567' }).unit_number, '#08-123');
  assert.doesNotMatch(parseSellerDetails({ description: 'Renovated unit #08-123' }).description, /08-123/);
  assert.throws(() => parseSellerContext({ ...newSellerContext(), draft_id: 'not-an-id' }));
});

test('estimate rejects sparse details, invented extreme values and provider failures', async () => {
  const context = { ...newSellerContext(), stage: 'price', postal_code: '560123', details };
  for (const estimate of [null, -1, 50, 90000000, '600000']) {
    const client = { chat: { completions: { create: async () => completion({ suggested_price: estimate }) } } };
    assert.equal(await suggestSellerPrice(client, 'fixture', context, address, []), null);
  }
  const unavailable = { chat: { completions: { create: async () => { throw new Error('outage'); } } } };
  assert.equal(await suggestSellerPrice(unavailable, 'fixture', context, address, []), null);
  const never = { chat: { completions: { create: async () => assert.fail('sparse details invoked estimate') } } };
  assert.equal(await suggestSellerPrice(never, 'fixture', { ...context, details: emptySellerDetails() }, address, []), null);
});
