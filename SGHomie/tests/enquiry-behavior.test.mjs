import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import test from 'node:test';
import { componentHarness, content, deferred } from './helpers/frontend-component.mjs';

// Synthetic enquiries and account doubles; no email is sent and no database is used.
const user = { id: 'synthetic-buyer', email: 'buyer@example.invalid' };
const enquiry = {
  id: 'synthetic-enquiry', name: 'Test Buyer', email: user.email,
  phone: '+65 9000 0000', message: 'Synthetic viewing enquiry',
  status: 'RESPONDED', admin_response: 'Synthetic response', created_at: '2026-10-27T01:00:00Z',
};

function harness({
  history = { data: [], error: null },
  refreshedHistory = history,
  insertion = Promise.resolve({ error: null }),
} = {}) {
  const writes = [];
  const reads = [];
  const successes = [];
  const errors = [];
  const app = componentHarness(new URL('../FrontEnd/src/pages/Enquiry.tsx', import.meta.url), {
    'lucide-react': {},
    '../contexts/AuthContext': { useAuth: () => ({ user }) },
    'react-hot-toast': { default: { success: value => successes.push(value), error: value => errors.push(value) } },
    '../lib/supabase': { supabase: { from(table) {
      assert.equal(table, 'enquiries');
      const read = {};
      const query = {
        insert(rows) { writes.push(JSON.parse(JSON.stringify(rows))); return insertion; },
        select(columns) { read.columns = columns; return query; },
        eq(column, value) { read.filter = [column, value]; return query; },
        async order(column, options) {
          reads.push({ ...read, order: [column, options] });
          return reads.length === 1 ? history : refreshedHistory;
        },
      };
      return query;
    } } },
  });
  const input = (id, value) => app.find(node => node.props.id === id).props.onChange({ target: { value } });
  const value = id => app.find(node => node.props.id === id).props.value;
  const submit = () => app.find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  const fill = () => {
    input('name', enquiry.name);
    input('phone', enquiry.phone);
    input('message', enquiry.message);
  };
  return { ...app, writes, reads, successes, errors, input, value, submit, fill };
}

test('FE-ENQUIRY-01 history requests only the signed-in email and newest records first', async () => {
  const app = harness({ history: { data: [enquiry], error: null } });
  app.render();
  await app.effects();
  await setImmediate();
  assert.deepEqual(JSON.parse(JSON.stringify(app.reads)), [{ columns: '*', filter: ['email', user.email], order: ['created_at', { ascending: false }] }]);
  assert.match(content(app.render()), /Synthetic viewing enquiry/);
  assert.match(content(app.render()), /RESPONDED/);
  assert.match(content(app.render()), /Synthetic response/);
  assert.doesNotMatch(content(app.render()), /Loading enquiries/);
});

test('FE-ENQUIRY-02 empty history displays the empty state', async () => {
  const app = harness();
  app.render();
  await app.effects();
  await setImmediate();
  assert.match(content(app.render()), /No enquiries yet/);
});

test('FE-ENQUIRY-03 history failure is reported and loading finishes', async () => {
  const app = harness({ history: { data: null, error: new Error('synthetic database failure') } });
  app.render();
  await app.effects();
  await setImmediate();
  assert.deepEqual(app.errors, ['Failed to load enquiries']);
  assert.doesNotMatch(content(app.render()), /Loading enquiries/);
});

test('FE-ENQUIRY-04 submission uses account email, persists pending status, resets and refreshes', async () => {
  const app = harness();
  app.fill();
  // Even a direct handler event cannot change the trusted account email.
  app.input('email', 'different@example.invalid');
  assert.equal(app.find(node => node.props.id === 'email').props.readOnly, true);
  await app.submit();
  assert.deepEqual(app.writes, [{ name: enquiry.name, email: user.email, phone: enquiry.phone, message: enquiry.message, status: 'PENDING' }].map(row => [row]));
  assert.equal(app.value('name'), '');
  assert.equal(app.value('message'), '');
  assert.equal(app.value('email'), user.email);
  assert.equal(app.reads.length, 1);
  assert.deepEqual(app.errors, []);
  assert.equal(app.successes.length, 1);
});

test('FE-ENQUIRY-05 failed insertion preserves all input for retry and never announces success', async () => {
  const app = harness({ insertion: Promise.resolve({ error: new Error('synthetic denied insert') }) });
  app.fill();
  await app.submit();
  assert.equal(app.value('name'), enquiry.name);
  assert.equal(app.value('message'), enquiry.message);
  assert.equal(app.value('phone'), enquiry.phone);
  assert.deepEqual(app.successes, []);
  assert.deepEqual(app.errors, ['Failed to submit enquiry. Please try again.']);
  assert.equal(app.reads.length, 0);
  assert.equal(app.find(node => node.props.type === 'submit').props.disabled, false);
});

test('FE-ENQUIRY-06 submission disables its button while the write is pending', async () => {
  const pending = deferred();
  const app = harness({ insertion: pending.promise });
  app.fill();
  const submitted = app.submit();
  assert.equal(app.find(node => node.props.type === 'submit').props.disabled, true);
  assert.match(content(app.render()), /Sending/);
  pending.resolve({ error: null });
  await submitted;
  assert.equal(app.find(node => node.props.type === 'submit').props.disabled, false);
});

test('FE-ENQUIRY-07 refresh failure after a successful insert does not invite duplicate submission', async () => {
  const app = harness({
    refreshedHistory: { data: null, error: new Error('synthetic refresh failure') },
  });
  app.render();
  await app.effects();
  await setImmediate();
  app.fill();

  await app.submit();

  assert.equal(app.writes.length, 1);
  assert.equal(app.value('name'), '');
  assert.equal(app.value('message'), '');
  assert.deepEqual(app.successes, ['Enquiry submitted successfully! We will get back to you soon.']);
  assert.deepEqual(app.errors, ['Enquiry submitted, but history could not be refreshed.']);
  assert.equal(app.find(node => node.props.type === 'submit').props.disabled, false);
});
