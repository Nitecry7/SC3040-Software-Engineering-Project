export const TOWNS = [
  'ANG MO KIO', 'BEDOK', 'BISHAN', 'BUKIT BATOK', 'BUKIT MERAH',
  'BUKIT PANJANG', 'BUKIT TIMAH', 'CENTRAL AREA', 'CHOA CHU KANG',
  'CLEMENTI', 'GEYLANG', 'HOUGANG', 'JURONG EAST', 'JURONG WEST',
  'KALLANG/WHAMPOA', 'MARINE PARADE', 'PASIR RIS', 'PUNGGOL',
  'QUEENSTOWN', 'SEMBAWANG', 'SENGKANG', 'SERANGOON', 'TAMPINES',
  'TOA PAYOH', 'WOODLANDS', 'YISHUN',
] as const;

const ROOM_TYPES = ['2 ROOM', '3 ROOM', '4 ROOM', '5 ROOM', 'EXECUTIVE'] as const;
const SORT_ORDERS = {
  price_asc: 'price.asc,created_at.desc,id.asc',
  price_desc: 'price.desc,created_at.desc,id.asc',
  area_desc: 'area_sqft.desc,price.asc,id.asc',
  newest: 'created_at.desc,id.asc',
} as const;

export interface ListingFilters {
  locations?: string[];
  min_price?: number;
  max_price?: number;
  room_type?: typeof ROOM_TYPES[number];
  bedrooms?: number;
  min_bedrooms?: number;
  min_bathrooms?: number;
  min_area_sqft?: number;
  keywords?: string[];
  sort_by: keyof typeof SORT_ORDERS;
}

export interface ListingRecommendation {
  id: string;
  title: string;
  price: number;
  location: string;
  bedrooms: number;
  bathrooms: number;
  area_sqft: number;
  description: string | null;
  image_url: string;
  url: string;
}

export interface ListingSearchResult {
  filters: ListingFilters;
  total_matches: number;
  listings: ListingRecommendation[];
}

export class ListingQueryError extends Error {}
export class ListingServiceError extends Error {}

export const SEARCH_LISTINGS_TOOL = {
  type: 'function',
  function: {
    name: 'search_listings',
    description: `Search SG Homie's live approved HDB sale listings. All supplied filters are ANDed;
locations are ORed. Returns up to 3 listings, property URLs, applied filters and total match count.
Use when the client requests finding, showing or refining available homes. This is an optional
search tool, not the default response to every buying conversation. A budget, town or room type
mentioned in an advice question does not request a search. Answer timing, affordability and
housing-choice questions conversationally; this catalog cannot establish market trends or forecasts.
Omitted filters retain saved values; null (or [] for arrays) clears a filter ("any").
Interpret changes from the conversation and retain the other filters. Never relax
requirements without agreement. A bare "buy" starts a conversation, not a tool call.
When they ask to see homes, use stated preferences; clear the filters they no longer want.
Any location is supported: use null/[] to clear locations and search all supported towns.
"No need Clementi. Just any executives" removes locations and uses room_type="EXECUTIVE".
Retain other preferences such as budget when just the town is removed. Never use "Any" as a town.
Prices are numeric SGD: 600k -> 600000; 1.2m -> 1200000.
HDB room type is NOT bedroom count. room_type searches title/description because no dedicated
flat-type column exists. bedrooms/min_bedrooms filter the seller-recorded bedrooms column.
Do NOT use bedrooms=4 for "4-room". Do not infer actual bedrooms from HDB room type.
Example "4-room in Tampines under 600k" -> {"locations":["TAMPINES"],"room_type":"4 ROOM","max_price":600000}.
Example "at least 3 bedrooms, Bedok or Tampines, largest first" -> {"locations":["BEDOK","TAMPINES"],"min_bedrooms":3,"sort_by":"area_desc"}.
Cannot verify MRT distances, schools, floor or lease. Keywords only prove that the phrase occurs
in listing text. Only HDB is supported. This tool cannot create drafts or modify listings.`,
    parameters: {
      type: 'object', additionalProperties: false,
      properties: {
        locations: { type: ['array', 'null'], items: { type: 'string', enum: TOWNS }, maxItems: 5, description: 'Canonical HDB towns. Resolve AMK to ANG MO KIO. Null or [] clears the town filter (any town); omit to retain it.' },
        min_price: { type: ['number', 'null'], minimum: 0, description: 'Inclusive minimum SGD price.' },
        max_price: { type: ['number', 'null'], minimum: 0, description: 'Inclusive maximum SGD price, >= min_price.' },
        room_type: { type: ['string', 'null'], enum: [...ROOM_TYPES, null], description: 'HDB room type as described in title/description, NOT bedrooms. Null clears this filter (any room type); omit to retain it. Listings without a matching description are excluded.' },
        bedrooms: { type: ['integer', 'null'], minimum: 1, maximum: 20, description: 'Exact recorded bedroom count. Only use when actual bedrooms are requested.' },
        min_bedrooms: { type: ['integer', 'null'], minimum: 1, maximum: 20, description: 'Minimum recorded bedroom count.' },
        min_bathrooms: { type: ['integer', 'null'], minimum: 1, maximum: 10, description: 'Minimum bathrooms.' },
        min_area_sqft: { type: ['number', 'null'], minimum: 0, description: 'Minimum floor area in sqft. Convert sqm if necessary.' },
        keywords: { type: ['array', 'null'], items: { type: 'string', minLength: 1, maxLength: 80 }, maxItems: 5, description: 'Literal phrases in title, description or address. Each must match at least one field. Use explicit requirements (renovated, balcony), not sentences/budgets/towns. No SQL/wildcards.' },
        sort_by: { type: ['string', 'null'], enum: [...Object.keys(SORT_ORDERS), null], description: 'price_asc default; price_desc, area_desc for largest, newest for latest. Ranking applies after ALL filters; it is not an investment score.' },
      },
    },
  },
} as const;

export function parseListingFilters(value: unknown): ListingFilters {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ListingQueryError('Search arguments must be an object');
  const input = value as Record<string, unknown>;
  const fields = Object.keys(SEARCH_LISTINGS_TOOL.function.parameters.properties);
  for (const field of Object.keys(input)) {
    if (!fields.includes(field)) throw new ListingQueryError(`Unsupported search filter: ${field}`);
  }
  const filters: ListingFilters = { sort_by: 'price_asc' };
  for (const field of ['min_price', 'max_price', 'bedrooms', 'min_bedrooms', 'min_bathrooms', 'min_area_sqft'] as const) {
    const number = input[field];
    if (number === undefined || number === null) continue;
    if (typeof number !== 'number' || !Number.isFinite(number) || number < 0 || number > 1_000_000_000) {
      throw new ListingQueryError(`${field} must be a finite, non-negative number <= 1000000000`);
    }
    if (['bedrooms', 'min_bedrooms', 'min_bathrooms'].includes(field)
      && (!Number.isInteger(number) || number < 1 || number > (field === 'min_bathrooms' ? 10 : 20))) {
      throw new ListingQueryError(`${field} must be a positive integer within the tool schema's range`);
    }
    filters[field] = number;
  }
  if (filters.min_price !== undefined && filters.max_price !== undefined && filters.min_price > filters.max_price) {
    throw new ListingQueryError('min_price cannot exceed max_price');
  }
  if (filters.bedrooms !== undefined && filters.min_bedrooms !== undefined && filters.bedrooms < filters.min_bedrooms) {
    throw new ListingQueryError('bedrooms cannot be lower than min_bedrooms');
  }
  for (const field of ['locations', 'keywords'] as const) {
    const items = input[field];
    if (items === undefined || items === null) continue;
    if (!Array.isArray(items) || items.length > 5 || items.some(item => typeof item !== 'string' || !item.trim() || item.length > 80)) {
      throw new ListingQueryError(`${field} must contain at most 5 non-empty strings of at most 80 characters`);
    }
    const normalized = [...new Set(items.map(item => field === 'locations' ? item.trim().toUpperCase() : item.trim()))];
    if (field === 'locations' && normalized.some(town => !(TOWNS as readonly string[]).includes(town))) {
      throw new ListingQueryError(`locations must use supported towns: ${TOWNS.join(', ')}`);
    }
    if (field === 'keywords' && normalized.some(keyword => /[\u0000-\u001f*]/.test(keyword))) {
      throw new ListingQueryError('Keywords must be literal phrases without control characters or * wildcards');
    }
    if (normalized.length) filters[field] = normalized;
  }
  if (input.room_type !== undefined && input.room_type !== null) {
    if (typeof input.room_type !== 'string' || !(ROOM_TYPES as readonly string[]).includes(input.room_type)) throw new ListingQueryError('room_type must be 2 ROOM, 3 ROOM, 4 ROOM, 5 ROOM or EXECUTIVE');
    filters.room_type = input.room_type as ListingFilters['room_type'];
  }
  if (input.sort_by !== undefined && input.sort_by !== null) {
    if (typeof input.sort_by !== 'string' || !Object.prototype.hasOwnProperty.call(SORT_ORDERS, input.sort_by)) throw new ListingQueryError('sort_by must be price_asc, price_desc, area_desc or newest');
    filters.sort_by = input.sort_by as ListingFilters['sort_by'];
  }
  return filters;
}

function quoteFilter(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function buildListingSearchUrl(supabaseUrl: string, filters: ListingFilters): URL {
  const url = new URL(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/properties`);
  url.searchParams.set('select', 'id,title,price,location,town,bedrooms,bathrooms,area_sqft,description,image_url');
  url.searchParams.set('status', 'eq.approved');
  url.searchParams.set('type', 'eq.HDB');
  url.searchParams.set('limit', '3');
  url.searchParams.set('order', SORT_ORDERS[filters.sort_by]);
  const clauses: string[] = [];
  if (filters.locations?.length) {
    const towns = filters.locations.map(quoteFilter).join(',');
    clauses.push(`or(location.in.(${towns}),town.in.(${towns}))`);
  }
  for (const [field, column, operator] of [
    ['min_price', 'price', 'gte'], ['max_price', 'price', 'lte'],
    ['bedrooms', 'bedrooms', 'eq'], ['min_bedrooms', 'bedrooms', 'gte'],
    ['min_bathrooms', 'bathrooms', 'gte'], ['min_area_sqft', 'area_sqft', 'gte'],
  ] as const) {
    if (filters[field] !== undefined) clauses.push(`${column}.${operator}.${filters[field]}`);
  }
  if (filters.room_type) {
    // Controlled regex: 4-room is not 14-room and never implies four bedrooms.
    const pattern = filters.room_type === 'EXECUTIVE'
      ? '(^|[^[:alpha:]])executive([^[:alpha:]]|$)'
      : `(^|[^0-9])${filters.room_type[0]}[-[:space:]]+room([^[:alpha:]]|$)`;
    clauses.push(`or(title.imatch.${quoteFilter(pattern)},description.imatch.${quoteFilter(pattern)})`);
  }
  for (const keyword of filters.keywords ?? []) {
    const pattern = quoteFilter(`%${keyword.replace(/[\\%_]/g, '\\$&')}%`);
    clauses.push(`or(title.ilike.${pattern},description.ilike.${pattern},detailed_location.ilike.${pattern})`);
  }
  if (clauses.length) url.searchParams.set('and', `(${clauses.join(',')})`);
  return url;
}

export async function searchListings(filters: ListingFilters, config: {
  supabaseUrl: string; anonKey: string; authorization?: string;
}): Promise<ListingSearchResult> {
  let response: Response;
  try {
    response = await fetch(buildListingSearchUrl(config.supabaseUrl, filters), {
      headers: { apikey: config.anonKey, Authorization: config.authorization ?? `Bearer ${config.anonKey}`, Prefer: 'count=exact' },
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ListingServiceError('Listing search is temporarily unavailable. Please try again.');
  }
  if (!response.ok) throw new ListingServiceError('Listing search is temporarily unavailable. Please try again.');
  let rows: unknown;
  try { rows = await response.json(); } catch { throw new ListingServiceError('Listing search returned an invalid response'); }
  if (!Array.isArray(rows)) throw new ListingServiceError('Listing search returned an invalid response');
  // Reject inconsistent results rather than displaying a home outside the applied query.
  for (const row of rows) {
    if (!row || typeof row !== 'object' || typeof row.id !== 'string') throw new ListingServiceError('Listing search returned an invalid response');
    if (filters.locations?.length) {
      const location = String(row.location ?? '').trim().toUpperCase();
      const town = String(row.town ?? '').trim().toUpperCase();
      if (!filters.locations.includes(location) && !filters.locations.includes(town)
        || ((TOWNS as readonly string[]).includes(location) && town && town !== location)) {
        throw new ListingServiceError('Listing search returned a home outside the requested town. Please try again.');
      }
    }
    for (const [field, column, comparison] of [
      ['min_price', 'price', 'min'], ['max_price', 'price', 'max'], ['bedrooms', 'bedrooms', 'equal'],
      ['min_bedrooms', 'bedrooms', 'min'], ['min_bathrooms', 'bathrooms', 'min'], ['min_area_sqft', 'area_sqft', 'min'],
    ] as const) {
      const value = Number(row[column]);
      const required = filters[field];
      if (required !== undefined && (!Number.isFinite(value) || row[column] === null
        || (comparison === 'min' ? value < required : comparison === 'max' ? value > required : value !== required))) {
        throw new ListingServiceError('Listing search returned a home outside the requested filters. Please try again.');
      }
    }
  }
  const listings = rows.slice(0, 3).map(row => ({
    id: row.id as string, title: row.title as string, price: Number(row.price), location: row.location as string,
    bedrooms: Number(row.bedrooms), bathrooms: Number(row.bathrooms), area_sqft: Number(row.area_sqft),
    description: typeof row.description === 'string' ? row.description.slice(0, 600) : null,
    image_url: row.image_url as string, url: `/property/${encodeURIComponent(row.id)}`,
  }));
  const count = Number(response.headers.get('content-range')?.split('/')[1]);
  return { filters, total_matches: Number.isFinite(count) ? count : listings.length, listings };
}
