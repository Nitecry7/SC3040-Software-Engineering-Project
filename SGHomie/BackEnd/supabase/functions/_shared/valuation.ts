export const VALUATION_FEATURE_ORDER = [
  'transaction_year',
  'transaction_month',
  'floor_area_sqm',
  'storey_mid',
  'remaining_lease_months',
  'town',
  'flat_type',
  'block',
  'street_name',
  'flat_model',
] as const;

export const SUPPORTED_COVERAGE = [0.8, 0.9, 0.95] as const;
export const VALUATION_UNAVAILABLE = 'VALUATION_UNAVAILABLE';
export const CANONICAL_DEMO_BATCH_IDS = [
  'sghomie-test-2026-10-07-2e3e55',
  'sghomie-test-2026-10-07-extra30-12f05f',
] as const;

type PropertyRecord = {
  id?: unknown;
  area_sqft?: unknown;
  price?: unknown;
  town?: unknown;
  block_number?: unknown;
  street_name?: unknown;
  flat_type?: unknown;
  flat_model?: unknown;
  storey_range?: unknown;
  storey_mid?: unknown;
  remaining_lease_months?: unknown;
  remaining_lease_as_of_month?: unknown;
  valuation_inputs_source?: unknown;
  hdb_verified?: unknown;
  demo_batch_id?: unknown;
  status?: unknown;
};

type UserClient = {
  auth: { getUser: () => Promise<{ data: { user: unknown | null }; error: unknown | null }> };
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => Promise<{ data: PropertyRecord | null; error: unknown | null }>;
      };
    };
  };
};

export type ValuationDependencies = {
  supabaseUrl: string | undefined;
  supabaseAnonKey: string | undefined;
  renderApiUrl: string | undefined;
  renderServiceToken: string | undefined;
  allowDemoInputs: string | undefined;
  allowHostedDemoInputs: string | undefined;
  edgeRegion?: string;
  createUserClient: (url: string, anonKey: string, authorization: string) => UserClient;
  fetcher?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function fail(status: number, code: string, message: string): Response {
  return jsonResponse({ error: { code, message } }, status);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function nonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validModelVersion(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value);
}

export function currentSingaporeMonth(now = new Date()): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
  };
}

export function parseAsOfMonth(value: unknown): { year: number; month: number } | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-01$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 1900 || month < 1 || month > 12) return null;
  return { year, month };
}

export function effectiveRemainingLeaseMonths(
  storedMonths: unknown,
  asOfMonth: unknown,
  valuationMonth: { year: number; month: number },
): number {
  if (!Number.isInteger(storedMonths) || (storedMonths as number) < 1 || (storedMonths as number) > 1200) {
    throw new Error('invalid stored lease');
  }
  const asOf = parseAsOfMonth(asOfMonth);
  if (!asOf || !Number.isInteger(valuationMonth.year) || !Number.isInteger(valuationMonth.month)
      || valuationMonth.month < 1 || valuationMonth.month > 12) {
    throw new Error('invalid lease month');
  }
  const elapsed = (valuationMonth.year - asOf.year) * 12 + valuationMonth.month - asOf.month;
  if (elapsed < 0) throw new Error('lease as-of month is in the future');
  const effective = (storedMonths as number) - elapsed;
  if (effective <= 0) throw new Error('lease is exhausted');
  return effective;
}

export function isLocalSupabaseUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const host = new URL(value).hostname.toLowerCase();
    return ['localhost', '127.0.0.1', '::1', '[::1]', 'kong'].includes(host);
  } catch {
    return false;
  }
}

export function storeyRangeMidpoint(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{2}) TO (\d{2})$/.exec(value);
  if (!match) return null;
  const low = Number(match[1]);
  const high = Number(match[2]);
  if (low < 1 || high < low || high > 99) return null;
  return (low + high) / 2;
}

export function buildValuationRequest(
  property: PropertyRecord,
  valuationMonth: { year: number; month: number },
): { features: Record<(typeof VALUATION_FEATURE_ORDER)[number], string | number>; asking_price?: number } {
  const floorArea = finiteNumber(property.area_sqft) ? property.area_sqft / 10.7639 : NaN;
  const remainingLease = effectiveRemainingLeaseMonths(
    property.remaining_lease_months,
    property.remaining_lease_as_of_month,
    valuationMonth,
  );
  const requiredCategories = {
    town: property.town,
    flat_type: property.flat_type,
    block: property.block_number,
    street_name: property.street_name,
    flat_model: property.flat_model,
  };
  const categoryLimits: Record<string, number> = {
    town: 100,
    flat_type: 40,
    block: 20,
    street_name: 120,
    flat_model: 100,
  };
  for (const [name, value] of Object.entries(requiredCategories)) {
    if (!nonBlank(value) || value.trim().length > categoryLimits[name]) throw new Error(`invalid ${name}`);
  }
  if (!Number.isFinite(floorArea) || floorArea <= 0 || !finiteNumber(property.storey_mid)
      || property.storey_mid <= 0 || property.storey_mid > 100) {
    throw new Error('invalid numeric valuation input');
  }
  const features = {
    transaction_year: valuationMonth.year,
    transaction_month: valuationMonth.month,
    floor_area_sqm: floorArea,
    storey_mid: property.storey_mid,
    remaining_lease_months: remainingLease,
    town: (property.town as string).trim(),
    flat_type: (property.flat_type as string).trim(),
    block: (property.block_number as string).trim(),
    street_name: (property.street_name as string).trim(),
    flat_model: (property.flat_model as string).trim(),
  };
  const result: { features: typeof features; asking_price?: number } = { features };
  if (finiteNumber(property.price) && property.price > 0) result.asking_price = property.price;
  return result;
}

export function validateValuationResponse(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const numericKeys = [
    'estimated_value', 'lower_bound', 'upper_bound', 'interval_half_width',
    'interval_full_width', 'coverage_target',
  ];
  if (!numericKeys.every((key) => finiteNumber(value[key]))) return null;
  const estimate = value.estimated_value as number;
  const lower = value.lower_bound as number;
  const upper = value.upper_bound as number;
  const half = value.interval_half_width as number;
  const full = value.interval_full_width as number;
  if (estimate <= 0 || lower < 0 || lower > estimate || estimate > upper || half < 0 || full < 0
      || Math.abs(full - (upper - lower)) > 0.01
      || Math.abs(half - (upper - lower) / 2) > 0.01
      || !SUPPORTED_COVERAGE.includes(value.coverage_target as (typeof SUPPORTED_COVERAGE)[number])) return null;
  if (!validModelVersion(value.model_version) || !nonBlank(value.uncertainty_method)
      || !nonBlank(value.uncertainty_group) || !Number.isInteger(value.uncertainty_support)
      || (value.uncertainty_support as number) < 0 || typeof value.used_global_fallback !== 'boolean') return null;
  const positions = [null, 'below_estimated_market_range', 'within_estimated_market_range', 'above_estimated_market_range'];
  if (!positions.includes(value.price_position as null | string)) return null;
  return {
    estimated_value: estimate,
    lower_bound: lower,
    upper_bound: upper,
    interval_half_width: half,
    interval_full_width: full,
    coverage_target: value.coverage_target,
    model_version: value.model_version,
    uncertainty_method: value.uncertainty_method,
    uncertainty_group: value.uncertainty_group,
    uncertainty_support: value.uncertainty_support,
    used_global_fallback: value.used_global_fallback,
    price_position: value.price_position,
  };
}

export function createValuationHandler(dependencies: ValuationDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (request.method !== 'POST') return fail(405, 'METHOD_NOT_ALLOWED', 'Use POST for valuation.');
    const requestStartedAt = performance.now();
    const requestId = crypto.randomUUID();
    const timings: Record<string, number> = {};
    const elapsedMs = (startedAt: number) => Math.round((performance.now() - startedAt) * 100) / 100;
    const finish = (
      response: Response,
      outcome: string,
      details: {
        failureCategory?: string;
        modelVersion?: string | null;
        predictionSanity?: 'passed' | 'failed' | 'not_checked';
      } = {},
    ) => {
      const headers = new Headers(response.headers);
      headers.set('X-Valuation-Request-ID', requestId);
      headers.set('Access-Control-Expose-Headers', 'X-Valuation-Request-ID');
      console.info(JSON.stringify({
        event: 'valuation_timing',
        request_id: requestId,
        edge_region: dependencies.edgeRegion ?? null,
        outcome,
        status_code: response.status,
        failure_category: details.failureCategory ?? null,
        model_version: details.modelVersion ?? null,
        prediction_sanity: details.predictionSanity ?? 'not_checked',
        timings_ms: timings,
        total_ms: elapsedMs(requestStartedAt),
      }));
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    };
    const authorization = request.headers.get('Authorization') ?? '';
    const authorizationHeaderStartedAt = performance.now();
    if (!/^Bearer\s+\S+$/i.test(authorization)) {
      timings.authentication_ms = elapsedMs(authorizationHeaderStartedAt);
      return finish(fail(401, 'UNAUTHORIZED', 'Authentication required.'), 'unauthorized', { failureCategory: 'AUTH_FAILURE' });
    }
    if (!dependencies.supabaseUrl || !dependencies.supabaseAnonKey) {
      console.error(JSON.stringify({ requestId, stage: 'configuration', message: 'Supabase auth configuration missing' }));
      timings.authentication_ms = elapsedMs(authorizationHeaderStartedAt);
      return finish(fail(503, 'VALUATION_UNAVAILABLE', 'Valuation is temporarily unavailable.'), 'configuration_error', { failureCategory: 'EDGE_UNAVAILABLE' });
    }
    let body: unknown;
    const requestValidationStartedAt = performance.now();
    try {
      body = await request.json();
    } catch {
      timings.request_validation_ms = elapsedMs(requestValidationStartedAt);
      return finish(fail(400, 'INVALID_REQUEST', 'A JSON request body is required.'), 'invalid_request', { failureCategory: 'INVALID_REQUEST' });
    }
    if (!isRecord(body) || Object.keys(body).length !== 1 || typeof body.property_id !== 'string'
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.property_id)) {
      timings.request_validation_ms = elapsedMs(requestValidationStartedAt);
      return finish(fail(400, 'INVALID_REQUEST', 'Provide a valid property_id.'), 'invalid_request', { failureCategory: 'INVALID_REQUEST' });
    }
    timings.request_validation_ms = elapsedMs(requestValidationStartedAt);
    let client: UserClient;
    const authenticationStartedAt = performance.now();
    try {
      client = dependencies.createUserClient(dependencies.supabaseUrl, dependencies.supabaseAnonKey, authorization);
      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError || !authData.user) {
        timings.authentication_ms = elapsedMs(authenticationStartedAt);
        return finish(fail(401, 'UNAUTHORIZED', 'Authentication required.'), 'unauthorized', { failureCategory: 'AUTH_FAILURE' });
      }
    } catch {
      timings.authentication_ms = elapsedMs(authenticationStartedAt);
      return finish(fail(401, 'UNAUTHORIZED', 'Authentication required.'), 'unauthorized', { failureCategory: 'AUTH_FAILURE' });
    }
    timings.authentication_ms = elapsedMs(authenticationStartedAt);
    let property: PropertyRecord | null;
    const databaseStartedAt = performance.now();
    try {
      const query = await client.from('properties').select(
        'id,area_sqft,price,town,block_number,street_name,flat_type,flat_model,storey_range,storey_mid,remaining_lease_months,remaining_lease_as_of_month,valuation_inputs_source,hdb_verified,demo_batch_id,status',
      ).eq('id', body.property_id).maybeSingle();
      timings.database_lookup_ms = elapsedMs(databaseStartedAt);
      if (query.error) return finish(fail(503, 'VALUATION_UNAVAILABLE', 'Valuation is temporarily unavailable.'), 'database_error', { failureCategory: 'PROPERTY_LOOKUP_FAILURE' });
      property = query.data;
    } catch {
      timings.database_lookup_ms = elapsedMs(databaseStartedAt);
      return finish(fail(503, 'VALUATION_UNAVAILABLE', 'Valuation is temporarily unavailable.'), 'database_error', { failureCategory: 'PROPERTY_LOOKUP_FAILURE' });
    }
    if (!property) return finish(fail(404, 'PROPERTY_NOT_FOUND', 'Property not found.'), 'property_not_found', { failureCategory: 'PROPERTY_NOT_FOUND' });

    const requestConstructionStartedAt = performance.now();
    const localSupabase = isLocalSupabaseUrl(dependencies.supabaseUrl);
    const demoMidpoint = storeyRangeMidpoint(property.storey_range);
    const hasCanonicalDemoProvenance = CANONICAL_DEMO_BATCH_IDS.includes(
      property.demo_batch_id as (typeof CANONICAL_DEMO_BATCH_IDS)[number],
    );
    const hasConsistentDemoStorey = demoMidpoint !== null
      && finiteNumber(property.storey_mid)
      && demoMidpoint === property.storey_mid;
    const isLocalDemo = property.valuation_inputs_source === 'demo'
      && dependencies.allowDemoInputs === 'true'
      && localSupabase
      && hasCanonicalDemoProvenance
      && property.status === 'approved'
      && hasConsistentDemoStorey;
    const isHostedDemo = property.valuation_inputs_source === 'demo'
      && dependencies.allowHostedDemoInputs === 'true'
      && !localSupabase
      && hasCanonicalDemoProvenance
      && property.status === 'approved'
      && hasConsistentDemoStorey;
    const isSellerSupplied = property.valuation_inputs_source === 'seller_supplied'
      && property.hdb_verified === true
      && property.demo_batch_id == null;
    if (!isLocalDemo && !isHostedDemo && !isSellerSupplied) {
      timings.request_construction_ms = elapsedMs(requestConstructionStartedAt);
      return finish(fail(409, VALUATION_UNAVAILABLE, 'This property does not have verified, complete valuation inputs.'), 'valuation_unavailable', { failureCategory: 'FEATURE_PREPARATION_FAILURE' });
    }
    const singaporeMonth = currentSingaporeMonth(dependencies.now?.() ?? new Date());
    let valuationRequest: ReturnType<typeof buildValuationRequest>;
    try {
      valuationRequest = buildValuationRequest(property, singaporeMonth);
    } catch {
      timings.request_construction_ms = elapsedMs(requestConstructionStartedAt);
      return finish(fail(409, VALUATION_UNAVAILABLE, 'This property does not have complete valid valuation inputs.'), 'valuation_unavailable', { failureCategory: 'FEATURE_PREPARATION_FAILURE' });
    }
    timings.request_construction_ms = elapsedMs(requestConstructionStartedAt);
    if (!dependencies.renderApiUrl || !dependencies.renderServiceToken) {
      console.error(JSON.stringify({ requestId, stage: 'configuration', message: 'Valuation upstream configuration missing' }));
      return finish(fail(503, 'VALUATION_UNAVAILABLE', 'Valuation is temporarily unavailable.'), 'configuration_error', { failureCategory: 'EDGE_UNAVAILABLE' });
    }
    const fetcher = dependencies.fetcher ?? fetch;
    let upstream: Response;
    const renderSignal = AbortSignal.timeout(dependencies.timeoutMs ?? 120_000);
    try {
      const renderFetchStartedAt = performance.now();
      upstream = await fetcher(dependencies.renderApiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${dependencies.renderServiceToken}`,
          'Content-Type': 'application/json',
          'X-Valuation-Request-ID': requestId,
        },
        body: JSON.stringify({
          ...valuationRequest.features,
          coverage: 0.9,
          ...(valuationRequest.asking_price === undefined ? {} : { asking_price: valuationRequest.asking_price }),
        }),
        signal: renderSignal,
      });
      timings.render_fetch_ms = elapsedMs(renderFetchStartedAt);
    } catch (error) {
      console.error(JSON.stringify({ requestId, stage: 'upstream', message: 'Valuation request failed' }));
      const timedOut = renderSignal.aborted || (error instanceof Error
        && ['AbortError', 'TimeoutError'].includes(error.name));
      return finish(
        fail(503, 'VALUATION_UNAVAILABLE', 'Valuation is temporarily unavailable.'),
        timedOut ? 'timeout' : 'upstream_error',
        { failureCategory: timedOut ? 'TIMEOUT' : 'RENDER_UNAVAILABLE' },
      );
    }
    if (!upstream.ok) {
      console.error(JSON.stringify({ requestId, stage: 'upstream', status: upstream.status }));
      return finish(fail(503, 'VALUATION_UNAVAILABLE', 'Valuation is temporarily unavailable.'), 'upstream_error', { failureCategory: 'RENDER_UNAVAILABLE' });
    }
    let upstreamBody: unknown;
    const responseParseStartedAt = performance.now();
    try {
      upstreamBody = await upstream.json();
    } catch {
      timings.render_response_parse_ms = elapsedMs(responseParseStartedAt);
      return finish(fail(502, 'INVALID_VALUATION_RESPONSE', 'The valuation service returned an invalid response.'), 'invalid_upstream_response', { failureCategory: 'INVALID_PREDICTION_SCHEMA', predictionSanity: 'failed' });
    }
    timings.render_response_parse_ms = elapsedMs(responseParseStartedAt);
    const safeResult = validateValuationResponse(upstreamBody);
    if (!safeResult) {
      const hasNumericInterval = isRecord(upstreamBody)
        && ['estimated_value', 'lower_bound', 'upper_bound', 'interval_half_width', 'interval_full_width']
          .every((key) => finiteNumber(upstreamBody[key]));
      const invalidInterval = hasNumericInterval && isRecord(upstreamBody)
        && ((upstreamBody.estimated_value as number) <= 0
          || (upstreamBody.lower_bound as number) < 0
          || (upstreamBody.lower_bound as number) > (upstreamBody.estimated_value as number)
          || (upstreamBody.estimated_value as number) > (upstreamBody.upper_bound as number)
          || (upstreamBody.interval_half_width as number) < 0
          || (upstreamBody.interval_full_width as number) < 0
          || Math.abs((upstreamBody.interval_full_width as number)
            - ((upstreamBody.upper_bound as number) - (upstreamBody.lower_bound as number))) > 0.01
          || Math.abs((upstreamBody.interval_half_width as number)
            - ((upstreamBody.upper_bound as number) - (upstreamBody.lower_bound as number)) / 2) > 0.01);
      const invalidModelVersion = isRecord(upstreamBody)
        && typeof upstreamBody.model_version === 'string'
        && !validModelVersion(upstreamBody.model_version);
      return finish(
        fail(502, 'INVALID_VALUATION_RESPONSE', 'The valuation service returned an invalid response.'),
        'invalid_upstream_response',
        {
          failureCategory: invalidModelVersion ? 'MODEL_VERSION_MISMATCH'
            : invalidInterval ? 'INVALID_INTERVAL' : 'INVALID_PREDICTION_SCHEMA',
          modelVersion: isRecord(upstreamBody) && validModelVersion(upstreamBody.model_version)
            ? upstreamBody.model_version : null,
          predictionSanity: 'failed',
        },
      );
    }
    return finish(jsonResponse({ data: safeResult, request_id: requestId }), 'success', {
      modelVersion: safeResult.model_version as string,
      predictionSanity: 'passed',
    });
  };
}
