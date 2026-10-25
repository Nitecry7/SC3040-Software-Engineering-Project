import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  ChatQuotaError, ChatQuotaUnavailableError, reserveProviderCapacity,
  reserveUserInteraction, withProviderCapacity,
} from '../BackEnd/supabase/functions/chatbot/quota.ts';
import { chatFailureText, formatSingaporeResetTimestamp } from '../FrontEnd/src/lib/chat.ts';

const snapshot = { tier: 'tester', minute_limit: 10, minute_remaining: 9, daily_limit: 25,
  daily_remaining: 24, daily_reset_at: '2026-10-27T16:00:00.000Z', cooldown_until: null };

test('user quota adapter returns only a validated current-user snapshot', async () => {
  let call;
  const client = { async rpc(name) { call = name; return { data: { allowed: true, quota: snapshot }, error: null }; } };
  assert.deepEqual(await reserveUserInteraction(client), snapshot);
  assert.equal(call, 'reserve_chat_user_interaction');
});

test('user quota denial retains stable code and retry metadata', async () => {
  const client = { async rpc() { return { data: { allowed: false, code: 'CHAT_USER_BURST_LIMIT',
    retry_after_seconds: 17, retry_at: '2026-10-26T10:00:17Z', quota: snapshot }, error: null }; } };
  await assert.rejects(reserveUserInteraction(client), error => error instanceof ChatQuotaError
    && error.code === 'CHAT_USER_BURST_LIMIT' && error.retryAfterSeconds === 17
    && error.quota.tier === 'tester');
});

test('simultaneous adapter calls pass through database decisions without client-side trust', async () => {
  let count = 0;
  const client = { async rpc() {
    count++;
    return count <= 2
      ? { data: { allowed: true, quota: { ...snapshot, minute_remaining: 2 - count } }, error: null }
      : { data: { allowed: false, code: 'CHAT_USER_BURST_LIMIT', retry_after_seconds: 20,
        retry_at: '2026-10-26T10:00:20Z', quota: { ...snapshot, minute_remaining: 0 } }, error: null };
  } };
  const results = await Promise.all(Array.from({ length: 8 }, () => reserveUserInteraction(client).then(() => true, () => false)));
  assert.equal(results.filter(Boolean).length, 2);
  assert.equal(count, 8);
});

test('quota storage errors fail closed with a safe unavailable error', async () => {
  await assert.rejects(reserveUserInteraction({ async rpc() { return { data: null, error: new Error('private SQL detail') }; } }),
    error => error instanceof ChatQuotaUnavailableError && !error.message.includes('private SQL detail'));
});

test('each outbound provider invocation reserves a global permit first', async () => {
  const order = [];
  const wrapped = withProviderCapacity({ chat: { completions: { async create(params) { order.push('provider'); return params; } } } },
    async () => { order.push('permit'); });
  await wrapped.chat.completions.create({ model: 'fixture', messages: [] });
  await wrapped.chat.completions.create({ model: 'fixture', messages: [] });
  assert.deepEqual(order, ['permit', 'provider', 'permit', 'provider']);
});

test('global denial carries current user metadata but never global counters', async () => {
  const quota = { ...snapshot, tier: 'privileged', daily_limit: null, daily_remaining: null };
  const client = { async rpc(name) {
    assert.equal(name, 'reserve_chat_provider_call');
    return { data: { allowed: false, code: 'CHAT_GLOBAL_CAPACITY', retry_after_seconds: 60,
      retry_at: '2026-10-26T10:01:00Z' }, error: null };
  } };
  await assert.rejects(reserveProviderCapacity(client, quota), error => error instanceof ChatQuotaError
    && error.code === 'CHAT_GLOBAL_CAPACITY' && error.quota.tier === 'privileged'
    && !('global_remaining' in error));
});

test('quota errors map to deterministic account-only messages', () => {
  assert.match(chatFailureText(429, 'CHAT_USER_BURST_LIMIT', { retry_after_seconds: 7 }), /wait 7 seconds/);
  assert.match(chatFailureText(429, 'CHAT_USER_DAILY_LIMIT', { quota: { daily_reset_at: '2026-10-26T16:00:00.000Z' } }),
    /Tuesday, 27 October 2026 at 12:00 AM Singapore time/);
  assert.match(chatFailureText(429, 'CHAT_USER_DAILY_LIMIT', { quota: { daily_reset_at: 'invalid' }, retry_at: '2026-10-26T16:00:00.000Z' }),
    /Tuesday, 27 October 2026 at 12:00 AM Singapore time/);
  assert.match(chatFailureText(429, 'CHAT_USER_DAILY_LIMIT', { quota: { daily_reset_at: 'invalid' }, retry_at: 'also-invalid' }),
    /Please try again later/);
  assert.match(chatFailureText(429, 'CHAT_COOLDOWN_ACTIVE', { retry_at: '2026-10-26T10:15:00Z' }), /temporarily paused for this account/);
  assert.match(chatFailureText(429, 'CHAT_GLOBAL_CAPACITY', {}), /rest of SG Homie remains available/);
});

test('Singapore reset formatter handles midnight and month/year boundaries from server timestamps', () => {
  assert.equal(formatSingaporeResetTimestamp('2026-10-26T15:59:00.000Z'), 'Monday, 26 October 2026 at 11:59 PM');
  assert.equal(formatSingaporeResetTimestamp('2026-10-26T16:00:00.000Z'), 'Tuesday, 27 October 2026 at 12:00 AM');
  assert.equal(formatSingaporeResetTimestamp('2026-12-31T16:00:00.000Z'), 'Friday, 1 January 2027 at 12:00 AM');
  assert.equal(formatSingaporeResetTimestamp('invalid'), undefined);
  assert.equal(formatSingaporeResetTimestamp(undefined), undefined);
});

test('privileged quota snapshots remove only the per-user daily cap', async () => {
  const privileged = { tier: 'privileged', minute_limit: 20, minute_remaining: 19,
    daily_limit: null, daily_remaining: null, daily_reset_at: snapshot.daily_reset_at, cooldown_until: null };
  const result = await reserveUserInteraction({ async rpc(name) {
    assert.equal(name, 'reserve_chat_user_interaction');
    return { data: { allowed: true, quota: privileged }, error: null };
  } });
  assert.equal(result.tier, 'privileged');
  assert.equal(result.minute_limit, 20);
  assert.equal(result.daily_limit, null);
  assert.equal(result.daily_remaining, null);
});

test('migration uses bounded state, transaction locks, Singapore dates and restricted RPC grants', async () => {
  const sql = await readFile(new URL('../BackEnd/supabase/migrations/20261026130000_chatbot_quotas_and_capacity.sql', import.meta.url), 'utf8');
  assert.match(sql, /chat_quota_assignments/);
  assert.match(sql, /tier text NOT NULL REFERENCES public\.chat_quota_tier_config/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /AT TIME ZONE 'Asia\/Singapore'/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.reserve_chat_user_interaction\(\) TO authenticated/);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.reserve_chat_provider_call\(\) TO service_role/);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.reserve_chat_provider_call\(\) FROM PUBLIC, anon, authenticated/);
  assert.match(sql, /'standard', 2, 5, 5, 600, 900/);
  assert.match(sql, /'tester', 10, 25, 5, 600, 900/);
  assert.match(sql, /'privileged', 20, NULL, 5, 600, 900/);
  assert.match(sql, /VALUES \(true, 18, 45\)/);
  assert.match(sql, /IF v_config\.daily_limit IS NOT NULL AND v_state\.daily_count >= v_config\.daily_limit/);
  assert.match(sql, /REVOKE ALL ON public\.chat_quota_tier_config, public\.chat_quota_assignments,[\s\S]*FROM PUBLIC, anon, authenticated, service_role/);
  assert.match(sql, /'Asia\/Singapore'/);
  assert.doesNotMatch(sql, /ALTER TABLE public\.user_profiles|is_admin|is_seller/i);
  assert.doesNotMatch(sql, /email/i);
});
