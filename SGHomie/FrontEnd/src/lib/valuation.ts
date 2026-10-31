import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';
import { functionsSupabase, supabase } from './supabase';

export type ValuationPricePosition =
  | 'below_estimated_market_range'
  | 'within_estimated_market_range'
  | 'above_estimated_market_range';

export type PropertyValuation = {
  estimated_value: number;
  lower_bound: number;
  upper_bound: number;
  interval_half_width: number;
  interval_full_width: number;
  coverage_target: number;
  model_version: string;
  uncertainty_method: string;
  uncertainty_group: string;
  uncertainty_support: number;
  used_global_fallback: boolean;
  price_position: ValuationPricePosition;
};

export type PropertyValuationErrorCategory =
  | 'authentication'
  | 'network'
  | 'valuation_unavailable'
  | 'property_not_found'
  | 'malformed_response'
  | 'function_error';

export class PropertyValuationError extends Error {
  constructor(readonly category: PropertyValuationErrorCategory) {
    super(getValuationErrorMessage(category));
    this.name = 'PropertyValuationError';
  }
}

type ValuationFunctionResponse = {
  data: PropertyValuation;
  request_id: string;
};

const PRICE_POSITIONS = new Set<ValuationPricePosition>([
  'below_estimated_market_range',
  'within_estimated_market_range',
  'above_estimated_market_range',
]);
const SUPPORTED_COVERAGE = new Set([0.8, 0.9, 0.95]);

export function getPricePositionLabel(position: ValuationPricePosition): string {
  switch (position) {
    case 'below_estimated_market_range':
      return 'Asking price is below the estimated market range';
    case 'within_estimated_market_range':
      return 'Asking price is within the estimated market range';
    case 'above_estimated_market_range':
      return 'Asking price is above the estimated market range';
  }
}

export function getValuationErrorMessage(category: PropertyValuationErrorCategory): string {
  switch (category) {
    case 'authentication':
      return 'Please sign in again to request a valuation.';
    case 'valuation_unavailable':
      return 'A model estimate is not available for this property right now.';
    case 'property_not_found':
      return 'This property is not currently available for valuation.';
    case 'network':
      return 'We could not connect to the valuation service. Please try again.';
    case 'malformed_response':
      return 'The valuation service returned an unreadable response. Please try again.';
    case 'function_error':
      return 'Valuation could not be completed. Please try again.';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPropertyValuation(value: unknown): value is PropertyValuation {
  if (!isRecord(value)) return false;

  const intervalWidth = isFiniteNumber(value.lower_bound) && isFiniteNumber(value.upper_bound)
    ? value.upper_bound - value.lower_bound
    : Number.NaN;

  return isFiniteNumber(value.estimated_value)
    && value.estimated_value > 0
    && isFiniteNumber(value.lower_bound)
    && value.lower_bound >= 0
    && isFiniteNumber(value.upper_bound)
    && value.upper_bound >= value.lower_bound
    && value.estimated_value >= value.lower_bound
    && value.estimated_value <= value.upper_bound
    && isFiniteNumber(value.interval_half_width)
    && value.interval_half_width >= 0
    && Math.abs(value.interval_half_width - intervalWidth / 2) <= 0.01
    && isFiniteNumber(value.interval_full_width)
    && value.interval_full_width >= 0
    && Math.abs(value.interval_full_width - intervalWidth) <= 0.01
    && isFiniteNumber(value.coverage_target)
    && SUPPORTED_COVERAGE.has(value.coverage_target)
    && typeof value.model_version === 'string'
    && value.model_version.trim().length > 0
    && typeof value.uncertainty_method === 'string'
    && value.uncertainty_method.trim().length > 0
    && typeof value.uncertainty_group === 'string'
    && value.uncertainty_group.trim().length > 0
    && typeof value.uncertainty_support === 'number'
    && Number.isInteger(value.uncertainty_support)
    && value.uncertainty_support >= 0
    && typeof value.used_global_fallback === 'boolean'
    && typeof value.price_position === 'string'
    && PRICE_POSITIONS.has(value.price_position as ValuationPricePosition);
}

async function getFunctionErrorCategory(error: unknown): Promise<PropertyValuationErrorCategory> {
  if (error instanceof FunctionsFetchError || error instanceof FunctionsRelayError) {
    return 'network';
  }

  if (!(error instanceof FunctionsHttpError)) return 'function_error';

  const response = (error as FunctionsHttpError & { context?: Response }).context;
  if (response?.status === 401) return 'authentication';

  if (response) {
    try {
      const body: unknown = await response.clone().json();
      if (isRecord(body) && isRecord(body.error) && typeof body.error.code === 'string') {
        if (body.error.code === 'VALUATION_UNAVAILABLE') return 'valuation_unavailable';
        if (body.error.code === 'PROPERTY_NOT_FOUND') return 'property_not_found';
        if (body.error.code === 'UNAUTHORIZED') return 'authentication';
      }
    } catch {
      // An unrecognized HTTP response stays a generic function failure.
    }
  }

  return 'function_error';
}

export async function getPropertyValuation(propertyId: string): Promise<PropertyValuation> {
  if (typeof propertyId !== 'string' || propertyId.trim().length === 0) {
    throw new PropertyValuationError('function_error');
  }

  let sessionData;
  try {
    const result = await supabase.auth.getSession();
    sessionData = result.data;
    if (result.error) throw new PropertyValuationError('authentication');
  } catch {
    throw new PropertyValuationError('authentication');
  }

  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new PropertyValuationError('authentication');

  let invocation: Awaited<ReturnType<typeof functionsSupabase.functions.invoke<ValuationFunctionResponse>>>;
  try {
    functionsSupabase.functions.setAuth(accessToken);
    invocation = await functionsSupabase.functions.invoke<ValuationFunctionResponse>('valuation', {
      body: { property_id: propertyId },
    });
  } catch (error) {
    const category = error instanceof FunctionsFetchError
      || error instanceof FunctionsRelayError
      || error instanceof TypeError
      ? 'network'
      : 'function_error';
    throw new PropertyValuationError(category);
  }

  const { data, error } = invocation;

  if (error) throw new PropertyValuationError(await getFunctionErrorCategory(error));

  if (!isRecord(data) || typeof data.request_id !== 'string' || !isPropertyValuation(data.data)) {
    throw new PropertyValuationError('malformed_response');
  }

  return data.data;
}
