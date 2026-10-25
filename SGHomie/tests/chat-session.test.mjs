import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createChatLifecycle, emptyChatSession } from '../FrontEnd/src/lib/chatSession.ts';
import { consumeChatStream } from '../FrontEnd/src/lib/chat.ts';

test('New Chat returns only empty temporary state and invalidates active requests', () => {
  const lifecycle = createChatLifecycle();
  const persistent = { session: 'signed-in', profile: { preferred_locations: ['BEDOK'] }, drafts: ['saved'], interests: ['liked'] };
  const before = structuredClone(persistent);
  const old = lifecycle.begin();
  assert.equal(lifecycle.begin(), undefined);
  assert.equal(lifecycle.isCurrent(old), true);
  assert.deepEqual(lifecycle.reset(), { messages: [], input: '', search: undefined, seller: undefined, loading: false, followStream: true });
  assert.equal(old.controller.signal.aborted, true);
  assert.equal(lifecycle.isCurrent(old), false);
  assert.deepEqual(persistent, before);
  assert.notEqual(emptyChatSession().messages, emptyChatSession().messages);
});

test('late text/cards/seller metadata/errors and finally cannot affect a fresh request', async () => {
  const lifecycle = createChatLifecycle();
  const old = lifecycle.begin();
  let release;
  const delayed = new Promise(resolve => { release = resolve; });
  const mutations = [];
  const completion = (async () => {
    await delayed;
    for (const mutation of ['text', 'cards', 'seller', 'draft', 'dashboard-refresh', 'error']) {
      if (lifecycle.isCurrent(old)) mutations.push(mutation);
    }
    if (lifecycle.finish(old)) mutations.push('loading-cleared');
  })();
  lifecycle.reset();
  const fresh = lifecycle.begin();
  release(); await completion;
  assert.deepEqual(mutations, []);
  assert.equal(lifecycle.isCurrent(fresh), true);
  assert.equal(lifecycle.begin(), undefined, 'old cleanup must not unlock fresh request');
  assert.equal(lifecycle.finish(fresh), true);
  assert.ok(lifecycle.begin());
});

test('account change/unmount invalidation is safe repeatedly and old cleanup is harmless', () => {
  const lifecycle = createChatLifecycle();
  const old = lifecycle.begin();
  lifecycle.reset(); lifecycle.reset();
  assert.equal(lifecycle.finish(old), false);
  assert.ok(lifecycle.begin());
});

test('reset cancels a pending SSE read without publishing old metadata', async () => {
  const lifecycle = createChatLifecycle();
  const active = lifecycle.begin();
  let cancelled = false;
  const response = new Response(new ReadableStream({ cancel() { cancelled = true; } }));
  const pending = consumeChatStream(response, () => assert.fail('late text'), () => assert.fail('late cards'),
    () => assert.fail('late seller'), active.controller.signal);
  lifecycle.reset();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(cancelled, true);
});
