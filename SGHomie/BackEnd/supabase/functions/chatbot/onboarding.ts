type CatalogSummary = { properties: number; towns: string[] };

export const REGISTRATION_MESSAGE = 'The full SG Homie AI consultant is available to registered users. Please sign up or log in for free using **Sign In** to ask questions about budgets, towns, HDB types and listings.';
export const SELL_ONBOARDING = `**Welcome to SG Homie 👋**

Looking to sell your HDB? SG Homie guides registered sellers through preparing a draft property listing.

Once signed in and registered as a seller, the assistant can help you:

- Verify your HDB address and collect property details.
- Prepare a draft owned by you after the required steps succeed.
- Get provisional AI asking-price guidance where available. This is not a CatBoost valuation or an official valuation.

Unit numbers remain private. You control the final listing details and asking price.

**To get started:**

1. Sign up or log in for free using **Sign In**.
2. Register on the [seller sign-up page](/seller/signup).
3. Return to the chatbot and choose **Sell** again to access the authenticated seller assistant.`;

export function onboardingAction(latest: string, intent?: 'buy' | 'sell'): 'buy' | 'sell' | undefined {
  if (intent) return intent;
  const text = latest.trim().toLowerCase().replace(/[.!?]+$/, '').trim();
  if (['buy', 'i want to buy a house'].includes(text)) return 'buy';
  if (['sell', 'i want to sell', 'i want to sell my unit'].includes(text)) return 'sell';
}

// A separate public read, never the buyer tool or the caller's authenticated client.
// Partial catalog scans must not be presented as complete town counts.
export async function loadOnboardingSummary(
  supabaseUrl: string, anonKey: string, signal: AbortSignal = AbortSignal.timeout(5000),
): Promise<CatalogSummary> {
  const towns = new Set<string>();
  const ids = new Set<string>();
  let total: number | undefined;
  for (let page = 0; page < 10; page++) {
    const offset = ids.size;
    const url = new URL('/rest/v1/properties', supabaseUrl);
    url.search = new URLSearchParams({ select: 'id,town,location', status: 'eq.approved', type: 'eq.HDB',
      order: 'id.asc', offset: String(offset), limit: '500' }).toString();
    const response = await fetch(url, { signal, headers: {
      apikey: anonKey, Authorization: `Bearer ${anonKey}`, Prefer: 'count=exact',
    } });
    if (!response.ok) throw new Error('Catalog unavailable');
    const range = response.headers.get('content-range');
    const match = range?.match(/^(?:(\d+)-(\d+)|\*)\/(\d+)$/);
    if (!match) throw new Error('Missing catalog count');
    const count = Number(match[3]);
    if (!Number.isSafeInteger(count) || count > 5000 || (total !== undefined && count !== total)) throw new Error('Incomplete catalog');
    total = count;
    const rows: unknown = await response.json();
    if (!Array.isArray(rows) || rows.length > 500 || ids.size + rows.length > total) throw new Error('Invalid catalog page');
    if (rows.length && (Number(match[1]) !== offset || Number(match[2]) !== offset + rows.length - 1)) throw new Error('Incomplete catalog range');
    for (const row of rows) {
      if (!row || typeof row.id !== 'string' || !row.id || ids.has(row.id)
        || (row.town !== null && typeof row.town !== 'string')
        || typeof row.location !== 'string') throw new Error('Invalid catalog row');
      ids.add(row.id);
      const town = (row.town?.trim() || row.location.trim()).toUpperCase();
      if (town && town !== 'PENDING') towns.add(town);
    }
    if (ids.size === total) return { properties: total, towns: [...towns].sort() };
    if (!rows.length) throw new Error('Incomplete catalog');
  }
  throw new Error('Catalog scan limit reached');
}

function escapeMarkdown(text: string): string {
  return text.replace(/[\\`*_{}[\]()<>#+.!|~\-]/g, '\\$&').replace(/[\r\n\u0000-\u001f\u007f]/g, ' ');
}

export async function buyOnboarding(getEnv: (name: string) => string | undefined): Promise<string> {
  let summary = 'The listing summary is temporarily unavailable. You can still explore your housing options after signing in.';
  try {
    const url = getEnv('SUPABASE_URL');
    const key = getEnv('SUPABASE_ANON_KEY');
    if (!url || !key) throw new Error('Catalog not configured');
    const catalog = await loadOnboardingSummary(url, key);
    summary = catalog.properties === 0 ? 'There are currently no approved HDB listings.'
      : `We currently have ${catalog.properties} approved HDB listings across ${catalog.towns.length} towns.`
        + (catalog.towns.length ? `\nAvailable areas include ${catalog.towns.slice(0, 8).map(escapeMarkdown).join(', ')}${catalog.towns.length > 8 ? ', and others' : ''}.` : ' Town information is not available.');
  } catch {
    // No provider fallback, including when the catalog is too large to scan safely.
  }
  return `**Welcome to SG Homie 👋**\n\nSG Homie helps you explore Singapore HDB listings and make sense of your housing options with AI-assisted housing guidance.\n\n${summary}\n\nThese are application asking listings and may include demo records; they are not verified completed transactions.\n\nSign up or log in for free using **Sign In**, then browse available properties in [Explore](/search). Explore currently requires login.\n\nTo ask our AI consultant questions and refine homes around your budget and preferences, sign up or log in for the full chat experience.`;
}
