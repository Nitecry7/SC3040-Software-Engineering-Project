export type ValuationRangeInput = {
  lowerBound: number;
  upperBound: number;
  estimatedValue: number;
  askingPrice: number;
};

export type ValuationRangeLayout = ValuationRangeInput & {
  domainMin: number;
  domainMax: number;
  lowerPosition: number;
  upperPosition: number;
  estimatePosition: number;
  askingPosition: number;
};

const isFinitePositive = (value: number) => Number.isFinite(value) && value > 0;

export const getValuationRangeLayout = (
  input: ValuationRangeInput,
): ValuationRangeLayout | null => {
  const { lowerBound, upperBound, estimatedValue, askingPrice } = input;
  if (
    !isFinitePositive(lowerBound) ||
    !isFinitePositive(upperBound) ||
    !isFinitePositive(estimatedValue) ||
    !isFinitePositive(askingPrice) ||
    lowerBound > upperBound ||
    estimatedValue < lowerBound ||
    estimatedValue > upperBound
  ) {
    return null;
  }

  const values = [lowerBound, upperBound, estimatedValue, askingPrice];
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueSpan = maxValue - minValue;
  const padding = valueSpan > 0 ? valueSpan * 0.12 : Math.max(maxValue * 0.05, 1000);
  const domainMin = Math.max(0, minValue - padding);
  const domainMax = maxValue + padding;
  const domainSpan = domainMax - domainMin;
  if (!Number.isFinite(domainSpan) || domainSpan <= 0) return null;

  const position = (value: number) => ((value - domainMin) / domainSpan) * 100;
  return {
    ...input,
    domainMin,
    domainMax,
    lowerPosition: position(lowerBound),
    upperPosition: position(upperBound),
    estimatePosition: position(estimatedValue),
    askingPosition: position(askingPrice),
  };
};

export const formatSingaporeDollars = (value: number) => {
  if (!Number.isFinite(value)) return 'Unavailable';
  const formatted = new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: 0,
  }).formatToParts(value).map((part) => part.type === 'currency' ? 'S$' : part.value).join('');
  return formatted;
};
