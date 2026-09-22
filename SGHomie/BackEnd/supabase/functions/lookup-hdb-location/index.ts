import { createClient } from 'npm:@supabase/supabase-js@2.114.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};

const jsonHeaders = {
  ...corsHeaders,
  'Content-Type': 'application/json',
};

const HDB_DATASET_ID = 'd_17f5382f26140b1fdae0ba2ef6239d2f';
const ONEMAP_SEARCH_URL = 'https://www.onemap.gov.sg/api/common/elastic/search';
const ONEMAP_TOKEN_URL = 'https://www.onemap.gov.sg/api/auth/post/getToken';
const DATASTORE_SEARCH_URL = 'https://data.gov.sg/api/action/datastore_search';

type OneMapResult = {
  BLK_NO?: string;
  ROAD_NAME?: string;
  ADDRESS?: string;
  POSTAL?: string;
  LATITUDE?: string;
  LONGITUDE?: string;
};

type HdbRecord = {
  blk_no?: string;
  street?: string;
  residential?: string;
  year_completed?: string;
  bldg_contract_town?: string;
};

type OneMapToken = {
  value: string;
  expiresAt: number;
};

let cachedOneMapToken: OneMapToken | null = null;

class HttpError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

function normalisePostalCode(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, '') : '';
}

function normaliseBlock(value: unknown): string {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

function normaliseStreet(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[.,]/g, ' ')
    .replace(/\bROAD\b/g, 'RD')
    .replace(/\bSTREET\b/g, 'ST')
    .replace(/\bAVENUE\b/g, 'AVE')
    .replace(/\bDRIVE\b/g, 'DR')
    .replace(/\bCRESCENT\b/g, 'CRES')
    .replace(/\bCLOSE\b/g, 'CL')
    .replace(/\bJUNCTION\b/g, 'JCT')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseOptionalYear(value: unknown): number | null {
  const year = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(year) && year > 0 ? year : null;
}

function mapTownCode(value: unknown): string {
  const code = String(value ?? '').trim().toUpperCase();
  const townAliases: Record<string, string> = {
    AMK: 'ANG MO KIO',
    ANG_MO_KIO: 'ANG MO KIO',
    BD: 'BEDOK',
    BDK: 'BEDOK',
    BE: 'BEDOK',
    BSH: 'BISHAN',
    BI: 'BISHAN',
    BB: 'BUKIT BATOK',
    BM: 'BUKIT MERAH',
    BP: 'BUKIT PANJANG',
    BT: 'BUKIT TIMAH',
    CC: 'CENTRAL AREA',
    CT: 'CENTRAL AREA',
    KWN: 'KALLANG/WHAMPOA',
    KAL: 'KALLANG/WHAMPOA',
    CK: 'CHOA CHU KANG',
    CCK: 'CHOA CHU KANG',
    CL: 'CLEMENTI',
    CLE: 'CLEMENTI',
    GL: 'GEYLANG',
    GEY: 'GEYLANG',
    HG: 'HOUGANG',
    HO: 'HOUGANG',
    JE: 'JURONG EAST',
    JUR: 'JURONG EAST',
    JW: 'JURONG WEST',
    JUR_WEST: 'JURONG WEST',
    MP: 'MARINE PARADE',
    MPR: 'MARINE PARADE',
    PR: 'PASIR RIS',
    PRC: 'PASIR RIS',
    PG: 'PUNGGOL',
    PGL: 'PUNGGOL',
    QT: 'QUEENSTOWN',
    QN: 'QUEENSTOWN',
    SB: 'SEMBAWANG',
    SEM: 'SEMBAWANG',
    SK: 'SENGKANG',
    SEN: 'SENGKANG',
    SG: 'SERANGOON',
    SER: 'SERANGOON',
    TAP: 'TAMPINES',
    TP: 'TAMPINES',
    TMP: 'TAMPINES',
    TO: 'TOA PAYOH',
    TPY: 'TOA PAYOH',
    WL: 'WOODLANDS',
    WDL: 'WOODLANDS',
    YS: 'YISHUN',
    YSH: 'YISHUN',
  };

  if (townAliases[code]) return townAliases[code];

  const knownTownNames = [
    'ANG MO KIO', 'BEDOK', 'BISHAN', 'BUKIT BATOK', 'BUKIT MERAH',
    'BUKIT PANJANG', 'BUKIT TIMAH', 'CENTRAL AREA', 'CHOA CHU KANG',
    'CLEMENTI', 'GEYLANG', 'HOUGANG', 'JURONG EAST', 'JURONG WEST',
    'KALLANG/WHAMPOA', 'MARINE PARADE', 'PASIR RIS', 'PUNGGOL',
    'QUEENSTOWN', 'SEMBAWANG', 'SENGKANG', 'SERANGOON', 'TAMPINES',
    'TOA PAYOH', 'WOODLANDS', 'YISHUN',
  ];

  return knownTownNames.includes(code) ? code : '';
}

async function getOneMapToken(forceRefresh = false): Promise<string> {
  const email = Deno.env.get('ONEMAP_EMAIL');
  const password = Deno.env.get('ONEMAP_PASSWORD');

  if (!email || !password) {
    throw new HttpError('OneMap credentials are not configured', 503);
  }

  const now = Date.now();
  if (!forceRefresh && cachedOneMapToken && cachedOneMapToken.expiresAt > now + 60_000) {
    return cachedOneMapToken.value;
  }

  const response = await fetch(ONEMAP_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new HttpError('Unable to authenticate with OneMap', 503);
  }

  const payload = await response.json();
  if (typeof payload.access_token !== 'string') {
    throw new HttpError('OneMap returned an invalid access token', 503);
  }

  const expiryTimestamp = Number(payload.expiry_timestamp);
  cachedOneMapToken = {
    value: payload.access_token,
    expiresAt: Number.isFinite(expiryTimestamp) ? expiryTimestamp * 1000 : now + 2 * 24 * 60 * 60 * 1000,
  };

  return cachedOneMapToken.value;
}

async function searchOneMap(postalCode: string, token: string): Promise<OneMapResult[]> {
  const params = new URLSearchParams({
    searchVal: postalCode,
    returnGeom: 'Y',
    getAddrDetails: 'Y',
    pageNum: '1',
  });

  const response = await fetch(`${ONEMAP_SEARCH_URL}?${params.toString()}`, {
    headers: { Authorization: token },
  });

  if (response.status === 401) {
    throw new HttpError('OneMap token expired', 401);
  }
  if (!response.ok) {
    throw new HttpError('OneMap address search failed', 503);
  }

  const payload = await response.json();
  return Array.isArray(payload.results) ? payload.results : [];
}

async function findHdbRecord(blockNumber: string, streetName: string): Promise<HdbRecord | null> {
  const query = async (filters: Record<string, string>) => {
    const params = new URLSearchParams({
      resource_id: HDB_DATASET_ID,
      limit: '100',
      filters: JSON.stringify(filters),
    });

    const response = await fetch(`${DATASTORE_SEARCH_URL}?${params.toString()}`);
    if (!response.ok) {
      throw new HttpError('HDB dataset lookup failed', 503);
    }

    const payload = await response.json();
    return Array.isArray(payload?.result?.records) ? payload.result.records as HdbRecord[] : [];
  };

  const normalisedTargetStreet = normaliseStreet(streetName);
  const matchesStreet = (record: HdbRecord) =>
    normaliseBlock(record.blk_no) === normaliseBlock(blockNumber)
    && normaliseStreet(record.street) === normalisedTargetStreet;

  const exactRecords = await query({ blk_no: blockNumber, street: streetName });
  const exactMatches = exactRecords.filter(matchesStreet);
  if (exactMatches.length > 0) {
    return exactMatches.find(record => String(record.residential ?? '').trim().toUpperCase() === 'Y')
      ?? exactMatches[0];
  }

  // Some dataset rows use a slightly different street abbreviation. Fetch the
  // block candidates and apply the same normalisation locally before rejecting.
  const blockRecords = await query({ blk_no: blockNumber });
  const blockMatches = blockRecords.filter(matchesStreet);
  return blockMatches.find(record => String(record.residential ?? '').trim().toUpperCase() === 'Y')
    ?? blockMatches[0]
    ?? null;
}

async function lookupHdbLocation(postalCode: string) {
  let token = await getOneMapToken();
  let oneMapResults: OneMapResult[];

  try {
    oneMapResults = await searchOneMap(postalCode, token);
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) {
      token = await getOneMapToken(true);
      oneMapResults = await searchOneMap(postalCode, token);
    } else {
      throw error;
    }
  }

  const result = oneMapResults.find(item => normalisePostalCode(item.POSTAL) === postalCode)
    ?? oneMapResults[0];

  if (!result?.BLK_NO || !result.ROAD_NAME) {
    return { valid: false, code: 'ADDRESS_NOT_FOUND', message: 'No address was found for this postal code.' };
  }

  const latitude = Number(result.LATITUDE);
  const longitude = Number(result.LONGITUDE);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new HttpError('OneMap returned an address without valid coordinates', 503);
  }

  const hdbRecord = await findHdbRecord(result.BLK_NO, result.ROAD_NAME);
  if (!hdbRecord) {
    return { valid: false, code: 'NOT_HDB', message: 'This postal code does not match a known HDB block.' };
  }

  if (String(hdbRecord.residential ?? '').trim().toUpperCase() !== 'Y') {
    return { valid: false, code: 'NOT_RESIDENTIAL_HDB', message: 'This address is not a residential HDB block.' };
  }

  const blockNumber = result.BLK_NO.trim();
  const streetName = result.ROAD_NAME.trim();

  return {
    valid: true,
    address: {
      postalCode,
      blockNumber,
      streetName,
      displayAddress: result.ADDRESS?.trim() || `Blk ${blockNumber} ${streetName} Singapore ${postalCode}`,
      town: mapTownCode(hdbRecord.bldg_contract_town),
      builtYear: parseOptionalYear(hdbRecord.year_completed),
      latitude,
      longitude,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const authorization = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!authorization || !supabaseUrl || !supabaseAnonKey) {
      return jsonResponse({ error: 'Authentication is required' }, 401);
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authData.user) {
      return jsonResponse({ error: 'Authentication is required' }, 401);
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('is_seller')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile?.is_seller) {
      return jsonResponse({ error: 'Seller access is required' }, 403);
    }

    const body = await req.json();
    const postalCode = normalisePostalCode(body?.postalCode);
    if (!/^\d{6}$/.test(postalCode)) {
      return jsonResponse({
        valid: false,
        code: 'INVALID_POSTAL_CODE',
        message: 'Enter a valid 6-digit Singapore postal code.',
      }, 400);
    }

    return jsonResponse(await lookupHdbLocation(postalCode));
  } catch (error) {
    console.error('HDB location lookup failed:', error);
    const status = error instanceof HttpError ? error.status : 500;
    return jsonResponse({
      error: status >= 500 ? 'Address lookup is temporarily unavailable.' : 'Address lookup failed.',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, status);
  }
});
