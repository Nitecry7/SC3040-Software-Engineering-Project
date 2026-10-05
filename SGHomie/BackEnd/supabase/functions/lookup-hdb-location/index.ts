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
  if (typeof value === 'number' && Number.isInteger(value)) {
    return String(value);
  }

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
    console.error('OneMap lookup credentials are missing', {
      hasEmail: Boolean(email),
      hasPassword: Boolean(password),
    });
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
    const responseBody = await response.text();
    console.error('OneMap token request failed', {
      status: response.status,
      responseBody: responseBody.slice(0, 1000),
    });
    throw new HttpError('Unable to authenticate with OneMap', 503);
  }

  const payload = await response.json();
  if (typeof payload.access_token !== 'string') {
    console.error('OneMap token response did not contain an access token', {
      responseKeys: payload && typeof payload === 'object' ? Object.keys(payload) : [],
    });
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
    const responseBody = await response.text();
    console.error('OneMap address search request failed', {
      status: response.status,
      responseBody: responseBody.slice(0, 1000),
    });
    throw new HttpError('OneMap address search failed', 503);
  }

  const payload = await response.json();
  if (typeof payload?.error === 'string') {
    console.error('OneMap address search returned an API error', {
      error: payload.error,
      postalCode,
    });
    if (/\b(?:invalid|expired|missing|not found)\b.{0,40}\btoken\b|\btoken\b.{0,40}\b(?:invalid|expired|missing|not found)\b/i.test(payload.error)) {
      throw new HttpError('OneMap rejected the search token', 401);
    }
    throw new HttpError('OneMap address search failed', 503);
  }
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
      const responseBody = await response.text();
      console.error('HDB dataset query failed', {
        status: response.status,
        filters,
        responseBody: responseBody.slice(0, 1000),
      });
      throw new HttpError('HDB dataset lookup failed', 503);
    }

    const payload = await response.json();
    if (payload?.success === false) {
      console.error('HDB dataset returned an unsuccessful result', {
        filters,
        error: payload.error,
      });
      throw new HttpError('HDB dataset lookup failed', 503);
    }
    return Array.isArray(payload?.result?.records) ? payload.result.records as HdbRecord[] : [];
  };

  const normalisedTargetStreet = normaliseStreet(streetName);
  const matchesStreet = (record: HdbRecord) =>
    normaliseBlock(record.blk_no) === normaliseBlock(blockNumber)
    && normaliseStreet(record.street) === normalisedTargetStreet;

  const exactRecords = await query({ blk_no: blockNumber, street: streetName });
  const exactMatches = exactRecords.filter(matchesStreet);
  if (exactMatches.length > 0) {
    console.log('HDB block matched by exact block and street', {
      blockNumber,
      streetName,
      matchCount: exactMatches.length,
    });
    return exactMatches.find(record => String(record.residential ?? '').trim().toUpperCase() === 'Y')
      ?? exactMatches[0];
  }

  // Some dataset rows use a slightly different street abbreviation. Fetch the
  // block candidates and apply the same normalisation locally before rejecting.
  const blockRecords = await query({ blk_no: blockNumber });
  const blockMatches = blockRecords.filter(matchesStreet);
  console.log('HDB block matched after street-name normalization', {
    blockNumber,
    streetName,
    candidateCount: blockRecords.length,
    matchCount: blockMatches.length,
  });
  return blockMatches.find(record => String(record.residential ?? '').trim().toUpperCase() === 'Y')
    ?? blockMatches[0]
    ?? null;
}

async function issueVerificationToken(
  sellerId: string,
  address: {
    postalCode: string;
    blockNumber: string;
    streetName: string;
    town: string;
    builtYear: number | null;
    latitude: number;
    longitude: number;
  },
): Promise<string> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new HttpError('Supabase server credentials are not configured', 503);
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await serviceClient
    .from('hdb_location_verifications')
    .delete()
    .eq('seller_id', sellerId)
    .lt('expires_at', new Date().toISOString());

  const { data, error } = await serviceClient
    .from('hdb_location_verifications')
    .insert({
      seller_id: sellerId,
      postal_code: address.postalCode,
      block_number: address.blockNumber,
      street_name: address.streetName,
      town: address.town,
      built_year: address.builtYear,
      latitude: address.latitude,
      longitude: address.longitude,
    })
    .select('token')
    .single();

  if (error || !data?.token) {
    console.error('Failed to issue HDB verification token', {
      sellerId,
      error,
    });
    throw new HttpError('Unable to save HDB verification', 503);
  }

  return data.token;
}

async function lookupHdbLocation(postalCode: string, sellerId: string) {
  let token = await getOneMapToken();
  let oneMapResults: OneMapResult[];

  try {
    oneMapResults = await searchOneMap(postalCode, token);
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) {
      token = await getOneMapToken(true);
      try {
        oneMapResults = await searchOneMap(postalCode, token);
      } catch (refreshError) {
        if (refreshError instanceof HttpError && refreshError.status === 401) {
          console.error('OneMap rejected a refreshed search token', { postalCode });
          throw new HttpError('OneMap rejected a refreshed search token', 503);
        }
        throw refreshError;
      }
    } else {
      throw error;
    }
  }

  const hasExactPostalMatch = oneMapResults.some(item => normalisePostalCode(item.POSTAL) === postalCode);
  console.log('OneMap postal search completed', {
    postalCode,
    resultCount: oneMapResults.length,
    hasExactPostalMatch,
  });

  // Only accept an address whose returned postal code exactly matches the
  // requested value. Falling back to the first fuzzy search result could
  // verify a different block when OneMap has no exact match.
  const result = oneMapResults.find(item => normalisePostalCode(item.POSTAL) === postalCode);

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
  const town = mapTownCode(hdbRecord.bldg_contract_town);
  const builtYear = parseOptionalYear(hdbRecord.year_completed);
  const verificationToken = await issueVerificationToken(sellerId, {
    postalCode,
    blockNumber,
    streetName,
    town,
    builtYear,
    latitude,
    longitude,
  });

  return {
    valid: true,
    address: {
      postalCode,
      blockNumber,
      streetName,
      displayAddress: result.ADDRESS?.trim() || `Blk ${blockNumber} ${streetName} Singapore ${postalCode}`,
      town,
      builtYear,
      latitude,
      longitude,
      verificationToken,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const requestId = req.headers.get('x-request-id') || crypto.randomUUID();

  if (req.method !== 'POST') {
    console.warn('HDB lookup received an unsupported method', {
      requestId,
      method: req.method,
    });
    return jsonResponse({ error: 'Method not allowed', requestId }, 405);
  }

  try {
    const authorization = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!authorization || !supabaseUrl || !supabaseAnonKey) {
      console.error('HDB lookup is missing required request configuration', {
        requestId,
        hasAuthorization: Boolean(authorization),
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasSupabaseAnonKey: Boolean(supabaseAnonKey),
      });
      return jsonResponse({ error: 'Authentication is required', requestId }, 401);
    }

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !authData.user) {
      console.error('HDB lookup rejected an invalid user token', {
        requestId,
        error: authError,
      });
      return jsonResponse({ error: 'Authentication is required', requestId }, 401);
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from('user_profiles')
      .select('is_seller')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile?.is_seller) {
      console.error('HDB lookup rejected a non-seller profile', {
        requestId,
        userId: authData.user.id,
        error: profileError,
        isSeller: profile?.is_seller ?? false,
      });
      return jsonResponse({ error: 'Seller access is required', requestId }, 403);
    }

    const body = await req.json();
    const postalCode = normalisePostalCode(body?.postalCode ?? body?.postal_code);
    if (!/^\d{6}$/.test(postalCode)) {
      console.warn('HDB lookup received an invalid postal code payload', {
        requestId,
        payloadKeys: body && typeof body === 'object' ? Object.keys(body) : [],
        valueType: typeof (body?.postalCode ?? body?.postal_code),
      });
      return jsonResponse({
        valid: false,
        code: 'INVALID_POSTAL_CODE',
        message: 'Enter a valid 6-digit Singapore postal code.',
      }, 400);
    }

    console.log('HDB postal lookup started', {
      requestId,
      userId: authData.user.id,
      postalCode,
    });
    return jsonResponse(await lookupHdbLocation(postalCode, authData.user.id));
  } catch (error) {
    console.error('HDB location lookup failed', { requestId, error });
    const status = error instanceof HttpError ? error.status : 500;
    return jsonResponse({
      error: status >= 500 ? 'Address lookup is temporarily unavailable.' : 'Address lookup failed.',
      details: error instanceof Error ? error.message : 'Unknown error',
      requestId,
    }, status);
  }
});
