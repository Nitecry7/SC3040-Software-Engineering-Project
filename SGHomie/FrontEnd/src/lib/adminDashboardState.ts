export type AdminTab = 'users' | 'properties' | 'enquiries' | 'monitoring';
export type MonitoringView = 'overview' | 'services' | 'chatbot' | 'valuation' | 'security' | 'feedback';
export type AdminDashboardUrlState = {
  tab: AdminTab;
  view: MonitoringView;
  range: '1h' | '24h' | '7d' | '30d';
};

const adminTabs: AdminTab[] = ['users', 'properties', 'enquiries', 'monitoring'];
const monitoringViews: MonitoringView[] = ['overview', 'services', 'chatbot', 'valuation', 'security', 'feedback'];
const monitoringRanges: AdminDashboardUrlState['range'][] = ['1h', '24h', '7d', '30d'];

function readSingleValue(params: URLSearchParams, key: string): string | null {
  const values = params.getAll(key);
  return values.length === 1 ? values[0] : null;
}

export function parseAdminDashboardUrl(params: URLSearchParams): AdminDashboardUrlState {
  const tab = readSingleValue(params, 'tab');
  const view = readSingleValue(params, 'view');
  const range = readSingleValue(params, 'range');
  return {
    tab: adminTabs.includes(tab as AdminTab) ? tab as AdminTab : 'users',
    view: monitoringViews.includes(view as MonitoringView) ? view as MonitoringView : 'overview',
    range: monitoringRanges.includes(range as AdminDashboardUrlState['range'])
      ? range as AdminDashboardUrlState['range'] : '7d',
  };
}

export function normalizeAdminDashboardUrl(params: URLSearchParams): URLSearchParams | null {
  const normalized = new URLSearchParams(params);
  const rules: Array<[string, readonly string[]]> = [
    ['tab', adminTabs],
    ['view', monitoringViews],
    ['range', monitoringRanges],
  ];
  let changed = false;
  for (const [key, validValues] of rules) {
    const values = params.getAll(key);
    if (values.length > 1 || (values.length === 1 && !validValues.includes(values[0]))) {
      normalized.delete(key);
      changed = true;
    }
  }
  return changed ? normalized : null;
}

export function selectAdminTab(
  setSearchParams: (next: (current: URLSearchParams) => URLSearchParams) => void,
  tab: AdminTab,
): void {
  setSearchParams(current => {
    const next = new URLSearchParams(current);
    if (tab === 'users') next.delete('tab');
    else next.set('tab', tab);
    return next;
  });
}

export function selectMonitoringView(
  setSearchParams: (next: (current: URLSearchParams) => URLSearchParams) => void,
  view: MonitoringView,
): void {
  setSearchParams(current => {
    const next = new URLSearchParams(current);
    if (view === 'overview') next.delete('view');
    else next.set('view', view);
    return next;
  });
}

export function selectMonitoringRange(
  setSearchParams: (next: (current: URLSearchParams) => URLSearchParams, options: { replace: true }) => void,
  range: AdminDashboardUrlState['range'],
): void {
  setSearchParams(current => {
    const next = new URLSearchParams(current);
    if (range === '7d') next.delete('range');
    else next.set('range', range);
    return next;
  }, { replace: true });
}
