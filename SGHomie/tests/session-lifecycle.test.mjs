import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACTIVITY_PERSIST_THROTTLE_MS,
  createIdleSession,
  SESSION_IDLE_TIMEOUT_MS,
  SESSION_WARNING_AT_MS,
  SESSION_WARNING_BEFORE_MS,
  sessionExpiryMinutesRemaining,
  verifySessionUser,
} from '../FrontEnd/src/lib/sessionLifecycle.ts';

function clockHarness({ start = 1_000, storedActivity = null, options = {} } = {}) {
  let now = start;
  let stored = storedActivity;
  let nextId = 0;
  const timers = new Map();
  const writes = [];
  const warnings = [];
  let expirations = 0;
  const schedule = (callback, delay) => {
    const id = ++nextId;
    timers.set(id, { callback, at: now + delay });
    return id;
  };
  const cancel = id => timers.delete(id);
  const controller = createIdleSession({
    now: () => now,
    readActivity: () => stored,
    writeActivity: timestamp => { stored = timestamp; writes.push(timestamp); },
    schedule,
    cancel,
    onWarning: (visible, expiresAt) => warnings.push({ visible, expiresAt, at: now }),
    onExpire: () => { expirations++; },
    ...options,
  });
  const runDue = () => {
    for (let count = 0; count < 100; count++) {
      const due = [...timers.entries()].filter(([, timer]) => timer.at <= now).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) return;
      timers.delete(due[0]);
      due[1].callback();
    }
    assert.fail('timer loop did not converge');
  };
  return {
    controller, timers, warnings, writes,
    get now() { return now; },
    get stored() { return stored; },
    get expirations() { return expirations; },
    setNow: value => { now = value; },
    advance: delta => { now += delta; runDue(); },
    wakeAfter: delta => { now += delta; runDue(); },
    runDue,
    syncStored: value => { stored = value; },
  };
}

test('warning stays hidden through 54:59 idle and opens at 55 minutes with five minutes left', () => {
  const harness = clockHarness();
  harness.controller.start();
  assert.equal(harness.stored, 1_000);
  harness.advance(5 * 60_000);
  assert.deepEqual(harness.warnings, []);
  harness.advance(25 * 60_000);
  assert.deepEqual(harness.warnings, []);
  harness.advance(SESSION_WARNING_AT_MS - 30 * 60_000 - 1);
  assert.deepEqual(harness.warnings, []);
  harness.advance(1);
  assert.deepEqual(harness.warnings, [{
    visible: true, expiresAt: 1_000 + SESSION_IDLE_TIMEOUT_MS,
    at: 1_000 + SESSION_WARNING_AT_MS,
  }]);
  assert.equal(sessionExpiryMinutesRemaining(harness.warnings[0].expiresAt, harness.now), 5);
});

test('countdown minutes derive from the authoritative expiry deadline', () => {
  const expiresAt = 1_000 + SESSION_IDLE_TIMEOUT_MS;
  assert.equal(sessionExpiryMinutesRemaining(expiresAt, 1_000 + SESSION_WARNING_AT_MS), 5);
  assert.equal(sessionExpiryMinutesRemaining(expiresAt, 1_000 + SESSION_WARNING_AT_MS + 60_000), 4);
  assert.equal(sessionExpiryMinutesRemaining(expiresAt, expiresAt - 1), 1);
  assert.equal(sessionExpiryMinutesRemaining(expiresAt, expiresAt), 1);
});

test('automatic sign-out happens at 60 minutes and delayed timers compare the deadline timestamp', () => {
  const onTime = clockHarness();
  onTime.controller.start();
  onTime.advance(SESSION_IDLE_TIMEOUT_MS - SESSION_WARNING_BEFORE_MS);
  onTime.advance(SESSION_WARNING_BEFORE_MS);
  assert.equal(onTime.expirations, 1);

  const slept = clockHarness();
  slept.controller.start();
  slept.setNow(1_000 + SESSION_IDLE_TIMEOUT_MS + 30_000);
  slept.runDue();
  assert.equal(slept.expirations, 1);
  assert.equal(slept.warnings.some(event => event.visible), false);
});

test('restored activity does not grant a fresh 60 minutes after page reload', () => {
  const harness = clockHarness({ start: 1_000 + 45 * 60_000, storedActivity: 1_000 });
  harness.controller.start();
  assert.equal(harness.controller.lastActivityAt, 1_000);
  assert.deepEqual(harness.warnings, []);
  harness.advance(10 * 60_000 - 1);
  assert.deepEqual(harness.warnings, []);
  harness.advance(1);
  assert.equal(harness.warnings.at(-1).visible, true);
  harness.advance(5 * 60_000);
  assert.equal(harness.expirations, 1);
});

test('Stay signed in verifies the active user and resets a full 60-minute period', async () => {
  const harness = clockHarness();
  harness.controller.start();
  harness.advance(SESSION_WARNING_AT_MS);
  assert.equal(harness.warnings.at(-1).visible, true);
  const verified = await verifySessionUser(async () => ({ data: { user: { id: 'buyer-1' } }, error: null }), 'buyer-1');
  assert.equal(verified, true);
  harness.controller.activity(harness.now);
  assert.equal(harness.warnings.at(-1).visible, false);
  harness.advance(SESSION_WARNING_AT_MS - 1);
  assert.equal(harness.warnings.at(-1).visible, false);
  harness.advance(1);
  assert.equal(harness.warnings.at(-1).visible, true);
  harness.advance(SESSION_WARNING_BEFORE_MS);
  assert.equal(harness.expirations, 1);
});

test('meaningful activity before expiry resets the warning and starts a full idle period', () => {
  const harness = clockHarness();
  harness.controller.start();
  harness.advance(SESSION_IDLE_TIMEOUT_MS - SESSION_WARNING_BEFORE_MS);
  harness.controller.activity(harness.now);
  assert.equal(harness.warnings.at(-1).visible, false);
  harness.advance(SESSION_IDLE_TIMEOUT_MS - SESSION_WARNING_BEFORE_MS - 1);
  assert.equal(harness.warnings.at(-1).visible, false);
  harness.advance(1);
  assert.equal(harness.warnings.at(-1).visible, true);
});

test('warning dismissal hides it without resetting the original deadline', () => {
  const harness = clockHarness();
  harness.controller.start();
  harness.advance(SESSION_IDLE_TIMEOUT_MS - SESSION_WARNING_BEFORE_MS);
  harness.controller.dismissWarning();
  assert.equal(harness.warnings.at(-1).visible, false);
  harness.advance(SESSION_WARNING_BEFORE_MS - 1);
  assert.equal(harness.expirations, 0);
  assert.equal(harness.warnings.filter(event => event.visible).length, 1);
  harness.advance(1);
  assert.equal(harness.expirations, 1);
});

test('external recent activity from another tab moves the effective deadline', () => {
  const harness = clockHarness();
  harness.controller.start();
  harness.advance(SESSION_IDLE_TIMEOUT_MS - 1_000);
  const otherTabActivity = harness.now;
  harness.syncStored(otherTabActivity);
  harness.controller.syncActivity(otherTabActivity);
  harness.advance(1_000);
  assert.equal(harness.expirations, 0);
  harness.advance(SESSION_IDLE_TIMEOUT_MS - 1_001);
  assert.equal(harness.expirations, 0);
  harness.advance(1_000);
  assert.equal(harness.expirations, 1);
});

test('activity persistence is throttled while in-memory activity remains current', () => {
  const harness = clockHarness();
  harness.controller.start();
  harness.setNow(1_000 + ACTIVITY_PERSIST_THROTTLE_MS + 5);
  harness.controller.activity(harness.now);
  const writeCount = harness.writes.length;
  harness.setNow(1_000 + ACTIVITY_PERSIST_THROTTLE_MS + 10);
  harness.controller.activity(harness.now);
  assert.equal(harness.controller.lastActivityAt, harness.now);
  assert.equal(harness.writes.length, writeCount);
});

test('anonymous or unresolved sessions have no lifecycle until the controller starts', () => {
  const harness = clockHarness();
  assert.equal(harness.timers.size, 0);
  assert.deepEqual(harness.warnings, []);
  assert.equal(harness.expirations, 0);
});

test('Stay signed in verification accepts only the active user and fails closed', async () => {
  assert.equal(await verifySessionUser(async () => ({ data: { user: { id: 'buyer-1' } }, error: null }), 'buyer-1'), true);
  assert.equal(await verifySessionUser(async () => ({ data: { user: { id: 'buyer-2' } }, error: null }), 'buyer-1'), false);
  assert.equal(await verifySessionUser(async () => ({ data: { user: null }, error: new Error('expired') }), 'buyer-1'), false);
  assert.equal(await verifySessionUser(async () => { throw new Error('offline'); }, 'buyer-1'), false);
});

