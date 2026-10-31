const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const REQUEST_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NUMERIC_FIELDS = [
  'estimated_value', 'lower_bound', 'upper_bound', 'interval_half_width', 'interval_full_width', 'coverage_target',
] as const;

export type ValuationCanaryChecks = {
  response_schema: boolean;
  interval_ordering: boolean;
  request_id_correlation: boolean;
  expected_model_version: boolean;
  model_version: string | null;
  request_id: string | null;
};

export function validateValuationCanaryResponse(
  body: unknown,
  expectedModelVersion: string,
  headerRequestId: string | null,
): ValuationCanaryChecks {
  const record = typeof body === 'object' && body !== null && !Array.isArray(body)
    ? body as Record<string, unknown> : null;
  const data = record?.data && typeof record.data === 'object' && !Array.isArray(record.data)
    ? record.data as Record<string, unknown> : null;
  if (!data) return {
    response_schema: false, interval_ordering: false, request_id_correlation: false,
    expected_model_version: false, model_version: null, request_id: null,
  };
  const schema = NUMERIC_FIELDS.every((key) => typeof data[key] === 'number' && Number.isFinite(data[key]))
    && typeof data.model_version === 'string' && VERSION_PATTERN.test(data.model_version)
    && typeof data.uncertainty_method === 'string' && data.uncertainty_method.trim().length > 0
    && typeof data.uncertainty_group === 'string' && data.uncertainty_group.trim().length > 0
    && Number.isInteger(data.uncertainty_support) && Number(data.uncertainty_support) >= 0
    && typeof data.used_global_fallback === 'boolean'
    && (data.price_position === null || [
      'below_estimated_market_range', 'within_estimated_market_range', 'above_estimated_market_range',
    ].includes(String(data.price_position)))
    && [0.8, 0.9, 0.95].includes(Number(data.coverage_target));
  const lower = Number(data.lower_bound);
  const estimate = Number(data.estimated_value);
  const upper = Number(data.upper_bound);
  const intervalValid = schema && estimate > 0 && lower >= 0 && lower <= estimate && estimate <= upper
    && Number(data.interval_half_width) >= 0 && Number(data.interval_full_width) >= 0
    && Math.abs(Number(data.interval_full_width) - (upper - lower)) <= 0.01
    && Math.abs(Number(data.interval_half_width) - (upper - lower) / 2) <= 0.01;
  const responseRequestId = record.request_id;
  const requestIdValid = typeof responseRequestId === 'string' && REQUEST_ID_PATTERN.test(responseRequestId)
    && headerRequestId === responseRequestId;
  return {
    response_schema: schema,
    interval_ordering: intervalValid,
    request_id_correlation: requestIdValid,
    expected_model_version: schema && data.model_version === expectedModelVersion,
    model_version: schema ? data.model_version as string : null,
    request_id: requestIdValid ? responseRequestId as string : null,
  };
}

export function isCanaryRequestId(value: unknown): value is string {
  return typeof value === 'string' && REQUEST_ID_PATTERN.test(value);
}

export function isCanaryModelVersion(value: unknown): value is string {
  return typeof value === 'string' && VERSION_PATTERN.test(value);
}
