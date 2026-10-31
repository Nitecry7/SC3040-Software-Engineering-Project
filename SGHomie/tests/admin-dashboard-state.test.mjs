import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeAdminDashboardUrl,
  parseAdminDashboardUrl,
  selectAdminTab,
  selectMonitoringRange,
  selectMonitoringView,
} from '../FrontEnd/src/lib/adminDashboardState.ts';

test('Admin dashboard URL defaults to Users, Overview and 7d without a wrong-tab initialization', () => {
  assert.deepEqual(parseAdminDashboardUrl(new URLSearchParams()), {
    tab: 'users', view: 'overview', range: '7d',
  });
  assert.equal(normalizeAdminDashboardUrl(new URLSearchParams()), null);
});

test('Admin tab, monitoring view and range restore together after remount or reload', () => {
  assert.deepEqual(parseAdminDashboardUrl(new URLSearchParams('tab=monitoring&view=chatbot&range=24h')), {
    tab: 'monitoring', view: 'chatbot', range: '24h',
  });
});

test('invalid and duplicated URL values safely fall back and normalize without loops', () => {
  const params = new URLSearchParams('tab=MONITORING&view=unknown&range=2d&range=30d&keep=yes');
  assert.deepEqual(parseAdminDashboardUrl(params), { tab: 'users', view: 'overview', range: '7d' });
  const normalized = normalizeAdminDashboardUrl(params);
  assert.equal(normalized?.toString(), 'keep=yes');
  assert.equal(normalizeAdminDashboardUrl(normalized), null, 'canonical URL needs no further replacement');
});

test('main-tab and monitoring-view selection push history and preserve other navigation state', () => {
  let current = new URLSearchParams('tab=monitoring&view=chatbot&range=24h&keep=yes');
  const calls = [];
  const set = (update, options) => {
    calls.push(options);
    current = update(current);
  };
  selectAdminTab(set, 'enquiries');
  assert.equal(current.toString(), 'tab=enquiries&view=chatbot&range=24h&keep=yes');
  selectMonitoringView(set, 'valuation');
  assert.equal(current.toString(), 'tab=enquiries&view=valuation&range=24h&keep=yes');
  assert.deepEqual(calls, [undefined, undefined], 'React Router default navigation pushes history');
  selectAdminTab(set, 'monitoring');
  assert.equal(current.toString(), 'tab=monitoring&view=valuation&range=24h&keep=yes');
});

test('range selection replaces history and preserves the selected tab and monitoring view', () => {
  let current = new URLSearchParams('tab=monitoring&view=chatbot');
  let options;
  selectMonitoringRange((update, nextOptions) => {
    current = update(current);
    options = nextOptions;
  }, '30d');
  assert.equal(current.toString(), 'tab=monitoring&view=chatbot&range=30d');
  assert.deepEqual(options, { replace: true });
  selectMonitoringRange((update, nextOptions) => {
    current = update(current);
    options = nextOptions;
  }, '7d');
  assert.equal(current.toString(), 'tab=monitoring&view=chatbot');
  assert.deepEqual(options, { replace: true });
});
