export type ValuationRangeInput = {
  lowerBound: number;
  upperBound: number;
  estimatedValue: number;
  askingPrice: number;
};

export type ValuationRangeLayout = ValuationRangeInput & {
  domainMin: number;
  domainMax: number;
  displayDomainMin: number;
  displayDomainMax: number;
  scaleMode: 'linear' | 'compressed';
  askingBeyondScale: 'below' | 'above' | null;
  lowerPosition: number;
  upperPosition: number;
  estimatePosition: number;
  askingPosition: number;
  lowerAnchorLane: 0 | 1 | 2;
  estimateAnchorLane: 0 | 1 | 2;
  upperAnchorLane: 0 | 1 | 2;
  lowerAnchorAlignment: 'start' | 'center' | 'end';
  estimateAnchorAlignment: 'start' | 'center' | 'end';
  upperAnchorAlignment: 'start' | 'center' | 'end';
  askingLabelAlignment: 'start' | 'center' | 'end';
};

const isFinitePositive = (value: number) => Number.isFinite(value) && value > 0;
const OUTLIER_RANGE_WIDTH_THRESHOLD = 0.18;
const ANCHOR_MIN_GAP_PERCENT = 24;

const getAnchorAlignment = (position: number): 'start' | 'center' | 'end' => {
  if (position < 22) return 'start';
  if (position > 78) return 'end';
  return 'center';
};

const getAnchorLanes = (positions: number[]): [0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2] => {
  const lanes: number[][] = [[], [], []];
  return positions.map((position) => {
    const lane = lanes.findIndex((items) => items.every((other) => Math.abs(position - other) >= ANCHOR_MIN_GAP_PERCENT));
    const resolvedLane = lane === -1 ? 2 : lane;
    lanes[resolvedLane].push(position);
    return resolvedLane as 0 | 1 | 2;
  }) as [0 | 1 | 2, 0 | 1 | 2, 0 | 1 | 2];
};

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

  const rangeWidth = upperBound - lowerBound;
  const askingDirection = askingPrice < lowerBound ? 'below' : askingPrice > upperBound ? 'above' : null;
  const scaleMode = rangeWidth > 0
    && askingDirection !== null
    && rangeWidth / domainSpan < OUTLIER_RANGE_WIDTH_THRESHOLD
    ? 'compressed'
    : 'linear';

  let displayDomainMin: number;
  let displayDomainMax: number;
  let askingBeyondScale: 'below' | 'above' | null = null;
  let mapValue: (value: number) => number;

  if (scaleMode === 'compressed') {
    const scaleUnit = Math.max(rangeWidth / 2, 1000);
    const tailLimit = rangeWidth * 3;
    const transform = (value: number) => {
      if (value < lowerBound) {
        const distance = lowerBound - value;
        const transformedDistance = scaleUnit * Math.log1p(distance / scaleUnit);
        if (transformedDistance > tailLimit) askingBeyondScale = 'below';
        return lowerBound - Math.min(transformedDistance, tailLimit);
      }
      if (value > upperBound) {
        const distance = value - upperBound;
        const transformedDistance = scaleUnit * Math.log1p(distance / scaleUnit);
        if (transformedDistance > tailLimit) askingBeyondScale = 'above';
        return upperBound + Math.min(transformedDistance, tailLimit);
      }
      return value;
    };

    const transformedValues = values.map(transform);
    const transformedMin = Math.min(...transformedValues);
    const transformedMax = Math.max(...transformedValues);
    const transformedSpan = transformedMax - transformedMin;
    if (askingBeyondScale === 'below') {
      displayDomainMin = lowerBound - tailLimit;
      displayDomainMax = upperBound + rangeWidth * 0.12;
    } else if (askingBeyondScale === 'above') {
      displayDomainMin = lowerBound - rangeWidth * 0.12;
      displayDomainMax = upperBound + tailLimit;
    } else {
      const transformedPadding = transformedSpan * 0.12;
      displayDomainMin = transformedMin - transformedPadding;
      displayDomainMax = transformedMax + transformedPadding;
    }
    if (!Number.isFinite(displayDomainMin) || !Number.isFinite(displayDomainMax) || displayDomainMax <= displayDomainMin) return null;
    mapValue = transform;
  } else {
    displayDomainMin = domainMin;
    displayDomainMax = domainMax;
    mapValue = (value) => value;
  }

  const displaySpan = displayDomainMax - displayDomainMin;
  if (!Number.isFinite(displaySpan) || displaySpan <= 0) return null;
  const position = (value: number) => ((mapValue(value) - displayDomainMin) / displaySpan) * 100;
  const lowerPosition = position(lowerBound);
  const estimatePosition = position(estimatedValue);
  const upperPosition = position(upperBound);
  const askingPosition = position(askingPrice);
  const [lowerAnchorLane, estimateAnchorLane, upperAnchorLane] = getAnchorLanes([lowerPosition, estimatePosition, upperPosition]);

  if ([lowerPosition, estimatePosition, upperPosition, askingPosition].some((point) => !Number.isFinite(point) || point < 0 || point > 100)) return null;

  return {
    ...input,
    domainMin,
    domainMax,
    displayDomainMin,
    displayDomainMax,
    scaleMode,
    askingBeyondScale,
    lowerPosition,
    upperPosition,
    estimatePosition,
    askingPosition,
    lowerAnchorLane,
    estimateAnchorLane,
    upperAnchorLane,
    lowerAnchorAlignment: getAnchorAlignment(lowerPosition),
    estimateAnchorAlignment: getAnchorAlignment(estimatePosition),
    upperAnchorAlignment: getAnchorAlignment(upperPosition),
    askingLabelAlignment: getAnchorAlignment(askingPosition),
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
